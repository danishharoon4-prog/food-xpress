import { useLocation } from "react-router-dom";
import { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useMotionPreference } from "@/hooks/useMotionPreference";

export function PageTransition({ children }: { children: ReactNode }) {
  const location = useLocation();
  const osReduce = useReducedMotion();
  const { motionEnabled, reduceMotion } = useMotionPreference();

  // Kill switch — render children with no motion wrapper at all
  if (!motionEnabled) {
    return <>{children}</>;
  }

  const reduce = osReduce || reduceMotion;

  const variants = reduce
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
      }
    : {
        initial: { opacity: 0, y: 12, filter: "blur(6px)" as any },
        animate: { opacity: 1, y: 0, filter: "blur(0px)" as any },
        exit: { opacity: 0, y: -8, filter: "blur(6px)" as any },
      };

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial="initial"
        animate="animate"
        exit="exit"
        variants={variants}
        transition={{ duration: reduce ? 0.15 : 0.35, ease: [0.22, 1, 0.36, 1] }}
        style={{ willChange: "opacity, transform" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
