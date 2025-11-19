import { FormEvent, useMemo, useState } from "react";
import { ArrowUp } from "lucide-react";

type Props = {
  onFirstMessage?: (message: string) => void;
};

export function CustomProjectNew({ onFirstMessage }: Props) {
  const [message, setMessage] = useState("");
  const [hasStarted, setHasStarted] = useState(false);

  const backgroundStyle = useMemo(
    () => ({
      background:
        "radial-gradient(90% 70% at 50% 18%, #ffffff 0%, #f6f8ff 30%, #d7e3ff 55%, #b3c7ff 68%, #ffffff 92%), radial-gradient(120% 120% at 50% 88%, #6f9cff 8%, #7fa6ff 28%, #ffad82 58%, #ff7b70 76%, #ffffff 95%)",
    }),
    []
  );

  const handleSubmit = (event?: FormEvent) => {
    event?.preventDefault();
    const trimmed = message.trim();

    if (!trimmed) return;

    console.log("New CustomProjectNew chat message:", trimmed);
    onFirstMessage?.(trimmed);
    setHasStarted(true);
    setMessage("");
  };

  if (hasStarted) {
    return (
      <div
        className="min-h-screen w-full flex items-center justify-center px-6 text-center"
        style={backgroundStyle}
      >
        <div className="text-gray-700 text-base md:text-lg">
          Chat experience coming soon.
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
