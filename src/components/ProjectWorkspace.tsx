import { useState, useEffect } from "react";
import { User } from "../App";
import {
  projectId,
  publicAnonKey,
} from "../utils/supabase/info";
import { WebIDE } from "./WebIDE";
import { AIChatbot } from "./AIChatbot";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Progress } from "./ui/progress";
import { ScrollArea } from "./ui/scroll-area";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  Trophy,
  Sparkles,
} from "lucide-react";

type Task = {
  id: string;
  title: string;
  description: string;
  hints: string[];
  starterCode: string;
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
  const [completedTasks, setCompletedTasks] = useState<
    string[]
  >([]);
  const [userCode, setUserCode] = useState("");
  const [showHints, setShowHints] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);

  const tasks: Task[] = project.tasks || [];
  const currentTask = tasks[currentTaskIndex];
  const progress = (completedTasks.length / tasks.length) * 100;

  useEffect(() => {
    if (currentTask) {
      setUserCode(currentTask.starterCode);
      setShowHints(false);
    }
  }, [currentTask]);

  useEffect(() => {
    // Load project progress
    if (project.progress?.completedTasks) {
      setCompletedTasks(project.progress.completedTasks);
    }
  }, [project]);

  const handleCompleteTask = async () => {
    const newCompleted = [...completedTasks, currentTask.id];
    setCompletedTasks(newCompleted);

    // Save progress
    try {
      await fetch(
        `https://${projectId}.supabase.co/functions/v1/server/project/${project.id}/progress`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            completedTasks: newCompleted,
          }),
        },
      );
    } catch (err) {
      console.error("Error saving progress:", err);
    }

    if (currentTaskIndex < tasks.length - 1) {
      setCurrentTaskIndex(currentTaskIndex + 1);
    } else {
      // Project complete!
      await handleProjectComplete();
    }
  };

  const handleProjectComplete = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/server/project/${project.id}/complete`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({ userName: user.name }),
        },
      );

      const data = await response.json();

      if (data.success) {
        setShowCompletion(true);
      }
    } catch (err) {
      console.error("Error completing project:", err);
    }
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
            <span className="font-semibold">
              {project.title}
            </span>
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
            This project is now part of your portfolio. Keep
            building and growing!
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
            <h1 className="text-lg">{project.title}</h1>
            <p className="text-sm text-gray-600">
              Task {currentTaskIndex + 1} of {tasks.length}
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
        {/* Sidebar - Task List */}
        <div className="w-64 border-r bg-gray-50 flex flex-col">
          <div className="p-4 border-b bg-white">
            <h2 className="font-semibold">Project Tasks</h2>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2">
              {tasks.map((task, index) => {
                const isCompleted = completedTasks.includes(
                  task.id,
                );
                const isCurrent = index === currentTaskIndex;
                const isLocked =
                  index > currentTaskIndex && !isCompleted;

                return (
                  <button
                    key={task.id}
                    onClick={() =>
                      !isLocked && setCurrentTaskIndex(index)
                    }
                    disabled={isLocked}
                    className={`w-full text-left p-3 rounded-lg mb-2 transition-colors ${
                      isCurrent
                        ? "bg-gradient-to-r from-[#ffa200] to-[#ff8800] text-white"
                        : isCompleted
                          ? "bg-white border border-green-200 hover:bg-green-50"
                          : isLocked
                            ? "bg-gray-100 text-gray-400 cursor-not-allowed opacity-50"
                            : "bg-white border hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm">
                        Task {index + 1}
                      </span>
                      {isCompleted && (
                        <Check className="w-4 h-4 text-green-600" />
                      )}
                    </div>
                    <div
                      className={`text-sm ${isCurrent ? "text-white" : "text-gray-900"}`}
                    >
                      {task.title}
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Middle - Task Description */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-3xl p-6 pb-8">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-5 h-5 text-[#ffa200]" />
                <span className="text-sm text-[#ffa200]">
                  Current Task
                </span>
              </div>

              <h2 className="text-3xl mb-4">
                {currentTask.title}
              </h2>
              <p className="text-lg text-gray-700 mb-8">
                {currentTask.description}
              </p>

              {/* Hints Section */}
              <Card className="mb-6 border-2 border-purple-200 bg-purple-50">
                <button
                  onClick={() => setShowHints(!showHints)}
                  className="w-full p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">💡</span>
                    <span className="font-semibold">Hints</span>
                  </div>
                  {showHints ? (
                    <ChevronDown className="w-5 h-5" />
                  ) : (
                    <ChevronRight className="w-5 h-5" />
                  )}
                </button>

                {showHints && (
                  <div className="px-4 pb-4 space-y-2">
                    {currentTask.hints.map((hint, i) => (
                      <div key={i} className="flex gap-2">
                        <span className="text-purple-600">
                          •
                        </span>
                        <p className="text-gray-700">{hint}</p>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Progress Info */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">
                    Tasks Completed
                  </span>
                  <span className="font-semibold">
                    {completedTasks.length} / {tasks.length}
                  </span>
                </div>
                <Progress
                  value={progress}
                  className="h-2 mt-2"
                />
              </div>

              {/* Action Buttons */}
              <div className="mt-6">
                <div className="flex gap-3">
                  <Button
                    onClick={handleCompleteTask}
                    size="lg"
                    className="bg-gradient-to-r from-[#7622e5] to-[#b480f8] hover:from-[#6518d0] hover:to-[#a070e8]"
                  >
                    {currentTaskIndex < tasks.length - 1
                      ? "Complete & Continue"
                      : "Complete Project"}
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>

                  {currentTaskIndex > 0 && (
                    <Button
                      onClick={() =>
                        setCurrentTaskIndex(
                          currentTaskIndex - 1,
                        )
                      }
                      variant="outline"
                    >
                      Previous Task
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right - IDE */}
        <div className="w-[45%] border-l flex flex-col">
          <div className="flex-1 p-4">
            <WebIDE
              initialCode={userCode}
              onCodeChange={setUserCode}
            />
          </div>
        </div>
      </div>

      <AIChatbot
        context={`Working on: ${currentTask.title}`}
        userProgress={completedTasks}
      />
    </div>
  );
}