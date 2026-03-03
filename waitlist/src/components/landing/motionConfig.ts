export type MotionLevel = 'balanced' | 'reduced';

export const LANDING_EASE = [0.25, 0.46, 0.45, 0.94] as const;

export const sectionVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: LANDING_EASE },
  },
};

export const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.1 },
  },
};

export const staggerItem = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: LANDING_EASE },
  },
};

export const HERO_MAX_TOKENS = {
  mobile: 0,
  md: 6,
  lg: 10,
};

export const HERO_MAX_INFINITE_ANIMATIONS = 13;
