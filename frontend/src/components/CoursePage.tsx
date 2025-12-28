import { useState, useEffect } from "react";
import { User } from "../App";
// NOTE: Course progress APIs not yet in Flask backend
import { WebIDE } from "./WebIDE";
import { AIChatbot } from "./AIChatbot";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Progress } from "./ui/progress";
import { ScrollArea } from "./ui/scroll-area";
import {
  ArrowLeft,
  Check,
  Lock,
  ChevronRight,
  Trophy,
  Sparkles,
} from "lucide-react";

type Lesson = {
  id: string;
  title: string;
  description: string;
  content: string;
  challenge: {
    description: string;
    starterCode: string;
    hints: string[];
  };
};

type Props = {
  user: User;
  onBack: () => void;
};

const getLessonsForTheme = (theme: string): Lesson[] => {
  const themes = {
    finance: {
      lesson1: {
        variables: "budget = 1000\nrent = 500\ngroceries = 200",
        operations:
          'remaining = budget - rent - groceries\nprint("Remaining budget:", remaining)',
        context: "budget tracker",
      },
      lesson2: {
        operations:
          "total_expenses = rent + groceries + utilities\nsavings = budget - total_expenses",
        context: "expense calculator",
      },
      lesson3: {
        loops:
          'expenses = [rent, groceries, utilities, transport]\nfor expense in expenses:\n    print("Expense:", expense)',
        context: "expense reporter",
      },
    },
    gaming: {
      lesson1: {
        variables:
          "player_health = 100\nenemy_health = 50\nscore = 0",
        operations:
          "player_health = player_health - 10\nscore = score + 50",
        context: "game",
      },
      lesson2: {
        operations:
          'damage = 15\nenemy_health = enemy_health - damage\nif enemy_health <= 0:\n    print("Enemy defeated!")',
        context: "combat system",
      },
      lesson3: {
        loops:
          'items = ["sword", "shield", "potion"]\nfor item in items:\n    print("Collected:", item)',
        context: "inventory system",
      },
    },
    chatbot: {
      lesson1: {
        variables:
          'bot_name = "CodeBot"\nuser_name = "Student"\ngreeting = "Hello"',
        operations:
          'message = greeting + ", " + user_name\nprint(message)',
        context: "chatbot",
      },
      lesson2: {
        operations:
          'response = "I can help you with coding!"\nfull_message = bot_name + " says: " + response',
        context: "response generator",
      },
      lesson3: {
        loops:
          'responses = ["Hello!", "How can I help?", "Goodbye!"]\nfor response in responses:\n    print(bot_name + ":", response)',
        context: "conversation system",
      },
    },
  };

  const themeData =
    themes[theme as keyof typeof themes] || themes.finance;

  return [
    {
      id: "lesson1",
      title: "Basics: Print, Variables & Data Types",
      description:
        "Learn the fundamentals of Python programming",
      content: `# Lesson 1: Python Basics

## Variables
Variables are containers for storing data. In Python, you create a variable by assigning a value to it:

\`\`\`python
name = "Alice"
age = 25
is_student = True
\`\`\`

## Data Types
Python has several basic data types:
- **Strings**: Text in quotes - \`"Hello"\` or \`'Hello'\`
- **Numbers**: Integers like \`42\` or decimals like \`3.14\`
- **Booleans**: \`True\` or \`False\`

## Print Function
The \`print()\` function displays output:
\`\`\`python
print("Hello, World!")
print(age)
\`\`\`

Now let's apply this to build part of your ${themeData.lesson1.context}!`,
      challenge: {
        description: `Create variables for your ${themeData.lesson1.context}. Define the variables shown in the example, then print them out.`,
        starterCode: `# Define your variables here\n${themeData.lesson1.variables}\n\n# Print them\nprint(${themeData.lesson1.variables.split("\n")[0].split(" = ")[0]})`,
        hints: [
          "Variables are created with the = sign",
          "Print each variable on a new line",
          "Make sure variable names match exactly",
        ],
      },
    },
    {
      id: "lesson2",
      title: "Operations: Math, Strings & Lists",
      description: "Perform operations on your data",
      content: `# Lesson 2: Operations

## Mathematical Operations
Python can do math with numbers:
\`\`\`python
total = 100 + 50
difference = 100 - 50
product = 10 * 5
quotient = 100 / 4
\`\`\`

## String Operations
You can combine strings with the + operator:
\`\`\`python
first_name = "John"
last_name = "Doe"
full_name = first_name + " " + last_name
\`\`\`

## List Operations
Lists store multiple items:
\`\`\`python
numbers = [1, 2, 3, 4, 5]
numbers.append(6)  # Add item
first = numbers[0]  # Access by index
\`\`\`

Now let's add calculations to your ${themeData.lesson2.context}!`,
      challenge: {
        description: `Perform operations on the variables from the previous lesson. Calculate totals and show the results.`,
        starterCode: `# Your variables from lesson 1\n${themeData.lesson1.variables}\n\n# Perform operations here\n${themeData.lesson2.operations}\n\n# Print the results`,
        hints: [
          "Use + for addition and - for subtraction",
          "You can combine multiple operations",
          "Print your calculated values to see results",
        ],
      },
    },
    {
      id: "lesson3",
      title: "Loops & Conditionals",
      description: "Control the flow of your program",
      content: `# Lesson 3: Loops & Conditionals

## If Statements
Make decisions in your code:
\`\`\`python
age = 18
if age >= 18:
    print("Adult")
else:
    print("Minor")
\`\`\`

## For Loops
Repeat code for each item in a sequence:
\`\`\`python
fruits = ["apple", "banana", "orange"]
for fruit in fruits:
    print(fruit)
\`\`\`

## While Loops
Repeat while a condition is true:
\`\`\`python
count = 0
while count < 5:
    print(count)
    count = count + 1
\`\`\`

Complete your ${themeData.lesson3.context} with loops!`,
      challenge: {
        description: `Use loops to process multiple items. Create a list and iterate through it.`,
        starterCode: `# Previous code\n${themeData.lesson1.variables}\n${themeData.lesson2.operations}\n\n# Add loops here\n${themeData.lesson3.loops}\n\nprint("Your ${themeData.lesson3.context} is complete!")`,
        hints: [
          "for loops iterate over lists",
          "Use meaningful variable names in loops",
          "Remember to indent code inside loops",
        ],
      },
    },
  ];
};

