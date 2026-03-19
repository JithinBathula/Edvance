import React, { useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { cn } from "./ui/utils";
import octopusUrl from "../assets/octopus.svg";
import { ArrowDown, ArrowUp, BookOpen, Check } from "lucide-react";

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

  useEffect(() => {
    if (count === 0) return;
    if (active < 0) onActiveChange(0);
    if (active > count - 1) onActiveChange(count - 1);
  }, [active, count, onActiveChange]);

  useEffect(() => {
    if (count === 0) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || target?.isContentEditable) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        onActiveChange(Math.min(active + 1, count - 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        onActiveChange(Math.max(active - 1, 0));
      }
      if (e.key === "Home") onActiveChange(0);
      if (e.key === "End") onActiveChange(count - 1);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [active, count, onActiveChange]);

  const node = useMemo(() => {
    const wrap = 34;
    const glow = 50;
    const ring = 32;
    const ringStroke = 2;
    const icon = 25;
    return { wrap, glow, ring, ringStroke, icon };
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
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold flex items-center gap-2 text-slate-700">
            <BookOpen className="w-5 h-5 text-teal-600" />
                Learning Milestones
        </h3>

      <div className="ml-auto flex items-center gap-2 rounded-xl border border-emerald-200 bg-teal-800/10 px-3 py-1.5 w-fit">
        <span className="text-xs font-medium text-emerald-600">Read through with</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onActiveChange(Math.max(active - 1, 0))}
            disabled={active === 0}
            className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-border bg-background text-foreground shadow-sm transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-30"
            title="Previous milestone (↑ or W)"
          >
            <ArrowUp className="h-3 w-3" strokeWidth={2.5} />
          </button>
          <button
            type="button"
            onClick={() => onActiveChange(Math.min(active + 1, count - 1))}
            disabled={active === count - 1}
            className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-border bg-background text-foreground shadow-sm transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-30"
            title="Next milestone (↓ or S)"
          >
            <ArrowDown className="h-3 w-3" strokeWidth={2.5} />
          </button>
        </div>
        <span className="text-xs font-medium text-emerald-600">or mouse click</span>
      </div>
      </div>

      <div className="space-y-3">
        {items.map((milestone, index) => {
          const isActive = index === active;
          const isDone = index < active;

          return (
            <button
              key={index}
              type="button"
              onClick={() => onActiveChange(index)}
              className="w-full text-left transition-transform active:scale-[0.99]"
            >
              {/* Outer milestone card container (state-driven border/background) */}
              <div
              className={cn(
                "relative min-w-0 w-full z-0 rounded-xl transition-all shadow-sm",
                isActive
                  ? "border border-amber-400 ring-4 ring-amber-100"
                  : isDone
                    ? "border border-amber-400 shadow-sm shadow-amber-50"
                    : "border border-gray-200"
              )}
            >

                {/* Inner text panel surface (keeps readable content background) */}
                <div
                  className={cn(
                    "w-full rounded-xl z-10 px-4 py-3 transition-all",
                    isActive
                      ? "bg-white/80 backdrop-blur-sm"
                      : isDone
                        ? "bg-amber-600/70"
                        : "bg-white/55 hover:bg-gray-50"
                  )}
                >
                  {/* Horizontal row: milestone icon, text, completion indicator */}
                  <div className="flex items-start gap-6">
                    {/* Left icon lane (number ring or active octopus icon) */}
                    <div className="relative mt-0.5 shrink-0" style={{ width: node.wrap, height: node.wrap }}>
                      {/* Soft glow behind circular icon node */}
                      <div
                        className="absolute left-1/2 top-1/2 rounded-full"
                        style={{
                          width: node.glow,
                          height: node.glow,
                          transform: "translate(-50%, -50%)",
                          background: isActive
                            ? "var(--color-amber-100)"
                            : isDone
                              ? "var(--color-amber-100)"
                              : "rgba(0,0,0,0.04)",
                        }}
                      />

                      {/* Circular node ring (shows step index when not active) */}
                      <div
                        className="absolute left-1/2 top-1/2 flex items-center justify-center rounded-full bg-white"
                        style={{
                          width: node.ring,
                          height: node.ring,
                          transform: "translate(-50%, -50%)",
                          borderWidth: node.ringStroke,
                          borderStyle: "solid",
                          borderColor: isActive
                            ? "var(--color-amber-500)"
                            : isDone
                              ? "var(--color-amber-500)"
                              : "var(--color-gray-300)",
                          boxShadow: "0 1px 0 rgba(0,0,0,0.03)",
                        }}
                      >
                        {!isActive && (
                          <span className="text-sm font-semibold text-gray-700">{index + 1}</span>
                        )}
                      </div>

                      {/* Active-state mascot icon overlay */}
                      {isActive && (
                        <motion.img
                          src={octopusUrl}
                          alt=""
                          aria-hidden="true"
                          className="absolute left-1/6 top-1/6"
                          style={{
                            width: node.icon,
                            height: node.icon,
                            transform: "translate(-50%, -50%)",
                          }}
                          initial={{ scale: 0.9, rotate: -6 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{ type: "spring", stiffness: 380, damping: 26 }}
                        />
                      )}
                    </div>

                    {/* Main text content lane (title + description) */}
                    <div className="min-w-0 flex-1">
                      {/* Milestone title */}
                      <div
                        className={cn(
                          "mt-0.5 text-base font-semibold leading-snug",
                          isActive ? "text-amber-700" : isDone ? "text-white" : "text-gray-700"
                        )}
                      >
                        {milestone.subheading_title}
                      </div>

                      {/* Milestone description */}
                      <div
                        className={cn(
                          "mt-1 text-sm leading-relaxed",
                          isActive ? "text-gray-700" : isDone ? "text-white" : "text-gray-500"
                        )}
                      >
                        {milestone.description}
                      </div>
                    </div>
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
