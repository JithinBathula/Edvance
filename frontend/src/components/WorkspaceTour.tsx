import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import codyUrl from '../assets/cody.svg';

type TourStep = {
  target: string;
  title: string;
  description: string;
  popoverPosition: 'right' | 'left' | 'below' | 'above';
};

const STEPS: TourStep[] = [
  {
    target: 'task-description',
    title: 'Your Task',
    description: 'Each task gives you a clear goal with step-by-step instructions. Read through it carefully before you start coding!',
    popoverPosition: 'right',
  },
  {
    target: 'code-editor',
    title: 'Code Editor',
    description: 'This is where you write your code. It works just like a real IDE with syntax highlighting and auto-complete.',
    popoverPosition: 'left',
  },
  {
    target: 'file-explorer-toggle',
    title: 'File Explorer',
    description: 'This is where you manage your project files. You can create new files, rename, or delete them.',
    popoverPosition: 'right',
  },
  {
    target: 'run-button',
    title: 'Run Your Code',
    description: 'Hit this button to run your code and see the output instantly. Test often as you build!',
    popoverPosition: 'below',
  },
  {
    target: 'complete-button',
    title: 'Submit Your Work',
    description: "When you're done with a task, click here to submit. Your code will be checked and you'll get feedback.",
    popoverPosition: 'right',
  },
  {
    target: 'chat-button',
    title: 'Meet Cody',
    description: "Stuck on something? Cody is your AI tutor — ask questions, get hints, or have code explained. He's always here to help!",
    popoverPosition: 'above',
  },
];

type SpotlightRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

type WorkspaceTourProps = {
  isOpen: boolean;
  onComplete: () => void;
  onSkip: () => void;
  onEnsureChatClosed: () => void;
};

