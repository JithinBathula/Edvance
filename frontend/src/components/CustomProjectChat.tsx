import { useEffect, useState, useRef, useCallback } from 'react';
import { User } from '../App';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Textarea } from './ui/textarea';
import { ArrowLeft, Send, Bot, User as UserIcon, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import React from "react";
// Import the backend URL constant
import { BACKEND_URL } from '../utils/constants';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
}

type Props = {
  user: User;
  onProjectCreated: (requirementsData: any) => void;
  onBack: () => void;
};

const getSessionId = (user: User) => user.id || 'default';

export function CustomProjectChat({ user, onProjectCreated, onBack }: Props) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isReadyToProceed, setIsReadyToProceed] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. Initialize Welcome Message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content: `Hi ${user.name}! 👋 I'm here to help you create a custom project. Tell me what you'd like to build, and I'll design a learning path tailored to your skill level (${user.onboarding?.experienceLevel || 'beginner'}).\n\nWhat project idea do you have in mind?`,
        },
      ]);
    }
  }, [user.name, user.onboarding?.experienceLevel, messages.length]);

  // 2. Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // 3. Auto-proceed when handoff is detected
  useEffect(() => {
    if (isReadyToProceed) {
      // Small delay for UX - let user see the final message
      const timer = setTimeout(() => {

        const proceed = async () => {
          // Fetch the session data from the backend
          try {
            const session_id = getSessionId(user);
            const reqRes = await fetch(`${BACKEND_URL}/chat/requirements/${session_id}`)
            const reqJson = await reqRes.json();

            if (!reqRes.ok || reqJson.status !== 'success') {
              throw new Error(`HTTP error! status: ${reqRes.status}`);
            }

            const sessionData = reqJson.requirements.session_data;

            const outlineRes = await fetch(`${BACKEND_URL}/planning/outline`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                session: sessionData,
                experience_level: user.onboarding?.experienceLevel || 'beginner',
              }),
            });

            if (!outlineRes.ok) {
              throw new Error(`HTTP error! status: ${outlineRes.status}`);
            }

            const outlineJson = await outlineRes.json();

            toast.success("Project plan created successfully!");

            onProjectCreated({
              session: sessionData,
              outline: outlineJson,
              experienceLevel: user.onboarding?.experienceLevel || 'beginner',
            });

          } catch (error) {
            console.error("Error during project creation:", error);
            toast.error("Failed to create project plan. Please try again.");
            setIsReadyToProceed(false);
          }
        };

        proceed();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isReadyToProceed, messages, onProjectCreated, user]);


  // 4. Handle Sending Messages
  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return;
    const userMessage = input.trim();
    setInput('');
    setIsLoading(true);

    const sessionId = getSessionId(user);

    const newUserMessage: ChatMessage = {
      id: Date.now().toString() + '-user',
      role: 'user',
      content: userMessage,
    };

    const history = messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role, content: m.content }));

    // Add user message
    setMessages(prev => [...prev, newUserMessage]);

    // Add placeholder assistant message immediately
    const assistantId = Date.now().toString() + '-assistant';
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '' }]);

    let fullContent = "";

    try {
      const response = await fetch(`${BACKEND_URL}/chat/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          history: history,
          session_id: sessionId,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let streamFinished = false;

      while (!streamFinished) {
        const { value, done } = await reader.read();
        if (done) {
          streamFinished = true;
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const dataString = line.substring(6);
              const data = JSON.parse(dataString);

              setMessages(prev => {
                const newMessages = [...prev];
                const lastIndex = newMessages.length - 1;
                // Create a shallow copy to prevent Strict Mode double-render duplication
                const lastMessage = { ...newMessages[lastIndex] };

                if (lastMessage.id === assistantId) {
                  if (data.content) {
                    lastMessage.content += data.content;
                    fullContent += data.content;

                    // Check for completion signal - multiple variations
                    const lowerContent = fullContent.toLowerCase();
                    const handoffPhrases = [
                      'hand you over to the planning',
                    ];

                    if (!isReadyToProceed && handoffPhrases.some(phrase => lowerContent.includes(phrase))) {
                      console.log('🎯 Handoff phrase detected! Content:', fullContent.slice(-100));
                      setIsReadyToProceed(true);
                    }
                  }

                  if (data.done) {
                    streamFinished = true;
                  }

                  // Update array with the modified copy
                  newMessages[lastIndex] = lastMessage;
                }
                return newMessages;
              });
            } catch (e) {
              console.error("Failed to parse JSON chunk:", e, line);
            }
          }
        }
      }


    } catch (error) {
      console.error("Chat streaming error:", error);
      toast.error("Connection failed. Please ensure the Flask backend is running on port 8001.");
      setMessages(prev => {
        const newMessages = [...prev];
        const lastIndex = newMessages.length - 1;
        const lastMessage = { ...newMessages[lastIndex] };

        if (lastMessage.id === assistantId) {
          lastMessage.content = (lastMessage.content || "") + "\n\n**Error:** I encountered a backend error. Please try again.";
          newMessages[lastIndex] = lastMessage;
        }
        return newMessages;
      });
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages, user]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Logic updated for loading state
  const isThinking = isLoading &&
    messages.length > 0 &&
    messages[messages.length - 1].role === 'assistant' &&
    messages[messages.length - 1].content === '';

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-purple-50 to-orange-50">

      {/* Header */}
      <header className="border-b bg-white px-4 py-3 flex items-center gap-4 flex-shrink-0">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#7622e5] to-[#b480f8] flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Create Custom Project</h1>
            <p className="text-sm text-gray-600">Let AI design your learning path</p>
          </div>
        </div>
      </header>

      {/* Chat Area - Full width scroll */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4">
          <div className="space-y-6 py-4 pb-32">
            {messages.map((message, i) => {
              // Don't render assistant messages that are empty (loading state handles them)
              if (message.role === 'assistant' && !message.content) return null;

              return (
                <div
                  key={i}
                  className={`flex gap-4 ${message.role === 'user' ? 'justify-end' : 'justify-start'
                    } ${message.role === 'tool' ? 'hidden' : ''}`}
                >
                  {message.role === 'assistant' && (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#7622e5] to-[#b480f8] flex items-center justify-center flex-shrink-0">
                      <Bot className="w-5 h-5 text-white" />
                    </div>
                  )}

                  <div className={`flex flex-col gap-2 max-w-[80%] ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
                    {/* Message Card */}
                    {message.content && (
                      <Card
                        className={`p-4 ${message.role === 'user'
                          ? 'bg-gradient-to-r from-[#ffa200] to-[#ff8800] text-white border-0'
                          : 'bg-white'
                          }`}
                      >
                        <div className={`${message.role === 'assistant' ? "text-gray-800 prose prose-sm max-w-none" : ""}`}>
                          <ReactMarkdown
                            components={{
                              // Paragraphs with proper spacing
                              p: ({ children }) => <p className="mb-4 last:mb-0 leading-relaxed">{children}</p>,

                              // Unordered lists with bullets
                              ul: ({ children }) => (
                                <ul className="list-disc pl-6 mb-4 space-y-2 marker:text-gray-600">
                                  {children}
                                </ul>
                              ),

                              // Ordered lists with numbers
                              ol: ({ children }) => (
                                <ol className="list-decimal pl-6 mb-4 space-y-2 marker:text-gray-600">
                                  {children}
                                </ol>
                              ),

                              // List items
                              li: ({ children }) => <li className="leading-relaxed">{children}</li>,

                              // Bold text
                              strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,

                              // Italic text
                              em: ({ children }) => <em className="italic">{children}</em>,

                              // Code blocks
                              code: ({ inline, children }: any) =>
                                inline ? (
                                  <code className="bg-gray-100 text-pink-600 px-1.5 py-0.5 rounded text-sm font-mono">
                                    {children}
                                  </code>
                                ) : (
                                  <code className="block bg-gray-100 p-3 rounded text-sm font-mono overflow-x-auto mb-4">
                                    {children}
                                  </code>
                                ),

                              // Headings
                              h1: ({ children }) => <h1 className="text-2xl font-bold mb-3 mt-4">{children}</h1>,
                              h2: ({ children }) => <h2 className="text-xl font-bold mb-3 mt-4">{children}</h2>,
                              h3: ({ children }) => <h3 className="text-lg font-semibold mb-2 mt-3">{children}</h3>,

                              // Blockquotes
                              blockquote: ({ children }) => (
                                <blockquote className="border-l-4 border-purple-500 pl-4 italic my-4 text-gray-700">
                                  {children}
                                </blockquote>
                              ),
                            }}
                          >
                            {message.content}
                          </ReactMarkdown>
                        </div>
                      </Card>
                    )}
                  </div>

                  {message.role === 'user' && (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#ffa200] to-[#ff8800] flex items-center justify-center flex-shrink-0">
                      <UserIcon className="w-5 h-5 text-white" />
                    </div>
                  )}
                </div>
              );
            })}

            {/* Loading State Animation */}
            {isThinking && (
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#7622e5] to-[#b480f8] flex items-center justify-center flex-shrink-0">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <Card className="p-4 bg-white">
                  <div className="flex gap-2 items-center">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-[#7622e5] rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-[#7622e5] rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-[#7622e5] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                    <span className="text-sm text-gray-600"></span>
                  </div>
                </Card>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      <div className="border-t bg-white/95 backdrop-blur-sm p-4 flex-shrink-0">
        <div className="flex gap-3 items-end max-w-4xl mx-auto">
          {/* Render Textarea OR Proceed Button */}
          {!isReadyToProceed ? (
            <>
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe your project idea... (e.g., 'A calculator app' or 'A password generator')"
                disabled={isLoading}
                className="flex-1 min-h-[60px] max-h-[120px] resize-none"
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                size="lg"
                className="bg-gradient-to-r from-[#7622e5] to-[#b480f8] hover:from-[#6518d0] hover:to-[#a070e8] h-[60px] px-6"
              >
                <Send className="w-5 h-5" />
              </Button>
            </>
          ) : (
            <div className="w-full flex flex-col items-center gap-2 p-4">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 border-2 border-[#7622e5] border-t-transparent rounded-full animate-spin" />
                <p className="text-gray-600">Preparing your project plan...</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
