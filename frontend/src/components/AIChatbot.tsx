import { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Send, Bot, User, AlertTriangle, X, Sparkles, Loader2 } from 'lucide-react';
import { BACKEND_URL } from '../utils/constants';
import ReactMarkdown from 'react-markdown';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

type Props = {
  context?: string;
  userProgress?: any;
  taskId?: string;
  userId?: string;
  projectId?: string;
  userCode?: string;
  taskDescription?: string;
  testSpec?: {
    expected_state?: string;
    verification_code?: string;
  };
  onClose?: () => void;
  visible?: boolean;
};

export function AIChatbot({
  context,
  userProgress,
  taskId,
  userId,
  projectId,
  userCode,
  taskDescription,
  testSpec,
  onClose,
  visible = true
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
          user_id: userId,
          project_id: projectId,
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

  // If not visible, return null (handled by parent usually, but good for safety)
  if (!visible) return null;

  return (
    <div className="h-full flex flex-col bg-white border-l border-gray-200 shadow-xl">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-linear-to-r from-blue-50 to-indigo-50 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center border border-blue-200">
            <Sparkles className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-800 text-sm">AI Tutor</h3>
            <p className="text-xs text-gray-500">Always here to help</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/50 rounded-full text-gray-400 hover:text-gray-600 transition-colors"

          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Messages Area */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 bg-gray-50/50" ref={scrollRef}>
        <div className="space-y-4">
          {messages.map((message, i) => (
            <div
              key={i}
              className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              {message.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-blue-600" />
                </div>
              )}
              {message.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-purple-100 border border-purple-200 flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-purple-600" />
                </div>
              )}

              <div
                className={`rounded-2xl px-4 py-3 max-w-[85%] min-w-0 text-sm shadow-sm overflow-hidden ${message.role === 'user'
                    ? 'bg-purple-600 text-white rounded-tr-none'
                    : 'bg-white text-gray-700 border border-gray-100 rounded-tl-none'
                  }`}
              >
                {message.role === 'user' ? (
                  <p className="whitespace-pre-wrap leading-relaxed break-words">{message.content}</p>
                ) : (
                  <div className="prose prose-sm max-w-none overflow-hidden">
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => <p className="mb-3 last:mb-0 leading-relaxed break-words">{children}</p>,
                        ul: ({ children }) => <ul className="list-disc pl-4 mb-3 space-y-1">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal pl-4 mb-3 space-y-1">{children}</ol>,
                        li: ({ children }) => <li className="leading-relaxed break-words">{children}</li>,
                        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                        code: ({ inline, children }: any) =>
                          inline ? (
                            <code className="bg-gray-100 text-pink-600 px-1 py-0.5 rounded text-xs font-mono break-all">
                              {children}
                            </code>
                          ) : (
                            <pre className="bg-gray-900 text-gray-100 p-3 rounded-lg text-xs font-mono whitespace-pre-wrap break-all mb-3 overflow-hidden">
                              <code>{children}</code>
                            </pre>
                          ),
                        h1: ({ children }) => <h1 className="text-lg font-bold mb-2 break-words">{children}</h1>,
                        h2: ({ children }) => <h2 className="text-base font-bold mb-2 break-words">{children}</h2>,
                        h3: ({ children }) => <h3 className="text-sm font-semibold mb-1 break-words">{children}</h3>,
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-blue-600" />
              </div>
              <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                <span className="text-xs text-gray-400">Thinking...</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-orange-600 text-sm px-4 py-2 bg-orange-50 border-t border-orange-100">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-gray-200 shrink-0">
        <div className="relative flex items-center gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask me anything..."
            disabled={isLoading}
            className="pr-10"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            size="icon"
            className="absolute right-1 w-8 h-8 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
