import React, { useState, useEffect, useRef, useCallback } from "react";
import { User } from "../App";
import { authFetch } from "../utils/authFetch";
import { EditorIDE } from "./EditorIDE";
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
} from "lucide-react";
import { GLOSSARY } from "../utils/glossary";
import { TechnicalTermHover } from "./TechnicalTermHover";
import { BACKEND_URL } from '../utils/constants';


// Sorted glossary terms by length descending for longest-match-first
const SORTED_GLOSSARY_TERMS = Object.keys(GLOSSARY).sort(
  (a, b) => b.length - a.length
);

// Build a combined regex from glossary terms using lookahead/lookbehind
// so terms adjacent to punctuation (commas, periods) still match.
const GLOSSARY_REGEX = new RegExp(
  `(?<![a-zA-Z0-9])(${SORTED_GLOSSARY_TERMS.map((t) =>
    t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  ).join("|")})(?![a-zA-Z0-9])`,
  "gi"
);

// Keywords that get green styling (not in glossary but still highlighted)
const KEYWORD_REGEX = /(?<![a-zA-Z0-9])(GET|POST|PUT|DELETE)(?![a-zA-Z0-9])/g;

/**
 * Parse a text segment (non-code) into React nodes with glossary hover terms
 * and keyword highlighting. Only highlights the first occurrence of each term.
 */
function parseSegmentWithTerms(
  text: string,
  matchedTerms: Set<string>,
  onAskTutor?: (term: string) => void
): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let keyCounter = 0;

  // Collect all matches (glossary + keywords) with their positions
  type Match = { index: number; length: number; text: string; type: "glossary" | "keyword" };
  const matches: Match[] = [];

  // Reset regex state
  GLOSSARY_REGEX.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = GLOSSARY_REGEX.exec(text)) !== null) {
    matches.push({ index: m.index, length: m[0].length, text: m[0], type: "glossary" });
  }

  KEYWORD_REGEX.lastIndex = 0;
  while ((m = KEYWORD_REGEX.exec(text)) !== null) {
    // Only add keyword matches that don't overlap with a glossary match
    const overlaps = matches.some(
      (existing) =>
        m!.index >= existing.index && m!.index < existing.index + existing.length
    );
    if (!overlaps) {
      matches.push({ index: m.index, length: m[0].length, text: m[0], type: "keyword" });
    }
  }

  // Sort matches by position
  matches.sort((a, b) => a.index - b.index);

  for (const match of matches) {
    // Add plain text before this match
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    if (match.type === "glossary") {
      // Find the glossary key (case-insensitive lookup)
      const glossaryKey = SORTED_GLOSSARY_TERMS.find(
        (t) => t.toLowerCase() === match.text.toLowerCase()
      );
      const termLower = match.text.toLowerCase();

      if (glossaryKey && !matchedTerms.has(termLower)) {
        // First occurrence — render as hoverable term
        matchedTerms.add(termLower);
        nodes.push(
          <TechnicalTermHover
            key={`term-${keyCounter++}`}
            term={glossaryKey}
            definition={GLOSSARY[glossaryKey]}
            onAskTutor={onAskTutor}
          >
            {match.text}
          </TechnicalTermHover>
        );
      } else {
        // Already highlighted or no definition — render as plain text
        nodes.push(match.text);
      }
    } else {
      // Keyword match (GET, POST, etc.)
      nodes.push(
        <span key={`kw-${keyCounter++}`} className="keyword">
          {match.text}
        </span>
      );
    }

    lastIndex = match.index + match.length;
  }

  // Remaining text after last match
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes.length > 0 ? nodes : [text];
}

/**
 * Parse a sentence into React nodes, splitting on code regions first,
 * then applying glossary/keyword matching on non-code text.
 */
