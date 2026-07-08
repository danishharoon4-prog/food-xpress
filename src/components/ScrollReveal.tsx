import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useMotionPreference } from "@/hooks/useMotionPreference";

/**
 * Global scroll-reveal: watches DOM for [data-reveal] elements and
 * toggles `.is-visible` when they enter the viewport. Re-scans on
 * every route change so newly-mounted pages animate correctly.
 */
export function ScrollReveal() {
  const location = useLocation();
  const { motionEnabled, reduceMotion } = useMotionPreference();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (typeof IntersectionObserver === "undefined") return;

    const osReduce =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    // If user disabled motion or reduced-motion is active, just reveal everything now
    if (!motionEnabled || reduceMotion || osReduce) {
      document
        .querySelectorAll<HTMLElement>("[data-reveal]:not(.is-visible)")
        .forEach((el) => el.classList.add("is-visible"));
      return;
    }


    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );

    const scan = () => {
      const targets = document.querySelectorAll<HTMLElement>(
        "[data-reveal]:not(.is-visible)"
      );
      targets.forEach((el) => io.observe(el));
    };

    // Initial scan (next frame so route content is mounted)
    const raf = requestAnimationFrame(scan);

    // Observe DOM changes to catch async content
    const mo = new MutationObserver(() => scan());
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      cancelAnimationFrame(raf);
      mo.disconnect();
      io.disconnect();
    };
  }, [location.pathname, motionEnabled, reduceMotion]);

  return null;
}
