import { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { Button } from './ui/button';
import {
    Play,
    RotateCcw,
    Loader2,
    Save,
    Plus,
    File,
    FolderOpen,
    X,
    ChevronRight,
    ChevronDown,
    TerminalSquare
} from 'lucide-react';

export type ProjectFile = {
    name: string;
    content: string;
    language: string;
};

type Props = {
    files: ProjectFile[];
    onFilesChange: (files: ProjectFile[]) => void;
    onSave?: (files: ProjectFile[]) => void;
    readOnly?: boolean;
    saving?: boolean;
};

export function MonacoIDE({
    files,
    onFilesChange,
    onSave,
    readOnly = false,
    saving = false
}: Props) {
    const [activeFile, setActiveFile] = useState<string>(files[0]?.name || 'main.py');
    const [openTabs, setOpenTabs] = useState<string[]>([files[0]?.name || 'main.py']);
    const [output, setOutput] = useState<string[]>([]);
    const [isRunning, setIsRunning] = useState(false);
    const [newFileName, setNewFileName] = useState('');
    const [showNewFileInput, setShowNewFileInput] = useState(false);
    const [isTerminalOpen, setIsTerminalOpen] = useState(true);

    const currentFile = files.find(f => f.name === activeFile);

    const handleCodeChange = (value: string | undefined) => {
        if (!value || !activeFile) return;
        const updatedFiles = files.map(f =>
            f.name === activeFile ? { ...f, content: value } : f
        );
        onFilesChange(updatedFiles);
    };

    const selectFile = (fileName: string) => {
        setActiveFile(fileName);
        if (!openTabs.includes(fileName)) {
            setOpenTabs([...openTabs, fileName]);
        }
    };

    const closeTab = (fileName: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const newTabs = openTabs.filter(t => t !== fileName);
        setOpenTabs(newTabs);
        if (activeFile === fileName && newTabs.length > 0) {
            setActiveFile(newTabs[newTabs.length - 1]);
        }
    };

    const addNewFile = () => {
        if (!newFileName.trim()) return;

        let fileName = newFileName.trim();
        if (!fileName.endsWith('.py')) {
            fileName += '.py';
        }

        if (files.some(f => f.name === fileName)) {
            setNewFileName('');
            setShowNewFileInput(false);
            return;
        }

        const newFile: ProjectFile = {
            name: fileName,
            content: `# ${fileName}\n`,
            language: 'python'
        };

        onFilesChange([...files, newFile]);
        setOpenTabs([...openTabs, fileName]);
        setActiveFile(fileName);
        setNewFileName('');
        setShowNewFileInput(false);
    };

    const runCode = async () => {
        setIsRunning(true);
        setOutput(['Running main.py...']);

        try {
            await new Promise(resolve => setTimeout(resolve, 500));

            const mainFile = files.find(f => f.name === 'main.py');
            if (!mainFile) {
                setOutput(['Error: main.py not found']);
                return;
            }

            const lines = mainFile.content.split('\n');
            const results: string[] = [];
            const variables: Record<string, any> = {};

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('#')) continue;

                const assignMatch = trimmed.match(/^(\w+)\s*=\s*(.+)$/);
                if (assignMatch) {
                    const [, varName, value] = assignMatch;
                    if (value.match(/^['"].*['"]$/)) {
                        variables[varName] = value.replace(/^['"]|['"]$/g, '');
                    } else if (!isNaN(Number(value))) {
                        variables[varName] = Number(value);
                    } else {
                        variables[varName] = value;
                    }
                    continue;
                }

                if (trimmed.startsWith('print(')) {
                    const match = trimmed.match(/print\((.*?)\)/);
                    if (match) {
                        const content = match[1];
                        if (variables.hasOwnProperty(content)) {
                            results.push(String(variables[content]));
                        } else if (content.match(/^['"].*['"]$/)) {
                            results.push(content.replace(/^['"]|['"]$/g, ''));
                        } else {
                            results.push(content);
                        }
                    }
                }
            }

            setOutput(results.length > 0 ? results : ['Code executed successfully (no output)']);
        } catch (error) {
            setOutput([`Error: ${error}`]);
        } finally {
            setIsRunning(false);
        }
    };

    const getFileIcon = (fileName: string) => {
        if (fileName.endsWith('.py')) return '🐍';
        if (fileName.endsWith('.json')) return '📋';
        if (fileName.endsWith('.txt')) return '📄';
        return '📄';
    };

    return (
        <div className="flex flex-col h-full w-full bg-[#1e1e1e] rounded-lg overflow-hidden">
            {/* Toolbar */}
            <div className="bg-[#252526] px-4 py-2 flex items-center justify-between border-b border-[#3c3c3c]">
                <div className="flex items-center gap-2">
                    <FolderOpen className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-400">Explorer</span>
                </div>
                <div className="flex gap-2">
                    <Button
                        size="sm"
                        onClick={() => setOutput([])}
                        variant="ghost"
                        className="text-gray-400 hover:text-white hover:bg-[#3c3c3c]"
                    >
                        <RotateCcw className="w-4 h-4 mr-1" />
                        Clear
                    </Button>
                    {onSave && (
                        <Button
                            size="sm"
                            onClick={() => onSave(files)}
                            disabled={saving}
                            variant="ghost"
                            className="text-gray-400 hover:text-white hover:bg-[#3c3c3c]"
                        >
                            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                            Save
                        </Button>
                    )}
                    <Button
                        size="sm"
                        onClick={runCode}
                        disabled={isRunning || readOnly}
                        className="bg-[#0e639c] hover:bg-[#1177bb] text-white"
                    >
                        {isRunning ? (
                            <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Running</>
                        ) : (
                            <><Play className="w-4 h-4 mr-1" />Run</>
                        )}
                    </Button>
                </div>
            </div>

            {/* Main Content */}
            <div className={`flex overflow-hidden min-h-0 flex-1`}>
                {/* File Tree Sidebar */}
                <div className="w-60 bg-[#252526] border-r border-[#3c3c3c] flex flex-col">
                    <div className="p-2 text-xs text-gray-400 uppercase tracking-wide flex items-center justify-between">
                        <span>Files</span>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setShowNewFileInput(true)}
                            className="h-5 w-5 p-0 text-gray-400 hover:text-white hover:bg-[#3c3c3c]"
                        >
                            <Plus className="w-3 h-3" />
                        </Button>
                    </div>

                    {showNewFileInput && (
                        <div className="px-2 pb-2">
                            <input
                                type="text"
                                value={newFileName}
                                onChange={e => setNewFileName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && addNewFile()}
                                onBlur={() => {
                                    if (!newFileName) setShowNewFileInput(false);
                                }}
                                placeholder="filename.py"
                                autoFocus
                                className="w-full bg-[#3c3c3c] text-white text-sm px-2 py-1 rounded border border-[#0e639c] focus:outline-none"
                            />
                        </div>
                    )}

                    <div className="flex-1 overflow-auto">
                        {files.map(file => (
                            <div
                                key={file.name}
                                onClick={() => selectFile(file.name)}
                                className={`flex items-center gap-2 px-3 py-1 cursor-pointer text-sm ${activeFile === file.name
                                    ? 'bg-[#37373d] text-white'
                                    : 'text-gray-400 hover:bg-[#2a2d2e]'
                                    }`}
                            >
                                <span>{getFileIcon(file.name)}</span>
                                <span className="truncate">{file.name}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Editor Area */}
                <div className="flex-1 flex flex-col">
                    {/* Tabs */}
                    <div className="flex bg-[#252526] border-b border-[#3c3c3c] overflow-x-auto">
                        {openTabs.map(tab => (
                            <div
                                key={tab}
                                onClick={() => setActiveFile(tab)}
                                className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer border-r border-[#3c3c3c] ${activeFile === tab
                                    ? 'bg-[#1e1e1e] text-white'
                                    : 'bg-[#2d2d2d] text-gray-400 hover:bg-[#2a2d2e]'
                                    }`}
                            >
                                <span>{getFileIcon(tab)}</span>
                                <span>{tab}</span>
                                {openTabs.length > 1 && (
                                    <button
                                        onClick={(e) => closeTab(tab, e)}
                                        className="ml-1 hover:bg-[#3c3c3c] rounded p-0.5"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Monaco Editor */}
                    <div className="flex-1">
                        <Editor
                            height="100%"
                            language={currentFile?.language || 'python'}
                            value={currentFile?.content || ''}
                            onChange={handleCodeChange}
                            theme="vs-dark"
                            options={{
                                minimap: { enabled: false },
                                fontSize: 14,
                                lineNumbers: 'on',
                                scrollBeyondLastLine: false,
                                automaticLayout: true,
                                tabSize: 4,
                                readOnly: readOnly,
                                wordWrap: 'on',
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* Terminal */}
            <div
                style={{ height: isTerminalOpen ? '25%' : '30px' }}
                className="border-t border-[#3c3c3c] bg-[#1e1e1e] flex flex-col overflow-hidden flex-none"
            >
                <div
                    className="px-4 h-9 flex-none bg-[#252526] border-b border-[#3c3c3c] flex items-center justify-between cursor-pointer hover:bg-[#2a2d2e]"
                    onClick={() => setIsTerminalOpen(!isTerminalOpen)}
                >
                    <div className="flex items-center gap-2">
                        <TerminalSquare className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-400">Terminal</span>
                    </div>
                    {isTerminalOpen ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                </div>
                <div className="p-3 flex-1 overflow-auto font-mono text-sm">
                    {output.length === 0 ? (
                        <div className="text-gray-500">Run your code to see output here...</div>
                    ) : (
                        output.map((line, i) => (
                            <div key={i} className="text-green-400 mb-0.5">{line}</div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
