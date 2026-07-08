import { useEffect, useState, useCallback } from "react";

/**
 * User-controlled motion preferences.
 *  - motionEnabled=false  → disables ALL app animations/transitions
 *  - reduceMotion=true    → forces reduced-motion behavior (like OS setting)
 *
 * Both preferences are persisted in localStorage and applied as classes
 * on <html> so plain CSS can react instantly, everywhere.
 */

const ENABLED_KEY = "app-motion-enabled";
const REDUCE_KEY = "app-motion-reduce";

const readBool = (key: string, fallback: boolean): boolean => {
  if (typeof window === "undefined") return fallback;
  const v = window.localStorage.getItem(key);
  if (v === null) return fallback;
  return v === "1" || v === "true";
};

const applyClasses = (enabled: boolean, reduce: boolean) => {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("motion-off", !enabled);
  root.classList.toggle("motion-reduce", reduce);
};

// Cross-tab sync via storage event
const listeners = new Set<() => void>();
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === ENABLED_KEY || e.key === REDUCE_KEY) {
      listeners.forEach((l) => l());
    }
  });
}

export function useMotionPreference() {
  const [motionEnabled, setMotionEnabledState] = useState(() =>
    readBool(ENABLED_KEY, true)
  );
  const [reduceMotion, setReduceMotionState] = useState(() =>
    readBool(REDUCE_KEY, false)
  );

  // Apply classes whenever state changes
  useEffect(() => {
    applyClasses(motionEnabled, reduceMotion);
  }, [motionEnabled, reduceMotion]);

  // Subscribe to cross-tab changes
  useEffect(() => {
    const sync = () => {
      setMotionEnabledState(readBool(ENABLED_KEY, true));
      setReduceMotionState(readBool(REDUCE_KEY, false));
    };
    listeners.add(sync);
    return () => {
      listeners.delete(sync);
    };
  }, []);

  const setMotionEnabled = useCallback((v: boolean) => {
    window.localStorage.setItem(ENABLED_KEY, v ? "1" : "0");
    setMotionEnabledState(v);
  }, []);

  const setReduceMotion = useCallback((v: boolean) => {
    window.localStorage.setItem(REDUCE_KEY, v ? "1" : "0");
    setReduceMotionState(v);
  }, []);

  return { motionEnabled, reduceMotion, setMotionEnabled, setReduceMotion };
}

/**
 * One-time initializer so classes are applied before React mounts
 * (prevents a flash of animation for users who disabled it).
 */
export function initMotionPreference() {
  applyClasses(readBool(ENABLED_KEY, true), readBool(REDUCE_KEY, false));
}