function parseTextToNodes(
  text: string,
  matchedTerms: Set<string>,
  onAskTutor?: (term: string) => void
): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let keyCounter = 0;

  // Split on: backtick code, JSX tags, single-quoted code, function calls like method()
  const codeRegex = /(`[^`]+`)|(<[A-Z][a-zA-Z0-9]*\s*\/>)|(<[A-Z][a-zA-Z0-9]*>)|('([^'\s]+)')|(\b[a-z_][a-z0-9_]*\(\))/gi;
  let lastIndex = 0;
  let m: RegExpExecArray | null;

  while ((m = codeRegex.exec(text)) !== null) {
    // Non-code text before this match
    if (m.index > lastIndex) {
      const segment = text.slice(lastIndex, m.index);
      nodes.push(...parseSegmentWithTerms(segment, matchedTerms, onAskTutor));
    }

    // Render the code region
    const matched = m[0];
    if (matched.startsWith("`")) {
      // Backtick code
      const code = matched.slice(1, -1);
      nodes.push(
        <code key={`code-${keyCounter++}`} className="inline-code">
          {code}
        </code>
      );
    } else if (matched.startsWith("<")) {
      // JSX tag
      nodes.push(
        <code key={`code-${keyCounter++}`} className="inline-code">
          {matched.replace(/</g, "<").replace(/>/g, ">")}
        </code>
      );
    } else if (matched.startsWith("'")) {
      // Single-quoted code (no spaces)
      const code = m[5] || matched.slice(1, -1);
      nodes.push(
        <code key={`code-${keyCounter++}`} className="inline-code">
          {code}
        </code>
      );
    } else if (matched.match(/^[a-z_]/i) && matched.endsWith("()")) {
      // Function call like method(), split(), etc.
      nodes.push(
        <code key={`code-${keyCounter++}`} className="inline-code">
          {matched}
        </code>
      );
    }

    lastIndex = m.index + matched.length;
  }

  // Remaining non-code text
  if (lastIndex < text.length) {
    nodes.push(
      ...parseSegmentWithTerms(text.slice(lastIndex), matchedTerms, onAskTutor)
    );
  }

  return nodes;
}

/**
 * Apply glossary/keyword highlighting to string children within ReactMarkdown output.
 * Leaves non-string children (React elements like <code>, <strong>) untouched.
 */
function withGlossary(
  children: React.ReactNode,
  matchedTerms: Set<string>,
  onAskTutor?: (term: string) => void
): React.ReactNode {
  return React.Children.map(children, (child) => {
    if (typeof child === "string") {
      return parseSegmentWithTerms(child, matchedTerms, onAskTutor);
    }
    return child;
  });
}

