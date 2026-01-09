import React, { useState, useEffect, useMemo } from "react";
import { User } from "../App";
import { WebIDE } from "./WebIDE";
import { AIChatbot } from "./AIChatbot";
import { LessonSection as LessonSectionComponent } from "./LessonSection";
import { Sidebar } from "./Sidebar";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Progress } from "./ui/progress";
import { ScrollArea } from "./ui/scroll-area";
import { MessageCircle, PanelLeft } from "lucide-react";
import {
  ArrowLeft,
  Check,
  Code2,
  Lock,
  ChevronRight,
  ChevronDown,
  Trophy,
  Terminal,
  Sparkles,
  ListChecks,
  Target,
  Lightbulb,
  BookOpen,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { BACKEND_URL } from "../utils/constants";
import { LessonSection, LessonTask, ChatMessage, MessageRole } from "../types/types";
import { mockLesson, LessonSectionData } from "../data/mockLessonData";

// Icon mapping for database icon names
const iconMap: Record<string, LucideIcon> = {
  BookOpen,
  Sparkles,
  ListChecks,
  Target,
  Lightbulb,
};


type LessonHighlight = {
  id: string;
  position: number;
  title: string;
  heading: string;
  detail: string;
  icon_name: string;
};

type Lesson = {
  id: string;
  position: number;
  title: string;
  description: string;
  content: string;
  challenge_description: string;
  starter_code: string;
  hints: string[];
  tasks: LessonTask[];
  highlights: LessonHighlight[];
};

type Course = {
  id: string;
  title: string;
  description: string;
  theme: string;
  lessons: Lesson[];
};

type SubSectionId =
  | "blog"
  | "lesson"
  | "task-1"
  | "task-2"
  | "task-3";

type Props = {
  user: User;
  onBack: () => void;
};


export function CoursePage({ user, onBack }: Props) {
  // --- Data Loading State
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentLessonIndex, setCurrentLessonIndex] = useState(0);
  const [completedLessons, setCompletedLessons] = useState<string[]>([]);

  // --- UI State
  const [userCode, setUserCode] = useState(mockLesson.starterCode);
  const [ideOutput, setIdeOutput] = useState<string[]>([]); // Track IDE output for practice validation
  const [completedSections, setCompletedSections] = useState<string[]>([]); // Track per-section completion
  const [showCompletion, setShowCompletion] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true); // Control Left Sidebar
  const [isChatOpen, setIsChatOpen] = useState(true); // Control Right AI Chat
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: MessageRole.Model,
      text: "Hi! I'm your AI assistant. I'll watch your progress and help you learn!",
      timestamp: Date.now()
    }
  ]);
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Handler to mark a section as complete
  const handleSectionComplete = (sectionId: string) => {
    if (!completedSections.includes(sectionId)) {
      setCompletedSections(prev => [...prev, sectionId]);
    }
  };

  const theme = user.onboarding?.theme || "finance";
  const lessons = course?.lessons || [];
  const currentLesson = lessons[currentLessonIndex];

  const progress = lessons.length > 0
    ? (completedLessons.length / lessons.length) * 100
    : 0;

  // Get tasks from current lesson (from database)
  const lessonTasks = currentLesson?.tasks?.map(t => t.task_description) || [];

  // Get highlights from current lesson and map icon names to components
  const lessonHighlights = (currentLesson?.highlights || []).map(h => ({
    id: h.id,
    title: h.title,
    heading: h.heading,
    detail: h.detail,
    icon: iconMap[h.icon_name] || BookOpen,
  }));

  // Fetch course data on mount
  useEffect(() => {
    const fetchCourse = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${BACKEND_URL}/courses/${theme}`);
        const data = await response.json();

        if (data.success && data.course) {
          setCourse(data.course);
        } else {
          setError("Failed to load course");
        }
      } catch (err) {
        console.error("Error fetching course:", err);
        setError("Failed to load course");
      } finally {
        setLoading(false);
      }
    };
    fetchCourse();
  }, [theme]);

  // Load user progress
  useEffect(() => {
    const loadProgress = async () => {
      if (!course?.id) return;
      try {
        const response = await fetch(
          `${BACKEND_URL}/user/${user.id}/course-progress/${course.id}`
        );
        const data = await response.json();
        if (data.success && data.progress?.completed_lessons) {
          setCompletedLessons(data.progress.completed_lessons);
        }
      } catch (err) {
        console.error("Error loading progress:", err);
      }
    };
    loadProgress();
  }, [user.id, course?.id]);

  // Set starter code when lesson changes
  useEffect(() => {
    if (currentLesson?.starter_code) {
      setUserCode(currentLesson.starter_code);
    }
  }, [currentLessonIndex, currentLesson?.starter_code]);


  const [expandedLessons, setExpandedLessons] = useState<Record<string, boolean>>(
    {},
  );
  const [activeSubsection, setActiveSubsection] = useState<{
    lessonId: string;
    itemId: SubSectionId;
  }>({
    lessonId: "",
    itemId: "blog",
  });
  const [sidebarWidth, setSidebarWidth] = useState(256); // 64 * 4 = 256px (w-64)
  const [ideWidth, setIdeWidth] = useState(40); // 40% of remaining space
  const [isDraggingSidebar, setIsDraggingSidebar] = useState(false);
  const [isDraggingIde, setIsDraggingIde] = useState(false);
  const [isSmallScreen, setIsSmallScreen] = useState(false);

  // Responsive behavior for small screens
  useEffect(() => {
    const checkScreenSize = () => {
      setIsSmallScreen(window.innerWidth < 1024);
      if (window.innerWidth < 1024) {
        // Equal widths on small screens
        const equalWidth = (window.innerWidth - 32) / 3; // Account for borders
        setSidebarWidth(Math.min(equalWidth, 300));
        setIdeWidth(33.33);
      }
    };
    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);
    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);
  const sectionAnchors = useMemo<Record<SubSectionId, string>>(
    () => ({
      blog: "lesson-section-blog",
      practice: "lesson-section-practice",
      lesson: "lesson",
      "task-1": "lesson-task-1",
      "task-2": "lesson-task-2",
      "task-3": "lesson-task-3",
    }),
    [],
  );

  useEffect(() => {
    if (!currentLesson) return;
    setExpandedLessons((prev) => {
      const next = { ...prev };
      lessons.forEach((lesson, idx) => {
        if (next[lesson.id] === undefined) {
          next[lesson.id] = idx === currentLessonIndex;
        }
      });
      next[currentLesson.id] = true;
      return next;
    });
  }, [lessons, currentLesson?.id, currentLessonIndex]);

  useEffect(() => {
    if (!currentLesson) return;
    setActiveSubsection((prev) =>
      prev.lessonId === currentLesson.id
        ? prev
        : {
          lessonId: currentLesson.id,
          itemId: "blog",
        },
    );
  }, [currentLesson?.id]);

  useEffect(() => {
    if (!currentLesson) return;
    if (activeSubsection.lessonId !== currentLesson.id) {
      return;
    }
    const anchorId = sectionAnchors[activeSubsection.itemId];
    if (!anchorId) return;
    const element = document.getElementById(anchorId);
    if (element) {
      element.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [activeSubsection, currentLesson?.id, sectionAnchors]);



  const handleCompleteLesson = async () => {
    if (!currentLesson || !course?.id) return;

    const newCompleted = [...completedLessons, currentLesson.id];
    setCompletedLessons(newCompleted);

    // Save progress to new API
    try {
      await fetch(
        `${BACKEND_URL}/user/${user.id}/course-progress/${course.id}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            completedLessons: newCompleted,
            currentLessonId: currentLesson.id,
          }),
        }
      );
    } catch (err) {
      console.error("Error saving progress:", err);
    }

    if (currentLessonIndex < lessons.length - 1) {
      setCurrentLessonIndex(currentLessonIndex + 1);
    } else {
      setShowCompletion(true);
    }
  };

  // Resizable panel handlers
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingSidebar) {
        const newWidth = Math.max(200, Math.min(500, e.clientX));
        setSidebarWidth(newWidth);
      }
      if (isDraggingIde) {
        const containerWidth = window.innerWidth - sidebarWidth;
        const ideX = e.clientX;
        const remainingWidth = containerWidth - (ideX - sidebarWidth);
        const newWidth = Math.max(20, Math.min(60, (remainingWidth / containerWidth) * 100));
        setIdeWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsDraggingSidebar(false);
      setIsDraggingIde(false);
    };

    if (isDraggingSidebar || isDraggingIde) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isDraggingSidebar, isDraggingIde, sidebarWidth]);

  if (showCompletion) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-orange-50 flex items-center justify-center p-4">
        <Card className="max-w-2xl w-full p-12 text-center bg-white">
          <div className="w-20 h-20 bg-gradient-to-br from-[#ffa200] to-[#ff8800] rounded-full flex items-center justify-center mx-auto mb-6">
            <Trophy className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-4xl mb-4">Congratulations! 🎉</h2>
          <p className="text-xl text-gray-600 mb-8">
            You've completed the Python Fundamentals course and
            built a working{" "}
            {user.onboarding?.theme || "project"}!
          </p>
          <div className="bg-gradient-to-r from-purple-50 to-orange-50 rounded-xl p-6 mb-8">
            <p className="text-lg mb-2">
              The components you coded have been integrated to
              form:
            </p>
            <p className="text-2xl bg-gradient-to-r from-[#7622e5] to-[#ffa200] bg-clip-text text-transparent">
              A Complete{" "}
              {user.onboarding?.theme === "finance"
                ? "Budget Tracker"
                : user.onboarding?.theme === "gaming"
                  ? "Game"
                  : "Chatbot"}{" "}
              App
            </p>
          </div>
          <p className="text-gray-600 mb-8">
            You now have the foundation to build your own
            projects. Keep practicing and creating!
          </p>
          <Button
            onClick={onBack}
            className="bg-gradient-to-r from-[#7622e5] to-[#b480f8] hover:from-[#6518d0] hover:to-[#a070e8]"
          >
            Back to Home
          </Button>
        </Card>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-orange-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center bg-white">
          <div className="animate-spin w-12 h-12 border-4 border-[#7622e5] border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-600">Loading course...</p>
        </Card>
      </div>
    );
  }

  // Error state
  if (error || !course || !currentLesson) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-orange-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center bg-white">
          <p className="text-red-500 mb-4">{error || "Failed to load course"}</p>
          <Button onClick={onBack} variant="outline">
            Back to Home
          </Button>
        </Card>
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
            <h1 className="text-lg">Python Fundamentals</h1>
            <p className="text-sm text-gray-600">
              Lesson {currentLessonIndex + 1} of{" "}
              {lessons.length}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-48">
            <Progress value={progress} className="h-2" />
          </div>
          <span className="text-sm text-gray-600">
            {Math.round(progress)}%
          </span>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Collapsible */}
        <Sidebar
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          completedSections={completedSections}
          onSectionClick={(sectionId) => {
            const element = document.getElementById(`section-${sectionId}`);
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }}
        />

        {/* Middle - Unified Lesson Card (Story + Practice) with better padding */}
        <div
          className="flex flex-col overflow-hidden border-r border-gray-200 bg-white relative"
          style={{
            flex: `1 1 ${100 - ideWidth}%`,
            minWidth: '300px'
          }}
        >
          {/* Resize handle for IDE */}
          <div
            className="group absolute right-0 top-0 bottom-0 w-3 cursor-col-resize z-10"
            onMouseDown={(e) => {
              e.preventDefault();
              setIsDraggingIde(true);
            }}
            onDoubleClick={() => setIdeWidth(40)}
          >
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-12 w-[3px] rounded bg-gray-300 group-hover:bg-[#7622e5]" />
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-8">
            <div className="max-w-2xl mx-auto">

              {/* Section-based Lesson Content using mockLesson */}
              <div>
                {mockLesson.sections.map((section) => (
                  <LessonSectionComponent
                    key={section.id}
                    section={section}
                    isCompleted={completedSections.includes(section.id)}
                    userCode={userCode}
                    output={ideOutput}
                    onSectionComplete={handleSectionComplete}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right - IDE */}
        <div
          className="border-l border-gray-200 bg-white flex flex-col"
          style={{
            width: `${ideWidth}%`,
            minWidth: '300px',
            maxWidth: '60%'
          }}
        >
          <div className="flex-1 min-h-0 overflow-hidden">
            <WebIDE
              initialCode={userCode}
              onCodeChange={setUserCode}
              onOutputChange={setIdeOutput}
              readOnly={false}
            />
          </div>
        </div>

        {/* AI Chatbot */}
        {
          isChatOpen && (
            <div className="w-80 border-l border-gray-200 bg-white flex flex-col transition-all duration-300">
              <AIChatbot
                context={currentLesson?.title || mockLesson.title}
                taskId={currentLesson?.id || mockLesson.id}
                userCode={userCode}
                onClose={() => setIsChatOpen(false)}
                visible={true}
              />
            </div>
          )
        }
        {
          !isChatOpen && (
            <button
              onClick={() => setIsChatOpen(true)}
              className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-110 hover:shadow-xl z-50"
              style={{ backgroundColor: '#4285f4' }}
              title="Open AI Chat"
            >
              <MessageCircle className="w-6 h-6 text-white" />
            </button>
          )
        }
      </div>
    </div>
  );
}