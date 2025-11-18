import { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from './ui/sheet';
import { MessageCircle, Send, Bot, User } from 'lucide-react';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

type Props = {
  context?: string;
  userProgress?: any;
};

export function AIChatbot({ context, userProgress }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hi! I'm your coding assistant. I can help you understand concepts, debug code, or provide hints. What would you like to know?",
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    // Simulate AI response (in production, this would call an AI API)
    setTimeout(() => {
      const response = generateResponse(userMessage, context);
      setMessages((prev) => [...prev, { role: 'assistant', content: response }]);
      setIsLoading(false);
    }, 1000);
  };

  const generateResponse = (question: string, context?: string): string => {
    const lowerQuestion = question.toLowerCase();

    // Basic responses based on common questions
    if (lowerQuestion.includes('variable')) {
      return "Variables are like containers that store data. In Python, you create them by assigning a value: `name = 'John'` or `age = 25`. The variable name goes on the left, and the value on the right. You can then use the variable name to access that value later!";
    }

    if (lowerQuestion.includes('print')) {
      return "The `print()` function displays output to the console. You can print text in quotes like `print('Hello')` or print variables like `print(age)`. You can also combine them: `print('My name is', name)`. Try it out!";
    }

    if (lowerQuestion.includes('loop') || lowerQuestion.includes('for')) {
      return "Loops let you repeat code multiple times. A `for` loop iterates over a sequence:\n```python\nfor i in range(5):\n    print(i)\n```\nThis prints numbers 0 to 4. The `range(5)` creates a sequence of 5 numbers starting from 0.";
    }

    if (lowerQuestion.includes('if') || lowerQuestion.includes('condition')) {
      return "An `if` statement lets you execute code only when a condition is true:\n```python\nif age > 18:\n    print('Adult')\nelse:\n    print('Minor')\n```\nThe code checks if age is greater than 18 and runs different code based on the result.";
    }

    if (lowerQuestion.includes('list')) {
      return "Lists store multiple items in a single variable. Create them with square brackets: `fruits = ['apple', 'banana', 'orange']`. Access items by index: `fruits[0]` gives 'apple'. You can add items with `append()`: `fruits.append('grape')`.";
    }

    if (lowerQuestion.includes('error') || lowerQuestion.includes('bug')) {
      return "Debugging tip: Read error messages carefully - they tell you what went wrong and often where. Common issues include:\n- Typos in variable names\n- Forgetting colons after if/for statements\n- Indentation errors (Python uses spaces/tabs to organize code)\n- Using quotes inconsistently\n\nWhat specific error are you seeing?";
    }

    if (lowerQuestion.includes('help') || lowerQuestion.includes('stuck')) {
      return "I'm here to help! Try these strategies:\n1. Break the problem into smaller steps\n2. Print variables to see their values\n3. Check your syntax (colons, parentheses, quotes)\n4. Test small pieces of code separately\n\nTell me more about what you're working on and I can give specific guidance!";
    }

    // Default response
    return "That's a great question! " + (context ? `Based on your current lesson, ` : '') + "I can help you understand this better. Could you provide more details about what you're trying to do or what's confusing you?";
  };

  return (
    <Sheet>
      <SheetTrigger className="fixed bottom-6 right-6 rounded-full w-14 h-14 shadow-lg bg-gradient-to-r from-[#7622e5] to-[#b480f8] hover:from-[#6518d0] hover:to-[#a070e8] inline-flex items-center justify-center text-white transition-colors">
        <MessageCircle className="w-6 h-6" />
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-[#7622e5]" />
            AI Coding Assistant
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 pr-4 -mr-4" ref={scrollRef}>
          <div className="space-y-4 py-4">
            {messages.map((message, i) => (
              <div
                key={i}
                className={`flex gap-3 ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {message.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7622e5] to-[#b480f8] flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                )}
                <div
                  className={`rounded-2xl px-4 py-2 max-w-[80%] ${
                    message.role === 'user'
                      ? 'bg-gradient-to-r from-[#7622e5] to-[#b480f8] text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                </div>
                {message.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#ffa200] to-[#ff8800] flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7622e5] to-[#b480f8] flex items-center justify-center">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="bg-gray-100 rounded-2xl px-4 py-2">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="flex gap-2 pt-4 border-t">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask me anything..."
            disabled={isLoading}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            size="icon"
            className="bg-gradient-to-r from-[#7622e5] to-[#b480f8] hover:from-[#6518d0] hover:to-[#a070e8]"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
