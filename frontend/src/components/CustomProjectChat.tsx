import React, { useEffect, useState, useRef, useCallback } from 'react';
import { User } from '../App';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Textarea } from './ui/textarea';
import { ArrowLeft, Send, Bot, User as UserIcon, Sparkles, Paperclip, X, FileText, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BACKEND_URL } from '../utils/constants';
import { GUIDING_QUESTIONS } from '../utils/guidingQuestions';
import { authFetch } from '../utils/authFetch';
import { cn } from './ui/utils';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from './ui/alert-dialog';

// ─── Types ───────────────────────────────────────────────────────────────────

interface FileAttachment {
  name: string;
  type: string;
  url: string;        // object URL – always set for click-to-open
  isImage: boolean;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  attachments?: FileAttachment[];
}

type Props = {
  user: User;
  onProjectCreated: (requirementsData: any) => void;
  onBack: () => void;
  embedded?: boolean;
  onRegisterRestart?: (fn: (() => void) | null) => void;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const VALID_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain', 'text/x-python', 'application/javascript'];
const VALID_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.txt', '.py', '.js'];

const MARKDOWN_COMPONENTS = {
  p: ({ children }: any) => <p className="mb-4 last:mb-0 leading-relaxed whitespace-pre-wrap">{children}</p>,
  ul: ({ children }: any) => <ul className="list-disc list-outside ml-6 mb-4 space-y-1.5">{children}</ul>,
  ol: ({ children }: any) => <ol className="list-decimal list-outside ml-6 mb-4 space-y-1.5">{children}</ol>,
  li: ({ children }: any) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }: any) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }: any) => <em className="italic">{children}</em>,
  code: ({ inline, children, ...props }: any) =>
    inline ? (
      <code className="bg-gray-100 text-pink-600 px-1.5 py-0.5 rounded text-sm font-mono" {...props}>{children}</code>
    ) : (
      <code className="block bg-gray-900 text-gray-100 p-3 rounded text-sm font-mono overflow-x-auto mb-4" {...props}>{children}</code>
    ),
  h1: ({ children }: any) => <h1 className="text-2xl font-bold mb-3 mt-6 first:mt-0">{children}</h1>,
  h2: ({ children }: any) => <h2 className="text-xl font-bold mb-3 mt-5 first:mt-0">{children}</h2>,
  h3: ({ children }: any) => <h3 className="text-lg font-semibold mb-2 mt-4 first:mt-0">{children}</h3>,
  blockquote: ({ children }: any) => <blockquote className="border-l-4 border-teal-500 pl-4 italic my-4">{children}</blockquote>,
  br: () => <br className="my-2" />,
};

const LEVEL_LABELS: Record<string, string> = {
  'level-1': 'Level 1 (Basics)',
  'level-2': 'Level 2 (Conditions)',
  'level-3': 'Level 3 (Loops)',
  'level-4': 'Level 4 (Functions & Data)',
  'level-5': 'Level 5 (Advanced)',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildUserProfile(user: User) {
  return {
    educationLevel: user.onboarding?.educationLevel || 'primary',
    schoolExperience: user.onboarding?.schoolExperience || 'beginner',
    pythonLevel: user.onboarding?.pythonLevel || 'level-1',
    biggestChallenges: user.onboarding?.biggestChallenges || 'planning',
    learningMode: user.onboarding?.learningMode || 'guided',
  };
}

function cleanStreamContent(raw: string): string {
  let clean = raw.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\t/g, '  ');
  clean = clean.replace(/([^\n])\n(\s*[\*\-\d+\.])/g, '$1\n\n$2');
  if (clean.startsWith('"') && clean.endsWith('"')) clean = clean.slice(1, -1);
  return clean;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB (matches backend MAX_CONTENT_LENGTH)
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB for images (matches backend)

function isValidFile(file: File): { valid: boolean; reason?: string } {
  const isImage = file.type.startsWith('image/');
  if (isImage && file.size > MAX_IMAGE_SIZE) {
    return { valid: false, reason: `${file.name} is too large (images max 5MB, got ${(file.size / 1024 / 1024).toFixed(1)}MB)` };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, reason: `${file.name} is too large (max 50MB, got ${(file.size / 1024 / 1024).toFixed(1)}MB)` };
  }
  const typeOk = VALID_MIME_TYPES.includes(file.type) || VALID_EXTENSIONS.some(ext => file.name.toLowerCase().endsWith(ext));
  if (!typeOk) {
    return { valid: false, reason: `${file.name} has an unsupported file type` };
  }
  return { valid: true };
}

