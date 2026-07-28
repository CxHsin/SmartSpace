import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';

export const springs = {
  snappy: { type: 'spring', stiffness: 400, damping: 28, mass: 0.8 },
  smooth: { type: 'spring', stiffness: 220, damping: 24, mass: 1 },
} as const;

interface RevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

// Adapted from Amicro's MIT-licensed FadeUp transition.
export function Reveal({ children, className, delay = 0 }: RevealProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

