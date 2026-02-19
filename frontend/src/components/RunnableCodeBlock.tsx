import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { usePyodide } from '../hooks/usePyodide';
import { Play, Square, Loader2, GripHorizontal } from 'lucide-react';

const MIN_HEIGHT = 60;
const DEFAULT_HEIGHT = 120;
const MAX_HEIGHT = 400;

export function RunnableCodeBlock({ code }: { code: string }) {
  const { runCode, stopCode, output, isRunning, status, inputPrompt, submitInput } = usePyodide();
  const [inputValue, setInputValue] = useState('');
  const [hasRun, setHasRun] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);
  const [outputHeight, setOutputHeight] = useState(DEFAULT_HEIGHT);
  const dragging = useRef(false);
  const dragStartY = useRef(0);
  const dragStartH = useRef(0);

  // Stop execution on unmount (user collapsed Part B while running)
  const stopRef = useRef(stopCode);
  stopRef.current = stopCode;
  const runningRef = useRef(isRunning);
  runningRef.current = isRunning;
  useEffect(() => () => { if (runningRef.current) stopRef.current(); }, []);

  // Auto-scroll output
  useEffect(() => {
    outputRef.current?.scrollTo({ top: outputRef.current.scrollHeight });
  }, [output, inputPrompt]);

  const handleRun = useCallback(() => {
    setHasRun(true);
    runCode([{ name: 'snippet.py', content: code }], 'snippet.py');
  }, [runCode, code]);

  const handleInputSubmit = useCallback(() => {
    submitInput(inputValue);
    setInputValue('');
  }, [submitInput, inputValue]);

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') { e.preventDefault(); handleInputSubmit(); }
    },
    [handleInputSubmit]
  );

  // Drag-to-resize handlers
  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    dragStartY.current = e.clientY;
    dragStartH.current = outputHeight;

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const delta = ev.clientY - dragStartY.current;
      setOutputHeight(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, dragStartH.current + delta)));
    };
    const onUp = () => {
      dragging.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [outputHeight]);

  const pyodideLoading = status === 'loading' || status === 'idle';

  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden mb-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50 border-b border-gray-200">
        <span className="text-xs font-medium text-gray-500">Python</span>
        {isRunning ? (
          <button onClick={stopCode} className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors">
            <Square className="w-3 h-3" /> Stop
          </button>
        ) : (
          <button onClick={handleRun} disabled={pyodideLoading && hasRun} className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {pyodideLoading && hasRun ? <><Loader2 className="w-3 h-3 animate-spin" /> Loading...</> : <><Play className="w-3 h-3" /> Run</>}
          </button>
        )}
      </div>

      {/* Syntax-highlighted code */}
      <SyntaxHighlighter
        language="python"
        style={oneLight}
        customStyle={{ margin: 0, padding: '1rem', fontSize: '0.8125rem', lineHeight: '1.6', background: '#f9fafb', borderRadius: 0 }}
      >
        {code}
      </SyntaxHighlighter>

      {/* Output area */}
      {hasRun && (
        <>
          <div
            ref={outputRef}
            className="border-t border-gray-200 bg-gray-900 px-4 py-3 overflow-y-auto font-mono text-sm"
            style={{ height: outputHeight }}
          >
            {pyodideLoading && output.length === 0 && (
              <div className="flex items-center gap-2 text-gray-400 text-xs">
                <Loader2 className="w-3 h-3 animate-spin" /> Loading Python runtime...
              </div>
            )}
            {output.map((line, i) => (
              <div key={i} className={line.type === 'stderr' ? 'text-red-400' : 'text-gray-100'} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {line.text}
              </div>
            ))}
            {inputPrompt !== null && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-gray-300 text-xs">{inputPrompt}</span>
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleInputKeyDown}
                  autoFocus
                  className="flex-1 bg-gray-800 text-gray-100 text-sm px-2 py-0.5 rounded border border-gray-600 outline-none focus:border-emerald-500"
                />
                <button onClick={handleInputSubmit} className="text-xs px-2 py-0.5 rounded bg-emerald-600 text-white hover:bg-emerald-700">
                  Enter
                </button>
              </div>
            )}
          </div>
          {/* Resize handle */}
          <div
            onMouseDown={onDragStart}
            className="h-2 bg-gray-800 flex items-center justify-center cursor-ns-resize hover:bg-gray-700 transition-colors"
          >
            <GripHorizontal className="w-4 h-3 text-gray-500" />
          </div>
        </>
      )}
    </div>
  );
}
