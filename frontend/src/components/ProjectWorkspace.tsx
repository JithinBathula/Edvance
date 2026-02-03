import { useState, useEffect, useRef } from "react";
import { User } from "../App";
import { BACKEND_URL } from "../utils/constants";
import { CodeSandboxIDE } from "./CodeSandboxIDE";
import { ProjectFile } from "../types/workspace";
import { AIChatbot } from "./AIChatbot";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Progress } from "./ui/progress";
import { ScrollArea } from "./ui/scroll-area";
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
} from "lucide-react";

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

  // Submission gate state
  const [evaluating, setEvaluating] = useState(false);
  const [evaluationFeedback, setEvaluationFeedback] = useState<string | null>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  const tasks: Task[] = project.tasks || [];
  const currentTask = tasks[currentTaskIndex];
  const progress = (completedTasks.length / tasks.length) * 100;

  // Load saved files ONCE on project load (not per task - files persist across tasks)
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
      // Load files from first task (they're shared across all tasks)
      const firstTaskId = tasks[0]?.id;
      if (!firstTaskId) return;

      const response = await fetch(
        `${BACKEND_URL}/workspace/${project.id}?user_id=${user.id}`,
        { credentials: 'include' }
      );
      const data = await response.json();

      if (data.success && Array.isArray(data.files) && data.files.length > 0) {
        setProjectFiles(data.files);
        return;
      }

      // No saved code - use starter code if available
      const starterCode = currentTask?.starterCode || '# Write your code here\n';
      setProjectFiles([
        { name: 'main.py', content: starterCode, language: 'python' }
      ]);
    } catch (err) {
      console.error('Error loading files:', err);
    }
  };

  const saveFiles = async (files: ProjectFile[]) => {
    // Save to project repo; include task ID if available
    const firstTaskId = tasks[0]?.id;

    setSaving(true);
    try {
      const response = await fetch(`${BACKEND_URL}/workspace/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          user_id: user.id,
          project_id: project.id,
          task_id: firstTaskId,
          files: files,
        }),
      });
      const data = await response.json();
      if (data.success) {
        toast.success(`Saved`);
      }
    } catch (err) {
      console.error('Error saving files:', err);
      toast.error('Failed to save files');
    } finally {
      setSaving(false);
    }
  };


  const handleCompleteTask = async () => {
    // Get the main file content for evaluation
    const mainFile = projectFiles.find(f => f.name === 'main.py') || projectFiles[0];
    const code = mainFile?.content || '';

    setEvaluating(true);
    setEvaluationFeedback(null);

    try {
      // Call submission evaluation API
      const response = await fetch(`${BACKEND_URL}/submission/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          user_id: user.id,
          task_id: currentTask.id,
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
        // Success! Save files and advance
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
        // Incorrect - show feedback modal
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

  if (!currentTask) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading project...</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Header */}
      <header className="border-b bg-white px-4 py-3 flex items-center justify-between">
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

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left - Task List */}
        <div
          className="flex-none overflow-hidden border-r border-gray-200 flex flex-col bg-gradient-to-b from-white to-gray-50 transition-all duration-200"
          style={{ width: sidebarCollapsed ? '3rem' : '20%' }}
        >
          <div className="px-3 py-3 flex items-center justify-between border-b border-gray-200 bg-white">
            {!sidebarCollapsed && <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tasks</span>}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
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
                      ? "bg-gradient-to-r from-purple-100 to-purple-50 text-purple-700 shadow-sm border border-purple-200"
                      : completedTasks.includes(task.id)
                        ? "text-green-600 hover:bg-green-50"
                        : "text-gray-600 hover:bg-gray-100"
                      }`}
                  >
                    {completedTasks.includes(task.id) ? (
                      <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                        <Check className="w-2.5 h-2.5 text-white" />
                      </div>
                    ) : (
                      <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${idx === currentTaskIndex ? 'border-purple-400' : 'border-gray-300'}`} />
                    )}
                    <span className="text-xs font-medium leading-tight">{task.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Center - Task Details */}
        <div
          className="flex-none min-w-0 overflow-hidden border-r border-gray-200 flex flex-col bg-gradient-to-br from-purple-50 via-white to-orange-50"
          style={{ width: '30%' }}
        >
          <div className="flex-1 overflow-y-auto p-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4 leading-snug">{currentTask.title}</h2>
            <div className="prose max-w-none mb-6">
              <p className="text-gray-600 text-base leading-relaxed whitespace-pre-wrap">
                {currentTask.description}
              </p>
            </div>

            {/* Hints Section */}
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
                  <div className="mt-3 bg-white/60 rounded-lg p-4 backdrop-blur-sm border border-purple-100">
                    <ul className="space-y-3">
                      {currentTask.hints.map((hint, idx) => (
                        <li
                          key={idx}
                          className="text-base text-gray-700 pl-4 border-l-2 border-purple-300 leading-relaxed"
                        >
                          {hint}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Complete Button */}
            <Button
              onClick={handleCompleteTask}
              disabled={saving || evaluating}
              className="w-full bg-gradient-to-r from-[#7622e5] to-[#b480f8] hover:from-[#6518d0] hover:to-[#a070e8] shadow-md hover:shadow-lg transition-shadow"
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

        {/* Right - Monaco IDE */}
        <div className="flex-1 min-w-0 overflow-hidden flex flex-col bg-[#0b1020]">
          <div className="flex-1 p-3">
            <CodeSandboxIDE
              files={projectFiles}
              onFilesChange={setProjectFiles}
              onSave={saveFiles}
              saving={saving}
              userId={user.id}
              projectId={project.id}
              vmType={project?.vm_type}
            />
          </div>
        </div>
      </div>

      <AIChatbot
        context={`Working on: ${currentTask.title}`}
        userProgress={completedTasks}
        taskId={currentTask.id}
        userId={user.id}
        projectId={project.id}
        userCode={projectFiles.find(f => f.name === 'main.py')?.content || projectFiles[0]?.content || ''}
        taskDescription={currentTask.description}
        testSpec={currentTask.testSpec}
      />

      {/* Feedback Modal */}
      {showFeedbackModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="p-6 bg-white" style={{ maxWidth: '640px' }}>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-5 h-5 text-orange-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Not Quite Right</h3>
                <p className="text-gray-600 mb-4 whitespace-pre-wrap">{evaluationFeedback}</p>
                <Button
                  onClick={() => setShowFeedbackModal(false)}
                  className="w-full bg-gradient-to-r from-[#7622e5] to-[#b480f8]"
                >
                  Try Again
                </Button>
              </div>
              <button
                onClick={() => setShowFeedbackModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
