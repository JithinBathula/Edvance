import { useEffect, useState, useRef } from 'react';
import { User } from '../App';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Textarea } from './ui/textarea';
import { ArrowLeft, Send, Bot, User as UserIcon, Sparkles, CheckCircle2 } from 'lucide-react';
import { useChat } from '@ai-sdk/react';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';

type Props = {
  user: User;
  onProjectCreated: (requirementsData: any) => void;
  onBack: () => void;
};

export function CustomProjectChat({ user, onProjectCreated, onBack }: Props) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, append, isLoading } = useChat({
    api: `https://${projectId}.supabase.co/functions/v1/server/user/${user.name}/chat`,
    headers: { 'Authorization': `Bearer ${publicAnonKey}` },
    body: {
      userSkills: {
        userExperienceLevel: user.onboarding?.experienceLevel || 'beginner',
        pythonExperience: user.onboarding?.pythonExperience || 'Just starting out',
        theme: user.onboarding?.theme || 'general'
      }
    },
    initialMessages: [
      {
        id: 'welcome',
        role: 'assistant',
        content: `Hi ${user.name}! 👋 I'm here to help you create a custom project. Tell me what you'd like to build, and I'll design a learning path tailored to your skill level (${user.onboarding?.experienceLevel || 'beginner'}).\n\nWhat project idea do you have in mind?`,
      },
    ],
    onError: (error: Error) => {
      console.error("Chat Error:", error);
      toast.error("Connection failed. Please try again.");
    }
  } as any) as any;

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const userMessage = input.trim();
    setInput(''); 
    try {
      await append({ role: 'user', content: userMessage });
    } catch (e) { 
      console.error(e); 
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Hand-off Logic
  useEffect(() => {
    if (isLoading) return;
    const lastMessage = messages[messages.length - 1];
    
    if (lastMessage?.role === 'assistant' && lastMessage.toolInvocations) {
      const qualityCheck = lastMessage.toolInvocations.find(
        (t: any) => t.toolName === 'qualityCheckTool' && t.result?.action === 'proceed'
      );

      if (qualityCheck) {
        const techInfo = messages
          .flatMap((m: any) => m.toolInvocations || [])
          .find((t: any) => t.toolName === 'webSearchForDependencies')?.result;

        const userIdeaMessage = messages.find((m: any) => m.role === 'user');

        setTimeout(() => {
          onProjectCreated({
            title: "Custom Project", 
            idea: userIdeaMessage ? userIdeaMessage.content : "Python Project",
            techStack: techInfo?.libraries, 
            complexity: qualityCheck.result, 
            userContext: { name: user.name }
          }); 
        }, 2000);
      }
    }
  }, [messages, isLoading, onProjectCreated, user]);

  const isThinking = isLoading && messages[messages.length - 1]?.role === 'user';

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
            {messages.map((message: any, i: number) => (
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
                
                <div className={`flex flex-col gap-2 max-w-[80%] ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
                  {/* Message Card */}
                  {message.content && (
                    <Card
                      className={`p-4 ${
                        message.role === 'user'
                          ? 'bg-gradient-to-r from-[#ffa200] to-[#ff8800] text-white border-0'
                          : 'bg-white'
                      }`}
                    >
                      {message.role === 'assistant' ? (
                        <div className="text-gray-800 text-sm leading-relaxed">
                          <ReactMarkdown
                            components={{
                              p: ({children}) => <p className="mb-3 last:mb-0">{children}</p>,
                              ul: ({children}) => <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>,
                              ol: ({children}) => <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>,
                              li: ({children}) => <li className="mb-1">{children}</li>,
                              strong: ({children}) => <span className="font-bold">{children}</span>,
                            }}
                          >
                            {message.content}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      )}
                    </Card>
                  )}

                  {/* Tool Chips */}
                  {message.toolInvocations?.map((t: any) => {
                    if (t.state === 'result') {
                      return (
                        <div key={t.toolCallId} className="mt-1 flex items-center gap-2 text-xs text-green-600 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>
                            {t.toolName === 'webSearchForDependencies' ? 'Tech Stack Analyzed' : 
                             t.toolName === 'qualityCheckTool' ? 'Skill Match Verified' : 'Analysis Complete'}
                          </span>
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>

                {message.role === 'user' && (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#ffa200] to-[#ff8800] flex items-center justify-center flex-shrink-0">
                    <UserIcon className="w-5 h-5 text-white" />
                  </div>
                )}
              </div>
            ))}

            {/* Loading State */}
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
                    <span className="text-sm text-gray-600">Analyzing your project idea...</span>
                  </div>
                </Card>
              </div>
            )}
            
            {/* Scroll anchor */}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>
        <div className="border-t bg-white/95 backdrop-blur-sm p-4 flex-shrink-0">
          <div className="flex gap-3 items-end max-w-4xl mx-auto">
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
          </div>
        </div>
      </div>
  );
}