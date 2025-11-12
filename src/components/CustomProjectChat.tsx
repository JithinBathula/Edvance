import { useState } from 'react';
import { User } from '../App';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Textarea } from './ui/textarea';
import { ScrollArea } from './ui/scroll-area';
import { ArrowLeft, Send, Bot, User as UserIcon, Sparkles, AlertCircle } from 'lucide-react';

type Message = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

type Props = {
  user: User;
  onProjectCreated: (project: any) => void;
  onBack: () => void;
};

export function CustomProjectChat({ user, onProjectCreated, onBack }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `Hi ${user.name}! 👋 I'm here to help you create a custom project. Tell me what you'd like to build, and I'll design a learning path tailored to your skill level (${user.onboarding?.experienceLevel || 'beginner'}).\n\nWhat project idea do you have in mind?`,
    },
  ]);
  const [input, setInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [projectIdea, setProjectIdea] = useState('');

  const handleSend = async () => {
    if (!input.trim() || isAnalyzing) return;

    const userMessage = input.trim();
    setInput('');
    setProjectIdea(userMessage);
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setIsAnalyzing(true);

    // Simulate AI analysis
    setTimeout(() => {
      analyzeProject(userMessage);
    }, 1500);
  };

  const analyzeProject = (idea: string) => {
    const userLevel = user.onboarding?.experienceLevel || 'never';
    const ideaLower = idea.toLowerCase();

    // Simple complexity detection
    let complexity: 'beginner' | 'intermediate' | 'advanced' = 'beginner';
    
    if (
      ideaLower.includes('api') ||
      ideaLower.includes('database') ||
      ideaLower.includes('machine learning') ||
      ideaLower.includes('ai') ||
      ideaLower.includes('neural')
    ) {
      complexity = 'advanced';
    } else if (
      ideaLower.includes('class') ||
      ideaLower.includes('oop') ||
      ideaLower.includes('file') ||
      ideaLower.includes('json')
    ) {
      complexity = 'intermediate';
    }

    const levelMatch =
      (userLevel === 'never' && complexity === 'beginner') ||
      (userLevel === 'basic' && complexity === 'beginner') ||
      (userLevel === 'intermediate' && (complexity === 'beginner' || complexity === 'intermediate')) ||
      (userLevel === 'advanced');

    if (!levelMatch && userLevel !== 'advanced') {
      // Project too complex
      const recommendation = generateRecommendation(userLevel);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `I love your ambition! However, this project seems ${complexity} level, which might be challenging given your current experience (${userLevel}).\n\nHere's a recommendation that would be perfect for you:\n\n${recommendation}\n\nWould you like to:\n1. Continue with your original idea anyway\n2. Try the recommended project\n3. Tell me a different idea`,
        },
      ]);
      setIsAnalyzing(false);
    } else if (complexity === 'beginner' && userLevel === 'advanced') {
      // Too simple
      const recommendation = generateAdvancedRecommendation();
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `This project might be too simple for your advanced skill level. Here's a more challenging version:\n\n${recommendation}\n\nWould you like to:\n1. Continue with the original idea\n2. Try the enhanced version\n3. Tell me a different idea`,
        },
      ]);
      setIsAnalyzing(false);
    } else {
      // Good match!
      generateProject(idea, complexity);
    }
  };

  const generateRecommendation = (level: string): string => {
    const recommendations = {
      never: '🎯 **Simple Calculator**\nBuild a calculator that adds, subtracts, multiplies, and divides numbers. You\'ll learn variables, user input, and basic operations.',
      basic: '📝 **Todo List Manager**\nCreate a program to add, view, and mark tasks as complete. You\'ll practice lists, loops, and conditionals.',
      intermediate: '🎮 **Text Adventure Game**\nBuild an interactive story game where player choices matter. You\'ll use functions, classes, and complex logic.',
    };
    return recommendations[level as keyof typeof recommendations] || recommendations.basic;
  };

  const generateAdvancedRecommendation = (): string => {
    return '🚀 **Enhanced Version with Features**\nAdd data persistence (save/load), error handling, advanced algorithms, or integrate with an API to make it more challenging.';
  };

  const generateProject = async (idea: string, difficulty: string) => {
    setMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        content: `Perfect! This project matches your skill level. Let me design the tasks for you...`,
      },
    ]);

    // Generate tasks based on the project
    setTimeout(async () => {
      const tasks = generateTasks(idea, difficulty);
      
      const project = {
        title: idea,
        description: `A custom project to build: ${idea}`,
        difficulty,
        tasks,
      };

      // Save to backend
      try {
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-949d056e/user/${encodeURIComponent(user.name)}/project`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${publicAnonKey}`,
            },
            body: JSON.stringify(project),
          }
        );

        const data = await response.json();
        
        if (data.success) {
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content: `✅ Your project is ready! I've created ${tasks.length} tasks to guide you through building "${idea}". Let's get started!`,
            },
          ]);

          setTimeout(() => {
            onProjectCreated(data.project);
          }, 1000);
        }
      } catch (err) {
        console.error('Error creating project:', err);
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `There was an error creating your project. Please try again.`,
          },
        ]);
      }

      setIsAnalyzing(false);
    }, 2000);
  };

  const generateTasks = (idea: string, difficulty: string): any[] => {
    // Generate contextual tasks based on the project idea
    const ideaLower = idea.toLowerCase();
    
    if (ideaLower.includes('calculator')) {
      return [
        {
          id: 'task1',
          title: 'Set Up Variables',
          description: 'Create variables to store two numbers for calculation.',
          hints: ['Use meaningful variable names like num1 and num2', 'You can use input() to get user input'],
          starterCode: '# Get two numbers from user\nnum1 = 0\nnum2 = 0\n\nprint("Number 1:", num1)\nprint("Number 2:", num2)',
        },
        {
          id: 'task2',
          title: 'Add Operations',
          description: 'Implement addition, subtraction, multiplication, and division.',
          hints: ['Create variables for each operation result', 'Use +, -, *, / operators'],
          starterCode: '# Previous code here\n\n# Calculations\naddition = num1 + num2\nsubtraction = num1 - num2\n\nprint("Addition:", addition)',
        },
        {
          id: 'task3',
          title: 'Add User Choice',
          description: 'Let users choose which operation to perform.',
          hints: ['Use if/elif statements', 'Compare the user choice to strings like "add"'],
          starterCode: '# Ask user for operation\noperation = input("Enter operation (add/sub/mul/div): ")\n\nif operation == "add":\n    print(num1 + num2)',
        },
      ];
    }

    if (ideaLower.includes('todo') || ideaLower.includes('task')) {
      return [
        {
          id: 'task1',
          title: 'Create Task List',
          description: 'Set up a list to store tasks.',
          hints: ['Use an empty list: tasks = []', 'Use append() to add items'],
          starterCode: '# Initialize task list\ntasks = []\n\n# Add a sample task\ntasks.append("Learn Python")\nprint(tasks)',
        },
        {
          id: 'task2',
          title: 'Add and View Tasks',
          description: 'Create functions to add and display tasks.',
          hints: ['Use a for loop to display all tasks', 'Print each task with its index'],
          starterCode: '# Show all tasks\nfor i, task in enumerate(tasks):\n    print(f"{i + 1}. {task}")',
        },
        {
          id: 'task3',
          title: 'Complete Tasks',
          description: 'Mark tasks as complete and remove them.',
          hints: ['Use remove() or pop() to delete items', 'Ask user which task to complete'],
          starterCode: '# Remove completed task\nif len(tasks) > 0:\n    tasks.pop(0)\n    print("Task completed!")',
        },
      ];
    }

    // Generic tasks for any project
    return [
      {
        id: 'task1',
        title: 'Setup and Planning',
        description: `Plan the basic structure of your ${idea}. Define the main variables and data structures you'll need.`,
        hints: ['Think about what data you need to store', 'Create variables for the core elements', 'Use print() to test your setup'],
        starterCode: '# Your project setup\n# Define your main variables here\n\nprint("Project initialized!")',
      },
      {
        id: 'task2',
        title: 'Core Functionality',
        description: 'Implement the main features of your project.',
        hints: ['Break the problem into smaller steps', 'Use functions to organize your code', 'Test each part as you build'],
        starterCode: '# Core functionality\n# Add your main code here\n\n',
      },
      {
        id: 'task3',
        title: 'User Interaction',
        description: 'Add user input and make your project interactive.',
        hints: ['Use input() to get user data', 'Add if/else for different user choices', 'Provide clear prompts'],
        starterCode: '# User interaction\nuser_input = input("Enter your choice: ")\nprint("You entered:", user_input)',
      },
      {
        id: 'task4',
        title: 'Polish and Complete',
        description: 'Add final touches, error handling, and test thoroughly.',
        hints: ['Test with different inputs', 'Add helpful messages', 'Handle edge cases'],
        starterCode: '# Final touches\n# Test your complete project here',
      },
    ];
  };

  const handleContinueAnyway = () => {
    generateProject(projectIdea, 'custom');
  };

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-purple-50 to-orange-50">
      {/* Header */}
      <header className="border-b bg-white px-4 py-3 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#7622e5] to-[#b480f8] flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg">Create Custom Project</h1>
            <p className="text-sm text-gray-600">Let AI design your learning path</p>
          </div>
        </div>
      </header>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full p-4">
        <ScrollArea className="flex-1 pr-4 -mr-4">
          <div className="space-y-6 py-4">
            {messages.map((message, i) => (
              <div
                key={i}
                className={`flex gap-4 ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {message.role === 'assistant' && (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#7622e5] to-[#b480f8] flex items-center justify-center flex-shrink-0">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                )}
                <Card
                  className={`p-4 max-w-[80%] ${
                    message.role === 'user'
                      ? 'bg-gradient-to-r from-[#ffa200] to-[#ff8800] text-white border-0'
                      : 'bg-white'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </Card>
                {message.role === 'user' && (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#ffa200] to-[#ff8800] flex items-center justify-center flex-shrink-0">
                    <UserIcon className="w-5 h-5 text-white" />
                  </div>
                )}
              </div>
            ))}
            {isAnalyzing && (
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#7622e5] to-[#b480f8] flex items-center justify-center">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <Card className="p-4 bg-white">
                  <div className="flex gap-2 items-center">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-[#7622e5] rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-[#7622e5] rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-[#7622e5] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                    <span className="text-sm text-gray-600">Analyzing your project idea...</span>
                  </div>
                </Card>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="pt-4 border-t bg-white/80 backdrop-blur-sm">
          <div className="flex gap-3">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Describe your project idea... (e.g., 'A calculator app' or 'A password generator')"
              disabled={isAnalyzing}
              className="flex-1 min-h-[60px] max-h-[120px]"
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isAnalyzing}
              size="lg"
              className="bg-gradient-to-r from-[#7622e5] to-[#b480f8] hover:from-[#6518d0] hover:to-[#a070e8]"
            >
              <Send className="w-5 h-5" />
            </Button>
          </div>

          {messages.length > 1 && messages[messages.length - 1].role === 'assistant' && 
           messages[messages.length - 1].content.includes('Would you like to') && (
            <div className="flex gap-2 mt-3">
              <Button
                onClick={handleContinueAnyway}
                variant="outline"
                size="sm"
                className="border-[#7622e5] text-[#7622e5] hover:bg-purple-50"
              >
                Continue with my idea
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
