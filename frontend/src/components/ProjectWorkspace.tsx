import { useState, useEffect, useRef } from "react";
import { User } from "../App";
import { BACKEND_URL } from "../utils/constants";
import { CodeSandboxIDE } from "./CodeSandboxIDE";
import { ProjectFile } from "../types/workspace";
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
} from "lucide-react";

// Component to format task description with code highlighting and structure
function FormattedDescription({ text }: { text: string }) {
  // Split into sentences but keep them as logical blocks
  const paragraphs = text.split(/(?<=[.!?])\s+/).filter(Boolean);

  // Helper to format inline code and keywords
  const formatText = (sentence: string) => {
    // First, escape any raw < > that could break HTML (except our own tags)
    let result = sentence
      // Convert React/JSX component tags like <Rect>, <Line>, <Circle> to styled code
      .replace(/<([A-Z][a-zA-Z0-9]*)>/g, '<code class="inline-code">&lt;$1&gt;</code>')
      .replace(/<([A-Z][a-zA-Z0-9]*)\s*\/>/g, '<code class="inline-code">&lt;$1 /&gt;</code>')
      // Backtick code - this is the main one for code in descriptions
      .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

    // Now apply other formatting (these shouldn't conflict with the code blocks)
    result = result
      // Only match single-quoted text without spaces (code doesn't have spaces)
      .replace(/'([^'\s]+)'/g, '<code class="inline-code">$1</code>')
      // Highlight common programming keywords
      .replace(/\b(API|JSON|ISO 8601|HTTP|GET|POST|PUT|DELETE)\b/gi, '<span class="keyword">$1</span>');

    return result;
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
              <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xs font-semibold shrink-0 mt-0.5">
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
          color: #f97316;
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
  project: initialProject,
  onBack,
  onComplete,
}: Props) {
  const [filesLoading, setFilesLoading] = useState(true);
  // State for fresh project data from API
  const [project, setProject] = useState(initialProject);
  const [projectLoading, setProjectLoading] = useState(true);

  // Restore current task from localStorage
  const [currentTaskIndex, setCurrentTaskIndex] = useState(() => {
    const saved = localStorage.getItem(`edvance_project_${initialProject.id}_current_task`);
    return saved ? parseInt(saved, 10) : 0;
  });

  // Restore completed tasks from localStorage
  const [completedTasks, setCompletedTasks] = useState<string[]>(() => {
    const saved = localStorage.getItem(`edvance_project_${initialProject.id}_completed_tasks`);
    return saved ? JSON.parse(saved) : [];
  });

  const [projectFiles, setProjectFiles] = useState<ProjectFile[]>([
    { name: 'main.py', content: '# Write your code here\n', language: 'python' }
  ]);
  const [showHints, setShowHints] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const filesLoaded = useRef(false);
  const lastProjectSignature = useRef<string>('');
  const taskListPanelRef = useRef<ImperativePanelHandle>(null);

  // Chat State
  const [isChatOpen, setIsChatOpen] = useState(true);

  // Screen Size State (Default to true/large)
  const [isLargeScreen, setIsLargeScreen] = useState(window.innerWidth > 1200);

  // Submission gate state
  const [evaluating, setEvaluating] = useState(false);
  const [evaluationFeedback, setEvaluationFeedback] = useState<string | null>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  const tasks: Task[] = project.tasks || [];
  const currentTask = tasks[currentTaskIndex];
  const hasTasks = tasks.length > 0 && !!currentTask;
  const safeCurrentTask: Task = currentTask || {
    id: 'generating',
    title: 'Generating tasks...',
    description: 'Tasks are being generated. The editor is ready while we load the task details.',
    hints: [],
    starterCode: '# Write your code here\n',
  };
  const progress = tasks.length > 0 ? (completedTasks.length / tasks.length) * 100 : 0;

  const buildProjectSignature = (milestones: any[] = []) =>
    JSON.stringify(
      milestones.map((milestone) => ({
        id: milestone.id,
        status: milestone.tasks && milestone.tasks.length > 0 ? 'ready' : 'generating',
        taskIds: (milestone.tasks || []).map((task: any) => task.id),
      }))
    );

  // Persist current task index
  useEffect(() => {
    localStorage.setItem(`edvance_project_${initialProject.id}_current_task`, String(currentTaskIndex));
  }, [currentTaskIndex, initialProject.id]);

  // Persist completed tasks
  useEffect(() => {
    localStorage.setItem(`edvance_project_${initialProject.id}_completed_tasks`, JSON.stringify(completedTasks));
  }, [completedTasks, initialProject.id]);

  // Track Window Resize for Chat Width
  useEffect(() => {
    const handleResize = () => {
      setIsLargeScreen(window.innerWidth > 1200);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch fresh project data on mount
  useEffect(() => {
    const fetchProject = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/progress/projects/${initialProject.id}/full`, {
          credentials: 'include',
        });
        const data = await response.json();
        if (data.success && data.project) {
          setProject(data.project);
          lastProjectSignature.current = buildProjectSignature(data.project.milestones);
        }
      } catch (err) {
        console.error('Error fetching project:', err);
      } finally {
        setProjectLoading(false);
      }
    };

    fetchProject();
  }, [initialProject.id]);

  // Poll for milestone updates (tasks are generated async)
  useEffect(() => {
    if (!project.milestones || project.milestones.length === 0) return;

    const hasGeneratingMilestones = project.milestones.some(
      (m: any) => !m.tasks || m.tasks.length === 0
    );

    if (!hasGeneratingMilestones) return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/progress/projects/${initialProject.id}/full`, {
          credentials: 'include',
        });
        const data = await response.json();

        if (data.success && data.project) {
          const newSignature = buildProjectSignature(data.project.milestones);
          if (newSignature !== lastProjectSignature.current) {
            lastProjectSignature.current = newSignature;
            setProject(data.project);
          }

          const stillGenerating = data.project.milestones.some(
            (m: any) => !m.tasks || m.tasks.length === 0
          );

          if (!stillGenerating) {
            clearInterval(pollInterval);
          }
        }
      } catch (err) {
        console.error('Poll error:', err);
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [project.milestones, initialProject.id]);

  // Load saved files ONCE on project load
  useEffect(() => {
    if (!filesLoaded.current && project.id && !projectLoading) {
      loadSavedFiles();
      filesLoaded.current = true;
    }
  }, [project.id, projectLoading]);

  useEffect(() => {
    if (project.progress?.completedTasks) {
      setCompletedTasks(project.progress.completedTasks);
    }
  }, [project]);

  const loadSavedFiles = async () => {
    setFilesLoading(true);
    try {
      const response = await fetch(
        `${BACKEND_URL}/workspace/${project.id}?user_id=${user.id}`,
        { credentials: 'include' }
      );
      const data = await response.json();

      if (data.success && Array.isArray(data.files) && data.files.length > 0) {
        setProjectFiles(data.files);
        return;
      }

      const starterCode = currentTask?.starterCode || '# Write your code here\n';
      setProjectFiles([
        { name: 'main.py', content: starterCode, language: 'python' }
      ]);
    } catch (err) {
      console.error('Error loading files:', err);
    } finally {
      setFilesLoading(false);
    }
  };

  const saveFiles = async (files: ProjectFile[]) => {
    setSaving(true);
    try {
      const response = await fetch(`${BACKEND_URL}/workspace/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          user_id: user.id,
          project_id: project.id,
          files: files,
        }),
      });
      const data = await response.json();
      if (data.success) {
        toast.success('Saved');
      }
    } catch (err) {
      console.error('Error saving files:', err);
      toast.error('Failed to save files');
    } finally {
      setSaving(false);
    }
  };

  const handleCompleteTask = async () => {
    // Format all files for evaluation
    const code = projectFiles
      .map(f => `# === ${f.name} ===\n${f.content || ''}`)
      .join('\n\n');

    setEvaluating(true);
    setEvaluationFeedback(null);

    try {
      const response = await fetch(`${BACKEND_URL}/submission/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          user_id: user.id,
          task_id: safeCurrentTask.id,
          code: code,
          project_id: project.id,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        toast.error(data.error || 'Evaluation failed');
        return;
      }

      if (data.is_correct) {
        await saveFiles(projectFiles);

        const newCompleted = [...completedTasks, safeCurrentTask.id];
        setCompletedTasks(newCompleted);

        // If next task was adapted, update the project tasks
        if (data.next_task && currentTaskIndex < tasks.length - 1) {
          const updatedTasks = [...tasks];
          updatedTasks[currentTaskIndex + 1] = {
            ...updatedTasks[currentTaskIndex + 1],
            description: data.next_task.description || updatedTasks[currentTaskIndex + 1].description,
            hints: data.next_task.hints || updatedTasks[currentTaskIndex + 1].hints,
          };

          const updatedMilestones = project.milestones?.map((milestone: any) => ({
            ...milestone,
            tasks: milestone.tasks?.map((task: any) => {
              const updatedTask = updatedTasks.find((t: any) => t.id === task.id);
              return updatedTask || task;
            }),
          }));

          setProject({
            ...project,
            milestones: updatedMilestones,
            tasks: updatedTasks,
          });

          console.log('✅ Next task updated with adapted content');
        }

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
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-orange-50 flex items-center justify-center p-4">
        <Card className="max-w-2xl w-full p-12 text-center bg-white">
          <div className="w-20 h-20 bg-gradient-to-br from-[#ffa200] to-[#ff8800] rounded-full flex items-center justify-center mx-auto mb-6">
            <Trophy className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-4xl mb-4">Amazing Work! 🎉</h2>
          <p className="text-xl text-gray-600 mb-6">
            You've successfully completed:{" "}
            <span className="font-semibold">{project.title}</span>
          </p>

          <div className="bg-gradient-to-r from-purple-50 to-orange-50 rounded-xl p-6 mb-6">
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
            className="bg-gradient-to-r from-[#7622e5] to-[#b480f8] hover:from-[#6518d0] hover:to-[#a070e8]"
          >
            Back to Home
          </Button>
        </Card>
      </div>
    );
  }

  if (projectLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#7622e5]" />
      </div>
    );
  }

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
              {hasTasks ? `Task ${currentTaskIndex + 1} of ${tasks.length}` : 'Loading tasks...'}
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
          id="task-list"
          order={1}
          ref={taskListPanelRef}
          defaultSize={15}
          minSize={3}
          maxSize={25}
          collapsible
          collapsedSize={3}
          onCollapse={() => setSidebarCollapsed(true)}
          onExpand={() => setSidebarCollapsed(false)}
        >
          <div className="h-full overflow-hidden border-r border-gray-200 flex flex-col bg-gradient-to-b from-white to-gray-50">
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
                  {(() => {
                    // Group tasks by their major number (1, 2, 3, etc.)
                    const groupedTasks: { [key: string]: { name: string; tasks: Array<typeof tasks[0] & { originalIdx: number }> } } = {};
                    tasks.forEach((task, idx) => {
                      const match = task.title.match(/(\d+)\.(\d+)/);
                      const majorNum = match ? match[1] : String(idx + 1);
                      const taskName = task.title.replace(/[:\s]*\d+\.\d+$/, '').trim();
                      if (!groupedTasks[majorNum]) {
                        groupedTasks[majorNum] = { name: taskName, tasks: [] };
                      }
                      groupedTasks[majorNum].tasks.push({ ...task, originalIdx: idx });
                    });

                    return Object.entries(groupedTasks).map(([majorNum, group]) => (
                      <div key={majorNum} className="mb-3">
                        {/* Group Header */}
                        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-2 py-1 mb-1">
                          Task {majorNum}: {group.name}
                        </div>
                        {/* Subtasks */}
                        {group.tasks.map((task) => {
                          const idx = task.originalIdx;
                          const subNum = task.title.match(/\d+\.(\d+)/)?.[1] || '1';
                          return (
                            <button
                              key={task.id}
                              onClick={() => {
                                setCurrentTaskIndex(idx);
                                setShowHints(false);
                              }}
                              className="w-full text-left px-3 py-2 rounded-lg mb-1 flex items-center gap-3 transition-all duration-200 ml-2 hover:bg-gray-50"
                              style={idx === currentTaskIndex
                                ? { background: '#fff7ed', color: '#ea580c', fontWeight: 500, borderLeft: '3px solid #ea580c' }
                                : completedTasks.includes(task.id)
                                  ? { color: '#059669', borderLeft: '3px solid #10b981' }
                                  : { color: '#374151', borderLeft: '3px solid transparent' }
                              }
                            >
                              <span className="text-xs font-medium">• {majorNum}.{subNum}</span>
                            </button>
                          );
                        })}
                      </div>
                    ));
                  })()}
                </div>
              </div>
            )}
          </div>
        </ResizablePanel>

        {!sidebarCollapsed && <ResizableHandle />}

        {/* Pane 2: Task Details */}
        <ResizablePanel id="task-details" order={2} defaultSize={isChatOpen ? 25 : 43} minSize={15} maxSize={50}>
          <div className="h-full overflow-hidden border-r border-gray-200 flex flex-col" style={{ background: 'linear-gradient(to bottom right, #fffbeb, white, #ecfeff)' }}>
            <div className="flex-1 overflow-y-auto p-6">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4 leading-snug">{safeCurrentTask.title}</h2>
              <div className="prose max-w-none mb-6">
                <FormattedDescription text={safeCurrentTask.description} />
              </div>

              {safeCurrentTask.hints && safeCurrentTask.hints.length > 0 && (
                <div className="mb-6">
                  <button
                    onClick={() => setShowHints(!showHints)}
                    className="flex items-center gap-2 text-base font-medium transition-colors"
                    style={{ color: '#0891b2' }}
                  >
                    {showHints ? (
                      <ChevronDown className="w-5 h-5" />
                    ) : (
                      <ChevronRight className="w-5 h-5" />
                    )}
                    {showHints ? "Hide Hints" : "Show Hints"}
                  </button>
                  {showHints && (
                    <div className="mt-3 rounded-xl p-6 shadow-sm" style={{ background: 'linear-gradient(to bottom right, #ecfeff, white)', border: '1px solid #cffafe' }}>
                      <div className="space-y-5">
                        {safeCurrentTask.hints.map((hint, idx) => (
                          <div
                            key={idx}
                            className="flex items-start gap-4"
                          >
                            <span className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 mt-0.5" style={{ backgroundColor: '#cffafe', color: '#0891b2' }}>
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
                disabled={saving || evaluating || !hasTasks}
                className="w-full shadow-md hover:shadow-lg transition-shadow"
                style={{ background: 'linear-gradient(to right, #f59e0b, #f97316)' }}
              >
                {evaluating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Evaluating...
                  </>
                ) : hasTasks && completedTasks.includes(safeCurrentTask.id)
                  ? "Completed ✓"
                  : hasTasks && currentTaskIndex < tasks.length - 1
                    ? "Complete & Continue"
                    : hasTasks
                      ? "Complete Project"
                      : "Waiting for tasks..."}
              </Button>
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle />

        {/* Pane 3: IDE */}
        <ResizablePanel id="ide" order={3} defaultSize={isChatOpen ? 40 : 42} minSize={20}>
          <div className="h-full overflow-hidden flex flex-col bg-[#0b1020]">
            <div className="flex-1 p-3">
              {filesLoading ? (
                <div className="h-full flex items-center justify-center text-slate-400">
                  Loading...
                </div>
              ) : (
                <CodeSandboxIDE
                  files={projectFiles}
                  onFilesChange={setProjectFiles}
                  onSave={saveFiles}
                  saving={saving}
                  userId={user.id}
                  projectId={project.id}
                  vmType={project?.vm_type}
                />
              )}
            </div>
          </div>
        </ResizablePanel>

        {/* Pane 4: Chatbot Sidebar */}
        {isChatOpen && (
          <>
            <ResizableHandle />
            <ResizablePanel id="chat" order={4} defaultSize={20} minSize={15} maxSize={35}>
              <div className="h-full border-l border-gray-200 bg-white flex flex-col overflow-hidden">
                <AIChatbot
                  context={`Working on: ${safeCurrentTask.title}`}
                  userProgress={completedTasks}
                  taskId={safeCurrentTask.id}
                  userId={user.id}
                  projectId={project.id}
                  userCode={projectFiles.map(f => `# === ${f.name} ===\n${f.content || ''}`).join('\n\n')}
                  taskDescription={safeCurrentTask.description}
                  testSpec={safeCurrentTask.testSpec}
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
                    <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xs font-semibold shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <p className="text-gray-700 text-sm leading-relaxed"
                      dangerouslySetInnerHTML={{
                        __html: sentence
                          .replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 bg-gray-100 rounded text-orange-600 font-mono text-xs">$1</code>')
                          // Only match single-quoted text without spaces
                          .replace(/'([^'\s]+)'/g, '<code class="px-1.5 py-0.5 bg-gray-100 rounded text-orange-600 font-mono text-xs">$1</code>')
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
                className="w-full bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800"
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
