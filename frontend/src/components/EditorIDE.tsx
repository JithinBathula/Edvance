import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import Editor, { type Monaco } from '@monaco-editor/react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { Button } from './ui/button';
import {
  Code2,
  Globe2,
  Loader2,
  Play,
  Save,
  TerminalSquare,
  ChevronDown,
  ChevronRight,
  Plus,
  X,
  FileCode2,
  FileText,
  FileJson,
  File,
  Trash2,
  Square,
  MoreVertical,
  Pencil,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';
import { ProjectFile } from '../types/workspace';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { usePyodide, type OutputLine } from '../hooks/usePyodide';
import { getAccessToken } from '../utils/authFetch';

// --- Utility functions (from CodeSandboxIDE, zero external deps) ---

const detectLanguage = (filename: string) => {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.py')) return 'python';
  if (lower.endsWith('.ts') || lower.endsWith('.tsx')) return 'typescript';
  if (lower.endsWith('.js') || lower.endsWith('.jsx')) return 'javascript';
  if (lower.endsWith('.html')) return 'html';
  if (lower.endsWith('.css')) return 'css';
  if (lower.endsWith('.json')) return 'json';
  return 'text';
};

const inferMode = (files: ProjectFile[]) => {
  const lowerNames = files.map((file) => file.name.toLowerCase());
  if (lowerNames.some((name) => name.endsWith('.html'))) return 'web';
  if (lowerNames.some((name) => name.endsWith('.py'))) return 'python';
  return 'web';
};

const normalizeVmType = (vmType?: string) => {
  if (!vmType) return null;
  const normalized = vmType.trim().toLowerCase();
  if (['python', 'py', 'python3'].includes(normalized)) return 'python';
  if (['javascript', 'js', 'node', 'nodejs', 'web'].includes(normalized)) return 'javascript';
  return null;
};

const resolveMode = (files: ProjectFile[], vmType?: string) => {
  const normalized = normalizeVmType(vmType);
  if (normalized === 'python') return 'python';
  if (normalized === 'javascript') return 'web';
  return inferMode(files);
};

const isAllowedFile = (filename: string, mode: 'python' | 'web') => {
  const lower = filename.toLowerCase();
  if (mode === 'python') {
    return lower.endsWith('.py') || lower.endsWith('.json') || lower.endsWith('.txt');
  }
  return (
    lower.endsWith('.js') ||
    lower.endsWith('.jsx') ||
    lower.endsWith('.ts') ||
    lower.endsWith('.tsx') ||
    lower.endsWith('.html') ||
    lower.endsWith('.css') ||
    lower.endsWith('.json')
  );
};

const filterFilesByMode = (files: ProjectFile[], mode: 'python' | 'web') =>
  files.filter((file) => isAllowedFile(file.name, mode));

const FILE_CHANGE_DEBOUNCE_MS = 120;
const RECENT_LOCAL_EDIT_WINDOW_MS = 250;

const areFilesEqual = (a: ProjectFile[], b: ProjectFile[]) => {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (
      a[i].name !== b[i].name ||
      a[i].content !== b[i].content ||
      a[i].language !== b[i].language
    ) {
      return false;
    }
  }
  return true;
};

// Monaco language from file extension
const monacoLanguage = (filename: string): string => {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.py')) return 'python';
  if (lower.endsWith('.ts') || lower.endsWith('.tsx')) return 'typescript';
  if (lower.endsWith('.js') || lower.endsWith('.jsx')) return 'javascript';
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'html';
  if (lower.endsWith('.css')) return 'css';
  if (lower.endsWith('.json')) return 'json';
  if (lower.endsWith('.md')) return 'markdown';
  return 'plaintext';
};

