import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Send, Bot, User, AlertTriangle, X, Sparkles, Loader2, RotateCcw } from 'lucide-react';
import { authFetch } from '../utils/authFetch';
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
  getLatestCode?: () => string;
  taskDescription?: string;
  testSpec?: {
    expected_state?: string;
    verification_code?: string;
  };
  onClose?: () => void;
  visible?: boolean;
  prefillMessage?: string | null;
  onPrefillConsumed?: () => void;
};

const DEFAULT_WELCOME_MESSAGE: Message = {
  role: 'assistant',
  content: "Heyyy! I'm Cody, your coding buddy! I'm SO excited to build stuff with you! Whether you're stuck, confused, or just want to chat about your code — I'm right here. Let's goooo! What are you working on?",
};

export function AIChatbot({
  context,
  userProgress,
  taskId,
  userId,
  projectId,
  userCode,
  getLatestCode,
  taskDescription,
  testSpec,
  onClose,
  visible = true,
  prefillMessage,
  onPrefillConsumed,
}: Props) {
  const [messages, setMessages] = useState<Message[]>([DEFAULT_WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prefillProcessedRef = useRef<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const composerFrameRef = useRef<HTMLDivElement>(null);
  const composerWidthRef = useRef<number | null>(null);

  // Load chat history when component mounts or userId/projectId changes
  useEffect(() => {
    const loadChatHistory = async () => {
      if (!userId || !projectId) return;

      setIsLoadingHistory(true);
      try {
        const response = await authFetch(`/assistant/history/${projectId}`);
        const data = await response.json();

        if (data.success && data.messages && data.messages.length > 0) {
          // Map the messages from the database format to our Message type
          const historyMessages: Message[] = data.messages.map((m: any) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          }));
          setMessages(historyMessages);
        } else {
          // No history, use default welcome message
          setMessages([DEFAULT_WELCOME_MESSAGE]);
        }
      } catch (err) {
        console.error('Failed to load chat history:', err);
        // Keep default message on error
        setMessages([DEFAULT_WELCOME_MESSAGE]);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    loadChatHistory();
  }, [userId, projectId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const resizeComposer = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = '0px';

    const styles = window.getComputedStyle(textarea);
    const lineHeight = Number.parseFloat(styles.lineHeight) || 24;
    const paddingTop = Number.parseFloat(styles.paddingTop) || 0;
    const paddingBottom = Number.parseFloat(styles.paddingBottom) || 0;
    const borderTop = Number.parseFloat(styles.borderTopWidth) || 0;
    const borderBottom = Number.parseFloat(styles.borderBottomWidth) || 0;
    const minHeight = lineHeight + paddingTop + paddingBottom + borderTop + borderBottom;
    const maxHeight = lineHeight * 8 + paddingTop + paddingBottom + borderTop + borderBottom;
    const nextHeight = Math.min(textarea.scrollHeight, maxHeight);

    textarea.style.height = `${Math.max(nextHeight, minHeight)}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, []);

  useLayoutEffect(() => {
    resizeComposer();
  }, [input, resizeComposer]);

  useEffect(() => {
    const frame = composerFrameRef.current;
    if (!frame || typeof ResizeObserver === 'undefined') return;

    composerWidthRef.current = frame.getBoundingClientRect().width;

    const observer = new ResizeObserver(([entry]) => {
      const nextWidth = entry.contentRect.width;
      if (nextWidth === composerWidthRef.current) return;

      composerWidthRef.current = nextWidth;
      resizeComposer();
    });

    observer.observe(frame);
    return () => observer.disconnect();
  }, [resizeComposer]);

  const sendMessage = async (message: string) => {
    if (!message.trim() || isLoading) return;

    const userMessage = message.trim();
    setError(null);
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      // Call the backend assistant API
      const response = await authFetch('/assistant/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: userMessage,
          task_id: taskId,
          project_id: projectId,
          code: (getLatestCode ? getLatestCode() : userCode) || '',
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

  const handleSend = () => {
    sendMessage(input);
    setInput('');
  };

  // Handle prefilled messages from "Ask Cody" button
  useEffect(() => {
    if (prefillMessage && !isLoading && prefillMessage !== prefillProcessedRef.current) {
      prefillProcessedRef.current = prefillMessage;
      sendMessage(prefillMessage);
      onPrefillConsumed?.();
    }
  }, [prefillMessage]);

  // If not visible, return null (handled by parent usually, but good for safety)
  if (!visible) return null;

  return (
    <div className="h-full flex flex-col bg-white border-l border-gray-200 shadow-xl">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-linear-to-r from-teal-50 to-cyan-50 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center border border-teal-200">
            <Sparkles className="w-4 h-4 text-teal-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-800 text-sm">Cody</h3>
            <p className="text-xs text-gray-500">Your coding buddy!</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              setMessages([DEFAULT_WELCOME_MESSAGE]);
              setError(null);
              scrollRef.current?.scrollTo({ top: 0 });
              if (projectId) authFetch(`/assistant/history/${projectId}`, { method: 'DELETE' });
            }}
            className="p-1.5 hover:bg-white/50 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
            title="Restart conversation"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/50 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 bg-gray-50/50" ref={scrollRef}>
        <div className="space-y-4">
          {isLoadingHistory ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 text-teal-500 animate-spin" />
            </div>
          ) : messages.map((message, i) => (
            <div key={i} className="flex gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border bg-white border-gray-200">
                {message.role === 'assistant' ? (
                  <Bot className="w-4 h-4 text-teal-600" />
                ) : (
                  <User className="w-4 h-4 text-purple-600" />
                )}
              </div>
              <div
                className={`rounded-2xl px-4 py-3 text-sm shadow-sm min-w-0 ${message.role === 'user'
                    ? 'bg-purple-100 text-purple-900 border border-purple-200'
                    : 'bg-white text-gray-700 border border-gray-100'
                  }`}
              >
                {message.role === 'user' ? (
                  <p className="whitespace-pre-wrap leading-relaxed break-words [overflow-wrap:anywhere]">{message.content}</p>
                ) : (
                  <div className="prose prose-sm max-w-none break-words [overflow-wrap:anywhere]">
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>,
                        ul: ({ children }) => <ul className="list-disc pl-4 mb-3 space-y-1">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal pl-4 mb-3 space-y-1">{children}</ol>,
                        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                        code: ({ className, children }: any) => {
                          const codeText = String(children ?? "");
                          const isInlineCode = !className && !codeText.includes("\n");
                          return isInlineCode ? (
                            <code className="bg-gray-100 text-pink-600 px-1 py-0.5 rounded text-xs font-mono">
                              {children}
                            </code>
                          ) : (
                            <code className="text-xs font-mono">{children}</code>
                          );
                        },
                        pre: ({ children }) => (
                          <pre className="bg-teal-50 text-teal-900 border border-teal-100 p-3 rounded-lg text-xs font-mono whitespace-pre-wrap mb-3 overflow-x-auto">
                            {children}
                          </pre>
                        ),
                        h1: ({ children }) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
                        h2: ({ children }) => <h2 className="text-base font-bold mb-2">{children}</h2>,
                        h3: ({ children }) => <h3 className="text-sm font-semibold mb-1">{children}</h3>,
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
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-teal-600" />
              </div>
              <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-teal-500 animate-spin" />
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
        <div
          ref={composerFrameRef}
          className="rounded-2xl border border-gray-200 bg-gray-50/80 px-3 py-3 shadow-sm transition-all focus-within:border-teal-300 focus-within:bg-white focus-within:ring-4 focus-within:ring-teal-100/80"
        >
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask me anything..."
            disabled={isLoading}
            className="w-full resize-none border-0 bg-transparent px-0 py-0 text-sm leading-6 text-gray-800 placeholder:text-gray-400 shadow-none outline-none focus-visible:ring-0 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-60 break-words [overflow-wrap:anywhere]"
            rows={1}
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-[11px] leading-4 text-gray-400">
              Enter sends
            </p>
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              aria-label="Send message"
              className="ml-auto h-10 rounded-xl bg-teal-600 px-3 text-white hover:bg-teal-700"
            >
              <Send className="w-4 h-4" />
              <span>Send</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
