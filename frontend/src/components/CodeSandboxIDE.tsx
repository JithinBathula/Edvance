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
  const [terminalOutput, setTerminalOutput] = useState<string>('');
  const [terminalInput, setTerminalInput] = useState('');
  const [terminalLoading, setTerminalLoading] = useState(false);
  const [terminalError, setTerminalError] = useState<string | null>(null);
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

  const filteredFiles = useMemo(() => filterFilesByMode(localFiles, mode), [localFiles, mode]);
  const visibleFiles = useMemo(
    () => filteredFiles.map((file) => toSandpackPath(file.name)),
    [filteredFiles]
  );

  const sandpackFiles = useMemo(() => {
    const mapped: Record<string, { code: string }> = {};
    filteredFiles.forEach((file) => {
      const path = toSandpackPath(file.name);
      mapped[path] = { code: file.content };
    });
    return mapped;
  }, [filteredFiles]);

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

  const connectTerminal = async (): Promise<boolean> => {
    if (!userId || !projectId) return false;
    if (connectingRef.current) return false;

    // Allow reconnection if we don't have a terminal
    if (terminalRef.current) return true;

    connectingRef.current = true;
    setTerminalLoading(true);
    setTerminalError(null);

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
      setTerminalOutput(initial || '');
      terminal.onOutput((chunk: string) => {
        setTerminalOutput((prev) => prev + chunk);
      });
      return true;
    } catch (err: any) {
      console.error('Terminal connection error:', err);
      setTerminalError(err?.message || 'Failed to connect terminal');
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
      if (terminalRef.current) {
        terminalRef.current.kill?.();
        terminalRef.current = null;
      }
      if (clientRef.current?.disconnect) {
        clientRef.current.disconnect();
        clientRef.current = null;
      }
    };
  }, [mode, userId, projectId]);

  const syncFilesToSandbox = async () => {
    if (!clientRef.current) return;
    const payload = filteredFiles.map((file) => ({
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

  const runPython = async () => {
    setTerminalError(null);

    // Ensure terminal is connected
    const connected = await connectTerminal();
    if (!connected || !terminalRef.current) {
      setTerminalError('Terminal not connected. Please wait and try again.');
      return;
    }

    try {
      await syncFilesToSandbox();
      await terminalRef.current.run('python main.py');
    } catch (err: any) {
      console.error('Run error:', err);
      setTerminalError(err?.message || 'Failed to run code');
    }
  };

  const sendInput = async () => {
    if (!terminalInput.trim()) return;

    if (!terminalRef.current) {
      setTerminalError('Terminal not connected');
      return;
    }

    try {
      await terminalRef.current.write(`${terminalInput}\n`);
      setTerminalInput('');
    } catch (err: any) {
      console.error('Send input error:', err);
      setTerminalError(err?.message || 'Failed to send input');
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
          customSetup={{
            entry: activeFile || visibleFiles[0] || '/main.py',
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
            </div>
            {terminalOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </div>
          {terminalOpen && (
            <div className="ide-terminal-body">
              <div className="ide-terminal-output">
                {terminalError ? (
                  <span className="text-rose-400">{terminalError}</span>
                ) : (
                  terminalOutput || 'Run your code to see output here...'
                )}
              </div>
              <div className="ide-terminal-input">
                <input
                  type="text"
                  value={terminalInput}
                  onChange={(e) => setTerminalInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendInput()}
                  placeholder="Enter input..."
                />
                <Button size="sm" onClick={sendInput} disabled={!terminalInput.trim()}>
                  Send
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
