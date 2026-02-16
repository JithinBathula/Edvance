import React, { useEffect, useState, useRef, useCallback } from 'react';
import { User } from '../App';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Textarea } from './ui/textarea';
import { ArrowLeft, Send, Bot, User as UserIcon, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BACKEND_URL } from '../utils/constants';
import { GUIDING_QUESTIONS } from '../utils/guidingQuestions';
import { authFetch } from '../utils/authFetch';
import { cn } from './ui/utils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
}

type Props = {
  user: User;
  onProjectCreated: (requirementsData: any) => void;
  onBack: () => void;
  embedded?: boolean;
};

// Helper function to generate technical prompt
const generateSystemPrompt = (answers: Record<string, string | string[]>) => {
  console.log("[System] Generating prompt to pass to LLM from user answers:", answers);
  const { startPath, description, timeline } = answers;

  const pathLabel = startPath === 'have_idea'
    ? 'Student has a project idea'
    : startPath === 'learn_concept'
    ? 'Student wants to learn a Python concept through a project'
    : 'Student wants a surprise project suggestion based on their level';

  const descriptionLine = description
    ? `- **Description:** ${description}`
    : '- **Description:** (none provided — suggest something suitable)';

  const prompt = `
    ${pathLabel}

    **Student Choices:**
    ${descriptionLine}
    - **Timeline:** ${timeline}
    `;

    console.log("[System] Generated system prompt:", prompt);
    return prompt;
};

// Helper function to handle stream
async function streamChatResponse(
  payload: any,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (err: string) => void
) {
  try {
    const response = await authFetch('/chat/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
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

            onChunk(data);

            if (data.done) {
              streamFinished = true;
            }
          } catch (e) {
            console.error("Failed to parse JSON chunk:", e, line);
          }
        }
      }
    }

    onDone();
  } catch (error) {
    console.error("Chat streaming error:", error);
    onError("Connection failed. Please ensure the backend is running.");
  }
}