export function CoursePage({ user, onBack }: Props) {
  const [currentLessonIndex, setCurrentLessonIndex] =
    useState(0);
  const [completedLessons, setCompletedLessons] = useState<
    string[]
  >([]);
  const [userCode, setUserCode] = useState("");
  const [showCompletion, setShowCompletion] = useState(false);

  const lessons = getLessonsForTheme(
    user.onboarding?.theme || "finance",
  );
  const currentLesson = lessons[currentLessonIndex];
  const progress =
    (completedLessons.length / lessons.length) * 100;

  useEffect(() => {
    if (currentLesson) {
      setUserCode(currentLesson.challenge.starterCode);
    }
  }, [currentLesson]);

  useEffect(() => {
    // TODO: Load progress from backend (API not yet implemented)
    // For now, progress is local only
  }, [user.name]);

  const handleCompleteLesson = async () => {
    const newCompleted = [
      ...completedLessons,
      currentLesson.id,
    ];
    setCompletedLessons(newCompleted);

    // TODO: Save progress to backend (API not yet implemented)
    // Progress is local only for now

    if (currentLessonIndex < lessons.length - 1) {
      setCurrentLessonIndex(currentLessonIndex + 1);
    } else {
      setShowCompletion(true);
    }
  };

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
        <div className="w-64 border-r bg-gray-50 flex flex-col">
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

                return (
                  <button
                    key={lesson.id}
                    onClick={() =>
                      !isLocked && setCurrentLessonIndex(index)
                    }
                    disabled={isLocked}
                    className={`w-full text-left p-3 rounded-lg mb-2 transition-colors ${isCurrent
                        ? "bg-gradient-to-r from-[#7622e5] to-[#b480f8] text-white"
                        : isCompleted
                          ? "bg-white border border-green-200 hover:bg-green-50"
                          : isLocked
                            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                            : "bg-white border hover:bg-gray-50"
                      }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm">
                        Lesson {index + 1}
                      </span>
                      {isCompleted ? (
                        <Check className="w-4 h-4 text-green-600" />
                      ) : isLocked ? (
                        <Lock className="w-4 h-4" />
                      ) : null}
                    </div>
                    <div
                      className={
                        isCurrent
                          ? "text-white"
                          : "text-gray-900"
                      }
                    >
                      {lesson.title}
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Middle - Lesson Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-3xl p-6 pb-8">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-5 h-5 text-[#ffa200]" />
                <span className="text-sm text-[#7622e5]">
                  Current Lesson
                </span>
              </div>
              <h2 className="text-3xl mb-4">
                {currentLesson.title}
              </h2>
              <p className="text-gray-600 mb-8">
                {currentLesson.description}
              </p>

              <div className="prose max-w-none mb-8">
                <div className="bg-gray-50 rounded-lg p-6 border">
                  <pre className="whitespace-pre-wrap text-sm">
                    {currentLesson.content}
                  </pre>
                </div>
              </div>

              <Card className="p-6 border-2 border-[#ffa200] bg-orange-50 mb-6">
                <h3 className="text-xl mb-3 flex items-center gap-2">
                  <ChevronRight className="w-5 h-5 text-[#ffa200]" />
                  Mini Challenge
                </h3>
                <p className="text-gray-700 mb-4">
                  {currentLesson.challenge.description}
                </p>

                <div className="bg-white rounded-lg p-4 border">
                  <p className="text-sm mb-2">💡 Hints:</p>
                  <ul className="text-sm text-gray-600 space-y-1">
                    {currentLesson.challenge.hints.map(
                      (hint, i) => (
                        <li key={i}>• {hint}</li>
                      ),
                    )}
                  </ul>
                </div>
              </Card>

              <div className="mt-6">
                <Button
                  onClick={handleCompleteLesson}
                  size="lg"
                  className="bg-gradient-to-r from-[#7622e5] to-[#b480f8] hover:from-[#6518d0] hover:to-[#a070e8]"
                >
                  Complete Lesson & Continue
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
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

      <AIChatbot context={currentLesson.title} />
    </div>
  );
}