export function WorkspaceTour({ isOpen, onComplete, onSkip, onEnsureChatClosed }: WorkspaceTourProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<SpotlightRect | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const step = STEPS[stepIndex];

  const getTargetElement = useCallback((target: string): Element | null => {
    if (target === 'code-editor') {
      return document.querySelector('.ide-container');
    }
    // File explorer: try toggle button first, fall back to open sidebar
    if (target === 'file-explorer-toggle') {
      return (
        document.querySelector('[data-tour="file-explorer-toggle"]') ||
        document.querySelector('[data-tour="file-explorer"]')
      );
    }
    return document.querySelector(`[data-tour="${target}"]`);
  }, []);

  const measureRect = useCallback((el: Element) => {
    const r = el.getBoundingClientRect();
    const padding = 6;
    setRect({
      top: r.top - padding,
      left: r.left - padding,
      width: r.width + padding * 2,
      height: r.height + padding * 2,
    });
  }, []);

  const updateRect = useCallback(() => {
    const el = getTargetElement(step.target);
    if (!el) {
      setRect(null);
      return;
    }

    // Find nearest scrollable ancestor and scroll element into view if needed
    const scrollParent = findScrollParent(el);
    if (scrollParent) {
      const parentRect = scrollParent.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const isOutOfView =
        elRect.bottom > parentRect.bottom ||
        elRect.top < parentRect.top;

      if (isOutOfView) {
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        // Wait for scroll to settle, then measure
        setTimeout(() => measureRect(el), 350);
        return;
      }
    }

    measureRect(el);
  }, [step.target, getTargetElement, measureRect]);

  // Update rect on step change
  useEffect(() => {
    if (!isOpen) return;

    // For the chat button step, ensure chat is closed first
    if (step.target === 'chat-button') {
      onEnsureChatClosed();
      // Wait a frame for the floating button to render
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          updateRect();
        });
      });
    } else {
      updateRect();
    }
  }, [isOpen, stepIndex, step.target, updateRect, onEnsureChatClosed]);

  // ResizeObserver for panel resizes
  useEffect(() => {
    if (!isOpen) return;

    const panelGroup = document.querySelector('[data-panel-group]');
    if (!panelGroup) return;

    observerRef.current = new ResizeObserver(() => {
      updateRect();
    });
    observerRef.current.observe(panelGroup);

    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, [isOpen, updateRect]);

  // Window resize listener
  useEffect(() => {
    if (!isOpen) return;

    let timeout: ReturnType<typeof setTimeout>;
    const handleResize = () => {
      clearTimeout(timeout);
      timeout = setTimeout(updateRect, 100);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeout);
    };
  }, [isOpen, updateRect]);

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSkip();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onSkip]);

  const handleNext = useCallback(() => {
    if (stepIndex < STEPS.length - 1) {
      // Find next valid step
      let next = stepIndex + 1;
      while (next < STEPS.length) {
        const el = getTargetElement(STEPS[next].target);
        if (el) break;
        next++;
      }
      if (next < STEPS.length) {
        setStepIndex(next);
      } else {
        onComplete();
      }
    } else {
      onComplete();
    }
  }, [stepIndex, onComplete, getTargetElement]);

  const handleBack = useCallback(() => {
    if (stepIndex > 0) {
      setStepIndex(stepIndex - 1);
    }
  }, [stepIndex]);

  // If element not found after rect update, skip
  useEffect(() => {
    if (!isOpen || rect !== null) return;

    // Give a brief moment for the element to appear
    const timer = setTimeout(() => {
      const el = getTargetElement(step.target);
      if (!el) {
        handleNext();
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [isOpen, rect, step.target, handleNext, getTargetElement]);

  if (!isOpen || !rect) return null;

  // Calculate popover position
  const popoverStyle = getPopoverStyle(rect, step.popoverPosition, popoverRef.current);

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9999 }}
      onClick={(e) => {
        // Only close if clicking the dark overlay itself, not the popover
        if (e.target === e.currentTarget) return;
      }}
    >
      {/* Spotlight overlay */}
      <motion.div
        animate={{
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        style={{
          position: 'fixed',
          borderRadius: 12,
          boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)',
          pointerEvents: 'none',
          zIndex: 9999,
        }}
      />

      {/* Popover */}
      <AnimatePresence mode="wait">
        <motion.div
          key={stepIndex}
          ref={popoverRef}
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          style={{
            position: 'fixed',
            zIndex: 10000,
            ...popoverStyle,
          }}
          className="w-[300px]"
        >
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 p-5 relative">
            {/* Mascot */}
            <div className="flex items-start gap-3 mb-3">
              <motion.img
                src={codyUrl}
                alt="Cody"
                className="w-12 h-12 shrink-0"
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              />
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-gray-900">{step.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed mt-1">{step.description}</p>
              </div>
            </div>

            {/* Step indicator */}
            <div className="flex items-center justify-between mt-4">
              <div className="flex items-center gap-1.5">
                {STEPS.map((_, i) => (
                  <div
                    key={i}
                    className={`w-1.5 h-1.5 rounded-full transition-colors ${
                      i === stepIndex ? 'bg-teal-500' : i < stepIndex ? 'bg-teal-300' : 'bg-gray-300'
                    }`}
                  />
                ))}
                <span className="text-xs text-gray-400 ml-1.5">
                  {stepIndex + 1} of {STEPS.length}
                </span>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-between mt-4">
              <button
                onClick={onSkip}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                Skip Tour
              </button>
              <div className="flex items-center gap-2">
                {stepIndex > 0 && (
                  <button
                    onClick={handleBack}
                    className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Back
                  </button>
                )}
                <button
                  onClick={handleNext}
                  className="px-4 py-1.5 text-sm font-medium text-white rounded-lg transition-colors"
                  style={{ backgroundColor: '#0d9488' }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#0f766e')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#0d9488')}
                >
                  {stepIndex === STEPS.length - 1 ? 'Got it!' : 'Next'}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>,
    document.body
  );
}

function findScrollParent(el: Element): Element | null {
  let node = el.parentElement;
  while (node) {
    const style = window.getComputedStyle(node);
    const overflowY = style.overflowY;
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

function getPopoverStyle(
  rect: SpotlightRect,
  position: TourStep['popoverPosition'],
  popoverEl: HTMLDivElement | null
): React.CSSProperties {
  const gap = 16;
  const popoverW = 300;
  // Estimate height if we can't measure yet
  const popoverH = popoverEl?.offsetHeight || 200;
  const margin = 12;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let top: number;
  let left: number;

  switch (position) {
    case 'right':
      top = rect.top;
      left = rect.left + rect.width + gap;
      // If overflowing right, flip to left
      if (left + popoverW + margin > vw) {
        left = rect.left - popoverW - gap;
      }
      break;
    case 'left':
      top = rect.top;
      left = rect.left - popoverW - gap;
      // If overflowing left, flip to right
      if (left < margin) {
        left = rect.left + rect.width + gap;
      }
      break;
    case 'below':
      top = rect.top + rect.height + gap;
      left = rect.left + rect.width / 2 - popoverW / 2;
      // If overflowing bottom, flip to above
      if (top + popoverH + margin > vh) {
        top = rect.top - gap - popoverH;
      }
      break;
    case 'above':
      top = rect.top - gap - popoverH;
      left = rect.left + rect.width / 2 - popoverW / 2;
      // If overflowing top, flip to left of target
      if (top < margin) {
        top = rect.top;
        left = rect.left - popoverW - gap;
      }
      break;
  }

  // Clamp horizontally
  left = Math.max(margin, Math.min(left, vw - popoverW - margin));
  // Clamp vertically
  top = Math.max(margin, Math.min(top, vh - popoverH - margin));

  return { top, left };
}