function filterValidFiles(files: File[]): File[] {
  const accepted: File[] = [];
  for (const file of files) {
    const result = isValidFile(file);
    if (result.valid) {
      accepted.push(file);
    } else {
      toast.error(result.reason!);
    }
  }
  return accepted;
}

const generateSystemPrompt = (answers: Record<string, string | string[]>) => {
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

  return prompt;
}

/** Read an SSE stream and fire callbacks for content / handoff / done. */
async function readSSEStream(
  response: Response,
  onContent: (content: string) => void,
  onHandoff: () => void,
): Promise<void> {
  if (!response.ok || !response.body) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let finished = false;

  while (!finished) {
    const { value, done } = await reader.read();
    if (done) break;

    for (const line of decoder.decode(value, { stream: true }).split('\n')) {
      if (!line.startsWith('data: ')) continue;
      try {
        const data = JSON.parse(line.substring(6));
        if (data.content) onContent(data.content);
        if (data.handoff) onHandoff();
        if (data.done) finished = true;
      } catch {
        // skip malformed chunks
      }
    }
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export function CustomProjectChat({ user, onProjectCreated, onBack, embedded, onRegisterRestart }: Props) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessingHandoff, setIsProcessingHandoff] = useState(false);
  const [isInitializingAI, setIsInitializingAI] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [guidingAnswers, setGuidingAnswers] = useState<Record<string, string | string[]>>({});
  const [chatSessionId, setChatSessionId] = useState(crypto.randomUUID());
  const [isRestartOpen, setIsRestartOpen] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // --- Refs ---
  const guidingAnswersRef = useRef(guidingAnswers);
  guidingAnswersRef.current = guidingAnswers; 
  const hasInitializedChat = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // --- Derived ---
  const isGuidingPhase = currentStep < GUIDING_QUESTIONS.length;
  const currentQuestion = GUIDING_QUESTIONS[currentStep];
  const isInputDisabled = isLoading || isInitializingAI || isProcessingHandoff || (isGuidingPhase && !currentQuestion?.inputType);
  const userProfile = buildUserProfile(user);

  // ─── Effects ─────────────────────────────────────────────────────────────────

  // Initialise welcome messages
  useEffect(() => {
    if (hasInitializedChat.current === chatSessionId) return;
    hasInitializedChat.current = chatSessionId;

    if (messages.length === 0) {
      const skillLevel = LEVEL_LABELS[user.onboarding?.pythonLevel || ''] || 'beginner';
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content: `Hi ${user.name}! 👋 I'm here to help you create a custom project tailored to your **${skillLevel}** skill level. Let's start with a few questions to scope your project first!`,
        },
        { id: 'q1', role: 'assistant', content: GUIDING_QUESTIONS[0].text },
      ]);
    }
  }, [user.name, user.onboarding?.pythonLevel, messages.length, chatSessionId]);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, currentStep]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    }
  }, [input]);

  // Revoke object URLs on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      messages.forEach(msg =>
        msg.attachments?.forEach(att => {
          URL.revokeObjectURL(att.url);
        }),
      );
    };
  }, []);

  // ─── File handlers ───────────────────────────────────────────────────────────

  const addValidFiles = useCallback((files: File[]) => {
    const valid = filterValidFiles(files);
    if (valid.length > 0) {
      setAttachedFiles(prev => [...prev, ...valid]);
      toast.success(`Added ${valid.length} file${valid.length > 1 ? 's' : ''}`);
    }
    // Individual rejection toasts are now shown by filterValidFiles
  }, []);

  const removeFile = useCallback((index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    addValidFiles(Array.from(e.dataTransfer.files));
  }, [addValidFiles]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addValidFiles(Array.from(e.target.files));
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [addValidFiles]);

  // ─── Stream response helper ──────────────────────────────────────────────────

  /** Shared callback that appends streamed content to the assistant message. */
  const makeStreamHandlers = useCallback((assistantId: string) => {
    const onContent = (content: string) => {
      setMessages(prev => prev.map(msg => {
        if (msg.id !== assistantId) return msg;
        return { ...msg, content: cleanStreamContent((msg.content || '') + content) };
      }));
    };
    const onHandoff = () => triggerHandoff();
    const onDone = () => { setIsLoading(false); setIsInitializingAI(false); };
    const onError = (msg?: string) => { setIsLoading(false); setIsInitializingAI(false); toast.error(msg || 'Connection error — please check your network and try again'); };
    return { onContent, onHandoff, onDone, onError };
  }, []);

  // ─── Send message ────────────────────────────────────────────────────────────

  const handleSendMessage = useCallback(async (systemPrompt?: string, options: { skipUserBubble?: boolean } = {}) => {
    const textToBackend = typeof systemPrompt === 'string' ? systemPrompt : input.trim();
    const hasFiles = attachedFiles.length > 0;

    if ((!textToBackend && !hasFiles) || isLoading) return;

    setInput('');
    setIsLoading(true);

    const filesToSend = [...attachedFiles];
    setAttachedFiles([]);

    // Show user bubble
    if (!options.skipUserBubble) {
      const attachments: FileAttachment[] = filesToSend.map(f => ({
        name: f.name,
        type: f.type,
        url: URL.createObjectURL(f),
        isImage: f.type.startsWith('image/'),
      }));
      setMessages(prev => [...prev, {
        id: Date.now().toString() + '-user',
        role: 'user',
        content: textToBackend || '',
        attachments: attachments.length > 0 ? attachments : undefined,
      }]);
    }

    // Placeholder assistant message
    const assistantId = Date.now().toString() + '-assistant';
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '' }]);

    const history = messages.map(m => ({ role: m.role, content: m.content }));
    const { onContent, onHandoff, onDone, onError } = makeStreamHandlers(assistantId);

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      let response: Response;

      if (filesToSend.length > 0) {
        // Multipart — file upload
        const formData = new FormData();
        formData.append('message', textToBackend || 'Attached files');
        formData.append('history', JSON.stringify(history));
        formData.append('session_id', chatSessionId);
        formData.append('user_profile', JSON.stringify(userProfile));
        formData.append('guiding_complete', String(!!options.skipUserBubble));
        filesToSend.forEach(file => formData.append('files', file));

        response = await authFetch('/chat/', { method: 'POST', body: formData, signal: controller.signal });
      } else {
        // JSON — text only
        response = await authFetch('/chat/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: textToBackend,
            history,
            session_id: chatSessionId,
            user_profile: userProfile,
            guiding_complete: !!options.skipUserBubble,
          }),
          signal: controller.signal,
        });
      }

      if (!response.ok) {
        // Handle specific HTTP errors with clear messages
        if (response.status === 413) {
          onError('File too large — the server limit is 50MB. Please reduce file size and try again.');
        } else if (response.status === 400) {
          let detail = 'Invalid request';
          try { const body = await response.json(); detail = body.error || detail; } catch {}
          onError(detail);
        } else if (response.status === 422) {
          onError('Unsupported file type — accepted: images, PDFs, .txt, .py, .js');
        } else {
          onError(`Server error (${response.status}) — please try again`);
        }
        return;
      }

      await readSSEStream(response, onContent, onHandoff);
      onDone();
    } catch (error: any) {
      if (controller.signal.aborted) return;
      console.error('[Chat] Stream Error:', error);
      const hadFiles = filesToSend.length > 0;
      if (error instanceof TypeError && error.message?.includes('Failed to fetch')) {
        onError(
          hadFiles
            ? 'File too large for the server. Please reduce file size (images max 5MB, total max 50MB) and try again.'
            : 'Network error — could not reach the server. Please check your connection.',
        );
      } else if (error?.message?.includes('413')) {
        onError('File too large — the server limit is 50MB. Please reduce file size and try again.');
      } else {
        onError();
      }
    }
  }, [isLoading, messages, user, chatSessionId, attachedFiles, input, makeStreamHandlers, userProfile]);

  // ─── Guiding questions ───────────────────────────────────────────────────────

  const proceedToNextStep = (answers: Record<string, string | string[]>, userVisual: string) => {
    let nextStep = currentStep + 1;

    // Skip the "description" question (index 1) if user chose "surprise"
    if (nextStep === 1 && answers['startPath'] === 'surprise') {
      nextStep = 2; // jump to timeline
    }

    setCurrentStep(nextStep);
    setMessages(prev => [...prev, { id: `ans-${currentStep}`, role: 'user', content: userVisual }]);

    if (nextStep < GUIDING_QUESTIONS.length) {
      setTimeout(() => {
        setMessages(prev => [...prev, {
          id: `q-${nextStep}`,
          role: 'assistant',
          content: GUIDING_QUESTIONS[nextStep].text
        }]);
      }, 500);
    } else {
      const systemPrompt = generateSystemPrompt(answers);
      handleSendMessage(systemPrompt, { skipUserBubble: true });
    }
  };

  const handleGuidingStep = (value: string, label?: string) => {
    const currentQ = GUIDING_QUESTIONS[currentStep];

    console.group(`[Guiding] Step ${currentStep + 1}: ${currentQ.key}`);

    const newAnswers = { ...guidingAnswers, [currentQ.key]: value };
    setGuidingAnswers(newAnswers);
    setInput('');

    proceedToNextStep(newAnswers, label || value);
    console.groupEnd();
  };

  // ─── Handoff ─────────────────────────────────────────────────────────────────

  const triggerHandoff = async () => {
    if (isProcessingHandoff) return;
    setIsProcessingHandoff(true);

    setTimeout(async () => {
      try {
        // Fetch the canonical/validated session data from the backend
        const reqRes = await authFetch(`/chat/requirements/${chatSessionId}`);
        const reqJson = await reqRes.json();
        if (!reqRes.ok || reqJson.status !== 'success') throw new Error('Failed to get requirements');

        const sessionData = reqJson.requirements.session_data;
        sessionData.timeline = guidingAnswersRef.current.timeline || '';

        const outlineRes = await authFetch('/planning/outline', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session: sessionData, user_profile: userProfile }),
        });
        const outlineJson = await outlineRes.json();

        toast.success('Plan Created!');
        onProjectCreated({ session: sessionData, outline: outlineJson, userProfile });
      } catch (e) {
        console.error(e);
        toast.error('Failed to generate plan');
        setIsProcessingHandoff(false);
      }
    }, 2000);
  };

  // ─── Restart ─────────────────────────────────────────────────────────────────

  const handleRestart = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setMessages([]);
    setCurrentStep(0);
    setGuidingAnswers({});
    setInput('');
    setAttachedFiles([]);
    setIsLoading(false);
    setIsInitializingAI(false);
    setIsProcessingHandoff(false);
    const newId = crypto.randomUUID();
    setChatSessionId(newId);
    hasInitializedChat.current = null;
    setIsRestartOpen(false);
  }, []);

  // Register restart callback for parent (StudentLayout) to invoke
  useEffect(() => {
    onRegisterRestart?.(handleRestart);
    return () => onRegisterRestart?.(null);
  }, [handleRestart, onRegisterRestart]);

  // ─── Render ──────────────────────────────────────────────────────────────────

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

                {/* User messages with attachments: stack attachment + text, right-aligned */}
                {msg.role === 'user' && msg.attachments?.length ? (
                  <div className="flex flex-col items-end gap-1.5 max-w-[85%]">
                    {msg.attachments.map((att, i) =>
                      att.isImage ? (
                        <div key={i} className="w-fit">
                          <a href={att.url} target="_blank" rel="noopener noreferrer">
                            <img
                              src={att.url}
                              alt={att.name}
                              className="max-h-[300px] max-w-[300px] rounded-lg object-cover cursor-pointer hover:opacity-80 transition-opacity"
                            />
                          </a>
                        </div>
                      ) : (
                        <a
                          key={i}
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex w-fit h-fit items-center border-2 gap-3 bg-white/80 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-white/30 hover:text-teal-600 transition-colors cursor-pointer no-underline"
                        >
                          <FileText className="flex flex-col leading-tight pr-2 text-teal" />
                          <span className="font-medium truncate max-w-[180px]">{att.name}</span>
                          <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">
                            {att.name.split('.').pop()}
                          </span>
                        </a>
                      ),
                    )}
                    {msg.content && (
                      <Card className="p-4 rounded-2xl bg-teal-600 text-white border-0 shadow-sm">
                        <div className="prose prose-sm max-w-none break-words prose-invert">
                          <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                      </Card>
                    )}
                  </div>
                ) : (
                  <Card className={cn(
                    'p-4 max-w-[85%] rounded-2xl',
                    msg.role === 'user'
                      ? 'bg-teal-600 text-white border-0 shadow-sm'
                      : 'bg-white/90 border-slate-100 shadow-sm',
                  )}>
                    {msg.content && (
                      <div className={cn('prose prose-sm max-w-none break-words', msg.role === 'user' ? 'prose-invert' : 'prose-gray')}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    )}
                  </Card>
                )}

                {msg.role === 'user' && (
                  <div className="w-10 h-10 rounded-full bg-teal-600 flex items-center justify-center flex-shrink-0">
                    <UserIcon className="w-5 h-5 text-white" />
                  </div>
                )}
              </div>
            );
          })}

          {/* Loading indicator */}
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

          {/* Handoff spinner */}
          {isProcessingHandoff && (
            <div className="flex flex-col items-center justify-center py-10 gap-4 animate-in fade-in">
              <div className="relative w-14 h-14">
                <div className="absolute inset-0 rounded-full border-4 border-teal-100" />
                <div className="absolute inset-0 rounded-full border-4 border-teal-600 border-r-transparent border-b-transparent animate-spin" style={{ animationDuration: '0.9s' }} />
              </div>
              <div className="flex flex-col items-center gap-1.5">
                <p className="text-gray-800 text-lg font-semibold">Generating Project Blueprint</p>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                  <div className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
                  <div className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
                </div>
              </div>
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
                <div className="relative w-full flex items-end">
                  <Textarea
                    ref={textareaRef}
                    className="w-full min-h-[60px] max-h-[120px] resize-none pr-16 pb-14 pt-4 break-words overflow-y-auto"
                    placeholder={currentQuestion.placeholder}
                    value={input}
                    disabled={isInputDisabled}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
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

          {/* Free-chat phase with drag-and-drop */}
        {!isGuidingPhase && !isProcessingHandoff && (
          <div className="w-full relative px-4 pb-4">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={VALID_EXTENSIONS.join(',')}
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />

            {isDragging && (
              <div className="absolute inset-0 bg-teal-100 bg-opacity-50 border-4 border-dashed border-teal-600 rounded-lg flex flex-col items-center justify-center pointer-events-none animate-pulse z-50">
                <p className="text-cyan-700 font-semibold">Drop files here to attach</p>
              </div>
            )}

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={cn(
                'relative flex flex-col border rounded-2xl bg-white shadow-sm transition-all overflow-hidden',
                isDragging ? 'ring-2 ring-cyan-500 border-transparent' : 'border-gray-200',
              )}
            >
              {/* 1. Attached file chips (Top Section) */}
              {attachedFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 p-3 border-b bg-gray-50/50">
                  {attachedFiles.map((file, i) => (
                    <div key={i} className="flex items-center gap-2 bg-white border border-gray-200 pl-2 pr-1 py-1 rounded-lg text-xs shadow-sm group">
                      {file.type.startsWith('image/') ? <ImageIcon className="w-3 h-3 text-gray-400" /> : <FileText className="w-3 h-3 text-gray-400" />}
                      <span className="truncate max-w-[120px] text-gray-700">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => removeFile(i)}
                        className="p-1 hover:bg-gray-100 rounded-full text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* 2. Textarea Section (Middle Section - Full Width) */}
              <div className="px-2 pt-2">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask questions or drop a file..."
                  disabled={isInputDisabled}
                  className="w-full min-h-[80px] max-h-[200px] resize-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-base"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (input.trim() || attachedFiles.length > 0) handleSendMessage();
                    }
                  }}
                />
              </div>

              {/* 3. Action Toolbar (Bottom Section) */}
              <div className="flex items-center justify-between p-2 mt-1 bg-white">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 border-0 text-gray-500 hover:text-white hover:bg-teal-600 h-10 w-10 transition-all duration-200 pointer-events-auto cursor-pointer rounded-xl"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Paperclip className="w-5 h-5" />
                  </Button>
                  
                  {attachedFiles.length > 0 && (
                    <span className="text-[10px] bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-bold uppercase">
                      {attachedFiles.length} File{attachedFiles.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                <Button
                  type="button"
                  variant="default"
                  size="icon"
                  onClick={() => handleSendMessage()}
                  disabled={isInputDisabled || (!input.trim() && attachedFiles.length === 0)}
                  className="shrink-0 bg-teal-600 hover:bg-teal-700 h-10 w-10 transition-all duration-200 pointer-events-auto cursor-pointer rounded-xl"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
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
      <header className="border-b border-slate-100 bg-white/95 px-4 py-3 flex items-center gap-4 flex-shrink-0">
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
            onClick={() => setIsRestartOpen(false)}
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