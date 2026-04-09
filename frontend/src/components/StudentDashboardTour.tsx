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
    target: 'dashboard-create-project',
    title: 'Create A New Project',
    description: 'Start here whenever you want to build something new from scratch with Edvance.',
    popoverPosition: 'below',
  },
  {
    target: 'dashboard-profile-card',
    title: 'Your Profile',
    description: 'This card shows your current level, XP progress, streak, and quick learning stats.',
    popoverPosition: 'left',
  },
  {
    target: 'dashboard-sidebar-top',
    title: 'Main Navigation',
    description: 'Use Home and Classes to move between your dashboard and classroom work.',
    popoverPosition: 'right',
  },
  {
    target: 'dashboard-sidebar-bottom',
    title: 'Settings And Logout',
    description: 'Manage your account in Settings, or sign out from the same spot.',
    popoverPosition: 'right',
  },
  {
    target: 'dashboard-top-stats',
    title: 'Top Stats',
    description: 'These cards give you a quick snapshot of your projects, streak, XP, and overall completion.',
    popoverPosition: 'below',
  },
];

type SpotlightRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

type StudentDashboardTourProps = {
  isOpen: boolean;
  onComplete: () => void;
  onSkip: () => void;
};

export function StudentDashboardTour({ isOpen, onComplete, onSkip }: StudentDashboardTourProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<SpotlightRect | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const step = STEPS[stepIndex];

  const getTargetElement = useCallback((target: string): Element | null => {
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

    const scrollParent = findScrollParent(el);
    if (scrollParent) {
      const parentRect = scrollParent.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const isOutOfView = elRect.bottom > parentRect.bottom || elRect.top < parentRect.top;

      if (isOutOfView) {
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        window.setTimeout(() => measureRect(el), 350);
        return;
      }
    }

    measureRect(el);
  }, [getTargetElement, measureRect, step.target]);

  const handleNext = useCallback(() => {
    if (stepIndex < STEPS.length - 1) {
      let next = stepIndex + 1;
      while (next < STEPS.length) {
        const el = getTargetElement(STEPS[next].target);
        if (el) break;
        next += 1;
      }

      if (next < STEPS.length) {
        setStepIndex(next);
      } else {
        onComplete();
      }
    } else {
      onComplete();
    }
  }, [getTargetElement, onComplete, stepIndex]);

  const handleBack = useCallback(() => {
    if (stepIndex > 0) {
      setStepIndex(stepIndex - 1);
    }
  }, [stepIndex]);

  useEffect(() => {
    if (!isOpen) return;

    let attempts = 0;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const ensureStepTarget = () => {
      const el = getTargetElement(step.target);
      if (el) {
        updateRect();
        return;
      }

      if (attempts >= 15) {
        handleNext();
        return;
      }

      attempts += 1;
      timeoutId = setTimeout(ensureStepTarget, 200);
    };

    ensureStepTarget();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [getTargetElement, handleNext, isOpen, step.target, updateRect]);

  useEffect(() => {
    if (!isOpen) return;

    let timeout: ReturnType<typeof setTimeout>;
    const handleViewportChange = () => {
      clearTimeout(timeout);
      timeout = setTimeout(updateRect, 100);
    };

    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);
    return () => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
      clearTimeout(timeout);
    };
  }, [isOpen, updateRect]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSkip();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onSkip]);

  if (!isOpen || !rect) return null;

  const popoverStyle = getPopoverStyle(rect, step.popoverPosition, popoverRef.current);

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999 }}>
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
      if (left + popoverW + margin > vw) {
        left = rect.left - popoverW - gap;
      }
      break;
    case 'left':
      top = rect.top;
      left = rect.left - popoverW - gap;
      if (left < margin) {
        left = rect.left + rect.width + gap;
      }
      break;
    case 'below':
      top = rect.top + rect.height + gap;
      left = rect.left + rect.width / 2 - popoverW / 2;
      if (top + popoverH + margin > vh) {
        top = rect.top - gap - popoverH;
      }
      break;
    case 'above':
      top = rect.top - gap - popoverH;
      left = rect.left + rect.width / 2 - popoverW / 2;
      if (top < margin) {
        top = rect.top;
        left = rect.left - popoverW - gap;
      }
      break;
  }

  left = Math.max(margin, Math.min(left, vw - popoverW - margin));
  top = Math.max(margin, Math.min(top, vh - popoverH - margin));

  return { top, left };
}
