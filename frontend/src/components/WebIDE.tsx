import { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import { Play, RotateCcw, Loader2, Save } from 'lucide-react';

type Props = {
  initialCode?: string;
  onCodeChange?: (code: string) => void;
  onSave?: (code: string) => void;
  readOnly?: boolean;
  saving?: boolean;
};

export function WebIDE({ initialCode = '', onCodeChange, onSave, readOnly = false, saving = false }: Props) {
  const [code, setCode] = useState(initialCode);
  const [output, setOutput] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setCode(initialCode);
  }, [initialCode]);

  const handleCodeChange = (newCode: string) => {
    setCode(newCode);
    if (onCodeChange) {
      onCodeChange(newCode);
    }
  };

  const runCode = async () => {
    setIsRunning(true);
    setOutput(['Running...']);

    try {
      // Simulate Python execution (in a real app, you'd use a backend Python executor)
      // For this prototype, we'll do basic simulation
      await new Promise(resolve => setTimeout(resolve, 500));

      const lines = code.split('\n');
      const results: string[] = [];
      const variables: Record<string, any> = {};

      // Parse and execute code line by line
      for (const line of lines) {
        const trimmed = line.trim();

        // Skip comments and empty lines
        if (!trimmed || trimmed.startsWith('#')) continue;

        // Handle variable assignments
        const assignMatch = trimmed.match(/^(\w+)\s*=\s*(.+)$/);
        if (assignMatch) {
          const [, varName, value] = assignMatch;
          try {
            // Evaluate the value
            if (value.match(/^['"].*['"]$/)) {
              // String
              variables[varName] = value.replace(/^['"]|['"]$/g, '');
            } else if (!isNaN(Number(value))) {
              // Number
              variables[varName] = Number(value);
            } else if (value === 'True') {
              variables[varName] = true;
            } else if (value === 'False') {
              variables[varName] = false;
            } else {
              // Expression or variable reference
              variables[varName] = value;
            }
          } catch (e) {
            variables[varName] = value;
          }
          continue;
        }

        // Handle print statements
        if (trimmed.startsWith('print(')) {
          const match = trimmed.match(/print\((.*?)\)/);
          if (match) {
            const content = match[1];
            try {
              // Check if it's a variable
              if (variables.hasOwnProperty(content)) {
                results.push(String(variables[content]));
              } else if (content.match(/^['"].*['"]$/)) {
                // String literal
                results.push(content.replace(/^['"]|['"]$/g, ''));
              } else if (!isNaN(Number(content))) {
                // Number literal
                results.push(content);
              } else {
                // Try to evaluate as expression
                results.push(content);
              }
            } catch (e) {
              results.push(content);
            }
          }
        }
      }

      if (results.length === 0) {
        results.push('Code executed successfully (no output)');
      }

      setOutput(results);
    } catch (error) {
      setOutput([`Error: ${error}`]);
    } finally {
      setIsRunning(false);
    }
  };

  const clearOutput = () => {
    setOutput([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Handle tab key
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;
      const newCode = code.substring(0, start) + '    ' + code.substring(end);
      setCode(newCode);

      // Set cursor position after the inserted tab
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = start + 4;
          textareaRef.current.selectionEnd = start + 4;
        }
      }, 0);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 rounded-lg overflow-hidden">
      {/* Editor Header */}
      <div className="bg-gray-800 px-4 py-2 flex items-center justify-between border-b border-gray-700">
        <span className="text-sm text-gray-300">main.py</span>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={clearOutput}
            variant="ghost"
            className="text-gray-300 hover:text-white hover:bg-gray-700"
          >
            <RotateCcw className="w-4 h-4 mr-1" />
            Clear
          </Button>
          {onSave && (
            <Button
              size="sm"
              onClick={() => onSave(code)}
              disabled={saving}
              variant="ghost"
              className="text-gray-300 hover:text-white hover:bg-gray-700"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-1" />
              )}
              Save
            </Button>
          )}
          <Button
            size="sm"
            onClick={runCode}
            disabled={isRunning || readOnly}
            className="bg-[#7622e5] hover:bg-[#6518d0] text-white"
          >
            {isRunning ? (
              <>
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                Running
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-1" />
                Run
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Code Editor */}
      <div className="flex-1 overflow-auto">
        <div className="relative h-full">
          {/* Line numbers */}
          <div className="absolute left-0 top-0 bottom-0 w-12 bg-gray-800 text-gray-500 text-right pr-3 pt-4 text-sm select-none font-mono">
            {code.split('\n').map((_, i) => (
              <div key={i} className="leading-6">
                {i + 1}
              </div>
            ))}
          </div>

          {/* Code textarea */}
          <textarea
            ref={textareaRef}
            value={code}
            onChange={(e) => handleCodeChange(e.target.value)}
            onKeyDown={handleKeyDown}
            readOnly={readOnly}
            className="w-full h-full pl-16 pr-4 py-4 bg-gray-900 text-gray-100 font-mono text-sm resize-none focus:outline-none leading-6"
            style={{
              tabSize: 4,
              caretColor: '#ffa200',
            }}
            spellCheck={false}
          />
        </div>
      </div>

      {/* Terminal/Output */}
      <div className="h-48 border-t border-gray-700 bg-black/50">
        <div className="px-4 py-2 bg-gray-800 border-b border-gray-700">
          <span className="text-sm text-gray-300">Terminal</span>
        </div>
        <div className="p-4 h-[calc(100%-36px)] overflow-auto font-mono text-sm">
          {output.length === 0 ? (
            <div className="text-gray-500">Run your code to see output here...</div>
          ) : (
            output.map((line, i) => (
              <div key={i} className="text-green-400 mb-1">
                {line}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
