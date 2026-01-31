import { useState, useEffect, useRef } from "react";
import { User } from "../App";
import { BACKEND_URL } from "../utils/constants";
import { MonacoIDE, ProjectFile } from "./MonacoIDE";
import { AIChatbot } from "./AIChatbot";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Progress } from "./ui/progress";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "./ui/resizable";
import type { ImperativePanelHandle } from "react-resizable-panels";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  Trophy,
  Sparkles,
  PanelLeftClose,
  PanelLeft,
  Loader2,
  X,
  AlertCircle,
  MessageCircle,
  Code,
  FileText,
} from "lucide-react";

// Component to format task description with code highlighting and structure
function FormattedDescription({ text }: { text: string }) {
  // Split into sentences but keep them as logical blocks
  const paragraphs = text.split(/(?<=[.!?])\s+/).filter(Boolean);

  // Helper to format inline code and keywords
  const formatText = (sentence: string) => {
    // Replace 'quoted text' with styled code spans
    return sentence
      .replace(/'([^']+)'/g, '<code class="inline-code">$1</code>')
      .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
      // Highlight common programming keywords
      .replace(/\b(API|JSON|ISO 8601|HTTP|GET|POST|PUT|DELETE)\b/gi, '<span class="keyword">$1</span>');
  };

  // Group sentences into logical sections if there are multiple
  const renderContent = () => {
    if (paragraphs.length <= 2) {
      // Short description - render as flowing text
      return (
        <p
          className="text-gray-600 text-base leading-relaxed"
          dangerouslySetInnerHTML={{ __html: formatText(text) }}
        />
      );
    }

    // Longer description - render with visual structure
    return (
      <div className="space-y-4">
        {/* First paragraph as intro */}
        <p
          className="text-gray-700 text-base leading-relaxed font-medium"
          dangerouslySetInnerHTML={{ __html: formatText(paragraphs[0]) }}
        />

        {/* Remaining as numbered points */}
        <div className="space-y-3">
          {paragraphs.slice(1).map((sentence, i) => (
            <div key={i} className="flex items-start gap-3 pl-1">
              <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-xs font-semibold shrink-0 mt-0.5">
                {i + 1}
              </span>
              <p
                className="text-gray-600 text-base leading-relaxed flex-1"
                dangerouslySetInnerHTML={{ __html: formatText(sentence) }}
              />
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <>
      <style>{`
        .inline-code {
          background: linear-gradient(135deg, #f0e6ff 0%, #e8f0ff 100%);
          color: #7622e5;
          padding: 0.125rem 0.375rem;
          border-radius: 0.25rem;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 0.875em;
          font-weight: 500;
        }
        .keyword {
          color: #059669;
          font-weight: 600;
        }
      `}</style>
      {renderContent()}
    </>
  );
}

type Task = {
  id: string;
  title: string;
  description: string;
  hints: string[];
  starterCode: string;
  testSpec?: {
    expected_state?: string;
    verification_code?: string;
  };
};

type Props = {
  user: User;
  project: any;
  onBack: () => void;
  onComplete: () => void;
};

export function ProjectWorkspace({
  user,
  project,
  onBack,
  onComplete,
}: Props) {
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
  const [completedTasks, setCompletedTasks] = useState<string[]>([]);
  const [projectFiles, setProjectFiles] = useState<ProjectFile[]>([
    { name: 'main.py', content: '# Write your code here\n', language: 'python' }
  ]);
  const [showHints, setShowHints] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const filesLoaded = useRef(false);
  const taskListPanelRef = useRef<ImperativePanelHandle>(null);

  // Chat State
  const [isChatOpen, setIsChatOpen] = useState(true);

  // Screen Size State (Default to true/large)
  // We use 1200px as a breakpoint. 
  // - Full screen usually > 1200px.
  // - Half screen usually < 1200px.
  const [isLargeScreen, setIsLargeScreen] = useState(window.innerWidth > 1200);

  // Submission gate state
  const [evaluating, setEvaluating] = useState(false);
  const [evaluationFeedback, setEvaluationFeedback] = useState<string | null>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  const tasks: Task[] = project.tasks || [];
  const currentTask = tasks[currentTaskIndex];
  const progress = (completedTasks.length / tasks.length) * 100;

  // Track Window Resize for Chat Width
  useEffect(() => {
    const handleResize = () => {
      setIsLargeScreen(window.innerWidth > 1200);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!filesLoaded.current && project.id) {
      loadSavedFiles();
      filesLoaded.current = true;
    }
  }, [project.id]);

  useEffect(() => {
    if (project.progress?.completedTasks) {
      setCompletedTasks(project.progress.completedTasks);
    }
  }, [project]);

  const loadSavedFiles = async () => {
    try {
      const firstTaskId = tasks[0]?.id;
      if (!firstTaskId) return;

      const response = await fetch(
        `${BACKEND_URL}/progress/load/${firstTaskId}?user_id=${user.id}`,
        { credentials: 'include' }
      );
      const data = await response.json();

      if (data.success && data.code) {
        try {
          const parsed = JSON.parse(data.code);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setProjectFiles(parsed);
            return;
          }
        } catch {
          setProjectFiles([
            { name: 'main.py', content: data.code, language: 'python' }
          ]);
          return;
        }
      }

      const starterCode = currentTask?.starterCode || '# Write your code here\n';
      setProjectFiles([
        { name: 'main.py', content: starterCode, language: 'python' }
      ]);
    } catch (err) {
      console.error('Error loading files:', err);
    }
  };

  const saveFiles = async (files: ProjectFile[]) => {
    const firstTaskId = tasks[0]?.id;
    if (!firstTaskId) return;

    setSaving(true);
    try {
      const response = await fetch(`${BACKEND_URL}/progress/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          user_id: user.id,
          task_id: firstTaskId,
          code: JSON.stringify(files),
        }),
      });
      const data = await response.json();
      if (data.success) {
        toast.success(`Saved (v${data.version})`);
      }
    } catch (err) {
      console.error('Error saving files:', err);
      toast.error('Failed to save files');
    } finally {
      setSaving(false);
    }
  };

  const handleCompleteTask = async () => {
    const mainFile = projectFiles.find(f => f.name === 'main.py') || projectFiles[0];
    const code = mainFile?.content || '';

    setEvaluating(true);
    setEvaluationFeedback(null);

    try {
      const response = await fetch(`${BACKEND_URL}/submission/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          user_id: user.id,
          task_id: currentTask.id,
          code: code,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        toast.error(data.error || 'Evaluation failed');
        return;
      }

      if (data.is_correct) {
        await saveFiles(projectFiles);
        const newCompleted = [...completedTasks, currentTask.id];
        setCompletedTasks(newCompleted);
        toast.success(data.feedback || 'Great job! Task completed.');

        if (currentTaskIndex < tasks.length - 1) {
          setCurrentTaskIndex(currentTaskIndex + 1);
          setShowHints(false);
        } else {
          await handleProjectComplete();
        }
      } else {
        setEvaluationFeedback(data.feedback);
        setShowFeedbackModal(true);
      }
    } catch (err) {
      console.error('Error evaluating submission:', err);
      toast.error('Failed to evaluate submission. Please try again.');
    } finally {
      setEvaluating(false);
    }
  };

  const handleProjectComplete = async () => {
    setShowCompletion(true);
  };

  if (showCompletion) {
    return (
      <div className="min-h-screen bg-linear-to-br from-purple-50 to-orange-50 flex items-center justify-center p-4">
        <Card className="max-w-2xl w-full p-12 text-center bg-white">
          <div className="w-20 h-20 bg-linear-to-br from-[#ffa200] to-[#ff8800] rounded-full flex items-center justify-center mx-auto mb-6">
            <Trophy className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-4xl mb-4">Amazing Work! 🎉</h2>
          <p className="text-xl text-gray-600 mb-6">
            You've successfully completed:{" "}
            <span className="font-semibold">{project.title}</span>
          </p>

          <div className="bg-linear-to-r from-purple-50 to-orange-50 rounded-xl p-6 mb-6">
            <div className="flex items-center justify-center gap-3 mb-2">
              <Sparkles className="w-6 h-6 text-[#ffa200]" />
              <p className="text-2xl">+100 XP Earned!</p>
              <Sparkles className="w-6 h-6 text-[#ffa200]" />
            </div>
            <p className="text-sm text-gray-600">
              You now have {(user.xp || 0) + 100} total XP
            </p>
          </div>

          <p className="text-gray-600 mb-8">
            You've built something real and learned by doing.
            This project is now part of your portfolio!
          </p>

          <Button
            onClick={onComplete}
            className="bg-linear-to-r from-[#7622e5] to-[#b480f8] hover:from-[#6518d0] hover:to-[#a070e8]"
          >
            Back to Home
          </Button>
        </Card>
      </div>
    );
  }

  if (!currentTask) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading project...</p>
      </div>
    );
  }

  // Calculate chat width based on open state AND screen size
  const chatWidth = isChatOpen
    ? (isLargeScreen ? '35rem' : '20rem')
    : '0px';

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Header */}
      <header className="border-b bg-white px-4 py-3 flex items-center justify-between shrink-0 h-16">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-semibold">{project.title}</h1>
            <p className="text-sm text-gray-500">
              Task {currentTaskIndex + 1} of {tasks.length}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-48">
            <Progress value={progress} className="h-2" />
          </div>
          <span className="text-sm text-gray-600">
            {completedTasks.length}/{tasks.length} completed
          </span>
        </div>
      </header>

      {/* Main Content - RESIZABLE PANEL LAYOUT */}
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* Pane 1: Task List */}
        <ResizablePanel
          ref={taskListPanelRef}
          defaultSize={15}
          minSize={3}
          maxSize={25}
          collapsible
          collapsedSize={3}
          onCollapse={() => setSidebarCollapsed(true)}
          onExpand={() => setSidebarCollapsed(false)}
        >
          <div className="h-full overflow-hidden border-r border-gray-200 flex flex-col bg-linear-to-b from-white to-gray-50">
            <div className="px-3 py-3 flex items-center justify-between border-b border-gray-200 bg-white">
              {!sidebarCollapsed && <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tasks</span>}
              <button
                onClick={() => {
                  const panel = taskListPanelRef.current;
                  if (panel) {
                    if (sidebarCollapsed) {
                      panel.expand();
                    } else {
                      panel.collapse();
                    }
                  }
                }}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                {sidebarCollapsed ? <PanelLeft className="w-4 h-4 text-gray-500" /> : <PanelLeftClose className="w-4 h-4 text-gray-500" />}
              </button>
            </div>
            {!sidebarCollapsed && (
              <div className="flex-1 overflow-y-auto">
                <div className="p-2">
                  {tasks.map((task, idx) => (
                    <button
                      key={task.id}
                      onClick={() => {
                        setCurrentTaskIndex(idx);
                        setShowHints(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg mb-1 flex items-center gap-2.5 transition-all duration-150 ${idx === currentTaskIndex
                        ? "bg-linear-to-r from-purple-100 to-purple-50 text-purple-700 shadow-sm border border-purple-200"
                        : completedTasks.includes(task.id)
                          ? "text-green-600 hover:bg-green-50"
                          : "text-gray-600 hover:bg-gray-100"
                        }`}
                    >
                      {completedTasks.includes(task.id) ? (
                        <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center shrink-0">
                          <Check className="w-2.5 h-2.5 text-white" />
                        </div>
                      ) : (
                        <div className={`w-4 h-4 rounded-full border-2 shrink-0 ${idx === currentTaskIndex ? 'border-purple-400' : 'border-gray-300'}`} />
                      )}
                      <span className="text-xs font-medium leading-tight line-clamp-2">{task.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ResizablePanel>

        {!sidebarCollapsed && <ResizableHandle />}

        {/* Pane 2: Task Details */}
        <ResizablePanel defaultSize={30} minSize={15} maxSize={50}>
          <div className="h-full overflow-hidden border-r border-gray-200 flex flex-col bg-linear-to-br from-purple-50 via-white to-orange-50">
            <div className="flex-1 overflow-y-auto p-6">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4 leading-snug">{currentTask.title}</h2>
              <div className="prose max-w-none mb-6">
                <FormattedDescription text={currentTask.description} />
              </div>

              {currentTask.hints && currentTask.hints.length > 0 && (
                <div className="mb-6">
                  <button
                    onClick={() => setShowHints(!showHints)}
                    className="flex items-center gap-2 text-base font-medium text-purple-600 hover:text-purple-700 transition-colors"
                  >
                    {showHints ? (
                      <ChevronDown className="w-5 h-5" />
                    ) : (
                      <ChevronRight className="w-5 h-5" />
                    )}
                    {showHints ? "Hide Hints" : "Show Hints"}
                  </button>
                  {showHints && (
                    <div className="mt-3 bg-gradient-to-br from-purple-50 to-white rounded-xl p-6 border border-purple-100 shadow-sm">
                      <div className="space-y-5">
                        {currentTask.hints.map((hint, idx) => (
                          <div
                            key={idx}
                            className="flex items-start gap-4"
                          >
                            <span className="w-7 h-7 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-sm font-semibold shrink-0 mt-0.5">
                              {idx + 1}
                            </span>
                            <p
                              className="text-base text-gray-700 leading-relaxed flex-1 pt-0.5"
                              dangerouslySetInnerHTML={{
                                __html: hint
                                  .replace(/'([^']+)'/g, '<code class="inline-code">$1</code>')
                                  .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
                                  .replace(/\b([a-z_][a-z0-9_]*\(\))/gi, '<code class="inline-code">$1</code>')
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <Button
                onClick={handleCompleteTask}
                disabled={saving || evaluating}
                className="w-full bg-linear-to-r from-[#7622e5] to-[#b480f8] hover:from-[#6518d0] hover:to-[#a070e8] shadow-md hover:shadow-lg transition-shadow"
              >
                {evaluating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Evaluating...
                  </>
                ) : completedTasks.includes(currentTask.id)
                  ? "Completed ✓"
                  : currentTaskIndex < tasks.length - 1
                    ? "Complete & Continue"
                    : "Complete Project"}
              </Button>
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle />

        {/* Pane 3: IDE */}
        <ResizablePanel defaultSize={isChatOpen ? 35 : 55} minSize={20}>
          <div className="h-full overflow-hidden flex flex-col bg-gray-900">
            <div className="flex-1 p-1">
              <MonacoIDE
                files={projectFiles}
                onFilesChange={setProjectFiles}
                onSave={saveFiles}
                saving={saving}
              />
            </div>
          </div>
        </ResizablePanel>

        {/* Pane 4: Chatbot Sidebar */}
        {isChatOpen && (
          <>
            <ResizableHandle />
            <ResizablePanel defaultSize={20} minSize={15} maxSize={35}>
              <div className="h-full border-l border-gray-200 bg-white flex flex-col overflow-hidden">
                <AIChatbot
                  context={`Working on: ${currentTask.title}`}
                  userProgress={completedTasks}
                  taskId={currentTask.id}
                  userCode={projectFiles.find(f => f.name === 'main.py')?.content || projectFiles[0]?.content || ''}
                  taskDescription={currentTask.description}
                  testSpec={currentTask.testSpec}
                  onClose={() => setIsChatOpen(false)}
                  visible={true}
                />
              </div>
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>

      {/* Floating Chat Button */}
      {!isChatOpen && (
        <button
          onClick={() => setIsChatOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-110 hover:shadow-xl z-50"
          style={{ backgroundColor: '#4285f4' }}
          title="Open AI Chat"
        >
          <MessageCircle className="w-6 h-6 text-white" />
        </button>
      )}

      {/* Feedback Modal */}
      {showFeedbackModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="bg-white rounded-xl shadow-2xl overflow-hidden" style={{ maxWidth: '560px', width: '100%' }}>
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 px-6 py-4 border-b border-amber-100">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                    <AlertCircle className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Not Quite Right</h3>
                    <p className="text-sm text-gray-500">Review the feedback below and try again</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowFeedbackModal(false)}
                  className="text-gray-400 hover:text-gray-600 p-1.5 hover:bg-white/50 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content - formatted as list */}
            <div className="px-6 py-5">
              <div className="space-y-3">
                {evaluationFeedback?.split(/(?<=\.)\s+/).filter(Boolean).map((sentence, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-xs font-semibold shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <p className="text-gray-700 text-sm leading-relaxed"
                      dangerouslySetInnerHTML={{
                        __html: sentence
                          .replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 bg-gray-100 rounded text-purple-600 font-mono text-xs">$1</code>')
                          .replace(/'([^']+)'/g, '<code class="px-1.5 py-0.5 bg-gray-100 rounded text-purple-600 font-mono text-xs">$1</code>')
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
              <Button
                onClick={() => setShowFeedbackModal(false)}
                className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800"
              >
                Try Again
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