export function CustomProjectChat({ user, onProjectCreated, onBack, embedded }: Props) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessingHandoff, setIsProcessingHandoff] = useState(false);
  const [isInitializingAI, setIsInitializingAI] = useState(false);

  const hasInitializedChat = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [currentStep, setCurrentStep] = useState(0);
  const [guidingAnswers, setGuidingAnswers] = useState<Record<string, string | string[]>>({});

  const [chatSessionId, setChatSessionId] = useState(crypto.randomUUID());
  const [isRestartOpen, setIsRestartOpen] = useState(false); 


  // 1. Initialization 
  useEffect(() => {
    if (hasInitializedChat.current === chatSessionId) return;
    hasInitializedChat.current = chatSessionId;

    console.log("Chat Initialized for session:", chatSessionId);
                    
    if (messages.length === 0) {
      // Map pythonLevel to friendly display text
      const levelLabels: Record<string, string> = {
        'level-1': 'Level 1 (Basics)',
        'level-2': 'Level 2 (Conditions)',
        'level-3': 'Level 3 (Loops)',
        'level-4': 'Level 4 (Functions & Data)',
        'level-5': 'Level 5 (Advanced)',
      };
      const skillLevel = levelLabels[user.onboarding?.pythonLevel || ''] || 'beginner';
    
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: `Hi ${user.name}! 👋 I'm here to help you create a custom project tailored to your **${skillLevel}** skill level. Let's start with a few questions to scope your project first!`,
      },
      {
        id: 'q1',
        role: 'assistant',
        content: GUIDING_QUESTIONS[0].text,
      },
    ]);
  }
} 
,[user.name, user.onboarding?.pythonLevel, messages.length, chatSessionId]);
  

  // 2. Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, currentStep]);

  // 3. Handle chat (main loop)
  const handleSendMessage = useCallback(async (systemPrompt?: string, options: {skipUserBubble?: boolean} = {}) => {
    const textToBackend = typeof systemPrompt === 'string' ? systemPrompt : input.trim();

    if (!textToBackend || isLoading) return;

    setInput('');
    setIsLoading(true);
    
    console.group("[Chat] handleSendMessage Triggered");
    console.log("Current Guiding Answers State:", guidingAnswers);
    console.log("Sending to Backend:", textToBackend);
  
    if (!options.skipUserBubble) {
      const newUserMessage: ChatMessage = {
        id: Date.now().toString() + '-user',
        role: 'user',
        content: textToBackend, 
      };
      setMessages(prev => [...prev, newUserMessage]);
    }

    const assistantId = Date.now().toString() + '-assistant';
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '' }]);

    const history = messages.map(m => ({ role: m.role, content: m.content }));
    
    await streamChatResponse(
      {
        message: textToBackend,
        history: history,
        session_id: chatSessionId,
        user_profile: {
          educationLevel: user.onboarding?.educationLevel || 'primary',
          schoolExperience: user.onboarding?.schoolExperience || 'beginner',
          pythonLevel: user.onboarding?.pythonLevel || 'level-1',
          biggestChallenges: user.onboarding?.biggestChallenges || 'planning',
          learningMode: user.onboarding?.learningMode || 'guided',
        },
        guiding_complete: !!options.skipUserBubble,      
      },
      (data: any) => { 
      
      // 1. Handle Text Content - cleaning data from streaming
      if (data.content) {
        setMessages(prev => prev.map(msg => {
          if (msg.id === assistantId) {
            let updatedContent = (msg.content || '') + data.content;

            // Convert literal escaped strings to real characters
            let clean = updatedContent
              .replace(/\\n/g, '\n') 
              .replace(/\\"/g, '"')
              .replace(/\\t/g, '  ');

            // Markdown List 
            // Ensure there is a newline before any bullet point or numbered list 
            // if it follows text, otherwise it won't trigger the list parser.
            clean = clean.replace(/([^\n])\n(\s*[\*\-\d+\.])/g, '$1\n\n$2');

            // Strip wrapping quotes if the whole message is wrapped
            if (clean.startsWith('"') && clean.endsWith('"')) {
              clean = clean.slice(1, -1);
            }

            return { ...msg, content: clean };
          }
          return msg;
        }));
      }

      // 2. Handle Backend-Driven Handoff Trigger
      if (data.handoff && data.session_data) {
        console.log("[Handoff] Backend signaled ready. Data received:", data.session_data);
        triggerHandoff(data.session_data);
      }
    },
      () => {
        console.log("[Chat] Stream Finished");
        setIsLoading(false);
        setIsInitializingAI(false);
      },
      (err) => {
        console.error("[Chat] Stream Error:", err);
        setIsLoading(false);
        setIsInitializingAI(false);
        toast.error("Connection error");
      }
    );
    console.groupEnd();
  }, [isLoading, messages, user, guidingAnswers, chatSessionId]);

  // 4. Helper to proceed to next step
  const proceedToNextStep = (answers: Record<string, string | string[]>, userVisual: string) => {
    let nextStep = currentStep + 1;

    // Skip the "description" question (index 1) if user chose "surprise"
    if (nextStep === 1 && answers['startPath'] === 'surprise') {
      nextStep = 2; // jump to timeline
    }

    setCurrentStep(nextStep);

    // update chat UI: add user answer
    setMessages(prev => [...prev, { id: `ans-${currentStep}`, role: 'user', content: userVisual }]);

    // add next guiding question or proceed to chat llm
    if (nextStep < GUIDING_QUESTIONS.length) {
      setTimeout(() => {
        setMessages(prev => [...prev, {
          id: `q-${nextStep}`,
          role: 'assistant',
          content: GUIDING_QUESTIONS[nextStep].text
        }]);
      }, 500);
    } else {
      console.log("[Guiding] Phase Complete! Initiating Chat LLM...");
      const systemPrompt = generateSystemPrompt(answers);
      handleSendMessage(systemPrompt, { skipUserBubble: true });
    }
  };

  // 5. Handle Guiding Phase Selections (all single-select or text input)
  const handleGuidingStep = (value: string, label?: string) => {
    const currentQ = GUIDING_QUESTIONS[currentStep];

    console.group(`[Guiding] Step ${currentStep + 1}: ${currentQ.key}`);

    const newAnswers = { ...guidingAnswers, [currentQ.key]: value };
    setGuidingAnswers(newAnswers);
    setInput('');

    proceedToNextStep(newAnswers, label || value);
    console.groupEnd();
  };

  // 7. Handoff to Planning Phase
  const triggerHandoff = async (backendSessionData: any) => {
    console.log("[Handoff] Triggering project planning handoff...");
    if (isProcessingHandoff) return;
    setIsProcessingHandoff(true);

    setTimeout(async () => {
      try {
        const reqRes = await authFetch(`/chat/requirements/${chatSessionId}`);
        const reqJson = await reqRes.json();
        if (!reqRes.ok || reqJson.status !== 'success') throw new Error("Failed to get requirements");

        const sessionData = reqJson.requirements.session_data;
        const userProfile = {
              educationLevel: user.onboarding?.educationLevel || 'primary',
              schoolExperience: user.onboarding?.schoolExperience || 'none',
              pythonLevel: user.onboarding?.pythonLevel || 'level-1',
              biggestChallenges: user.onboarding?.biggestChallenges || [],
              learningMode: user.onboarding?.learningMode || 'guided',
        };

        const outlineRes = await fetch(`${BACKEND_URL}/planning/outline`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              session: backendSessionData,
              user_profile: userProfile,
            }),
        });

        const outlineJson = await outlineRes.json();

        toast.success("Plan Created!");
        onProjectCreated({
            session: backendSessionData,
            outline: outlineJson,
            userProfile,
        });

      } catch (e) {
        console.error(e);
        toast.error("Failed to generate plan");
        setIsProcessingHandoff(false);
      }
    }, 2000);
  };

  const handleRestart = useCallback(() => {
  try {
    setMessages([]);
    setCurrentStep(0);
    setGuidingAnswers({});
    setInput('');

    const newId = crypto.randomUUID();
    setChatSessionId(newId);
    console.log("[Chat] Restarted session. New session ID:", newId);

    hasInitializedChat.current = null; 
      
    toast.success("Session reset!");
    setIsRestartOpen(false);
    console.log("[Chat] Restart confirmed by user.");
  } catch (err) {
    console.error("Failed to reset session:", err);
    setIsRestartOpen(false);
  }
}, [setChatSessionId, setMessages, setCurrentStep, setGuidingAnswers, setInput, setIsRestartOpen]);

  // --- Render ---
  const isGuidingPhase = currentStep < GUIDING_QUESTIONS.length;
  const currentQuestion = GUIDING_QUESTIONS[currentStep];
  const isInputDisabled = isLoading || isInitializingAI || isProcessingHandoff || (isGuidingPhase && !currentQuestion.inputType);

  // ... inside your component
