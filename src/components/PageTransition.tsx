import { useLocation } from "react-router-dom";
import { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useMotionPreference } from "@/hooks/useMotionPreference";
import { useNavPrefs } from "@/hooks/useNavPrefs";

export function PageTransition({ children }: { children: ReactNode }) {
  const location = useLocation();
  const osReduce = useReducedMotion();
  const { motionEnabled, reduceMotion } = useMotionPreference();

  // Kill switch — render children with no motion wrapper at all
  if (!motionEnabled) {
    return <>{children}</>;
  }

  const reduce = osReduce || reduceMotion;

  // NOTE: intentionally opacity-only. Using `transform` or `filter` here
  // creates a new containing block, which breaks `position: fixed` for
  // descendants (e.g. mobile bottom navs would scroll with the page).
  const variants = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  };

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial="initial"
        animate="animate"
        exit="exit"
        variants={variants}
        transition={{ duration: reduce ? 0.15 : 0.3, ease: [0.22, 1, 0.36, 1] }}
        style={{ willChange: "opacity" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

