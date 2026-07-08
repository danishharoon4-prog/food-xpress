import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useMotionPreference } from "@/hooks/useMotionPreference";

/**
 * Global scroll-reveal: watches DOM for [data-reveal] elements and
 * toggles `.is-visible` when they enter the viewport.
 *
 * Performance tactics:
 *  - Single IntersectionObserver instance for the whole app
 *  - MutationObserver updates are DEBOUNCED (trailing-edge, ~120ms)
 *  - Scans run in BATCHES via requestIdleCallback (rAF fallback) so
 *    heavy pages don't jank the main thread
 *  - Only element additions/removals trigger a rescan — we ignore
 *    attribute-only mutations, text changes, and our own class writes
 *  - Reveals are applied in a batched rAF so multiple intersecting
 *    elements share a single style/layout flush
 */
export function ScrollReveal() {
  const location = useLocation();
  const { motionEnabled, reduceMotion } = useMotionPreference();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (typeof IntersectionObserver === "undefined") return;

    const osReduce =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    // Motion disabled → reveal everything in one batched pass, no observers
    if (!motionEnabled || reduceMotion || osReduce) {
      const all = document.querySelectorAll<HTMLElement>(
        "[data-reveal]:not(.is-visible)"
      );
      if (all.length) {
        requestAnimationFrame(() => {
          all.forEach((el) => el.classList.add("is-visible"));
        });
      }
      return;
    }

    // ---------- batched reveal writes ----------
    const pendingReveal = new Set<Element>();
    let revealRaf = 0;
    const flushReveals = () => {
      revealRaf = 0;
      pendingReveal.forEach((el) => el.classList.add("is-visible"));
      pendingReveal.clear();
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            pendingReveal.add(entry.target);
            io.unobserve(entry.target);
          }
        }
        if (pendingReveal.size && !revealRaf) {
          revealRaf = requestAnimationFrame(flushReveals);
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );

    // ---------- batched scans (idle callback + WeakSet dedupe) ----------
    const observed = new WeakSet<Element>();
    const idle: (cb: () => void) => number =
      (window as any).requestIdleCallback?.bind(window) ??
      ((cb: () => void) => window.setTimeout(cb, 1) as unknown as number);
    const cancelIdle: (id: number) => void =
      (window as any).cancelIdleCallback?.bind(window) ??
      ((id: number) => window.clearTimeout(id));

    let scanHandle = 0;
    const scan = () => {
      scanHandle = 0;
      const targets = document.querySelectorAll<HTMLElement>(
        "[data-reveal]:not(.is-visible)"
      );
      // Small pages: one pass. Large pages: chunk to keep the main thread free.
      const CHUNK = 40;
      let i = 0;
      const processChunk = () => {
        const end = Math.min(i + CHUNK, targets.length);
        for (; i < end; i++) {
          const el = targets[i];
          if (!observed.has(el)) {
            observed.add(el);
            io.observe(el);
          }
        }
        if (i < targets.length) idle(processChunk);
      };
      processChunk();
    };
    const scheduleScan = () => {
      if (scanHandle) return;
      scanHandle = idle(scan) as number;
    };

    // ---------- debounced mutation handling ----------
    let debounceTimer = 0;
    const DEBOUNCE_MS = 120;

    const mo = new MutationObserver((mutations) => {
      // Only care about actual node additions — ignore class/attr thrash
      // (importantly, our own `.is-visible` writes above).
      let relevant = false;
      for (const m of mutations) {
        if (m.type === "childList" && m.addedNodes.length > 0) {
          for (const n of m.addedNodes) {
            if (n.nodeType === 1) {
              relevant = true;
              break;
            }
          }
        }
        if (relevant) break;
      }
      if (!relevant) return;

      if (debounceTimer) window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(scheduleScan, DEBOUNCE_MS);
    });

    // Initial scan on next frame (after route content mounts)
    const initialRaf = requestAnimationFrame(scheduleScan);

    mo.observe(document.body, {
      childList: true,
      subtree: true,
      // Explicitly no attributes/characterData — cheaper + avoids feedback loops
      attributes: false,
      characterData: false,
    });

    return () => {
      cancelAnimationFrame(initialRaf);
      if (scanHandle) cancelIdle(scanHandle);
      if (revealRaf) cancelAnimationFrame(revealRaf);
      if (debounceTimer) window.clearTimeout(debounceTimer);
      mo.disconnect();
      io.disconnect();
      pendingReveal.clear();
    };
  }, [location.pathname, motionEnabled, reduceMotion]);

  return null;
}
