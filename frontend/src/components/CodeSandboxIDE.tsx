import { useEffect, useMemo, useRef, useState } from 'react';
import {
  SandpackProvider,
  SandpackLayout,
  SandpackCodeEditor,
  SandpackFileExplorer,
  SandpackPreview,
  useSandpack,
} from '@codesandbox/sandpack-react';
import type { SandpackTheme } from '@codesandbox/sandpack-react';
import { connectToSandbox } from '@codesandbox/sdk/browser';
import { python } from '@codemirror/lang-python';
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
} from 'lucide-react';
import { ProjectFile } from '../types/workspace';
import { BACKEND_URL } from '../utils/constants';

// Custom theme with consistent dark background
const edvanceTheme: SandpackTheme = {
  colors: {
    surface1: '#011627',
    surface2: '#011627',
    surface3: '#011627',
    clickable: '#6988a1',
    base: '#808080',
    disabled: '#4D4D4D',
    hover: '#c5e4fd',
    accent: '#c792ea',
    error: '#ff453a',
    errorSurface: '#011627',
  },
  syntax: {
    plain: '#d6deeb',
    comment: { color: '#999999', fontStyle: 'italic' },
    keyword: '#c792ea',
    tag: '#7fdbca',
    punctuation: '#d6deeb',
    definition: '#82aaff',
    property: '#addb67',
    static: '#f78c6c',
    string: '#ecc48d',
  },
  font: {
    body: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    mono: '"Fira Code", "Fira Mono", Menlo, Consolas, "DejaVu Sans Mono", monospace',
    size: '14px',
    lineHeight: '1.6',
  },
};

const pythonLanguage = {
  name: 'python',
  extensions: ['py'],
  language: python(),
};

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
  if (lowerNames.some((name) => name.endsWith('.html'))) {
    return 'web';
  }
  if (lowerNames.some((name) => name.endsWith('.py'))) {
    return 'python';
  }
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
    return lower.endsWith('.py');
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

const toSandpackPath = (name: string) => (name.startsWith('/') ? name : `/${name}`);

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

type TerminalStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

// Component to store sandpack ref for saving
function SandpackRef({
  sandpackRef,
}: {
  sandpackRef: React.MutableRefObject<ReturnType<typeof useSandpack>['sandpack'] | null>;
}) {
  const { sandpack } = useSandpack();
  sandpackRef.current = sandpack;
  return null;
}

