import { useLocation } from "react-router-dom";
import { ReactNode } from "react";
import { useMotionPreference } from "@/hooks/useMotionPreference";
import { useNavPrefs } from "@/hooks/useNavPrefs";

// Plain CSS fade keyed by route. AnimatePresence mode="wait" combined with
// lazy (Suspense) routes left the new page stuck invisible on first open in
// the mobile app, so no exit-animation gating is used here.
export function PageTransition({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { motionEnabled, reduceMotion } = useMotionPreference();
  const { prefs } = useNavPrefs();

  if (!motionEnabled) return <>{children}</>;

  const duration = (reduceMotion ? 0.15 : 0.25) * prefs.animationSpeed;
  return (
    <div key={location.pathname} className="fx-page-fade" style={{ animationDuration: `${duration}s` }}>
      {children}
    </div>
  );
}