// Component to format task description with full markdown rendering,
// code highlighting, glossary terms, and structured Learn → Try → Do content
function FormattedDescription({
  text,
  onAskTutor,
}: {
  text: string;
  onAskTutor?: (term: string) => void;
}) {
  const matchedTermsRef = useRef(new Set<string>());

  // Reset matched terms when text changes
  useEffect(() => {
    matchedTermsRef.current = new Set<string>();
  }, [text]);

  const matchedTerms = matchedTermsRef.current;

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
        .task-content .code-block code {
          background: transparent !important;
          color: inherit !important;
          padding: 0 !important;
          font-weight: normal !important;
          font-size: inherit !important;
        }
      `}</style>
      <div className="task-content">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ children }) => (
              <h1 className="text-xl font-bold text-gray-900 mt-6 mb-3 first:mt-0 leading-snug">
                {children}
              </h1>
            ),
            h2: ({ children }) => (
              <h2 className="text-lg font-bold text-gray-800 mt-6 mb-2 first:mt-0 leading-snug">
                {children}
              </h2>
            ),
            h3: ({ children }) => (
              <h3 className="text-base font-semibold text-gray-800 mt-5 mb-2 first:mt-0 leading-snug">
                {children}
              </h3>
            ),
            p: ({ children }) => (
              <p className="text-gray-600 text-[15px] leading-relaxed mb-3 last:mb-0">
                {withGlossary(children, matchedTerms, onAskTutor)}
              </p>
            ),
            strong: ({ children }) => (
              <strong className="font-semibold text-gray-900">{children}</strong>
            ),
            em: ({ children }) => <em className="italic">{children}</em>,
            code: ({ children }: any) => (
              <code className="inline-code">{children}</code>
            ),
            pre: ({ children }) => (
              <pre className="code-block bg-gray-100 text-gray-900 p-4 rounded-lg text-sm font-mono overflow-x-auto mb-4 leading-relaxed border border-gray-200">
                {children}
              </pre>
            ),
            ul: ({ children }) => (
              <ul className="list-disc ml-6 mb-4 space-y-1.5 text-gray-600 text-[15px]">
                {children}
              </ul>
            ),
            ol: ({ children }) => (
              <ol className="list-decimal ml-6 mb-4 space-y-1.5 text-gray-600 text-[15px]">
                {children}
              </ol>
            ),
            li: ({ children }) => (
              <li className="leading-relaxed">
                {withGlossary(children, matchedTerms, onAskTutor)}
              </li>
            ),
            blockquote: ({ children }) => (
              <blockquote className="border-l-4 border-orange-300 bg-orange-50/50 pl-4 py-2 my-3 rounded-r">
                {children}
              </blockquote>
            ),
            a: ({ href, children }) => (
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
          }}
        >
          {text}
        </ReactMarkdown>
      </div>
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const filesLoaded = useRef(false);
  const lastProjectSignature = useRef<string>('');
  const taskListPanelRef = useRef<ImperativePanelHandle>(null);

  // Chat State
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [chatPrefill, setChatPrefill] = useState<string | null>(null);

  const handleAskTutor = (term: string) => {
    setChatPrefill(`Can you explain what "${term}" means in the context of this task?`);
    if (!isChatOpen) setIsChatOpen(true);
  };

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

  // Determine the first uncompleted task index — users can only access completed tasks or this one
  const firstUncompletedIndex = tasks.findIndex((t) => !completedTasks.includes(t.id));
  const isTaskAccessible = (taskIndex: number) => {
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
      handleProjectComplete();
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
                    // Use milestones structure when available
                    if (project.milestones && project.milestones.length > 0) {
                      return project.milestones.map((milestone: any, mIdx: number) => {
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
                                      }
                                    }}
                                    className={`w-full text-left px-3 py-2 rounded-lg mb-1 flex items-center gap-3 transition-all duration-200 ml-2 ${accessible ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
                                    style={idx === currentTaskIndex
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
                      });
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

                    return Object.entries(groupedTasks).map(([majorNum, group]) => (
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
                                }
                              }}
                              className={`w-full text-left px-3 py-2 rounded-lg mb-1 flex items-center gap-3 transition-all duration-200 ml-2 ${accessible ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
                              style={idx === currentTaskIndex
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
                    ));
                  })()}
                </div>
              </div>
            )}
          </div>
        </ResizablePanel>

        <ResizableHandle />

        {/* Pane 2: Task Details */}
        <ResizablePanel id="task-details" order={2} defaultSize={isChatOpen ? 25 : 43} minSize={15} maxSize={50}>
          <div className="h-full overflow-hidden border-r border-gray-200 flex flex-col" style={{ background: 'linear-gradient(to bottom right, #fffbeb, white, #ecfeff)' }}>
            <div className="flex-1 overflow-y-auto p-6">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4 leading-snug">{safeCurrentTask.title}</h2>
              <div className="max-w-none mb-6">
                <FormattedDescription key={safeCurrentTask.id} text={safeCurrentTask.description} onAskTutor={handleAskTutor} />
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
                        {(() => {
                          const hintMatchedTerms = new Set<string>();
                          return safeCurrentTask.hints.map((hint, idx) => (
                            <div
                              key={idx}
                              className="flex items-start gap-4"
                            >
                              <span className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 mt-0.5" style={{ backgroundColor: '#cffafe', color: '#0891b2' }}>
                                {idx + 1}
                              </span>
                              <p className="text-base text-gray-700 leading-relaxed flex-1 pt-0.5">
                                {parseTextToNodes(hint, hintMatchedTerms, handleAskTutor)}
                              </p>
                            </div>
                          ));
                        })()}
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
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle />

        {/* Pane 3: IDE */}
        <ResizablePanel id="ide" order={3} defaultSize={isChatOpen ? 40 : 42} minSize={20}>
          <div className="h-full overflow-hidden flex flex-col bg-white">
            <div className="flex-1 p-3">
              {filesLoading ? (
                <div className="h-full flex items-center justify-center text-slate-400">
                  Loading...
                </div>
              ) : (
                <EditorIDE
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
              <p className="text-gray-700 text-[15px] leading-relaxed">{successFeedback}</p>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
              <Button
                onClick={handleSuccessNext}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
              >
                {currentTaskIndex < tasks.length - 1 ? (
                  <>Next Task <ArrowRight className="w-4 h-4 ml-2" /></>
                ) : (
                  <>Finish Project <Trophy className="w-4 h-4 ml-2" /></>
                )}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
