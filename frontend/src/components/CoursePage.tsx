import React, { useState, useEffect, useMemo } from "react";
import { User } from "../App";
import { WebIDE } from "./WebIDE";
import { AIChatbot } from "./AIChatbot";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Card, CardContent } from "./ui/card";
import { Progress } from "./ui/progress";
import { ScrollArea } from "./ui/scroll-area";
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

// Icon mapping for database icon names
const iconMap: Record<string, LucideIcon> = {
  BookOpen,
  Sparkles,
  ListChecks,
  Target,
  Lightbulb,
};

// Types matching database schema
type LessonTask = {
  id: string;
  position: number;
  task_description: string;
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
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentLessonIndex, setCurrentLessonIndex] = useState(0);
  const [completedLessons, setCompletedLessons] = useState<string[]>([]);
  const [userCode, setUserCode] = useState("");
  const [showCompletion, setShowCompletion] = useState(false);

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
        {/* Sidebar - Lessons List */}
        <div
          className="border-r bg-gray-50 flex flex-col relative"
          style={{ width: `${sidebarWidth}px`, minWidth: '200px', maxWidth: '500px' }}
        >
          {/* Resize handle */}
          <div
            className="group absolute right-0 top-0 bottom-0 w-3 cursor-col-resize z-10"
            onMouseDown={(e) => {
              e.preventDefault();
              setIsDraggingSidebar(true);
            }}
            onDoubleClick={() => setSidebarWidth(256)}
          >
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-12 w-[3px] rounded bg-gray-300 group-hover:bg-[#7622e5]" />
          </div>
          <div className="p-4 border-b bg-white">
            <h2 className="font-semibold">Course Progress</h2>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2">
              {lessons.map((lesson, index) => {
                const isCompleted = completedLessons.includes(
                  lesson.id,
                );
                const isCurrent = index === currentLessonIndex;
                const isLocked =
                  index > currentLessonIndex && !isCompleted;
                const isExpanded = !!expandedLessons[lesson.id];
                const activeItem =
                  activeSubsection.lessonId === lesson.id
                    ? activeSubsection.itemId
                    : null;
                const isPracticeActive =
                  activeItem === "lesson" ||
                  activeItem === "task-1" ||
                  activeItem === "task-2" ||
                  activeItem === "task-3";

                const handleSubsectionSelect = (subId: SubSectionId) => {
                  if (isLocked) return;
                  if (currentLessonIndex !== index) {
                    setCurrentLessonIndex(index);
                  }
                  setExpandedLessons((prev) => ({
                    ...prev,
                    [lesson.id]: true,
                  }));
                  setActiveSubsection({
                    lessonId: lesson.id,
                    itemId: subId,
                  });
                };

                return (
                  <div key={lesson.id} className="mb-3 last:mb-0">
                    <button
                      onClick={() => {
                        if (isLocked) return;
                        setCurrentLessonIndex(index);
                        setExpandedLessons((prev) => ({
                          ...prev,
                          [lesson.id]: !isExpanded,
                        }));
                        setActiveSubsection({
                          lessonId: lesson.id,
                          itemId: "blog",
                        });
                      }}
                      disabled={isLocked}
                      className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${isCurrent
                          ? "bg-gradient-to-r from-[#7622e5] to-[#b480f8] text-white border-transparent shadow-sm"
                          : isLocked
                            ? "bg-gray-100 text-gray-400 border-transparent cursor-not-allowed"
                            : "bg-white border-gray-200 hover:border-[#7622e5]/40 hover:bg-[#f5f0ff]"
                        }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <span className="text-xs uppercase tracking-wide block mb-1">
                            Lesson {index + 1}
                          </span>
                          <p
                            className={`text-sm font-medium ${isCurrent ? "text-white" : "text-gray-900"
                              }`}
                          >
                            {lesson.title}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {isCompleted ? (
                            <Check className="w-4 h-4 text-green-200" />
                          ) : isLocked ? (
                            <Lock className="w-4 h-4" />
                          ) : null}
                          <ChevronDown
                            className={`w-4 h-4 transition-transform ${isExpanded && !isLocked ? "rotate-180" : ""
                              }`}
                          />
                        </div>
                      </div>
                    </button>

                    {isExpanded && !isLocked && (
                      <div className="mt-3 ml-2 pl-3 border-l border-gray-200 space-y-1">
                        <button
                          onClick={() => handleSubsectionSelect("blog")}
                          className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-colors ${activeItem === "blog"
                              ? "bg-[#7622e5]/10 text-[#7622e5] font-medium"
                              : "text-gray-600 hover:bg-gray-100"
                            }`}
                        >
                          Blog Post
                        </button>

                        <div>
                          <button
                            onClick={() =>
                              handleSubsectionSelect("lesson")
                            }
                            className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-colors flex items-center justify-between ${isPracticeActive
                                ? "bg-[#7622e5]/10 text-[#7622e5] font-medium"
                                : "text-gray-600 hover:bg-gray-100"
                              }`}
                          >
                            <span>Lesson</span>
                            <ChevronRight className="w-3 h-3 opacity-50" />
                          </button>
                          <div className="ml-3 mt-1 space-y-1">
                            {["task-1", "task-2", "task-3"].map(
                              (taskId, taskIndex) => {
                                const typedTaskId = taskId as SubSectionId;
                                const isActive = activeItem === typedTaskId;
                                return (
                                  <button
                                    key={taskId}
                                    onClick={() =>
                                      handleSubsectionSelect(typedTaskId)
                                    }
                                    className={`w-full text-left text-sm px-3 py-1.5 rounded-lg transition-colors ${isActive
                                        ? "bg-[#7622e5]/10 text-[#7622e5] font-medium"
                                        : "text-gray-500 hover:bg-gray-100"
                                      }`}
                                  >
                                    Task {taskIndex + 1}
                                  </button>
                                );
                              },
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>

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
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-5xl mx-auto w-full px-8 sm:px-10 lg:px-12 py-10 sm:py-12 space-y-10">


              {/* Middle Panel - Article Content */}
              <ScrollArea className="flex-1 border-r">
                <div className="max-w-3xl mx-auto p-8 space-y-8">
                  {/* Introduction */}
                  <div className="space-y-4 animate-slide-up">
                    <Badge id="lesson-section-blog"
                    variant="outline"
                    className="border-primary/30 text-primary"
                  >
                    Lesson 1
                  </Badge>
                  <h2 className="text-3xl sm:text-4xl font-semibold text-gray-900 leading-tight mb-3 py-3">
                    {currentLesson.title}
                  </h2>
                  <p className="text-base sm:text-lg text-gray-700 max-w-2xl leading-[1.75]">
                    {currentLesson.description}
                  </p>
                </div>

                {/* Highlights grid with generous padding */}
                <div className="px-8 sm:px-12 lg:px-14 py-8 sm:py-10 grid gap-6 sm:gap-7 lg:gap-8 sm:grid-cols-3">
                  {lessonHighlights.map((highlight) => {
                    const Icon = highlight.icon;
                    return (
                      <div
                        key={highlight.id}
                        className="rounded-2xl border border-[#ffa200]/25 bg-white/80 p-6 shadow-sm hover:shadow-md transition-shadow space-y-3"
                      >
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#ffa200]">
                          <Icon className="w-4 h-4" />
                          {highlight.title}
                        </div>
                        <p className="text-base font-semibold text-gray-900 leading-snug">
                          {highlight.heading}
                        </p>
                        <p className="text-sm text-gray-600 leading-[1.7]">
                          {highlight.detail}
                        </p>
                      </div>
                    );
                  })}
                </div>
                </div>


              {/*What are Variables?*/}
              <div className="max-w-3xl mx-auto px-8">
              <h2 
              id = "lesson"
              className="text-3xl sm:text-4xl font-semibold text-gray-900 leading-tight mb-3 ">
                What are Variables?
              </h2>
              <p className="text-medium text-gray-600 leading-[1.7] py-8">
                Variables are like labeled boxes that store
                information in your program. They allow you to
                save data and use it later.
              </p>
                
              {/* Visual Metaphor */}
              <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-purple-500/5 overflow-hidden">
                <CardContent className="p-8">
                  <div className="space-y-6">
                    <h3 className="text-xl font-medium">
                      Think of Variables as Labeled Boxes
                    </h3>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <div className="p-6 rounded-xl border-2 border-dashed border-primary/30 bg-background/50 text-center">
                          <div className="text-sm text-muted-foreground mb-2">
                            Box Label
                          </div>
                          <div className="text-lg font-mono text-primary">
                            age
                          </div>
                          <div className="h-px bg-border my-3" />
                          <div className="text-2xl">25</div>
                          <div className="text-xs text-muted-foreground mt-2">
                            Value Inside
                          </div>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div className="p-6 rounded-xl border-2 border-dashed border-purple-500/30 bg-background/50 text-center">
                          <div className="text-sm text-muted-foreground mb-2">
                            Box Label
                          </div>
                          <div className="text-lg font-mono text-purple-500">
                            name
                          </div>
                          <div className="h-px bg-border my-3" />
                          <div className="text-2xl">"Maya"</div>
                          <div className="text-xs text-muted-foreground mt-2">
                            Value Inside
                          </div>
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Just like you can put different things in
                      different boxes and label them, you can
                      store different values in variables with
                      different names.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Syntax */}
              <div className="space-y-4 py-8">
                <h2 className="text-2xl">Basic Syntax</h2>
                <p className="text-muted-foreground">
                  In Python, creating a variable is simple. You
                  just write the variable name, an equals sign,
                  and the value you want to store:
                </p>

                <Card className="bg-black/95 text-green-400 overflow-hidden">
                  <CardContent className="p-6 space-y-3 font-mono">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm mb-4">
                      <Terminal className="h-4 w-4" />
                      Python Syntax
                    </div>
                    <div>
                      <span className="text-cyan-400">age</span>{" "}
                      ={" "}
                      <span className="text-yellow-400">
                        25
                      </span>
                    </div>
                    <div>
                      <span className="text-cyan-400">
                        name
                      </span>{" "}
                      ={" "}
                      <span className="text-green-400">
                        "Maya"
                      </span>
                    </div>
                    <div>
                      <span className="text-cyan-400">
                        height
                      </span>{" "}
                      ={" "}
                      <span className="text-yellow-400">
                        1.75
                      </span>
                    </div>
                    <div>
                      <span className="text-cyan-400">
                        is_student
                      </span>{" "}
                      ={" "}
                      <span className="text-purple-400">
                        True
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-l-primary bg-primary/5">
                  <CardContent className="p-4">
                    <div className="flex gap-3">
                      <Lightbulb className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <div className="font-medium">
                          Naming Rules
                        </div>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          <li>
                            • Variable names can contain
                            letters, numbers, and underscores
                          </li>
                          <li>
                            • They must start with a letter or
                            underscore
                          </li>
                          <li>
                            • They are case-sensitive (age and
                            Age are different)
                          </li>
                          <li>
                            • Use descriptive names (name is
                            better than n)
                          </li>
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Data Types */}
              <div className="space-y-4">
                <h2 className="text-3xl sm:text-4xl font-semibold text-gray-900 leading-tight mb-3 py-8 ">Types of Data</h2>
                <p className="text-muted-foreground">
                  Variables can store different types of data:
                </p>

                <div className="grid gap-4">
                  {[
                    {
                      type: "Integer (int)",
                      desc: "Whole numbers",
                      example: "age = 25",
                      color: "from-blue-500 to-cyan-500",
                    },
                    {
                      type: "String (str)",
                      desc: "Text in quotes",
                      example: 'name = "Maya"',
                      color: "from-green-500 to-emerald-500",
                    },
                    {
                      type: "Float",
                      desc: "Decimal numbers",
                      example: "height = 1.75",
                      color: "from-purple-500 to-pink-500",
                    },
                    {
                      type: "Boolean (bool)",
                      desc: "True or False",
                      example: "is_student = True",
                      color: "from-orange-500 to-red-500",
                    },
                  ].map((item, i) => (
                    <Card
                      key={i}
                      className="border-2 hover:border-primary/50 transition-all"
                    >
                      <CardContent className="p-4 flex items-start gap-4">
                        <div
                          className={`h-12 w-12 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center flex-shrink-0 shadow-lg`}
                        >
                          <Code2 className="h-6 w-6 text-white" />
                        </div>
                        <div className="flex-1 space-y-2">
                          <div className="font-medium">
                            {item.type}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {item.desc}
                          </div>
                          <code className="text-sm text-blue-400 px-3 py-1 rounded font-mono inline-block">
                            {item.example}
                          </code>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Printing Variables */}
                  <div className="space-y-4 py-8">
                  <h2 className="text-3xl sm:text-4xl font-semibold text-gray-900 leading-tight mb-3 py-8">
                  Printing Variables in Your Code
                </h2>
                <p className="text-muted-foreground">
                  Once you create a variable, you can use it
                  anywhere in your program:
                </p>

                <Card className="bg-black/95 text-green-400">
                  <CardContent className="p-6 space-y-2 font-mono text-sm">
                    <div>
                      <span className="text-cyan-400">age</span>{" "}
                      ={" "}
                      <span className="text-yellow-400">
                        25
                      </span>
                    </div>
                    <div>
                      <span className="text-cyan-400">
                        name
                      </span>{" "}
                      ={" "}
                      <span className="text-green-400">
                        "Maya"
                      </span>
                    </div>
                    <div className="h-px bg-gray-700 my-3" />
                    <div>
                      <span className="text-purple-400">
                        print
                      </span>
                      (<span className="text-green-400">f</span>
                      <span className="text-green-400">
                        "{"{"}name{"}"} is {"{"}age{"}"} years
                        old."
                      </span>
                      )
                    </div>
                    <div className="text-gray-400 text-xs mt-3">
                      Output: Maya is 25 years old.
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-l-cyan-500 bg-cyan-500/5">
                  <CardContent className="p-4">
                    <div className="flex gap-3">
                      <Sparkles className="h-5 w-5 text-cyan-500 flex-shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <div className="font-medium">
                          F-Strings for Formatting
                        </div>
                        <p className="text-sm text-muted-foreground">
                          The{" "}
                          <code className="text-xs bg-black/30 px-1.5 py-0.5 rounded">
                            f"..."
                          </code>{" "}
                          syntax lets you insert variables
                          directly into strings using{" "}
                          <code className="text-xs bg-black/30 px-1.5 py-0.5 rounded">
                            {"{"}variable{"}"}
                          </code>
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>


              {/* Practice - Try it youself! */}
              <div className="space-y-4 py-8">
              <h2 className="text-3xl sm:text-4xl font-semibold text-gray-900 leading-tight mb-3 py-8"> 
                Practice - Try it youself!
              </h2>
                  <p className="text-muted-foreground">
                    Tackle each task to unlock the next milestone—and celebrate every run!
                  </p>
              <Card className="border-l-4 border-l-cyan-500 bg-cyan-500/5 ">
                <CardContent className="p-6">
                  <div className="flex gap-3">
                    <Lightbulb className="h-5 w-5 text-cyan-500 flex-shrink-0 mt-0.5 text-[#ffa200]" /> 
                    <div className="space-y-1">
                      <div className="font-medium text-[#ffa200]">
                        Hints
                      </div>
                <ul className="space-y-3 text-base text-gray-600 leading-[1.7] list-disc pl-6">
                  {(currentLesson?.hints || []).map((hint: string, i: number) => (
                    <li key={i}>{hint}</li>
                  ))}
                </ul>
              </div>
              </div>
              </CardContent>
            </Card>
            </div>

              {/* Tasks */}
                <div className="grid gap-8 sm:grid-cols-3">
                  {lessonTasks.map((task, i) => (
                    <div
                      key={i}
                      id={`lesson-task-${i + 1}`}
                    >
                      <h4 className="mt-5 text-base font-semibold  text-[#ffa200]">Task {i + 1}</h4>
                      <p className="mt-3 text-sm text-gray-600 leading-[1.8]">{task}</p>
                    </div>
                  ))}
            </div>

            </div>
            {/* AI Assistant */}
            <Card className="mt-8 shadow-xl border border-[#7622e5]/25 bg-gradient-to-br from-purple-50 via-white to-purple-100">
              <div className="px-8 py-8 sm:px-10 sm:py-10 space-y-6">
                <div className="flex items-start gap-4">
                  <div className="rounded-xl bg-[#7622e5]/15 p-3 text-[#7622e5]">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-semibold text-gray-900">
                      AI Assistant: Your Always-On Coach
                    </h3>
                    <p className="text-base text-gray-600 leading-[1.7]">
                    </p>
                  </div>
                </div>
                <div className="grid gap-5 sm:grid-cols-3">
                  {[
                    "Clarify lesson concepts in student-friendly language.",
                    "Get hints that guide—not spoil—the solution.",
                    "Share your code to receive quick feedback before moving on.",
                  ].map((item, index) => (
                    <div
                      key={index}
                      className="rounded-xl  bg-white/85 p-5 text-base text-gray-700 shadow-sm leading-[1.7]"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </Card>

          </ScrollArea>

          <div className="mt-8 px-8 sm:px-12 lg:px-14 pb-9">
                <Button
                  onClick={handleCompleteLesson}
                  size="lg"
                  className="px-6 bg-gradient-to-r from-[#7622e5] to-[#b480f8] hover:from-[#6518d0] hover:to-[#a070e8]"
                >
                  Complete Lesson & Continue
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          </div>
          
        </div>

        {/* Right - IDE */}
        <div
          className="border-l border-gray-200 bg-gray-50 flex flex-col"
          style={{
            width: `${ideWidth}%`,
            minWidth: '300px',
            maxWidth: '60%'
          }}
        >
          <div className="px-6 py-4 bg-white border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              IDE
            </h3>
            <p className="text-sm text-gray-500">
              Type your solution on the left, run it, and review the output below.
            </p>
          </div>
          <div className="flex-1 p-6">
            <WebIDE
              initialCode={userCode}
              onCodeChange={setUserCode}
              readOnly={false}
            />
          </div>
        </div>
      </div>

      <AIChatbot context={currentLesson.title} />
      
    </div>

  );
}