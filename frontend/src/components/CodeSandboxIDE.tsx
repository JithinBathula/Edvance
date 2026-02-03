import { useEffect, useMemo, useRef, useState } from 'react';
import {
  SandpackProvider,
  SandpackLayout,
  SandpackCodeEditor,
  SandpackFileExplorer,
  SandpackPreview,
  useSandpack,
} from '@codesandbox/sandpack-react';
import { nightOwl } from '@codesandbox/sandpack-themes';
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
} from 'lucide-react';
import { ProjectFile } from '../types/workspace';
import { BACKEND_URL } from '../utils/constants';

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

function SandpackSync({
  onFilesChange,
  mode,
}: {
  onFilesChange: (files: ProjectFile[]) => void;
  mode: 'python' | 'web';
}) {
  const { sandpack } = useSandpack();
  const lastSerialized = useRef<string>('');

  useEffect(() => {
    const nextFiles = Object.entries(sandpack.files)
      .map(([path, file]) => ({
        name: path.replace(/^\//, ''),
        content: file.code,
        language: detectLanguage(path),
      }))
      .filter((file) => isAllowedFile(file.name, mode));

    const serialized = JSON.stringify(nextFiles);
    if (serialized !== lastSerialized.current) {
      lastSerialized.current = serialized;
      onFilesChange(nextFiles);
    }
  }, [sandpack.files, onFilesChange]);

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
  const terminalRef = useRef<any>(null);
  const clientRef = useRef<any>(null);
  const connectingRef = useRef(false);

  const filteredFiles = useMemo(() => filterFilesByMode(files, mode), [files, mode]);
  const visibleFiles = useMemo(
    () => filteredFiles.map((file) => toSandpackPath(file.name)),
    [filteredFiles]
  );
  const activeFile = visibleFiles[0];

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

  const connectTerminal = async () => {
    if (!userId || !projectId) return;
    if (clientRef.current || connectingRef.current) return;
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
    } catch (err: any) {
      setTerminalError(err?.message || 'Failed to connect terminal');
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
      }
      if (clientRef.current?.disconnect) {
        clientRef.current.disconnect();
      }
    };
  }, [mode]);

  const syncFilesToSandbox = async () => {
    if (!clientRef.current) return;
    const payload = filteredFiles.map((file) => ({
      path: file.name,
      content: file.content,
    }));
    if (payload.length === 0) return;
    await clientRef.current.fs.batchWrite(payload);
  };

  const runPython = async () => {
    if (!terminalRef.current) {
      await connectTerminal();
    }
    if (!terminalRef.current) return;
    await syncFilesToSandbox();
    await terminalRef.current.run('python main.py');
  };

  const sendInput = () => {
    if (!terminalRef.current || !terminalInput.trim()) return;
    terminalRef.current.write(`${terminalInput}\n`);
    setTerminalInput('');
  };

  return (
    <div className="flex flex-col h-full w-full rounded-2xl overflow-hidden border border-slate-800/80 bg-gradient-to-br from-[#0b1020] via-[#0b1424] to-[#0a0f1a] shadow-[0_18px_60px_rgba(6,12,24,0.55)]">
      <div className="px-4 py-2.5 flex items-center justify-between border-b border-slate-800/70 bg-gradient-to-r from-[#0f172a] via-[#0f182b] to-[#0b1220]">
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-200 font-semibold">Workspace</span>
            <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
              {mode === 'python' ? 'Python VM' : 'Web Preview'}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          {onSave && (
            <Button
              size="sm"
              onClick={() => onSave(filteredFiles)}
              disabled={saving}
              variant="ghost"
              className="text-slate-300 hover:text-white hover:bg-slate-800/60"
            >
              {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
              Save
            </Button>
          )}
          {mode === 'python' && (
            <Button
              size="sm"
              onClick={runPython}
              disabled={terminalLoading || readOnly}
              className="bg-emerald-500/90 hover:bg-emerald-400 text-slate-950"
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

      <div className="flex flex-1 min-h-0 overflow-hidden p-3">
        <SandpackProvider
          template={mode === 'python' ? 'node' : 'vanilla'}
          files={sandpackFiles}
          theme={nightOwl}
          options={{
            readOnly,
            visibleFiles,
            activeFile,
            classes: {
              'sp-wrapper': 'edvance-sandpack',
              'sp-layout': 'edvance-sandpack-layout',
              'sp-tab-button': 'edvance-sandpack-tab',
            },
          }}
        >
          <SandpackSync onFilesChange={onFilesChange} mode={mode} />
          <SandpackLayout className="h-full">
            <div className="w-60 shrink-0 border-r border-slate-800/80 bg-[#0f172a] text-sm flex flex-col">
              <div className="px-3 py-2 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-400 border-b border-slate-800/70">
                <Code2 className="w-3.5 h-3.5" />
                Files
              </div>
              <div className="flex-1 min-h-0 overflow-auto">
                <SandpackFileExplorer className="h-full" autoHiddenFiles />
              </div>
            </div>
            <div className="flex-1 min-w-0 flex flex-col bg-[#0b1220]">
              <div className="flex-1 min-h-0">
                <SandpackCodeEditor
                  showLineNumbers
                  showTabs
                  wrapContent
                  className="h-full"
                  style={{ height: '100%' }}
                />
              </div>
              {mode === 'web' && (
                <div className="h-[40%] border-t border-slate-800/70 bg-[#0f172a]">
                  <div className="px-3 py-2 text-xs uppercase tracking-[0.2em] text-slate-400 border-b border-slate-800/70 flex items-center gap-2">
                    <Globe2 className="w-3.5 h-3.5" />
                    Preview
                  </div>
                  <SandpackPreview
                    showOpenInCodeSandbox={false}
                    style={{ height: 'calc(100% - 34px)' }}
                  />
                </div>
              )}
            </div>
          </SandpackLayout>
        </SandpackProvider>
      </div>

      {mode === 'python' && (
        <div
          style={{ height: terminalOpen ? '25%' : '30px' }}
          className="border-t border-slate-800/80 bg-[#0b1020] flex flex-col overflow-hidden flex-none"
        >
          <div
            className="px-4 h-9 flex-none bg-[#0f172a] border-b border-slate-800/70 flex items-center justify-between cursor-pointer hover:bg-[#152238]"
            onClick={() => setTerminalOpen(!terminalOpen)}
          >
            <div className="flex items-center gap-2">
              <TerminalSquare className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-300">Terminal</span>
            </div>
            {terminalOpen ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
          </div>
          {terminalOpen && (
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="p-3 flex-1 overflow-auto font-mono text-sm whitespace-pre-wrap text-emerald-300">
                {terminalError ? (
                  <div className="text-rose-400">{terminalError}</div>
                ) : (
                  terminalOutput || 'Run your code to see output here...'
                )}
              </div>
              <div className="border-t border-slate-800/70 p-2 flex gap-2 bg-[#0f172a]">
                <input
                  type="text"
                  value={terminalInput}
                  onChange={(e) => setTerminalInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendInput()}
                  placeholder="Enter input..."
                  className="flex-1 bg-[#0b1220] text-white text-sm px-2 py-1 rounded border border-slate-700 focus:outline-none focus:border-emerald-400"
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