export function CodeSandboxIDE({
  files,
  onFilesChange,
  onSave,
  readOnly = false,
  saving = false,
  userId,
  projectId,
  vmType,
}: Props) {
  const mode = resolveMode(files, vmType);
  const [terminalOpen, setTerminalOpen] = useState(true);
  const [terminalLoading, setTerminalLoading] = useState(false);
  const [terminalError, setTerminalError] = useState<string | null>(null);
  const [terminalStatus, setTerminalStatus] = useState<TerminalStatus>('disconnected');
  const [showNewFile, setShowNewFile] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [localFiles, setLocalFiles] = useState<ProjectFile[]>(files);
  const [editorKey, setEditorKey] = useState(0);
  const [activeFile, setActiveFile] = useState<string>(files[0]?.name ? `/${files[0].name}` : '/main.py');
  const [isSaving, setIsSaving] = useState(false);
  const terminalRef = useRef<any>(null);
  const clientRef = useRef<any>(null);
  const connectingRef = useRef(false);
  const sandpackRef = useRef<any>(null);
  const terminalContainerRef = useRef<HTMLDivElement | null>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const terminalHistoryRef = useRef<string>('');
  const terminalWrittenRef = useRef(0);

  const filteredFiles = useMemo(() => filterFilesByMode(localFiles, mode), [localFiles, mode]);
  const visibleFiles = useMemo(
    () => filteredFiles.map((file) => toSandpackPath(file.name)),
    [filteredFiles]
  );
  const webEntry = useMemo(() => {
    const indexHtml = visibleFiles.find((file) => file.toLowerCase() === '/index.html');
    if (indexHtml) return indexHtml;
    const anyHtml = visibleFiles.find((file) => file.toLowerCase().endsWith('.html'));
    return anyHtml || visibleFiles[0] || '/index.html';
  }, [visibleFiles]);

  const sandpackFiles = useMemo(() => {
    const mapped: Record<string, { code: string }> = {};
    filteredFiles.forEach((file) => {
      const path = toSandpackPath(file.name);
      mapped[path] = { code: file.content };
    });
    return mapped;
  }, [filteredFiles]);

  const writeToTerminal = (chunk?: string) => {
    if (!chunk) return;
    terminalHistoryRef.current += chunk;
    if (xtermRef.current) {
      xtermRef.current.write(chunk);
      terminalWrittenRef.current = terminalHistoryRef.current.length;
    }
  };

  const resetTerminalDisplay = () => {
    terminalHistoryRef.current = '';
    terminalWrittenRef.current = 0;
    if (xtermRef.current) {
      xtermRef.current.reset();
      xtermRef.current.clear();
    }
  };

  const syncFilesToSandboxWith = async (filesToSync: ProjectFile[]) => {
    if (!clientRef.current) return;
    const filtered = filterFilesByMode(filesToSync, mode);
    const payload = filtered.map((file) => ({
      path: file.name,
      content: file.content,
    }));
    if (payload.length === 0) return;
    try {
      await clientRef.current.fs.batchWrite(payload);
    } catch (err) {
      console.error('Failed to sync files:', err);
    }
  };

  const flushTerminalHistory = () => {
    if (!xtermRef.current) return;
    const history = terminalHistoryRef.current;
    if (!history) return;
    const alreadyWritten = terminalWrittenRef.current;
    if (alreadyWritten > 0 && alreadyWritten < history.length) {
      xtermRef.current.write(history.slice(alreadyWritten));
    } else if (alreadyWritten === 0) {
      xtermRef.current.write(history);
    }
    terminalWrittenRef.current = history.length;
  };

  const initializeXterm = () => {
    if (xtermRef.current || !terminalContainerRef.current) return;

    const term = new Terminal({
      convertEol: true,
      cursorBlink: true,
      fontFamily: '"Fira Code", "Fira Mono", Menlo, Consolas, "DejaVu Sans Mono", monospace',
      fontSize: 13,
      lineHeight: 1.4,
      scrollback: 2000,
      theme: {
        background: '#011627',
        foreground: '#6ee7b7',
        cursor: '#6ee7b7',
        selection: 'rgba(148, 163, 184, 0.35)',
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalContainerRef.current);
    fitAddon.fit();

    term.onData((data) => {
      if (!terminalRef.current) return;
      try {
        terminalRef.current.write(data);
      } catch (err) {
        console.error('Terminal input error:', err);
        setTerminalError('Failed to send input');
      }
    });

    if (!terminalRef.current) {
      term.options.disableStdin = true;
    }

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;
    flushTerminalHistory();

    requestAnimationFrame(() => fitAddon.fit());
  };

  const disposeXterm = () => {
    if (xtermRef.current) {
      xtermRef.current.dispose();
      xtermRef.current = null;
    }
    fitAddonRef.current = null;
    terminalWrittenRef.current = 0;
  };

  const resetTerminalConnection = () => {
    if (terminalRef.current) {
      terminalRef.current.kill?.();
      terminalRef.current = null;
    }
    if (clientRef.current?.disconnect) {
      clientRef.current.disconnect();
      clientRef.current = null;
    }
    if (xtermRef.current) {
      xtermRef.current.options.disableStdin = true;
    }
    setTerminalStatus('disconnected');
  };

  const fetchSession = async () => {
    const response = await fetch(`${BACKEND_URL}/sandbox/python/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        user_id: userId,
        project_id: projectId,
      }),
    });
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to create sandbox session');
    }
    return data.session;
  };

  const connectTerminal = async (
    forceReconnect = false,
    suppressInitialOutput = false
  ): Promise<boolean> => {
    if (!userId || !projectId) return false;
    if (connectingRef.current) return false;

    // Allow reconnection if we don't have a terminal
    if (terminalRef.current && !forceReconnect) {
      setTerminalStatus('connected');
      return true;
    }
    if (forceReconnect) {
      resetTerminalDisplay();
      resetTerminalConnection();
    }

    connectingRef.current = true;
    setTerminalLoading(true);
    setTerminalError(null);
    setTerminalStatus('connecting');

    try {
      const session = await fetchSession();
      const sandboxClient = await connectToSandbox({
        session,
        getSession: fetchSession,
      });
      clientRef.current = sandboxClient;

      const terminal = await sandboxClient.terminals.create();
      terminalRef.current = terminal;
      const initial = await terminal.open();
      if (!suppressInitialOutput) {
        writeToTerminal(initial || '');
      }
      terminal.onOutput((chunk: string) => {
        writeToTerminal(chunk);
      });
      if (xtermRef.current) {
        xtermRef.current.options.disableStdin = false;
        xtermRef.current.focus();
      }
      setTerminalStatus('connected');
      return true;
    } catch (err: any) {
      console.error('Terminal connection error:', err);
      setTerminalError(err?.message || 'Failed to connect terminal');
      setTerminalStatus('error');
      return false;
    } finally {
      setTerminalLoading(false);
      connectingRef.current = false;
    }
  };

  useEffect(() => {
    if (mode === 'python') {
      connectTerminal();
    }
    return () => {
      disposeXterm();
      terminalHistoryRef.current = '';
      terminalWrittenRef.current = 0;
      resetTerminalConnection();
    };
  }, [mode, userId, projectId]);

  useEffect(() => {
    if (mode !== 'python') return;
    if (terminalOpen) {
      initializeXterm();
      flushTerminalHistory();
      requestAnimationFrame(() => fitAddonRef.current?.fit());
    } else {
      disposeXterm();
    }
  }, [mode, terminalOpen]);

  useEffect(() => {
    if (mode !== 'python' || !terminalOpen) return;
    const handleResize = () => {
      fitAddonRef.current?.fit();
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [mode, terminalOpen]);

  const syncFilesToSandbox = async () => {
    await syncFilesToSandboxWith(filteredFiles);
  };

  const runPython = async () => {
    setTerminalError(null);

    // Ensure terminal is connected
    const connected = await connectTerminal(terminalStatus !== 'connected');
    if (!connected || !terminalRef.current) {
      setTerminalError('Terminal not connected. Please wait and try again.');
      return;
    }

    try {
      const sp = sandpackRef.current;
      const currentFiles = sp
        ? Object.entries(sp.files)
            .map(([path, file]: [string, any]) => ({
              name: path.replace(/^\//, ''),
              content: file.code,
              language: detectLanguage(path),
            }))
            .filter((file) => isAllowedFile(file.name, mode))
        : filteredFiles;

      if (onSave && currentFiles.length > 0) {
        await onSave(currentFiles);
      }
      if (currentFiles.length > 0) {
        setLocalFiles(currentFiles);
        await syncFilesToSandboxWith(currentFiles);
      } else {
        await syncFilesToSandbox();
      }
      await terminalRef.current.run('python main.py');
    } catch (err: any) {
      console.error('Run error:', err);
      setTerminalError(err?.message || 'Failed to run code');
    }
  };

  const createNewFile = async () => {
    if (!newFileName.trim()) return;

    let fileName = newFileName.trim();
    if (mode === 'python' && !fileName.endsWith('.py')) {
      fileName += '.py';
    }

    if (filteredFiles.some(f => f.name === fileName)) {
      return;
    }

    const newFile: ProjectFile = {
      name: fileName,
      content: mode === 'python' ? '# New file\n' : '',
      language: detectLanguage(fileName),
    };

    const updatedFiles = [...localFiles, newFile];

    // Save to backend first
    if (onSave) {
      await onSave(updatedFiles);
    }

    // Then refresh editor
    setLocalFiles(updatedFiles);
    setEditorKey(k => k + 1);
    setNewFileName('');
    setShowNewFile(false);

    if (mode === 'python') {
      await syncFilesToSandboxWith(updatedFiles);
    }
  };

  return (
    <div className="ide-container" data-mode={mode}>
      {/* Header */}
      <div className="ide-header">
        <div className="ide-header-left">
          <div className="ide-status-dot" />
          <span className="ide-title">Workspace</span>
          <span className="ide-mode">{mode === 'python' ? 'Python VM' : 'Web Preview'}</span>
        </div>
        <div className="ide-header-right">
          {onSave && (
            <Button
              size="sm"
              onClick={async () => {
                const sp = sandpackRef.current;
                if (!sp) return;

                setIsSaving(true);

                // Remember current active file
                const currentActive = sp.activeFile;

                const currentFiles = Object.entries(sp.files)
                  .map(([path, file]: [string, any]) => ({
                    name: path.replace(/^\//, ''),
                    content: file.code,
                    language: detectLanguage(path),
                  }))
                  .filter((file) => isAllowedFile(file.name, mode));

                await onSave(currentFiles);

                // Set active file before remount so it opens to same file
                setActiveFile(currentActive);
                setLocalFiles(currentFiles);
                if (mode === 'python') {
                  await syncFilesToSandboxWith(currentFiles);
                }
                setEditorKey(k => k + 1);

                // Small delay to let remount complete
                setTimeout(() => setIsSaving(false), 300);
              }}
              disabled={saving || isSaving}
              variant="ghost"
              className="text-white hover:bg-slate-800/60"
            >
              {saving || isSaving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
              Save
            </Button>
          )}
          {mode === 'python' && (
            <Button
              size="sm"
              onClick={runPython}
              disabled={terminalLoading || readOnly}
              className="bg-emerald-500/90 hover:bg-emerald-400 text-white"
            >
              {terminalLoading ? (
                <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Connecting</>
              ) : (
                <><Play className="w-4 h-4 mr-1" />Run</>
              )}
            </Button>
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
        <SandpackProvider
          key={editorKey}
          files={sandpackFiles}
          template={mode === 'web' ? 'static' : undefined}
          customSetup={{
            entry: mode === 'web' ? webEntry : activeFile || visibleFiles[0] || '/main.py',
          }}
          theme={edvanceTheme}
          options={{
            visibleFiles,
            activeFile: activeFile,
          }}
        >
          <SandpackRef sandpackRef={sandpackRef} />
          <SandpackLayout>
            {/* File Explorer */}
            <div className="ide-sidebar">
              <div className="ide-sidebar-header">
                <Code2 className="w-3.5 h-3.5" />
                Files
                <button
                  onClick={() => setShowNewFile(true)}
                  className="ml-auto p-1 hover:bg-slate-700 rounded"
                  title="New File"
                >
                  <Plus className="w-3.5 h-3.5" />
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
                <SandpackFileExplorer autoHiddenFiles />
              </div>
            </div>

            {/* Code Editor */}
            <div className="ide-main">
              <SandpackCodeEditor
                showLineNumbers
                showTabs
                wrapContent={false}
                additionalLanguages={[pythonLanguage]}
              />
              {mode === 'web' && (
                <div className="ide-preview">
                  <div className="ide-preview-header">
                    <Globe2 className="w-3.5 h-3.5" />
                    Preview
                  </div>
                  <SandpackPreview showOpenInCodeSandbox={false} />
                </div>
              )}
            </div>
          </SandpackLayout>
        </SandpackProvider>
      </div>

      {/* Terminal */}
      {mode === 'python' && (
        <div className={`ide-terminal ${terminalOpen ? 'open' : ''}`}>
          <div className="ide-terminal-header" onClick={() => setTerminalOpen(!terminalOpen)}>
            <div className="ide-terminal-title">
              <TerminalSquare className="w-4 h-4" />
              <span>Terminal</span>
              <span className="ide-terminal-status" data-status={terminalStatus}>
                {terminalStatus === 'connecting'
                  ? 'Connecting'
                  : terminalStatus === 'connected'
                    ? 'Connected'
                    : terminalStatus === 'error'
                      ? 'Error'
                      : 'Disconnected'}
              </span>
            </div>
            {terminalOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </div>
          {terminalOpen && (
            <div className="ide-terminal-body">
              {terminalError && (
                <div className="ide-terminal-error">
                  {terminalError}
                </div>
              )}
              <div className="ide-terminal-output">
                <div ref={terminalContainerRef} className="ide-terminal-xterm" />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
