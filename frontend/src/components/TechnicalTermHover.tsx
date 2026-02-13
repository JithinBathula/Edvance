import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from "./ui/hover-card";
import { BookOpen, MessageCircle } from "lucide-react";

type Props = {
  term: string;
  definition: string;
  children: React.ReactNode;
  onAskTutor?: (term: string) => void;
};

export function TechnicalTermHover({
  term,
  definition,
  children,
  onAskTutor,
}: Props) {
  return (
    <HoverCard openDelay={300} closeDelay={200}>
      <HoverCardTrigger asChild>
        <span
          className="cursor-help"
          style={{
            backgroundColor: "#fef3c7",
            color: "#92400e",
            padding: "1px 5px",
            borderRadius: "4px",
            borderBottom: "2px solid #f59e0b",
            fontWeight: 500,
          }}
        >
          {children}
        </span>
      </HoverCardTrigger>
      <HoverCardContent
        className="w-auto p-0 bg-white shadow-xl border border-amber-200 rounded-xl"
        style={{ maxWidth: "320px" }}
        side="top"
        align="center"
      >
        <div className="bg-gradient-to-r from-amber-50 to-yellow-50 px-4 py-3 border-b border-amber-100">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center">
              <BookOpen className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <span className="font-semibold text-sm text-amber-900">{term}</span>
          </div>
        </div>
        <div className="px-4 py-3">
          <p className="text-sm leading-relaxed break-words" style={{ color: "#4b5563" }}>{definition}</p>
        </div>
        {onAskTutor && (
          <div className="flex justify-center px-4 pb-4">
            <button
              onClick={() => onAskTutor(term)}
              className="flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-lg transition-all hover:shadow-md"
              style={{ color: "#4f46e5", background: "#f3f4f6", border: "1px solid #e5e7eb" }}
            >
              <MessageCircle className="w-3.5 h-3.5" />
              Ask Cody
            </button>
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}
