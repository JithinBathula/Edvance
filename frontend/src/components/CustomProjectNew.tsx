import { FormEvent, useMemo, useState, useRef, useEffect } from "react";
import { ArrowUp, Loader2 } from "lucide-react";
import React from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type Props = {
  onFirstMessage?: (message: string) => void;
};

const BACKEND_URL = "http://localhost:8001";

export function CustomProjectNew({ onFirstMessage }: Props) {
  const [message, setMessage] = useState("");
  const [hasStarted, setHasStarted] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const backgroundStyle = useMemo(
    () => ({
      background:
        "radial-gradient(90% 70% at 50% 18%, #ffffff 0%, #f6f8ff 30%, #d7e3ff 55%, #b3c7ff 68%, #ffffff 92%), radial-gradient(120% 120% at 50% 88%, #6f9cff 8%, #7fa6ff 28%, #ffad82 58%, #ff7b70 76%, #ffffff 95%)",
    }),
    []
  );

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent]);

  const sendMessage = async (userMessage: string) => {
    try {
      setIsLoading(true);
      setStreamingContent("");

      // Add user message to chat
      const newMessages: Message[] = [
        ...messages,
        { role: "user", content: userMessage },
      ];
      setMessages(newMessages);

      // Prepare conversation history for API
      const history = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      // Make streaming request
      const response = await fetch(`${BACKEND_URL}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMessage,
          history: history,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              try {
                const parsed = JSON.parse(data);
                if (parsed.content) {
                  accumulatedContent += parsed.content;
                  setStreamingContent(accumulatedContent);
                } else if (parsed.done) {
                  // Streaming completed
                  break;
                } else if (parsed.error) {
                  console.error("API Error:", parsed.error);
                  throw new Error(parsed.error);
                }
              } catch (e) {
                // Ignore JSON parse errors for incomplete chunks
              }
            }
          }
        }
      }

      // Add assistant message to chat
      if (accumulatedContent) {
        setMessages([
          ...newMessages,
          { role: "assistant", content: accumulatedContent },
        ]);
      }
      setStreamingContent("");
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages([
        ...messages,
        { role: "user", content: userMessage },
        {
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
        },
      ]);
      setStreamingContent("");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (event?: FormEvent) => {
    event?.preventDefault();
    const trimmed = message.trim();

    if (!trimmed || isLoading) return;

    console.log("New CustomProjectNew chat message:", trimmed);
    onFirstMessage?.(trimmed);
    setHasStarted(true);
    sendMessage(trimmed);
    setMessage("");
  };

  if (hasStarted) {
    return (
      <div
        className="min-h-screen w-full flex flex-col"
        style={backgroundStyle}
      >
        {/* Chat messages area */}
        <div className="flex-1 overflow-y-auto px-4 py-6 md:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto space-y-6">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[85%] md:max-w-[75%] rounded-3xl px-5 py-3.5 border-2 backdrop-blur-xl ${
                    msg.role === "user"
                      ? "bg-indigo-600/80 text-black border-indigo-400/50 shadow-lg"
                      : "bg-white/70 text-gray-800 border-white/60 shadow-lg"
                  }`}
                  style={{
                    backdropFilter: "blur(20px) saturate(180%)",
                    WebkitBackdropFilter: "blur(20px) saturate(180%)",
                  }}
                >
                  <p className="text-base whitespace-pre-wrap break-words leading-relaxed">
                    {msg.content}
                  </p>
                </div>
              </div>
            ))}

            {/* Streaming message */}
            {streamingContent && (
              <div className="flex justify-start">
                <div 
                  className="max-w-[85%] md:max-w-[75%] rounded-3xl px-5 py-3.5 border-2 bg-white/70 text-gray-800 border-white/60 shadow-lg backdrop-blur-xl"
                  style={{
                    backdropFilter: "blur(20px) saturate(180%)",
                    WebkitBackdropFilter: "blur(20px) saturate(180%)",
                  }}
                >
                  <p className="text-base whitespace-pre-wrap break-words leading-relaxed">
                    {streamingContent}
                    <span className="inline-block w-1.5 h-4 ml-1 bg-gray-400 animate-pulse"></span>
                  </p>
                </div>
              </div>
            )}

            {/* Loading indicator */}
            {isLoading && !streamingContent && (
              <div className="flex justify-start">
                <div 
                  className="max-w-[85%] md:max-w-[75%] rounded-3xl px-5 py-3.5 border-2 bg-white/70 text-gray-800 border-white/60 shadow-lg backdrop-blur-xl"
                  style={{
                    backdropFilter: "blur(20px) saturate(180%)",
                    WebkitBackdropFilter: "blur(20px) saturate(180%)",
                  }}
                >
                  <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input area */}
        <div className="border-t border-white/20 bg-white/10 backdrop-blur-sm px-4 py-4 md:px-6 lg:px-8">
          <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
            <div className="flex items-center gap-2 md:gap-4 rounded-full border border-gray-200 bg-white/95 backdrop-blur-sm px-4 md:px-6 py-3 shadow-lg">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                placeholder="Type your message..."
                disabled={isLoading}
                className="flex-1 bg-transparent text-gray-700 text-base md:text-lg placeholder:text-gray-400 focus:outline-none disabled:opacity-50"
                aria-label="Chat message"
              />
              <button
                type="submit"
                disabled={isLoading || !message.trim()}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Send message"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <ArrowUp className="h-5 w-5" />
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative min-h-screen w-full overflow-hidden"
      style={backgroundStyle}
    >
      <div className="absolute inset-0 pointer-events-none" />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-[1200px] text-center">
  <div className="flex flex-wrap items-center justify-center gap-3 md:gap-4 text-4xl md:text-5xl font-semibold text-gray-900 leading-tight mb-12 md:mb-20">
    <span>Let's build!</span>
  </div>

  <form
    onSubmit={handleSubmit}
    className="mx-auto w-full max-w-5xl mt-16 md:mt-24"  
  >
    <div
      className="w-full rounded-full border border-[#f0ebe3] bg-white/95 backdrop-blur-sm 
                 px-6 md:px-8 py-5 md:py-6 flex items-center gap-4
                 shadow-xl"   
      style={{
        boxShadow: "0 20px 60px rgba(0, 0, 0, 0.15)",
        minHeight: "120px",
      }}
    >
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
          }
        }}
        placeholder="Type what to build..."
        className="flex-1 bg-transparent text-left text-gray-700 text-lg md:text-xl placeholder:text-[#666] focus:outline-none"
        aria-label="Chat prompt"
      />
      <button
        type="submit"
        className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        aria-label="Send message"
      >
        <ArrowUp className="h-5 w-5" />
      </button>
    </div>
  </form>
</div>
      </div>
    </div>
  );
}
