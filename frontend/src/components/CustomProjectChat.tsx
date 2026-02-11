import React, { useEffect, useState, useRef, useCallback } from 'react';
import { User } from '../App';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Textarea } from './ui/textarea';
import { ArrowLeft, Send, Bot, User as UserIcon, Sparkles, Check } from 'lucide-react';
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
};

// Helper function to generate technical prompt
const generateSystemPrompt = (answers: Record<string, string | string[]>) => {
  console.log("[System] Generating prompt to pass to LLM from user answers:", answers);
  const { projectType, projectIdea, timeline, mainFeatures, objective } = answers;

  const formatAnswer = (answer: string | string[]) => {
    return Array.isArray(answer) ? answer.join(', ') : answer;
  };

  const prompt = `
    This is the scope for the project idea user wants to build:
    
    **User Choices:**
    - **Type:** ${formatAnswer(projectType).toUpperCase()}
    - **Idea:** ${projectIdea}
    - **Main Features:** ${mainFeatures}
    - **Objective:** ${objective}
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

export function CustomProjectChat({ user, onProjectCreated, onBack }: Props) {
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
    const nextStep = currentStep + 1;
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

  // 5. Handle Guiding Phase Selections
  const handleGuidingStep = (value: string, label?: string) => {
    const currentQ = GUIDING_QUESTIONS[currentStep];

    console.group(`[Guiding] Step ${currentStep + 1}: ${currentQ.key}`);
    
    // Logic for Multi-Select
    if (currentQ.multiSelect) {
      const currentAnswers = guidingAnswers[currentQ.key];
      const answerArray = Array.isArray(currentAnswers) ? currentAnswers : [];
      
      let newAnswerArray: string[];
      
      // Toggle selection
      if (answerArray.includes(value)) {
        newAnswerArray = answerArray.filter(v => v !== value);
      } else {
        newAnswerArray = [...answerArray, value];
      }
      
      const newAnswers = { ...guidingAnswers, [currentQ.key]: newAnswerArray };
      setGuidingAnswers(newAnswers);
      setInput(''); // Clear input for next question
      
      console.log("Updated Multi-Select Answers:", newAnswers);
      console.groupEnd();
      return; // Return early, do not auto-advance
    } 
    
    // Logic for Single-Select (Auto-advance)
    const newAnswers = { ...guidingAnswers, [currentQ.key]: value };
    setGuidingAnswers(newAnswers);
    setInput(''); // Clear input for next question

    proceedToNextStep(newAnswers, label || value);
    console.groupEnd();
  };

  // 6. Handle continue button for multi-select questions
  const handleMultiSelectContinue = () => {
    const currentQ = GUIDING_QUESTIONS[currentStep];
    const selectedAnswers = guidingAnswers[currentQ.key];
    
    if (!selectedAnswers || (Array.isArray(selectedAnswers) && selectedAnswers.length === 0)) {
      toast.error("Please select at least one option");
      return;
    }

    const answerArray = Array.isArray(selectedAnswers) ? selectedAnswers : [selectedAnswers];
    const labels = currentQ.options
      ?.filter(opt => answerArray.includes(opt.value))
      .map(opt => opt.label)
      .join(', ') || '';

    proceedToNextStep(guidingAnswers, labels);
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

        const outlineRes = await fetch(`${BACKEND_URL}/planning/outline`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              session: backendSessionData,
              pythonLevel: user.onboarding?.pythonLevel || 'level-1',
            }),
        });
        
        const outlineJson = await outlineRes.json();
        
        toast.success("Plan Created!");
        onProjectCreated({
            session: backendSessionData,
            outline: outlineJson,
            pythonLevel: user.onboarding?.pythonLevel || 'level-1',
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

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-purple-50 to-orange-50">      
      {/* Header */}
      <header className="border-b bg-white px-4 py-3 flex items-center gap-4 flex-shrink-0">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5 pointer-events-auto cursor-pointer" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-800 to-cyan-500 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Create Custom Project</h1>
            <p className="text-sm text-gray-600">AI Project Architect</p>
          </div>
        </div>

       <AlertDialog open={isRestartOpen} onOpenChange={setIsRestartOpen}>
        <AlertDialogTrigger asChild>
          <Button
            variant="default"
            size="lg"
            className="ml-auto mr-4 hover:bg-gray-700 border-gray-200 transition-all duration-200 pointer-events-auto cursor-pointer"
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
            className="font-semibold ml-auto text-cyan-700 hover:text-accent hover:bg-gray-100 pointer-events-auto cursor-pointer"
            >
              CANCEL</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              variant="ghost"
              size="lg"
              onClick={handleRestart}
              className="font-semibold text-cyan-700 hover:text-accent hover:bg-gray-100 pointer-events-auto cursor-pointer"
              
            >
              RESTART NOW
            </AlertDialogAction>
          </AlertDialogFooter> 
        </AlertDialogContent>
      </AlertDialog>
      </header>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-4xl mx-auto space-y-6 pb-20">
          {messages.map((msg) => {
            if (msg.role === 'assistant' && !msg.content) return null;

            return (
              <div key={msg.id} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-10 h-10 rounded-full bg-cyan-800 flex items-center justify-center shrink-0">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                )}
                
                <Card className={`p-4 max-w-[85%] ${msg.role === 'user' ? 'bg-[#ffa200] text-white border-0' : 'bg-white'}`}>
  
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
                          <blockquote className="border-l-4 border-purple-500 pl-4 italic my-4">
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
                  <div className="w-10 h-10 rounded-full bg-[#ffa200] flex items-center justify-center flex-shrink-0">
                    <UserIcon className="w-5 h-5 text-white" />
                  </div>
                )}
              </div>
            )
          })}

          {/* Loading Indicator */}
          {(isLoading || isInitializingAI) && !isProcessingHandoff && (            
            <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-800 to-cyan-500 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <Card className="p-4 bg-white">
                  <div className="flex gap-2 items-center">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-cyan-800 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-cyan-800 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-cyan-800 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                    <span className="text-sm text-gray-600"></span>
                  </div>
                </Card>
              </div>
          )}
          
          {/* Handoff Spinner */}
          {isProcessingHandoff && (
            <div className="flex flex-col items-center justify-center py-8 gap-3 animate-in fade-in">
              <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-gray-500 text-lg font-medium">Generating Project Blueprint...</p>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t bg-white/95 backdrop-blur-sm p-4 shrink-0 transition-all duration-300 ease-in-out">
        <div className="max-w-4xl mx-auto">
          {isGuidingPhase && (
            <div className="animate-in slide-in-from-bottom-5 fade-in duration-300">
              <div className="flex justify-between items-center mb-3">
                 <p className="text-sm text-gray-500 font-medium">
                    {currentQuestion.multiSelect ? "Select one or more options:" 
                    : currentQuestion.inputType === "text" ? "Type your answer below:" 
                    : "Select an option:"}
                 </p>
              </div>

              {currentQuestion.options ? (
                // Render Buttons
                <div className="flex flex-col gap-4"> 
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {currentQuestion.options.map(opt => {
                      const isSelected = currentQuestion.multiSelect && 
                        Array.isArray(guidingAnswers[currentQuestion.key]) &&
                        (guidingAnswers[currentQuestion.key] as string[]).includes(opt.value);
                        
                  return (
                    <Button 
                      key={opt.id}  
                      variant="user_multi_option"
                      className={cn(
                        "group border-4 border-invisible h-auto py-6 flex flex-col gap-2 whitespace-normal transition-all duration-200 resize-none pointer-events-auto cursor-pointer",
                        isSelected 
                          ? "bg-amber-400 shadow-md" 
                          : "border-2 border-gray-200 bg-white transition-all duration-200 hover:border-blue-50 hover:border-4 hover:bg-gray-50"
                      )}
                      onClick={() => handleGuidingStep(opt.value, opt.label)}
                    >
                      <div className="flex items-center gap-2 justify-center w-full">
                        {isSelected && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
                        <span className={cn(
                          "font-semibold", 
                          isSelected ? "text-white" : "text-gray-800"
                        )}>
                          {opt.label}
                        </span>
                      </div>
                      
                      <span className={cn(
                        "text-xs font-normal px-4", 
                        isSelected ? "text-white" : "text-gray-500"
                      )}>
                        {opt.desc}
                      </span>
                    </Button>
                  );
                })}
              </div>
              
              {currentQuestion.multiSelect && (
                <div className="flex border justify-end pb-2 animate-in fade-in slide-in-from-bottom-2">
                  <Button 
                    onClick={handleMultiSelectContinue}
                        disabled={
                          !(guidingAnswers[currentQuestion.key] && 
                            Array.isArray(guidingAnswers[currentQuestion.key]) && 
                            (guidingAnswers[currentQuestion.key] as string[]).length > 0)
                        }
                        className="whitespace-normal bg-white hover:border-blue-50 hover:border-4 hover:bg-gray-50 text-xs text-gray-500 font-normal border px-8 py-2 shadow-md z-10 pointer-events-auto cursor-pointer"
                      >
                        Confirm Selection 
                      </Button>
                    </div>
                  )}
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
                    className="absolute right-4 top-4 h-[42px] w-[42px] hover:backdrop-blur-sm hover:bg-gray-700 disabled:opacity-50 transition-all duration-200 pointer-events-auto cursor-pointer"
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
                className="absolute right-4 top-4 hover:backdrop-blur-sm hover:bg-gray-700 h-[60px] w-[60px] transition-all duration-200 pointer-events-auto cursor-pointer"
               >
                 <Send className="w-4 h-4" />
               </Button>
            </div>
          )}
        </div>
      </div>
        </div>
  );
}
