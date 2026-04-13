'use client';

import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useRef } from 'react';

const variants = {
  initial: { opacity: 0, y: 12 },
  enter: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.15, ease: 'easeIn' } },
};

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const key = useRef(pathname);

  // Update key only when pathname actually changes
  if (pathname !== key.current) {
    key.current = pathname;
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={key.current}
        variants={variants}
        initial="initial"
        animate="enter"
        exit="exit"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
