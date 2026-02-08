import { useCallback, useEffect, useRef, useState } from 'react';

export type OutputLine = {
  type: 'stdout' | 'stderr' | 'system';
  text: string;
};

export type PyodideStatus = 'idle' | 'loading' | 'ready' | 'running' | 'done';

type WorkerMessage =
  | { type: 'stdout'; text: string }
  | { type: 'stderr'; text: string }
  | { type: 'inputRequest'; prompt: string }
  | { type: 'status'; status: 'loading' | 'ready' | 'running' | 'done' }
  | { type: 'result'; success: boolean; error?: string };

export function usePyodide() {
  const workerRef = useRef<Worker | null>(null);
  const [output, setOutput] = useState<OutputLine[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [status, setStatus] = useState<PyodideStatus>('idle');
  const [inputPrompt, setInputPrompt] = useState<string | null>(null);

  const spawnWorker = useCallback(() => {
    workerRef.current?.terminate();

    const worker = new Worker(
      new URL('../workers/pyodide.worker.ts', import.meta.url),
      { type: 'module' }
    );

    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const msg = event.data;
      switch (msg.type) {
        case 'stdout':
          setOutput((prev) => [...prev, { type: 'stdout', text: msg.text }]);
          break;
        case 'stderr':
          setOutput((prev) => [...prev, { type: 'stderr', text: msg.text }]);
          break;
        case 'inputRequest':
          setInputPrompt(msg.prompt);
          break;
        case 'status':
          if (msg.status === 'loading') setStatus('loading');
          else if (msg.status === 'ready') setStatus('ready');
          else if (msg.status === 'running') { setStatus('running'); setIsRunning(true); }
          else if (msg.status === 'done') { setStatus('done'); setIsRunning(false); }
          break;
        case 'result':
          break;
      }
    };

    worker.onerror = (err) => {
      console.error('Pyodide worker error:', err);
      setOutput((prev) => [...prev, { type: 'stderr', text: `Worker error: ${err.message}` }]);
      setIsRunning(false);
    };

    workerRef.current = worker;
  }, []);

  useEffect(() => {
    spawnWorker();
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, [spawnWorker]);

  const runCode = useCallback(
    (files: Array<{ name: string; content: string }>, entryFile: string) => {
      if (!workerRef.current) return;
      setOutput([]);
      setInputPrompt(null);
      setIsRunning(true);
      workerRef.current.postMessage({ type: 'run', files, entryFile });
    },
    []
  );

  const stopCode = useCallback(() => {
    setOutput((prev) => [...prev, { type: 'stderr', text: '\nExecution stopped.\n' }]);
    setIsRunning(false);
    setStatus('idle');
    setInputPrompt(null);
    spawnWorker();
  }, [spawnWorker]);

  const submitInput = useCallback((value: string) => {
    if (!workerRef.current) return;
    setInputPrompt(null);
    setOutput((prev) => [...prev, { type: 'stdout', text: value + '\n' }]);
    workerRef.current.postMessage({ type: 'inputResponse', value });
  }, []);

  const clearOutput = useCallback(() => {
    setOutput([]);
  }, []);

  return {
    runCode,
    stopCode,
    output,
    isRunning,
    status,
    clearOutput,
    inputPrompt,
    submitInput,
  };
}
