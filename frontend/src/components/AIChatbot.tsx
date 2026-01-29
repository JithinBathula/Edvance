import { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from './ui/sheet';
import { MessageCircle, Send, Bot, User, AlertTriangle, PanelRightClose } from 'lucide-react';
import { BACKEND_URL } from '../utils/constants';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

// We add 'onClose' and 'visible' props to control it from the parent
type Props = {
  context?: string;
  userProgress?: any;
  taskId?: string;
  userCode?: string;
  onClose: () => void; // New prop to close the panel
  visible: boolean;     // New prop to check if we should render
};

export function AIChatbot({
  context,
  userProgress,
  taskId,
  userCode,
  onClose,
  visible
}: Props) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hi! I'm your coding assistant. I can help you understand concepts, debug code, or provide hints. What would you like to know?",
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    setError(null);
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      // Call the backend assistant API
      const response = await fetch(`${BACKEND_URL}/assistant/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message: userMessage,
          task_id: taskId,
          code: userCode || '',
          history: messages.slice(-10).map(m => ({
            role: m.role,
            content: m.content
          })),
        }),
      });

      const data = await response.json();

      if (data.success && data.response) {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.response }]);
      } else {
        // Fallback to a helpful message if API fails
        setError('Failed to get response. Please try again.');
        setMessages((prev) => [...prev, {
          role: 'assistant',
          content: "I'm having trouble connecting right now. Could you try asking again?"
        }]);
      }
    } catch (err) {
      console.error('Assistant chat error:', err);
      setError('Connection error. Please try again.');
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: "I couldn't connect to the server. Please check your connection and try again."
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!visible) return null;
  return (
    <div className="w-full h-full bg-white flex flex-col border-l border-gray-200">
      {/* Header */}
      <div className="p-3 border-b border-gray-100 flex items-center justify-between bg-white">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
          <span className="font-medium text-sm text-gray-700">AI assistant</span>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-50 transition-colors"
          title="Collapse Chat"
        >
          <PanelRightClose size={16} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50" ref={scrollRef}>
        {messages.map((message, i) => (
          <div key={i} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[90%] rounded-2xl p-3 text-sm shadow-sm leading-relaxed ${message.role === 'user'
                ? 'bg-blue-600 text-white rounded-tr-none'
                : 'bg-white border border-gray-200 text-gray-600 rounded-tl-none'
              }`}>
              {message.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-none p-3 shadow-sm">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce delay-75"></div>
                <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce delay-150"></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-3 bg-white border-t border-gray-100">
        <div className="relative">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Chat here..."
            className="w-full pl-4 pr-10 py-2 bg-gray-50 border-gray-200 rounded-full text-sm focus:bg-white"
            disabled={isLoading}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            size="icon"
            className="absolute right-1 top-1 h-8 w-8 bg-blue-600 hover:bg-blue-700 rounded-full"
          >
            <Send className="w-4 h-4 text-white" />
          </Button>
        </div>
      </div>
    </div>
  );
}