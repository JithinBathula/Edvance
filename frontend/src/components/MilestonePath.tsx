import React, { useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { cn } from "./ui/utils";
import octopusUrl from "../assets/octopus.svg";

type Milestone = { subheading_title: string; description: string };

export function MilestonePlannerList({
  milestones,
  active,
  onActiveChange,
  className,
}: {
  milestones: Milestone[];
  active: number;
  onActiveChange: (i: number) => void;
  className?: string;
}) {
  const items = Array.isArray(milestones) ? milestones : [];
  const count = items.length;

  // Clamp active from parent (only if parent passes something out of range)
  useEffect(() => {
    if (count === 0) return;
    if (active < 0) onActiveChange(0);
    if (active > count - 1) onActiveChange(count - 1);
  }, [active, count, onActiveChange]);

  // Keyboard navigation (controlled)
  useEffect(() => {
    if (count === 0) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || target?.isContentEditable) return;

      if (e.key === "ArrowDown" || e.key === "j" || e.key === "s") {
        e.preventDefault();
        onActiveChange(Math.min(active + 1, count - 1));
      }
      if (e.key === "ArrowUp" || e.key === "k" || e.key === "w") {
        e.preventDefault();
        onActiveChange(Math.max(active - 1, 0));
      }
      if (e.key === "Home") onActiveChange(0);
      if (e.key === "End") onActiveChange(count - 1);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [active, count, onActiveChange]);

  const Node = useMemo(() => {
    const wrap = 60;
    const glow = 70;
    const ring = 50;
    const ringStroke = 6;
    return { wrap, glow, ring, ringStroke };
  }, []);

  if (count === 0) {
    return (
      <div className={cn("rounded-xl border bg-white p-6", className)}>
        <p className="text-gray-600">No milestones to display.</p>
      </div>
    );
  }

  return (
    <div className={cn("w-full", className)}>
      <div className="mb-3 text-sm text-gray-600">
        Use <span className="font-semibold">↑/↓</span> (or{" "}
        <span className="font-semibold">W/S</span>) to move.
      </div>

      <div className="space-y-3">
        {items.map((m, i) => {
          const isActive = i === active;
          const isDone = i < active;

          return (
            <button
              key={i}
              type="button"
              onClick={() => onActiveChange(i)}
              className={cn(
                "w-full text-left",
                "flex items-start gap-4",
                "transition-transform active:scale-[0.99]"
              )}
            >
              {/* Node column */}
              <div className="relative shrink-0 mt-1" style={{ width: Node.wrap, height: Node.wrap }}>
                {/* glow */}
                <div
                  className="absolute left-1/2 top-1/2 rounded-full"
                  style={{
                    width: Node.glow,
                    height: Node.glow,
                    transform: "translate(-50%, -50%)",
                    background: isActive ? "var(--color-amber-50)" : isDone ? "var(--color-amber-50)" : "rgba(0,0,0,0.05)",
                  }}
                />

                {/* Ring */}
                <div
                  className="absolute left-1/2 top-1/2 rounded-full bg-white flex items-center justify-center"
                  style={{
                    width: Node.ring,
                    height: Node.ring,
                    transform: "translate(-50%, -50%)",
                    borderWidth: Node.ringStroke,
                    borderStyle: "solid",
                    borderColor: isActive
                      ? "var(--color-amber-500)"
                      : isDone
                      ? "var(--color-amber-500)"
                      : "var(--color-gray-300)",
                    boxShadow: "0 1px 0 rgba(0,0,0,0.03)",
                  }}
                >
                  {/* number shows when NOT active */}
                  {!isActive && (
                    <span className="text-lg font-semibold text-gray-900">
                      {i + 1}
                    </span>
                  )}
                </div>

                {/* octopus on active */}
                {isActive && (
                  <motion.img
                    src={octopusUrl}
                    alt=""
                    aria-hidden="true"
                    className="absolute left-1/4 top-1/4"
                    style={{
                      width: 35,
                      height: 35,
                      transform: "translate(-50%, -50%)",
                    }}
                    initial={{ scale: 0.9, rotate: -6 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 380, damping: 26 }}
                  />
                )}
              </div>

            {/* TEXT CARD */}
            <div
            className={cn(
                "min-w-0 flex-1 rounded-2xl transition-all relative overflow-hidden",
                isActive && "gradient-border-active"
            )} 
            >
            {/* Inner glow overlay */}
            {isActive && (
                <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-white/15 pointer-events-none z-[1]" />
            )}
            
            <div
                className={cn(
                "w-full h-full px-4 py-3 transition-all relative z-10",
                isActive 
                    ? "bg-white rounded-xl border-2"
                    : isDone
                    ? "bg-amber-400 rounded-2xl"
                    : "bg-gray-50/80 border-2 border-gray-200 rounded-2xl"
                )}
            >
                <div
                className={cn(
                    "mt-1 text-lg font-semibold leading-snug",
                    isActive 
                    ? "bg-gradient-to-r from-amber-700 to-amber-300 bg-clip-text text-2xl-strong text-amber-700"
                    : isDone 
                    ? "text-white" 
                    : "text-gray-500"
                )}
                >
                {m.subheading_title}
                </div>
                <div
                className={cn(
                    "mt-1 text-sm leading-relaxed",
                    isActive 
                    ? "text-gray-700"
                    : isDone 
                    ? "text-white" 
                    : "text-gray-400"
                )}
                >
                {m.description}
                </div>
            </div>
            </div>
                        </button>
                    );
                    })}
                </div>
                </div>
            );
            }