const textareaRef = useRef<HTMLTextAreaElement>(null);

// This effect adjusts the height of the textarea based on content
useEffect(() => {
  const textarea = textareaRef.current;
  if (textarea) {
    textarea.style.height = "auto"; // Reset height to recalculate
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`; // Set to scrollHeight up to max
  }
}, [input]); // Runs every time 'input' changes

  const chatContent = (
    <>
      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-3xl mx-auto space-y-5 w-full pb-20">
          {messages.map((msg) => {
            if (msg.role === 'assistant' && !msg.content) return null;

            return (
              <div key={msg.id} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center shrink-0 shadow-sm">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                )}
                
                <Card className={`p-4 max-w-[85%] rounded-2xl ${msg.role === 'user' ? 'bg-teal-600 text-white border-0 shadow-sm' : 'bg-white/90 border-slate-100 shadow-sm'}`}>
  
                  <div className={cn(
                    "prose prose-sm max-w-none break-words",
                    msg.role === 'user' 
                      ? "prose-invert" 
                      : "prose-gray"
                  )}>
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        // Paragraphs with spacing
                        p: ({ children }) => (
                          <p className="mb-4 last:mb-0 leading-relaxed whitespace-pre-wrap">
                            {children}
                          </p>
                        ),

                        // Unordered lists 
                        ul: ({ children }) => (
                          <ul className="list-disc list-outside ml-6 mb-4 space-y-1.5">
                            {children}
                          </ul>
                        ),

                        // Ordered lists 
                        ol: ({ children }) => (
                          <ol className="list-decimal list-outside ml-6 mb-4 space-y-1.5">
                            {children}
                          </ol>
                        ),

                        // List items
                        li: ({ children }) => (
                          <li className="leading-relaxed">{children}</li>
                        ),

                        // Bold text
                        strong: ({ children }) => (
                          <strong className="font-semibold">{children}</strong>
                        ),

                        // Italic text
                        em: ({ children }) => (
                          <em className="italic">{children}</em>
                        ),

                        // Inline code
                        code: ({ inline, children, ...props }: any) =>
                          inline ? (
                            <code 
                              className="bg-gray-100 text-pink-600 px-1.5 py-0.5 rounded text-sm font-mono"
                              {...props}
                            >
                              {children}
                            </code>
                          ) : (
                            <code 
                              className="block bg-gray-900 text-gray-100 p-3 rounded text-sm font-mono overflow-x-auto mb-4"
                              {...props}
                            >
                              {children}
                            </code>
                          ),

                        // Headings
                        h1: ({ children }) => (
                          <h1 className="text-2xl font-bold mb-3 mt-6 first:mt-0">
                            {children}
                          </h1>
                        ),
                        h2: ({ children }) => (
                          <h2 className="text-xl font-bold mb-3 mt-5 first:mt-0">
                            {children}
                          </h2>
                        ),
                        h3: ({ children }) => (
                          <h3 className="text-lg font-semibold mb-2 mt-4 first:mt-0">
                            {children}
                          </h3>
                        ),

                        // Blockquotes
                        blockquote: ({ children }) => (
                          <blockquote className="border-l-4 border-teal-500 pl-4 italic my-4">
                            {children}
                          </blockquote>
                        ),

                        // Line breaks
                        br: () => <br className="my-2" />,
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                </Card>

                {msg.role === 'user' && (
                  <div className="w-10 h-10 rounded-full bg-teal-600 flex items-center justify-center flex-shrink-0">
                    <UserIcon className="w-5 h-5 text-white" />
                  </div>
                )}
              </div>
            )
          })}

          {/* Loading Indicator */}
          {(isLoading || isInitializingAI) && !isProcessingHandoff && (            
            <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center flex-shrink-0 shadow-sm">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <Card className="p-4 bg-white/90 border-slate-100 rounded-2xl shadow-sm">
                  <div className="flex gap-2 items-center">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-teal-500 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                    <span className="text-sm text-gray-600"></span>
                  </div>
                </Card>
              </div>
          )}
          
          {/* Handoff Spinner */}
          {isProcessingHandoff && (
            <div className="flex flex-col items-center justify-center py-8 gap-3 animate-in fade-in">
              <div className="w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-gray-500 text-lg font-medium">Generating Project Blueprint...</p>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="p-4 shrink-0">
        <div className="max-w-3xl mx-auto">
          {isGuidingPhase && (
            <div className="animate-in slide-in-from-bottom-5 fade-in duration-300">
              {currentQuestion.options ? (
                <div className={cn(
                  "grid gap-3",
                  currentQuestion.options.length === 3 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-4"
                )}>
                  {currentQuestion.options.map(opt => (
                  <button
                    key={opt.id}
                    className="group h-auto py-5 px-4 flex flex-col gap-1.5 whitespace-normal transition-all duration-200 pointer-events-auto cursor-pointer rounded-2xl border border-slate-200 bg-white hover:border-teal-300 hover:shadow-md hover:shadow-teal-100/50 text-left"
                    onClick={() => handleGuidingStep(opt.value, opt.label)}
                  >
                    <span className="font-semibold text-sm text-slate-800 group-hover:text-teal-700 transition-colors">
                      {opt.label}
                    </span>
                    <span className="text-xs font-normal text-slate-400 leading-relaxed">
                      {opt.desc}
                    </span>
                  </button>
                  ))}
                </div>
              ) : (
                // Render Text Input
                <div className="relative w-full flex items-end">
                  <Textarea
                    className="w-full min-h-[60px] max-h-[120px] resize-none pr-16 pb-14 pt-4 break-words overflow-y-auto" 
                    placeholder={currentQuestion.placeholder}
                    value={input}
                    disabled={isInputDisabled}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      // common chat behavior: Enter sends, Shift+Enter makes newline
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (input.trim()) handleGuidingStep(input.trim());
                      }
                    }}
                    autoFocus
                  />

                  <Button
                    type="button"
                    variant="default"
                    size="icon"
                    onClick={() => input.trim() && handleGuidingStep(input.trim())}
                    disabled={isInputDisabled || !input.trim()}
                    className="absolute right-4 top-4 h-[42px] w-[42px] bg-teal-600 hover:bg-teal-700 disabled:opacity-50 transition-all duration-200 pointer-events-auto cursor-pointer rounded-xl"
                  > 
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Normal Chat Input */}
          {!isGuidingPhase && !isProcessingHandoff && (
            <div className="relative w-full">
               <Textarea
                 value={input}
                 onChange={e => setInput(e.target.value)}
                 placeholder="Ask questions or refine the idea..."
                 disabled={isInputDisabled}
                className="w-full min-h-[50px] max-h-[120px] resize-none pr-14" 
                 onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(input); }}}
               />
               <Button 
                variant="default"
                size= "icon"
                 onClick={() => handleSendMessage(input)} 
                 disabled={isInputDisabled || !input.trim()}
                className="absolute right-4 top-4 bg-teal-600 hover:bg-teal-700 h-[60px] w-[60px] transition-all duration-200 pointer-events-auto cursor-pointer rounded-xl"
               >
                 <Send className="w-4 h-4" />
               </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );

  if (embedded) {
    return <div className="flex-1 min-h-0 flex flex-col">{chatContent}</div>;
  }

  return (
    <div className="h-screen flex flex-col" style={{ background: 'linear-gradient(to bottom right, #cffafe, #f0fdfa, #fef3c7)' }}>
      {/* Header */}
      <header className="border-b border-slate-100 bg-white/80 backdrop-blur-sm px-4 py-3 flex items-center gap-4 flex-shrink-0">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5 pointer-events-auto cursor-pointer" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-700 to-teal-500 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-800">Create Custom Project</h1>
            <p className="text-sm text-slate-500">AI Project Architect</p>
          </div>
        </div>

       <AlertDialog open={isRestartOpen} onOpenChange={setIsRestartOpen}>
        <AlertDialogTrigger asChild>
          <Button
            variant="default"
            size="lg"
            className="ml-auto mr-4 bg-teal-600 hover:bg-teal-700 border-teal-500 transition-all duration-200 pointer-events-auto cursor-pointer"
            type="button"
          >
            Restart
          </Button>
        </AlertDialogTrigger>

        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restart Chat?</AlertDialogTitle>
            <AlertDialogDescription>
              This will clear your current chat history and requirements. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel
            type="button"
            variant="ghost"
            size="lg"
            className="font-semibold ml-auto text-teal-700 hover:text-accent hover:bg-gray-100 pointer-events-auto cursor-pointer"
            >
              CANCEL</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              variant="ghost"
              size="lg"
              onClick={handleRestart}
              className="font-semibold text-teal-700 hover:text-accent hover:bg-gray-100 pointer-events-auto cursor-pointer"

            >
              RESTART NOW
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </header>

      {chatContent}
    </div>
  );
}
