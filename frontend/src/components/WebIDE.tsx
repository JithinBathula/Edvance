import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from './ui/button';
import { Play, RotateCcw, Loader2, Trash2, Terminal } from 'lucide-react';
import Editor from "@monaco-editor/react";

type Props = {
  initialCode?: string;
  onCodeChange?: (code: string) => void;
  readOnly?: boolean;
  language?: string;
};


export function WebIDE({
  initialCode = "",
  onCodeChange,
  readOnly = false,
  language = "python", // we still simulate python
}: Props) {
  const [code, setCode] = useState(initialCode);
  const [output, setOutput] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isRuntimeLoading, setIsRuntimeLoading] = useState(false);

  // Refs for Python runtime (Pyodide)
  const pyodideRef = useRef<any>(null);
  const pyodideLoaderRef = useRef<Promise<any> | null>(null);
  const pythonRunnerRef = useRef<any>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setCode(initialCode);
  }, [initialCode]);

  const handleChange = useCallback(
    (value?: string) => {
      const newCode = value ?? "";
      setCode(newCode);
      onCodeChange?.(newCode);
    },
    [onCodeChange]
  );

  // --- Python Runtime Logic
  const ensurePyodide = useCallback(async () => {
    if (pyodideRef.current) {
      return pyodideRef.current;
    }

    if (pyodideLoaderRef.current) {
      return pyodideLoaderRef.current;
    }

    const loadRuntimeScript = async () => {
      // Check both window and globalThis for loadPyodide
      const checkForLoader = () => {
        const win = window as typeof window & { loadPyodide?: (options: { indexURL: string }) => Promise<any> };
        const global = globalThis as typeof globalThis & { loadPyodide?: (options: { indexURL: string }) => Promise<any> };
        return win.loadPyodide || global.loadPyodide;
      };

      if (checkForLoader()) {
        return;
      }

      await new Promise<void>((resolve, reject) => {
        const existingScript = document.querySelector<HTMLScriptElement>(
          'script[data-pyodide="true"]',
        );

        if (existingScript?.getAttribute("data-loaded") === "true") {
          resolve();
          return;
        }

        const script = existingScript ?? document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/pyodide/v0.29.0/full/pyodide.js";
        script.async = true;
        script.setAttribute("data-pyodide", "true");
        script.onload = () => {
          script.setAttribute("data-loaded", "true");
          resolve();
        };
        script.onerror = () => reject(new Error("Failed to load the Python runtime script."));

        if (!existingScript) {
          document.body.appendChild(script);
        }
      });

      // Poll for loadPyodide to be available (script may need time to register)
      const MAX_ATTEMPTS = 100;
      const POLL_INTERVAL = 50;
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const loader = checkForLoader();
        if (typeof loader === "function") {
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
      }

      throw new Error("Python runtime failed to initialize after loading script.");
    };

    pyodideLoaderRef.current = (async () => {
      await loadRuntimeScript();

      // Get the loader function from window or globalThis
      const win = window as typeof window & { loadPyodide?: (options: { indexURL: string }) => Promise<any> };
      const global = globalThis as typeof globalThis & { loadPyodide?: (options: { indexURL: string }) => Promise<any> };
      const loader = win.loadPyodide || global.loadPyodide;

      if (!loader || typeof loader !== "function") {
        throw new Error("loadPyodide function not found after script load.");
      }

      const pyodide = await loader({
        indexURL: "https://cdn.jsdelivr.net/pyodide/v0.29.0/full/",
      });

      pyodideRef.current = pyodide;
      return pyodide;
    })();

    try {
      return await pyodideLoaderRef.current;
    } catch (error) {
      pyodideLoaderRef.current = null;
      throw error;
    }
  }, []);

  const ensureRunner = useCallback(async () => {
    const pyodide = await ensurePyodide();
    if (pythonRunnerRef.current) {
      return pythonRunnerRef.current;
    }

    pythonRunnerRef.current = pyodide.runPython(`
import sys
import io
import traceback

def run_user_code(source):
    stdout_buffer = io.StringIO()
    stderr_buffer = io.StringIO()
    globals_ctx = {}
    original_stdout = sys.stdout
    original_stderr = sys.stderr
    try:
        sys.stdout = stdout_buffer
        sys.stderr = stderr_buffer
        exec(source, globals_ctx)
    except Exception:
        traceback.print_exc(file=stderr_buffer)
    finally:
        sys.stdout = original_stdout
        sys.stderr = original_stderr
    return stdout_buffer.getvalue(), stderr_buffer.getvalue()

run_user_code
    `);

    return pythonRunnerRef.current;
  }, [ensurePyodide]);

  const runCode = useCallback(async () => {
    setIsRunning(true);
    setOutput(["Loading Python runtime..."]);
    try {
      setIsRuntimeLoading(true);
      const runner = await ensureRunner();
      setOutput(["Running..."]);

      const result = runner(code);
      const jsResult = result.toJs({ create_proxies: false }) as [
        string,
        string,
      ];
      const [stdout, stderr] = jsResult;

      if (typeof result.destroy === "function") {
        result.destroy();
      }

      if (stderr && stderr.trim().length > 0) {
        setOutput(
          stderr
            .replace(/\r\n/g, "\n")
            .split("\n")
            .filter((line) => line.trim().length > 0),
        );
      } else if (stdout && stdout.trim().length > 0) {
        setOutput(
          stdout
            .replace(/\r\n/g, "\n")
            .split("\n")
            .filter((line) => line.length > 0),
        );
      } else {
        setOutput(["Code executed successfully (no output)"]);
      }
    } catch (e) {
      setOutput([`Runtime error: ${String(e)}`]);
    } finally {
      setIsRuntimeLoading(false);
      setIsRunning(false);
    }
  }, [code, ensureRunner]);

  const clearOutput = () => {
    setOutput([]);
  };

  useEffect(() => {
    return () => {
      if (
        pythonRunnerRef.current &&
        typeof pythonRunnerRef.current.destroy === "function"
      ) {
        pythonRunnerRef.current.destroy();
        pythonRunnerRef.current = null;
      }
      pyodideRef.current = null;
      pyodideLoaderRef.current = null;
    };
  }, []);

  return (
    <div className="h-full w-full flex flex-col overflow-hidden bg-white">
      {/* Header */}
      <div className="flex-shrink-0 bg-white px-4 py-2 flex items-center justify-between border-b border-gray-200">
        {/* File Tab - Matching Google AI style */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-md border border-gray-200 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-green-500"></span>
          <span className="text-sm font-medium text-gray-800">
            main.py
          </span>
        </div>
        <div className="flex items-center gap-4 flex-shrink-0">
          <button
            onClick={() => setCode(initialCode)}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
          <button
            onClick={runCode}
            disabled={isRunning || isRuntimeLoading || readOnly}
            className="h-8 px-4 rounded-md font-medium text-sm flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            style={{ backgroundColor: '#22c55e', color: 'white' }}
          >
            {isRunning || isRuntimeLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {isRuntimeLoading ? "Loading" : "Running"}
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                Run
              </>
            )}
          </button>
        </div>
      </div>

      {/* Editor - Takes 55% of remaining space */}
      <div className="flex-1 min-h-0" style={{ flex: '1 1 55%' }}>
        <Editor
          height="100%"
          theme="vs-light"
          language={language}
          value={code}
          onChange={handleChange}
          options={{
            readOnly,
            fontSize: 14,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 4,
            wordWrap: "bounded",
            wrappingStrategy: "advanced",
            lineNumbers: "on",
            renderLineHighlight: "line",
            padding: { top: 8, bottom: 8 },
            scrollbar: {
              horizontalScrollbarSize: 6,
              verticalScrollbarSize: 6,
            },
          }}
        />
      </div>

      {/* Output Panel - Takes 45% of remaining space */}
      <div
        className="flex-shrink-0 border-t border-gray-300 bg-white flex flex-col"
        style={{ flex: '0 0 45%', minHeight: '200px', maxHeight: '400px' }}
      >
        <div className="flex-shrink-0 px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-semibold text-gray-700 tracking-wide">
              OUTPUT
            </span>
          </div>
          <button
            onClick={clearOutput}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            title="Clear output"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 p-4 overflow-auto font-mono text-sm leading-6 bg-white">
          {output.length === 0 ? (
            <div className="text-gray-400">
              Run your code to see output here...
            </div>
          ) : (
            output.map((l, i) => (
              <div key={i} className="text-gray-800">
                {l}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}