import { useCallback, useEffect, useRef, useState } from 'react';

export type OutputLine = {
  type: 'stdout' | 'stderr' | 'system';
  text: string;
};

export type PyodideStatus = 'idle' | 'loading' | 'ready' | 'running' | 'done';

const EXECUTION_TIMEOUT_MS = 120_000;
const EXECUTION_TIMEOUT_MESSAGE =
  `\nExecution stopped after ${EXECUTION_TIMEOUT_MS / 1000} seconds. Your code is likely stuck in a loop.\n`;

type WorkerMessage =
  | { type: 'stdout'; text: string }
  | { type: 'stderr'; text: string }
  | { type: 'outputLimit' }
  | { type: 'inputRequest'; prompt: string }
  | { type: 'status'; status: 'loading' | 'ready' | 'running' | 'done' }
  | { type: 'result'; success: boolean; error?: string };

export function usePyodide() {
  const workerRef = useRef<Worker | null>(null);
  const executionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [output, setOutput] = useState<OutputLine[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [status, setStatus] = useState<PyodideStatus>('idle');
  const [inputPrompt, setInputPrompt] = useState<string | null>(null);

  const clearExecutionTimeout = useCallback(() => {
    if (executionTimeoutRef.current) {
      clearTimeout(executionTimeoutRef.current);
      executionTimeoutRef.current = null;
    }
  }, []);

  const scheduleExecutionTimeout = useCallback((onTimeout: () => void) => {
    clearExecutionTimeout();
    executionTimeoutRef.current = setTimeout(onTimeout, EXECUTION_TIMEOUT_MS);
  }, [clearExecutionTimeout]);

  const restartWorker = useCallback((message?: string) => {
    clearExecutionTimeout();
    workerRef.current?.terminate();

    if (message) {
      setOutput((prev) => [...prev, { type: 'stderr', text: message }]);
    }

    setInputPrompt(null);
    setIsRunning(false);
    setStatus('idle');

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
          clearExecutionTimeout();
          setInputPrompt(msg.prompt);
          break;
        case 'outputLimit':
          restartWorker();
          break;
        case 'status':
          if (msg.status === 'loading') setStatus('loading');
          else if (msg.status === 'ready') setStatus('ready');
          else if (msg.status === 'running') {
            scheduleExecutionTimeout(() => {
              restartWorker(EXECUTION_TIMEOUT_MESSAGE);
            });
            setStatus('running');
            setIsRunning(true);
          }
          else if (msg.status === 'done') {
            clearExecutionTimeout();
            setStatus('done');
            setIsRunning(false);
          }
          break;
        case 'result':
          break;
      }
    };

    worker.onerror = (err) => {
      clearExecutionTimeout();
      console.error('Pyodide worker error:', err);
      setOutput((prev) => [...prev, { type: 'stderr', text: `Worker error: ${err.message}` }]);
      setIsRunning(false);
    };

    workerRef.current = worker;
  }, [clearExecutionTimeout, scheduleExecutionTimeout]);

  const spawnWorker = useCallback(() => {
    restartWorker();
  }, [restartWorker]);

  useEffect(() => {
    spawnWorker();
    return () => {
      clearExecutionTimeout();
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, [spawnWorker, clearExecutionTimeout]);

  const runCode = useCallback(
    (files: Array<{ name: string; content: string }>, entryFile: string, authToken?: string) => {
      if (!workerRef.current) {
        setOutput(prev => [...prev, { type: 'stderr', text: 'Python runtime is not ready. Please wait or refresh the page.\n' }]);
        return;
      }
      setOutput([]);
      setInputPrompt(null);
      setIsRunning(true);
      workerRef.current.postMessage({ type: 'run', files, entryFile, authToken });
    },
    []
  );

  const stopCode = useCallback(() => {
    restartWorker('\nExecution stopped.\n');
  }, [restartWorker]);

  const submitInput = useCallback((value: string) => {
    if (!workerRef.current) return;
    setInputPrompt(null);
    scheduleExecutionTimeout(() => {
      restartWorker(EXECUTION_TIMEOUT_MESSAGE);
    });
    setOutput((prev) => [...prev, { type: 'stdout', text: value + '\n' }]);
    workerRef.current.postMessage({ type: 'inputResponse', value });
  }, [restartWorker, scheduleExecutionTimeout]);

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
