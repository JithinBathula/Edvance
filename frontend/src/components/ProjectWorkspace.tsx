import React, { useState, useEffect, useRef, useCallback } from "react";
import { User } from "../App";
import { authFetch } from "../utils/authFetch";
import { EditorIDE, type EditorIDEHandle } from "./EditorIDE";
import { ProjectFile } from "../types/workspace";
import { AIChatbot } from "./AIChatbot";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Progress } from "./ui/progress";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "./ui/resizable";
import type { ImperativePanelHandle } from "react-resizable-panels";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
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
  CheckCircle2,
  Zap,
  ArrowRight,
  Info,
  Lock,
  GraduationCap,
  Play,
} from "lucide-react";
import { BACKEND_URL } from '../utils/constants';
import { RunnableCodeBlock } from './RunnableCodeBlock';

// Shared markdown components for task content rendering
const markdownComponents = (interactive?: boolean, contextCode?: string) => ({
  h1: ({ children }: any) => (
    <h1 className="text-xl font-bold text-gray-900 mt-6 mb-3 first:mt-0 leading-snug">
      {children}
    </h1>
  ),
  h2: ({ children }: any) => (
    <h2 className="text-lg font-bold text-gray-800 mt-6 mb-2 first:mt-0 leading-snug">
      {children}
    </h2>
  ),
  h3: ({ children }: any) => (
    <h3 className="text-base font-semibold text-gray-800 mt-5 mb-2 first:mt-0 leading-snug">
      {children}
    </h3>
  ),
  p: ({ children }: any) => (
    <p className="text-gray-600 text-[15px] leading-relaxed mb-3 last:mb-0">
      {children}
    </p>
  ),
  strong: ({ children }: any) => (
    <strong className="font-semibold text-gray-900">{children}</strong>
  ),
  em: ({ children }: any) => <em className="italic">{children}</em>,
  code: ({ children }: any) => (
    <code className="inline-code">{children}</code>
  ),
  pre: ({ children }: any) => {
    // When interactive, detect Python code blocks and render RunnableCodeBlock
    if (interactive && children?.props?.className) {
      const className: string = children.props.className || '';
      if (className.includes('python')) {
        const codeText = String(children.props.children || '').replace(/\n$/, '');
        return <RunnableCodeBlock code={codeText} contextCode={contextCode} />;
      }
    }
    return (
      <pre className="code-block bg-gray-100 text-gray-900 p-4 rounded-lg text-sm font-mono mb-4 leading-relaxed border border-gray-200" style={{ overflowX: 'auto', whiteSpace: 'pre', maxWidth: '100%' }}>
        {children}
      </pre>
    );
  },
  ul: ({ children }: any) => (
    <ul className="list-disc ml-6 mb-4 space-y-1.5 text-gray-600 text-[15px]">
      {children}
    </ul>
  ),
  ol: ({ children }: any) => (
    <ol className="list-decimal ml-6 mb-4 space-y-1.5 text-gray-600 text-[15px]">
      {children}
    </ol>
  ),
  li: ({ children }: any) => (
    <li className="leading-relaxed">{children}</li>
  ),
  blockquote: ({ children }: any) => (
    <blockquote className="border-l-4 border-orange-300 bg-orange-50/50 pl-4 py-2 my-3 rounded-r">
      {children}
    </blockquote>
  ),
  a: ({ href, children }: any) => (
    <a
      href={href}
      className="text-blue-600 underline"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
  hr: () => <hr className="my-4 border-gray-200" />,
});

// Split task description into parts (Part A, Part B, Part C) for collapsible rendering
function splitIntoParts(text: string): { intro: string; parts: { label: string; title: string; content: string; icon: string }[] } {
  const partRegex = /\*\*Part\s+([A-C]):\s*(.+?)\*\*/g;
  const matches = [...text.matchAll(partRegex)];

  if (matches.length === 0) {
    return { intro: text, parts: [] };
  }

  const intro = text.slice(0, matches[0].index).trim();
  const icons: Record<string, string> = { A: '', B: '', C: '' };
  const parts = matches.map((match, i) => {
    const startAfterHeader = match.index! + match[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index! : text.length;
    return {
      label: `Part ${match[1]}`,
      title: match[2].trim(),
      content: text.slice(startAfterHeader, end).trim(),
      icon: icons[match[1]] || '',
    };
  });

  return { intro, parts };
}

// Collapsible section component for task parts
function CollapsiblePart({
  label,
  title,
  icon,
  content,
  isOpen,
  onToggle,
  contextCode,
}: {
  label: string;
  title: string;
  icon: string;
  content: string;
  isOpen: boolean;
  onToggle: () => void;
  contextCode?: string;
}) {
  const isPartB = label === 'Part B';
  const components = markdownComponents(isPartB, isPartB ? contextCode : undefined);

  return (
    <div className="border border-gray-200 rounded-lg mb-3 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="text-base">{icon}</span>
        <span className="font-semibold text-gray-800 text-[15px] flex-1">
          {label}: {title}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? '' : '-rotate-90'}`}
        />
      </button>
      {isOpen && (
        <div className="px-4 pb-4 pt-1 border-t border-gray-100">
          <div className="task-content">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
              {content}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}

// Component to format task description with full markdown rendering,
// code highlighting, and structured Learn → Try → Do content
function FormattedDescription({
  text,
  contextCode,
}: {
  text: string;
  contextCode?: string;
}) {
  const { intro, parts } = splitIntoParts(text);

  // Track which parts are open; reset when text changes (new task)
  const [openParts, setOpenParts] = useState<Set<number>>(() => new Set([0]));

  // Reset collapse state when text changes (new task)
  useEffect(() => {
    setOpenParts(new Set([0]));
  }, [text]);

  const components = markdownComponents();

  const togglePart = (index: number) => {
    setOpenParts(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
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
        .task-content .code-block code {
          background: transparent !important;
          color: inherit !important;
          padding: 0 !important;
          font-weight: normal !important;
          font-size: inherit !important;
        }
      `}</style>

      {/* Render intro content (before any parts) */}
      {intro && (
        <div className="task-content mb-4">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
            {intro}
          </ReactMarkdown>
        </div>
      )}

      {/* Render collapsible parts */}
      {parts.length > 0 ? (
        <div className="space-y-0">
          {parts.map((part, index) => (
            <CollapsiblePart
              key={`${part.label}-${index}`}
              label={part.label}
              title={part.title}
              icon={part.icon}
              content={part.content}
              isOpen={openParts.has(index)}
              onToggle={() => togglePart(index)}
              contextCode={contextCode}
            />
          ))}
        </div>
      ) : (
        /* Fallback: no parts detected, render as plain markdown */
        <div className="task-content">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
            {text}
          </ReactMarkdown>
        </div>
      )}
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
  feedback?: {
    message?: string;
    teacher_feedback?: string;
    teacher_feedback_at?: string;
    teacher_name?: string;
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
  const SIDEBAR_COLLAPSED_SIZE = 4;
  const SIDEBAR_DEFAULT_SIZE = 18;
  const SIDEBAR_MIN_SIZE = 14;
  const SIDEBAR_MAX_SIZE = 28;

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
    if (!saved) return [];

  // Deduplicate when loading from localStorage
  const parsed = JSON.parse(saved);
  return Array.from(new Set(parsed));  // ← Removes duplicates!
  });

  const [projectFiles, setProjectFiles] = useState<ProjectFile[]>([
    { name: 'main.py', content: '# Write your code here\n', language: 'python' }
  ]);
  const [showHints, setShowHints] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const filesLoaded = useRef(false);
  const lastProjectSignature = useRef<string>('');
  const editorRef = useRef<EditorIDEHandle>(null);
  const taskListPanelRef = useRef<ImperativePanelHandle>(null);

  // Try-out phase state
  const [isTryOutPhase, setIsTryOutPhase] = useState(false);

  // Chat State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatPrefill, setChatPrefill] = useState<string | null>(null);

  // Text selection "Ask Cody" popup — uses refs + direct DOM to avoid re-renders that kill selection
  const taskContentRef = useRef<HTMLDivElement>(null);
  const askCodyPopupRef = useRef<HTMLDivElement>(null);
  const selectedTextRef = useRef<string>('');


  const showAskCodyPopup = (x: number, y: number, text: string) => {
    selectedTextRef.current = text;
    const el = askCodyPopupRef.current;
    if (el) {
      el.style.display = 'block';
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
    }
  };

  const hideAskCodyPopup = () => {
    selectedTextRef.current = '';
    const el = askCodyPopupRef.current;
    if (el) {
      el.style.display = 'none';
    }
  };

  const handleAskCodySelection = () => {
    if (selectedTextRef.current) {
      setChatPrefill(`Can you help me understand this part from the task?\n\n"${selectedTextRef.current}"`);
      if (!isChatOpen) setIsChatOpen(true);
      hideAskCodyPopup();
      window.getSelection()?.removeAllRanges();
    }
  };

  useEffect(() => {
    const handleMouseUp = (e: MouseEvent) => {
      setTimeout(() => {
        const selection = window.getSelection();
        const selectedText = selection?.toString().trim();

        if (selectedText && selectedText.length > 2 && taskContentRef.current?.contains(selection?.anchorNode ?? null)) {
          const range = selection!.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          const text = selectedText.length > 200 ? selectedText.slice(0, 200) + '...' : selectedText;
          showAskCodyPopup(rect.left + rect.width / 2, rect.top - 8, text);
        } else {
          const popupEl = askCodyPopupRef.current;
          if (!popupEl?.contains(e.target as Node)) {
            hideAskCodyPopup();
          }
        }
      }, 10);
    };

    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, []);

  // Screen Size State (Default to true/large)
  const [isLargeScreen, setIsLargeScreen] = useState(window.innerWidth > 1200);

  // Submission gate state
  const [evaluating, setEvaluating] = useState(false);
  const [evaluationFeedback, setEvaluationFeedback] = useState<string | null>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successFeedback, setSuccessFeedback] = useState<string | null>(null);

  const triggerConfetti = useCallback(() => {
    import('canvas-confetti').then((confetti) => {
      const count = 200;
      const defaults = { origin: { y: 0.7 }, zIndex: 9999 };
      function fire(particleRatio: number, opts: any) {
        confetti.default({ ...defaults, ...opts, particleCount: Math.floor(count * particleRatio) });
      }
      fire(0.25, { spread: 26, startVelocity: 55 });
      fire(0.2, { spread: 60 });
      fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
      fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
      fire(0.1, { spread: 120, startVelocity: 45 });
    });
  }, []);

  const triggerCelebrationConfetti = useCallback(() => {
    import('canvas-confetti').then((confetti) => {
      const brandColors = ['#0d9488', '#14b8a6', '#ffa200', '#f59e0b', '#10b981'];
      // Continuous side confetti for 4 seconds
      const duration = 4000;
      const end = Date.now() + duration;
      const frame = () => {
        confetti.default({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.6 },
          colors: brandColors,
          zIndex: 9999,
        });
        confetti.default({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.6 },
          colors: brandColors,
          zIndex: 9999,
        });
        if (Date.now() < end) requestAnimationFrame(frame);
      };
      frame();

      // Three staggered large bursts
      setTimeout(() => {
        confetti.default({ particleCount: 80, spread: 70, origin: { y: 0.6 }, colors: brandColors, zIndex: 9999 });
      }, 0);
      setTimeout(() => {
        confetti.default({ particleCount: 100, spread: 120, origin: { y: 0.5 }, colors: brandColors, zIndex: 9999 });
      }, 500);
      setTimeout(() => {
        confetti.default({
          particleCount: 60, spread: 160, origin: { y: 0.4 }, colors: brandColors, zIndex: 9999,
          shapes: ['star'], scalar: 1.2,
        });
      }, 1000);
    });
  }, []);

  const getLatestCode = useCallback(() => {
    const files = editorRef.current?.getLatestFiles() ?? projectFiles;
    return files.map(f => `# === ${f.name} ===\n${f.content || ''}`).join('\n\n');
  }, [projectFiles]);

  const tasks: Task[] = project.tasks || [];
  const totalXpEarned = tasks.length * 10;
  const allRealTasksCompleted = tasks.length > 0 && completedTasks.length >= tasks.length;
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

  // Determine the first uncompleted task index — users can only access completed tasks or this one
  const firstUncompletedIndex = tasks.findIndex((t) => !completedTasks.includes(t.id));
  const isTaskAccessible = (taskIndex: number) => {
    if (user.isAdmin) return true;
    if (taskIndex < 0) return false;
    // Task is completed — always accessible
    if (completedTasks.includes(tasks[taskIndex]?.id)) return true;
    // Task is the first uncompleted one — accessible
    if (taskIndex === firstUncompletedIndex) return true;
    // All tasks completed (firstUncompletedIndex === -1) — all accessible
    if (firstUncompletedIndex === -1) return true;
    return false;
  };

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
        const response = await authFetch(`/progress/projects/${initialProject.id}/full`);
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
  
  // Hydrate completed tasks from database if localStorage is empty
  useEffect(() => {
    const hydrateFromDatabase = async () => {
      // Only fetch from DB if localStorage is empty
      if (completedTasks.length === 0) {
        try {
          const response = await authFetch(`/progress/projects/${project.id}/completed-tasks/${user.id}`);
          const data = await response.json();
          
          if (data.success && data.completed_tasks?.length > 0) {
            console.log('✅ Hydrated from DB:', data.completed_tasks);
            setCompletedTasks(data.completed_tasks);
          }
        } catch (error) {
          console.error('Hydration failed:', error);
        }
      }
    };
    
    hydrateFromDatabase();
  }, [project.id, user.id, completedTasks.length]);


  // Poll for milestone updates (tasks are generated async)
  useEffect(() => {
    if (!project.milestones || project.milestones.length === 0) return;

    const hasGeneratingMilestones = project.milestones.some(
      (m: any) => !m.tasks || m.tasks.length === 0
    );

    if (!hasGeneratingMilestones) return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await authFetch(`/progress/projects/${initialProject.id}/full`);
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
      const response = await authFetch(`/workspace/${project.id}`);
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
      const response = await authFetch('/workspace/save', {
        method: 'POST',
        body: JSON.stringify({
          project_id: project.id,
          files: files,
        }),
      });
      const data = await response.json();
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
      // Save files BEFORE submitting so storage is always up-to-date
      await saveFiles(projectFiles);

      const response = await authFetch('/submission/evaluate', {
        method: 'POST',
        body: JSON.stringify({
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

        const newCompleted = Array.from(new Set([...completedTasks, safeCurrentTask.id]));
        setCompletedTasks(newCompleted);

        // If next task was adapted, update the project tasks
        if (data.next_task && currentTaskIndex < tasks.length - 1) {
          const updatedTasks = [...tasks];
          updatedTasks[currentTaskIndex + 1] = {
            ...updatedTasks[currentTaskIndex + 1],
            description: data.next_task.description || updatedTasks[currentTaskIndex + 1].description,
            hints: data.next_task.hints || updatedTasks[currentTaskIndex + 1].hints,
            testSpec: data.next_task.testSpec || updatedTasks[currentTaskIndex + 1].testSpec,
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

        setSuccessFeedback(data.feedback || 'Great job! Task completed.');
        setShowSuccessModal(true);
        triggerConfetti();
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

  const handleSuccessNext = () => {
    setShowSuccessModal(false);
    setSuccessFeedback(null);
    if (currentTaskIndex < tasks.length - 1) {
      setCurrentTaskIndex(currentTaskIndex + 1);
      setShowHints(false);
    } else {
      setIsTryOutPhase(true);
    }
  };

  const handleProjectComplete = async () => {
    triggerCelebrationConfetti();
    setShowCompletion(true);
  };

  const handleSidebarToggle = useCallback(() => {
    const panel = taskListPanelRef.current;
    if (!panel) return;

    if (sidebarCollapsed) {
      panel.expand();
      return;
    }

    panel.collapse();
  }, [sidebarCollapsed]);

  if (showCompletion) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #f0fdfa 0%, #fff7ed 50%, #ecfdf5 100%)' }}>
        {/* Top gradient strip */}
        <div className="fixed top-0 left-0 right-0 h-1.5" style={{ background: 'linear-gradient(to right, #0d9488, #ffa200, #10b981)' }} />

        <Card className="max-w-2xl w-full p-12 text-center bg-white/90 backdrop-blur shadow-xl border-0">
          {/* Trophy with animated glow */}
          <div className="relative w-24 h-24 mx-auto mb-8">
            <div className="absolute inset-0 rounded-full animate-ping opacity-20" style={{ background: 'linear-gradient(135deg, #0d9488, #ffa200)' }} />
            <div className="relative w-24 h-24 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0d9488, #ffa200)' }}>
              <Trophy className="w-12 h-12 text-white" />
            </div>
          </div>

          <h2 className="text-4xl font-bold mb-2 bg-clip-text text-transparent" style={{ backgroundImage: 'linear-gradient(135deg, #0d9488, #ffa200, #10b981)' }}>
            Amazing Work!
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            You've successfully completed:{" "}
            <span className="font-semibold text-gray-800">{project.title}</span>
          </p>

          {/* XP Card */}
          <div className="rounded-xl p-6 mb-6 border border-teal-100" style={{ background: 'linear-gradient(135deg, #f0fdfa, #fff7ed)' }}>
            <div className="flex items-center justify-center gap-3 mb-2">
              <Sparkles className="w-6 h-6 text-[#ffa200]" />
              <p className="text-3xl font-bold" style={{ color: '#0d9488' }}>+{totalXpEarned} XP Earned!</p>
              <Sparkles className="w-6 h-6 text-[#ffa200]" />
            </div>
            <p className="text-sm text-gray-500 mb-3">
              {tasks.length} task{tasks.length !== 1 ? 's' : ''} x 10 XP each
            </p>
            <div className="h-px bg-gradient-to-r from-transparent via-teal-200 to-transparent mb-3" />
            <p className="text-sm text-gray-600">
              You now have <span className="font-semibold text-[#0d9488]">{(user.xp || 0) + totalXpEarned}</span> total XP
            </p>
          </div>

          <p className="text-gray-600 mb-8">
            You've built something real and learned by doing.
            This project is now part of your portfolio!
          </p>

          <Button
            onClick={onComplete}
            className="px-8 py-3 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all"
            style={{ background: 'linear-gradient(135deg, #0d9488, #14b8a6)' }}
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
    <div className="h-screen flex flex-col" style={{ background: 'linear-gradient(to bottom right, #fffbeb, white, #ecfeff)' }}>
      {/* Header */}
      <header className="border-b border-slate-100 bg-white/80 backdrop-blur-sm px-6 py-4 flex items-center justify-between shrink-0 sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="flex items-center gap-2 text-teal-600 hover:text-teal-700 transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back</span>
          </button>
          <div className="h-6 w-px bg-slate-200" />
          <h1 className="text-xl font-bold text-slate-800">{project.title}</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-teal-50 px-3 py-1.5 rounded-lg">
            <CheckCircle2 className="w-4 h-4 text-teal-600" />
            <span className="text-sm font-semibold text-teal-700">
              {completedTasks.length}/{tasks.length} Tasks
            </span>
          </div>
          <div className="flex items-center gap-2 bg-amber-50 px-3 py-1.5 rounded-lg">
            <Zap className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-semibold text-amber-700">{user.xp} XP</span>
          </div>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center text-white font-bold cursor-pointer hover:scale-110 transition-transform overflow-hidden">
            {user.profilePictureUrl ? (
              <img src={user.profilePictureUrl} alt={user.name} className="w-full h-full object-cover" />
            ) : (
              user.name?.charAt(0)?.toUpperCase() || 'U'
            )}
          </div>
        </div>
      </header>

      {/* Main Content - RESIZABLE PANEL LAYOUT */}
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* Pane 1: Task List */}
        <ResizablePanel
          id="task-list"
          order={1}
          ref={taskListPanelRef}
          defaultSize={SIDEBAR_COLLAPSED_SIZE}
          minSize={SIDEBAR_MIN_SIZE}
          maxSize={SIDEBAR_MAX_SIZE}
          collapsible
          collapsedSize={SIDEBAR_COLLAPSED_SIZE}
          onCollapse={() => setSidebarCollapsed(true)}
          onExpand={() => setSidebarCollapsed(false)}
        >
          <div className="h-full overflow-hidden border-r border-gray-200 flex flex-col bg-gradient-to-b from-white to-gray-50">
            <div className="px-3 py-3 flex items-center justify-between border-b border-gray-200 bg-white">
              {!sidebarCollapsed && <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tasks</span>}
              <button
                onClick={handleSidebarToggle}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                {sidebarCollapsed ? <PanelLeft className="w-4 h-4 text-gray-500" /> : <PanelLeftClose className="w-4 h-4 text-gray-500" />}
              </button>
            </div>
            {sidebarCollapsed && (
              <div className="flex-1 overflow-y-auto py-1">
                {tasks.map((_task, idx) => {
                  const accessible = isTaskAccessible(idx);
                  const isActive = idx === currentTaskIndex && !isTryOutPhase;
                  const isCompleted = completedTasks.includes(_task.id);
                  return (
                    <button
                      key={_task.id}
                      disabled={!accessible}
                      onClick={() => {
                        if (accessible) {
                          setCurrentTaskIndex(idx);
                          setShowHints(false);
                          setIsTryOutPhase(false);
                        }
                      }}
                      className={`w-full flex items-center justify-center py-1.5 text-[11px] font-semibold rounded transition-colors ${
                        !accessible ? 'text-gray-300 cursor-not-allowed' :
                        isActive ? 'text-orange-600 bg-orange-50' :
                        isCompleted ? 'text-emerald-600' :
                        'text-gray-500 hover:bg-gray-100 cursor-pointer'
                      }`}
                    >
                      {_task.title.match(/(\d+\.\d+)/)?.[1] || idx + 1}
                    </button>
                  );
                })}
              </div>
            )}
            {!sidebarCollapsed && (
              <div className="flex-1 overflow-y-auto">
                <div className="p-2">
                  {(() => {
                    // Use milestones structure when available
                    if (project.milestones && project.milestones.length > 0) {
                      return (
                        <>
                          {project.milestones.map((milestone: any, mIdx: number) => {
                            const milestoneTasks = (milestone.tasks || []);
                            const isGenerating = milestoneTasks.length === 0;

                            return (
                              <div key={milestone.id} className="mb-3">
                                {/* Milestone Header */}
                                <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-2 py-1 mb-1 flex items-center gap-1.5">
                                  <span>Task {mIdx + 1}: {milestone.title}</span>
                                  {isGenerating && <Loader2 className="w-3 h-3 animate-spin text-gray-400" />}
                                </div>
                                {/* Tasks */}
                                {isGenerating ? (
                                  <div className="px-3 py-1.5 ml-2 text-[11px] text-gray-400 italic">
                                    Generating tasks...
                                  </div>
                                ) : (
                                  milestoneTasks.map((task: any, tIdx: number) => {
                                    const idx = tasks.findIndex((t) => t.id === task.id);
                                    const accessible = isTaskAccessible(idx);
                                    return (
                                      <button
                                        key={task.id}
                                        disabled={!accessible}
                                        onClick={() => {
                                          if (idx >= 0 && accessible) {
                                            setCurrentTaskIndex(idx);
                                            setShowHints(false);
                                            setIsTryOutPhase(false);
                                          }
                                        }}
                                        className={`w-full text-left px-3 py-2 rounded-lg mb-1 flex items-center gap-3 transition-all duration-200 ml-2 ${accessible ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
                                        style={idx === currentTaskIndex && !isTryOutPhase
                                          ? { background: '#fff7ed', color: '#ea580c', fontWeight: 500, borderLeft: '3px solid #ea580c' }
                                          : completedTasks.includes(task.id)
                                            ? { color: '#059669', borderLeft: '3px solid #10b981' }
                                            : !accessible
                                              ? { color: '#9ca3af', borderLeft: '3px solid transparent' }
                                              : { color: '#374151', borderLeft: '3px solid transparent' }
                                        }
                                      >
                                        <span className="text-xs font-medium flex items-center gap-1.5">
                                          {!accessible && <Lock className="w-3 h-3" />}
                                          • {mIdx + 1}.{tIdx + 1}
                                        </span>
                                      </button>
                                    );
                                  })
                                )}
                              </div>
                            );
                          })}
                          {/* Try Out Your Project milestone */}
                          {allRealTasksCompleted && (
                            <div className="mb-3">
                              <div className="text-[10px] font-semibold uppercase tracking-wide px-2 py-1 mb-1 flex items-center gap-1.5" style={{ color: '#0d9488' }}>
                                <Play className="w-3 h-3" />
                                <span>Try Out Your Project</span>
                              </div>
                              <button
                                onClick={() => setIsTryOutPhase(true)}
                                className="w-full text-left px-3 py-2 rounded-lg mb-1 flex items-center gap-3 transition-all duration-200 ml-2 hover:bg-teal-50 cursor-pointer"
                                style={isTryOutPhase
                                  ? { background: '#f0fdfa', color: '#0d9488', fontWeight: 500, borderLeft: '3px solid #0d9488' }
                                  : { color: '#0d9488', borderLeft: '3px solid transparent' }
                                }
                              >
                                <span className="text-xs font-medium flex items-center gap-1.5">
                                  <Play className="w-3 h-3" />
                                  Run & Test
                                </span>
                              </button>
                            </div>
                          )}
                        </>
                      );
                    }

                    // Fallback: group tasks by their major number from title
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

                    return (
                      <>
                        {Object.entries(groupedTasks).map(([majorNum, group]) => (
                          <div key={majorNum} className="mb-3">
                            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-2 py-1 mb-1">
                              Task {majorNum}: {group.name}
                            </div>
                            {group.tasks.map((task) => {
                              const idx = task.originalIdx;
                              const subNum = task.title.match(/\d+\.(\d+)/)?.[1] || '1';
                              const accessible = isTaskAccessible(idx);
                              return (
                                <button
                                  key={task.id}
                                  disabled={!accessible}
                                  onClick={() => {
                                    if (accessible) {
                                      setCurrentTaskIndex(idx);
                                      setShowHints(false);
                                      setIsTryOutPhase(false);
                                    }
                                  }}
                                  className={`w-full text-left px-3 py-2 rounded-lg mb-1 flex items-center gap-3 transition-all duration-200 ml-2 ${accessible ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
                                  style={idx === currentTaskIndex && !isTryOutPhase
                                    ? { background: '#fff7ed', color: '#ea580c', fontWeight: 500, borderLeft: '3px solid #ea580c' }
                                    : completedTasks.includes(task.id)
                                      ? { color: '#059669', borderLeft: '3px solid #10b981' }
                                      : !accessible
                                        ? { color: '#9ca3af', borderLeft: '3px solid transparent' }
                                        : { color: '#374151', borderLeft: '3px solid transparent' }
                                  }
                                >
                                  <span className="text-xs font-medium flex items-center gap-1.5">
                                    {!accessible && <Lock className="w-3 h-3" />}
                                    • {majorNum}.{subNum}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        ))}
                        {/* Try Out Your Project milestone */}
                        {allRealTasksCompleted && (
                          <div className="mb-3">
                            <div className="text-[10px] font-semibold uppercase tracking-wide px-2 py-1 mb-1 flex items-center gap-1.5" style={{ color: '#0d9488' }}>
                              <Play className="w-3 h-3" />
                              <span>Try Out Your Project</span>
                            </div>
                            <button
                              onClick={() => setIsTryOutPhase(true)}
                              className="w-full text-left px-3 py-2 rounded-lg mb-1 flex items-center gap-3 transition-all duration-200 ml-2 hover:bg-teal-50 cursor-pointer"
                              style={isTryOutPhase
                                ? { background: '#f0fdfa', color: '#0d9488', fontWeight: 500, borderLeft: '3px solid #0d9488' }
                                : { color: '#0d9488', borderLeft: '3px solid transparent' }
                              }
                            >
                              <span className="text-xs font-medium flex items-center gap-1.5">
                                <Play className="w-3 h-3" />
                                Run & Test
                              </span>
                            </button>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        </ResizablePanel>

        <ResizableHandle />

        {/* Pane 2: Task Details */}
        <ResizablePanel id="task-details" order={2} defaultSize={43} minSize={15} maxSize={50}>
          <div className="h-full overflow-hidden border-r border-gray-200 flex flex-col" style={{ background: 'linear-gradient(to bottom right, #fffbeb, white, #ecfeff)' }}>
            <div className="flex-1 overflow-y-auto p-6">
              {isTryOutPhase ? (
                /* Try-Out Phase Content */
                <div className="flex flex-col items-center justify-center h-full text-center px-4">
                  <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6" style={{ background: 'linear-gradient(135deg, #0d9488, #14b8a6)' }}>
                    <Trophy className="w-10 h-10 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    Congrats! You've completed all the coding tasks!
                  </h2>
                  <p className="text-gray-500 mb-8">Time to see your project in action</p>

                  <div className="w-full max-w-md rounded-xl p-5 border border-teal-100 mb-8" style={{ background: 'linear-gradient(135deg, #f0fdfa, #ecfdf5)' }}>
                    <div className="flex items-center gap-3 mb-2">
                      <Play className="w-5 h-5 text-[#0d9488]" />
                      <span className="font-semibold text-gray-800">Test Your Project</span>
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      Click the <strong>Run</strong> button in the IDE panel to test your project. Make sure everything works the way you expect!
                    </p>
                  </div>

                  <Button
                    onClick={handleProjectComplete}
                    className="px-8 py-3 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all"
                    style={{ background: 'linear-gradient(135deg, #0d9488, #14b8a6)' }}
                  >
                    <Trophy className="w-5 h-5 mr-2" />
                    Complete Project
                  </Button>
                </div>
              ) : (
              <>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4 leading-snug">{safeCurrentTask.title}</h2>
              <div ref={taskContentRef} className="max-w-none mb-6 relative">
                <FormattedDescription key={safeCurrentTask.id} text={safeCurrentTask.description} contextCode={projectFiles.map(f => f.content || '').join('\n')} />
              </div>

              {/* Persistent Feedback Banner — visible after modal is closed */}
              {evaluationFeedback && !showFeedbackModal && (
                <div className="mb-6 rounded-xl p-4 border border-amber-200" style={{ background: 'linear-gradient(135deg, #fffbeb, #fef3c7)' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <AlertCircle className="w-5 h-5 text-amber-600" />
                    <span className="font-semibold text-amber-800 text-sm">Things to fix</span>
                  </div>
                  <ul className="space-y-2">
                    {evaluationFeedback
                      .split('\n')
                      .map(line => line.replace(/^[-•*]\s*/, '').trim())
                      .filter(line => line.length > 0)
                      .map((item, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-amber-900 text-sm leading-relaxed">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 mt-1.5" />
                          <span
                            dangerouslySetInnerHTML={{
                              __html: item
                                .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
                                .replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 bg-amber-100 rounded text-amber-800 font-mono text-xs">$1</code>')
                                .replace(/'([^'\s]+)'/g, '<code class="px-1 py-0.5 bg-amber-100 rounded text-amber-800 font-mono text-xs">$1</code>')
                            }}
                          />
                        </li>
                      ))}
                  </ul>
                </div>
              )}

              {/* Ask Cody selection popup — always rendered, shown/hidden via ref to avoid re-renders */}
              <div
                ref={askCodyPopupRef}
                className="fixed z-50"
                style={{ display: 'none', transform: 'translate(-50%, -100%)' }}
              >
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={handleAskCodySelection}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium shadow-lg border border-blue-200 transition-all hover:scale-105 hover:shadow-xl"
                  style={{ background: 'linear-gradient(135deg, #eef2ff, #e0e7ff)', color: '#4338ca' }}
                >
                  <Sparkles className="w-3 h-3" />
                  Ask Cody
                </button>
              </div>

              {/* Teacher Feedback Banner */}
              {safeCurrentTask.feedback?.teacher_feedback && (
                <div className="mb-6 rounded-xl p-4 border border-blue-200" style={{ background: 'linear-gradient(135deg, #eff6ff, #dbeafe)' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <GraduationCap className="w-5 h-5 text-blue-600" />
                    <span className="font-semibold text-blue-800 text-sm">
                      Feedback from {safeCurrentTask.feedback.teacher_name || 'your teacher'}
                    </span>
                    {safeCurrentTask.feedback.teacher_feedback_at && (
                      <span className="text-xs text-blue-500">
                        {new Date(safeCurrentTask.feedback.teacher_feedback_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <p className="text-blue-900 text-[15px] leading-relaxed">{safeCurrentTask.feedback.teacher_feedback}</p>
                </div>
              )}

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
                              <p className="text-base text-gray-700 leading-relaxed flex-1 pt-0.5">
                                {hint}
                              </p>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Complete & Continue Button */}
                  <div className="mt-6">
                    <Button
                      onClick={handleCompleteTask}
                      disabled={saving || evaluating}
                      className="w-full px-6 py-3 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:from-slate-300 disabled:to-slate-400 text-white font-semibold flex items-center justify-center gap-2 transition-all shadow-md disabled:cursor-not-allowed"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Saving...
                        </>
                      ) : evaluating ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Evaluating...
                        </>
                      ) : completedTasks.includes(safeCurrentTask.id) ? (
                        <>
                          <Check className="w-5 h-5" />
                          Completed
                        </>
                      ) : (
                        <>
                          Complete & Continue
                          <ArrowRight className="w-5 h-5" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
              </>
              )}
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle />

        {/* Pane 3: IDE */}
        <ResizablePanel id="ide" order={3} defaultSize={42} minSize={20}>
          <div className="h-full overflow-hidden flex flex-col bg-white">
            <div className="flex-1 p-3">
              {filesLoading ? (
                <div className="h-full flex items-center justify-center text-slate-400">
                  Loading...
                </div>
              ) : (
                <EditorIDE
                  ref={editorRef}
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
                  getLatestCode={getLatestCode}
                  taskDescription={safeCurrentTask.description}
                  testSpec={safeCurrentTask.testSpec}
                  onClose={() => setIsChatOpen(false)}
                  visible={true}
                  prefillMessage={chatPrefill}
                  onPrefillConsumed={() => setChatPrefill(null)}
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

            {/* Content - formatted as bullet list */}
            <div className="px-6 py-5">
              <div className="space-y-3">
                {evaluationFeedback
                  ?.split('\n')
                  .map(line => line.replace(/^[-•*]\s*/, '').trim())
                  .filter(line => line.length > 0)
                  .map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xs font-semibold shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <p className="text-gray-700 text-sm leading-relaxed"
                      dangerouslySetInnerHTML={{
                        __html: item
                          .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
                          .replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 bg-gray-100 rounded text-orange-600 font-mono text-xs">$1</code>')
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

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="bg-white rounded-xl shadow-2xl overflow-hidden" style={{ maxWidth: '560px', width: '100%' }}>
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 px-6 py-5 border-b border-emerald-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">Task Complete!</h3>
                  <p className="text-sm text-emerald-600 font-medium">Great work on this one</p>
                </div>
              </div>
            </div>
            <div className="px-6 py-5">
              <div className="space-y-2.5">
                {successFeedback
                  ?.split('\n')
                  .map(line => line.replace(/^[-•*]\s*/, '').trim())
                  .filter(line => line.length > 0)
                  .map((item, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <p className="text-gray-700 text-sm leading-relaxed"
                        dangerouslySetInnerHTML={{
                          __html: item
                            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
                            .replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 bg-gray-100 rounded text-emerald-700 font-mono text-xs">$1</code>')
                            .replace(/'([^'\s]+)'/g, '<code class="px-1.5 py-0.5 bg-gray-100 rounded text-emerald-700 font-mono text-xs">$1</code>')
                        }}
                      />
                    </div>
                  ))}
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
              <Button
                onClick={handleSuccessNext}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
              >
                {currentTaskIndex < tasks.length - 1 ? (
                  <>Next Task <ArrowRight className="w-4 h-4 ml-2" /></>
                ) : (
                  <>Try Out Project <Play className="w-4 h-4 ml-2" /></>
                )}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