// File icon based on extension
function FileIcon({ filename }: { filename: string }) {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.py')) return <FileCode2 className="w-3.5 h-3.5 text-yellow-400" />;
  if (lower.endsWith('.js') || lower.endsWith('.jsx')) return <FileCode2 className="w-3.5 h-3.5 text-yellow-300" />;
  if (lower.endsWith('.ts') || lower.endsWith('.tsx')) return <FileCode2 className="w-3.5 h-3.5 text-blue-400" />;
  if (lower.endsWith('.html')) return <FileText className="w-3.5 h-3.5 text-orange-400" />;
  if (lower.endsWith('.css')) return <FileText className="w-3.5 h-3.5 text-blue-300" />;
  if (lower.endsWith('.json')) return <FileJson className="w-3.5 h-3.5 text-green-400" />;
  return <File className="w-3.5 h-3.5 text-slate-400" />;
}

export type EditorIDEHandle = {
  getLatestFiles: () => ProjectFile[];
};

type Props = {
  files: ProjectFile[];
  onFilesChange: (files: ProjectFile[]) => void;
  onSave?: (files: ProjectFile[]) => void;
  readOnly?: boolean;
  saving?: boolean;
  userId: string;
  projectId: string;
  vmType?: string;
};

export const EditorIDE = forwardRef<EditorIDEHandle, Props>(function EditorIDE({
  files,
  onFilesChange,
  onSave,
  readOnly = false,
  saving = false,
  vmType,
}, ref) {
  const mode = resolveMode(files, vmType);
  const [localFiles, setLocalFiles] = useState<ProjectFile[]>(files);

  useImperativeHandle(ref, () => ({
    getLatestFiles: () => localFiles,
  }), [localFiles]);
  const [activeFile, setActiveFile] = useState<string>(files[0]?.name || 'main.py');
  const [openFiles, setOpenFiles] = useState<string[]>([files[0]?.name || 'main.py']);
  const [showNewFile, setShowNewFile] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [outputOpen, setOutputOpen] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [renamingFile, setRenamingFile] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [webConsole, setWebConsole] = useState<OutputLine[]>([]);
  const [webPanel, setWebPanel] = useState<'preview' | 'console'>('preview');
  const inputRef = useRef<HTMLInputElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const previewDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const filesChangeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingFilesRef = useRef<ProjectFile[] | null>(null);
  const lastLocalEditAtRef = useRef(0);
  const monacoRef = useRef<Monaco | null>(null);
  const editorRef = useRef<any>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const xtermContainerRef = useRef<HTMLDivElement>(null);
  const prevOutputLenRef = useRef(0);

  const { runCode, stopCode, output, isRunning, status, clearOutput, inputPrompt, submitInput } = usePyodide();

  const filteredFiles = useMemo(() => filterFilesByMode(localFiles, mode), [localFiles, mode]);

  // Sync files from parent when it is safe to do so.
  // This avoids stale parent echoes overriding in-flight local edits.
  useEffect(() => {
    if (areFilesEqual(files, localFiles)) return;

    const pending = pendingFilesRef.current;
    if (pending && !areFilesEqual(files, pending)) return;

    const isEditorFocused = editorRef.current?.hasTextFocus?.() ?? false;
    const isRecentLocalEdit = Date.now() - lastLocalEditAtRef.current < RECENT_LOCAL_EDIT_WINDOW_MS;
    if (isEditorFocused && isRecentLocalEdit) return;

    setLocalFiles(files);
    if (!files.some((f) => f.name === activeFile) && files.length > 0) {
      setActiveFile(files[0].name);
      setOpenFiles([files[0].name]);
    }
  }, [files, localFiles, activeFile]);

  // Initialize xterm when output panel opens
  useEffect(() => {
    if (mode !== 'python' || !outputOpen || !xtermContainerRef.current) return;

    const container = xtermContainerRef.current;
    const term = new Terminal({
      convertEol: true,
      cursorBlink: false,
      disableStdin: true,
      fontFamily: '"Fira Code", "Fira Mono", Menlo, Consolas, monospace',
      fontSize: 13,
      lineHeight: 1.4,
      scrollback: 5000,
      theme: {
        background: '#011627',
        foreground: '#6ee7b7',
        cursor: '#011627',
        selectionBackground: 'rgba(148, 163, 184, 0.35)',
        red: '#f87171',
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(container);

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // Fit after layout settles, then use ResizeObserver for all future resizes
    requestAnimationFrame(() => fitAddon.fit());

    const ro = new ResizeObserver(() => {
      requestAnimationFrame(() => fitAddonRef.current?.fit());
    });
    ro.observe(container);

    // Replay any existing output
    for (const line of output) {
      if (line.type === 'stderr') {
        term.write(`\x1b[31m${line.text}\x1b[0m`);
      } else {
        term.write(line.text);
      }
    }
    prevOutputLenRef.current = output.length;

    return () => {
      ro.disconnect();
      term.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
      prevOutputLenRef.current = 0;
    };
  }, [mode, outputOpen]);

  // Write new output lines to xterm incrementally
  useEffect(() => {
    if (!xtermRef.current) return;
    const newLines = output.slice(prevOutputLenRef.current);
    for (const line of newLines) {
      if (line.type === 'stderr') {
        xtermRef.current.write(`\x1b[31m${line.text}\x1b[0m`);
      } else {
        xtermRef.current.write(line.text);
      }
    }
    prevOutputLenRef.current = output.length;
  }, [output]);

  // Clear xterm when output is cleared
  useEffect(() => {
    if (output.length === 0 && xtermRef.current) {
      xtermRef.current.clear();
      xtermRef.current.reset();
      prevOutputLenRef.current = 0;
    }
  }, [output.length]);

  // Focus input when prompt appears
  useEffect(() => {
    if (inputPrompt !== null) {
      inputRef.current?.focus();
    }
  }, [inputPrompt]);

  // Listen for console messages from iframe
  useEffect(() => {
    if (mode !== 'web') return;
    const handler = (event: MessageEvent) => {
      if (event.data?.source === 'edvance-preview') {
        const { level, args } = event.data;
        const text = args?.join(' ') || '';
        const type: OutputLine['type'] = level === 'error' ? 'stderr' : 'stdout';
        setWebConsole((prev) => [...prev, { type, text }]);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [mode]);

  // Build srcdoc for web preview
  const srcdoc = useMemo(() => {
    if (mode !== 'web') return '';

    const htmlFile = filteredFiles.find((f) =>
      f.name.toLowerCase().endsWith('.html')
    );
    if (!htmlFile) return '<html><body><p>No HTML file found</p></body></html>';

    let html = htmlFile.content;

    // Inject CSS files
    const cssFiles = filteredFiles.filter((f) => f.name.toLowerCase().endsWith('.css'));
    const cssInjection = cssFiles.map((f) => `<style>/* ${f.name} */\n${f.content}</style>`).join('\n');
    if (cssInjection) {
      html = html.replace('</head>', `${cssInjection}\n</head>`);
    }

    // Inject JS files
    const jsFiles = filteredFiles.filter(
      (f) => f.name.toLowerCase().endsWith('.js') || f.name.toLowerCase().endsWith('.jsx')
    );
    const jsInjection = jsFiles.map((f) => `<script>/* ${f.name} */\n${f.content}</script>`).join('\n');

    // Console capture script
    const consoleCapture = `<script>
(function() {
  var origLog = console.log, origError = console.error, origWarn = console.warn;
  function send(level, args) {
    try {
      parent.postMessage({ source: 'edvance-preview', level: level, args: Array.from(args).map(String) }, '*');
    } catch(e) {}
  }
  console.log = function() { send('log', arguments); origLog.apply(console, arguments); };
  console.error = function() { send('error', arguments); origError.apply(console, arguments); };
  console.warn = function() { send('warn', arguments); origWarn.apply(console, arguments); };
  window.onerror = function(msg, url, line) {
    send('error', [msg + ' (line ' + line + ')']);
  };
})();
</script>`;

    html = html.replace('</head>', `${consoleCapture}\n</head>`);

    if (jsInjection) {
      html = html.replace('</body>', `${jsInjection}\n</body>`);
    }

    return html;
  }, [filteredFiles, mode]);

  // Debounced srcdoc update for iframe
  const [debouncedSrcdoc, setDebouncedSrcdoc] = useState(srcdoc);
  useEffect(() => {
    if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current);
    previewDebounceRef.current = setTimeout(() => {
      setDebouncedSrcdoc(srcdoc);
      setWebConsole([]);
    }, 300);
    return () => {
      if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current);
    };
  }, [srcdoc]);

  const emitFilesChangeDebounced = useCallback(
    (nextFiles: ProjectFile[]) => {
      pendingFilesRef.current = nextFiles;
      if (filesChangeDebounceRef.current) clearTimeout(filesChangeDebounceRef.current);
      filesChangeDebounceRef.current = setTimeout(() => {
        const latest = pendingFilesRef.current;
        pendingFilesRef.current = null;
        filesChangeDebounceRef.current = null;
        if (latest) onFilesChange(latest);
      }, FILE_CHANGE_DEBOUNCE_MS);
    },
    [onFilesChange]
  );

  const emitFilesChangeImmediate = useCallback(
    (nextFiles: ProjectFile[]) => {
      if (filesChangeDebounceRef.current) {
        clearTimeout(filesChangeDebounceRef.current);
        filesChangeDebounceRef.current = null;
      }
      pendingFilesRef.current = null;
      onFilesChange(nextFiles);
    },
    [onFilesChange]
  );

  const flushPendingFileChanges = useCallback(() => {
    if (filesChangeDebounceRef.current) {
      clearTimeout(filesChangeDebounceRef.current);
      filesChangeDebounceRef.current = null;
    }
    if (pendingFilesRef.current) {
      const latest = pendingFilesRef.current;
      pendingFilesRef.current = null;
      onFilesChange(latest);
    }
  }, [onFilesChange]);

  useEffect(() => {
    return () => {
      if (filesChangeDebounceRef.current) clearTimeout(filesChangeDebounceRef.current);
    };
  }, []);

  const currentFile = localFiles.find((f) => f.name === activeFile);

  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      if (value === undefined) return;
      lastLocalEditAtRef.current = Date.now();
      setLocalFiles((prev) => {
        const updated = prev.map((f) =>
          f.name === activeFile
            ? { ...f, content: value, language: detectLanguage(f.name) }
            : f
        );
        if (mode === 'python') {
          emitFilesChangeDebounced(updated);
        } else {
          onFilesChange(updated);
        }
        return updated;
      });
    },
    [activeFile, mode, onFilesChange, emitFilesChangeDebounced]
  );

  const handleMonacoMount = useCallback((editor: any, monaco: Monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    // Define custom dark theme
    monaco.editor.defineTheme('edvance-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'keyword', foreground: 'c792ea' },
        { token: 'string', foreground: 'ecc48d' },
        { token: 'identifier', foreground: '82aaff' },
        { token: 'type.identifier', foreground: '82aaff' },
        { token: 'number', foreground: 'f78c6c' },
        { token: 'comment', foreground: '999999', fontStyle: 'italic' },
        { token: 'variable', foreground: 'addb67' },
        { token: 'delimiter', foreground: 'd6deeb' },
        { token: 'tag', foreground: '7fdbca' },
        { token: 'attribute.name', foreground: 'addb67' },
        { token: 'attribute.value', foreground: 'ecc48d' },
      ],
      colors: {
        'editor.background': '#011627',
        'editor.foreground': '#d6deeb',
        'editor.lineHighlightBackground': '#ffffff08',
        'editor.selectionBackground': '#94a3b859',
        'editorLineNumber.foreground': '#4b6479',
        'editorLineNumber.activeForeground': '#c5e4fd',
        'editorCursor.foreground': '#6ee7b7',
        'editorGutter.background': '#011627',
      },
    });
    monaco.editor.setTheme('edvance-dark');
  }, []);

  const openFileInEditor = (name: string) => {
    setActiveFile(name);
    if (!openFiles.includes(name)) {
      setOpenFiles((prev) => [...prev, name]);
    }
  };

  const closeTab = (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenFiles((prev) => {
      const updated = prev.filter((f) => f !== name);
      if (activeFile === name && updated.length > 0) {
        setActiveFile(updated[updated.length - 1]);
      }
      return updated;
    });
  };

  const createNewFile = async () => {
    if (!newFileName.trim()) return;

    let fileName = newFileName.trim();
    if (mode === 'python' && !fileName.includes('.')) {
      fileName += '.py';
    }

    if (filteredFiles.some((f) => f.name === fileName)) return;

    const defaultContent = fileName.endsWith('.json')
      ? '{}'
      : mode === 'python'
        ? '# New file\n'
        : '';
    const newFile: ProjectFile = {
      name: fileName,
      content: defaultContent,
      language: detectLanguage(fileName),
    };

    const updatedFiles = [...localFiles, newFile];

    if (onSave) {
      await onSave(updatedFiles);
    }

    setLocalFiles(updatedFiles);
    emitFilesChangeImmediate(updatedFiles);
    setNewFileName('');
    setShowNewFile(false);
    openFileInEditor(fileName);
  };

  const handleSave = async () => {
    if (!onSave) return;
    flushPendingFileChanges();
    setIsSaving(true);
    try {
      await onSave(localFiles);
    } catch (err) {
      console.error('Save error:', err);
    } finally {
      setTimeout(() => setIsSaving(false), 300);
    }
  };

  const handleRun = async () => {
    if (mode !== 'python') return;
    flushPendingFileChanges();

    // Save before running
    if (onSave) {
      await onSave(localFiles);
    }

    const pyFiles = filteredFiles.map((f) => ({ name: f.name, content: f.content }));
    const entry = pyFiles.find((f) => f.name === 'main.py')?.name || pyFiles[0]?.name || 'main.py';
    runCode(pyFiles, entry, getAccessToken() || undefined);
  };

  const handleInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = inputRef.current?.value || '';
    submitInput(value);
    if (inputRef.current) inputRef.current.value = '';
  };

  const deleteFile = async (name: string) => {
    if (filteredFiles.length <= 1) return; // Don't delete the last file
    const updated = localFiles.filter((f) => f.name !== name);
    setLocalFiles(updated);
    emitFilesChangeImmediate(updated);
    setOpenFiles((prev) => prev.filter((f) => f !== name));
    if (activeFile === name) {
      const remaining = updated.filter((f) => isAllowedFile(f.name, mode));
      setActiveFile(remaining[0]?.name || '');
    }
    if (onSave) await onSave(updated);
  };

  const renameFile = async (oldName: string, newName: string) => {
    if (!newName.trim() || newName === oldName) {
      setRenamingFile(null);
      return;
    }
    if (localFiles.some((f) => f.name === newName)) {
      setRenamingFile(null);
      return;
    }
    const updated = localFiles.map((f) =>
      f.name === oldName ? { ...f, name: newName, language: detectLanguage(newName) } : f
    );
    setLocalFiles(updated);
    emitFilesChangeImmediate(updated);
    setOpenFiles((prev) => prev.map((f) => (f === oldName ? newName : f)));
    if (activeFile === oldName) setActiveFile(newName);
    setRenamingFile(null);
    if (onSave) await onSave(updated);
  };

  // Determine what to show in the output/console area
  const outputLines = mode === 'python' ? output : webConsole;

  return (
    <div className="ide-container" data-mode={mode}>
      {/* Header */}
      <div className="ide-header">
        <div className="ide-header-left">
          <div className="ide-status-dot" />
          <span className="ide-title">Workspace</span>
          <span className="ide-mode">{mode === 'python' ? 'Python' : 'Web Preview'}</span>
        </div>
        <div className="ide-header-right">
          {onSave && (
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || isSaving}
              variant="ghost"
              className="text-white hover:bg-slate-800/60"
            >
              {saving || isSaving ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-1" />
              )}
              Save
            </Button>
          )}
          {mode === 'python' && (
            isRunning ? (
              <Button
                size="sm"
                onClick={stopCode}
                className="bg-red-500/90 hover:bg-red-400 text-white"
              >
                <Square className="w-3.5 h-3.5 mr-1 fill-current" />
                Stop
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleRun}
                disabled={readOnly}
                className="bg-emerald-500/90 hover:bg-emerald-400 text-white"
              >
                <Play className="w-4 h-4 mr-1" />
                Run
              </Button>
            )
          )}
        </div>
      </div>

      {/* Editor Area */}
      <div className="ide-editor-area" style={{ position: 'relative' }}>
        {isSaving && (
          <div className="ide-saving-overlay">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span>Saving...</span>
          </div>
        )}

        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          {/* File Explorer Sidebar */}
          {sidebarOpen && (
            <div className="ide-sidebar">
              <div className="ide-sidebar-header" style={{ justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <Code2 className="w-3.5 h-3.5" />
                  Files
                  <button
                    onClick={() => setShowNewFile(true)}
                    className="p-1 hover:bg-slate-700 rounded"
                    title="New File"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-1 hover:bg-slate-700 rounded"
                  title="Hide Files"
                >
                  <PanelLeftClose className="w-3.5 h-3.5" />
                </button>
              </div>
              {showNewFile && (
                <div className="ide-new-file">
                  <input
                    type="text"
                    value={newFileName}
                    onChange={(e) => setNewFileName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') createNewFile();
                      if (e.key === 'Escape') setShowNewFile(false);
                    }}
                    placeholder={mode === 'python' ? 'filename.py' : 'filename'}
                    autoFocus
                  />
                  <button onClick={createNewFile} className="ide-new-file-btn">
                    <Plus className="w-3 h-3" />
                  </button>
                  <button onClick={() => setShowNewFile(false)} className="ide-new-file-btn">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
              <div className="ide-file-list">
                {filteredFiles.map((file) => (
                  <div
                    key={file.name}
                    className={`ide-file-item ${activeFile === file.name ? 'active' : ''}`}
                    onClick={() => openFileInEditor(file.name)}
                    style={{ cursor: 'pointer' }}
                  >
                    <FileIcon filename={file.name} />
                    {renamingFile === file.name ? (
                      <input
                        className="flex-1 bg-slate-700 text-slate-200 text-xs px-1 py-0.5 rounded outline-none"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') renameFile(file.name, renameValue);
                          if (e.key === 'Escape') setRenamingFile(null);
                        }}
                        onBlur={() => renameFile(file.name, renameValue)}
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                      />
                    ) : (
                      <span className="flex-1 truncate">{file.name}</span>
                    )}
                    {renamingFile !== file.name && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className="ide-file-menu p-0.5 rounded hover:bg-slate-600 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="w-3.5 h-3.5 text-slate-400" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-[120px]" style={{ background: "#1e293b", borderColor: "#334155", padding: "4px" }}>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setRenamingFile(file.name);
                              setRenameValue(file.name);
                            }}
                            style={{ color: "#e2e8f0", padding: "6px 8px" }}
                            className="focus:bg-slate-600 focus:text-white"
                          >
                            <Pencil className="w-3.5 h-3.5 mr-2" />
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteFile(file.name);
                            }}
                            disabled={filteredFiles.length <= 1}
                            style={{ color: "#f87171", padding: "6px 8px" }}
                            className="focus:bg-slate-600 focus:text-red-400"
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {!sidebarOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', borderRight: '1px solid rgba(148,163,184,0.1)' }}>
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 hover:bg-slate-700/50 text-white hover:text-white"
                title="Show Files"
              >
                <PanelLeft className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Main Editor + Preview/Output */}
          <div className="ide-main">
            {/* Tab Bar */}
            <div className="ide-tab-bar">
              {openFiles.map((name) => (
                <button
                  key={name}
                  onClick={() => setActiveFile(name)}
                  className={`ide-tab ${activeFile === name ? 'active' : ''}`}
                >
                  <FileIcon filename={name} />
                  <span>{name}</span>
                  {openFiles.length > 1 && (
                    <span
                      className="ide-tab-close"
                      onClick={(e) => closeTab(name, e)}
                    >
                      <X className="w-3 h-3" />
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Monaco Editor */}
            <div style={{ flex: '1 1 0', minHeight: 0, overflow: 'hidden' }}>
              <Editor
                height="100%"
                theme="edvance-dark"
                language={monacoLanguage(activeFile)}
                value={currentFile?.content || ''}
                onChange={handleEditorChange}
                onMount={handleMonacoMount}
                path={activeFile}
                options={{
                  readOnly,
                  fontSize: 14,
                  fontFamily: '"Fira Code", "Fira Mono", Menlo, Consolas, monospace',
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  tabSize: 4,
                  wordWrap: 'bounded',
                  lineNumbers: 'on',
                  renderLineHighlight: 'line',
                  padding: { top: 8, bottom: 8 },
                  scrollbar: {
                    horizontalScrollbarSize: 6,
                    verticalScrollbarSize: 6,
                  },
                }}
              />
            </div>

            {/* Web Preview + Console (web mode) */}
            {mode === 'web' && (
              <div className="ide-preview">
                <div className="ide-preview-header">
                  <button
                    onClick={() => setWebPanel('preview')}
                    className={`ide-preview-tab ${webPanel === 'preview' ? 'active' : ''}`}
                  >
                    <Globe2 className="w-3.5 h-3.5" />
                    Preview
                  </button>
                  <button
                    onClick={() => setWebPanel('console')}
                    className={`ide-preview-tab ${webPanel === 'console' ? 'active' : ''}`}
                  >
                    <TerminalSquare className="w-3.5 h-3.5" />
                    Console
                    {webConsole.length > 0 && (
                      <span className="ide-preview-badge">{webConsole.length}</span>
                    )}
                  </button>
                  {webPanel === 'console' && webConsole.length > 0 && (
                    <button
                      onClick={() => setWebConsole([])}
                      className="ml-auto p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-200"
                      title="Clear console"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <iframe
                  ref={iframeRef}
                  sandbox="allow-scripts allow-same-origin"
                  srcDoc={debouncedSrcdoc}
                  style={{
                    flex: 1,
                    width: '100%',
                    border: 'none',
                    background: '#fff',
                    display: webPanel === 'preview' ? 'block' : 'none',
                  }}
                  title="Web Preview"
                />
                {webPanel === 'console' && (
                  <pre className="ide-output-content" style={{ flex: 1, minHeight: 0 }}>
                    {webConsole.length === 0 ? (
                      <span className="ide-output-placeholder">
                        Console output will appear here...
                      </span>
                    ) : (
                      webConsole.map((line, i) => (
                        <span
                          key={i}
                          className={line.type === 'stderr' ? 'ide-output-error' : ''}
                        >
                          {line.text}{'\n'}
                        </span>
                      ))
                    )}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Output Panel (Python mode) */}
      {mode === 'python' && (
        <div className={`ide-output ${outputOpen ? 'open' : ''}`}>
          <div className="ide-output-header" onClick={() => setOutputOpen(!outputOpen)}>
            <div className="ide-output-title">
              <TerminalSquare className="w-4 h-4" />
              <span>Output</span>
              {isRunning && (
                <span className="ide-output-status" data-status="running">
                  Running
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {outputOpen && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    clearOutput();
                  }}
                  className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-200"
                  title="Clear output"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
              {outputOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </div>
          </div>
          {outputOpen && (
            <div className="ide-output-body">
              <div ref={xtermContainerRef} className="ide-output-xterm" />
              {inputPrompt !== null && (
                <form onSubmit={handleInputSubmit} className="ide-output-input">
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder="Enter input..."
                    autoFocus
                  />
                  <Button
                    type="submit"
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-500 text-white h-7 px-3"
                  >
                    Send
                  </Button>
                </form>
              )}
            </div>
          )}
        </div>
      )}

    </div>
  );
});
