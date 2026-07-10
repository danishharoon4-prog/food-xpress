import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useNavPrefs } from './useNavPrefs';

/**
 * Enables horizontal swipe navigation between the given ordered paths.
 * Swipe left  → next path
 * Swipe right → previous path
 * Only active on touch devices (mobile).
 */
export function useSwipeNav(paths: string[]) {
  const navigate = useNavigate();
  const location = useLocation();
  const { prefs } = useNavPrefs();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!prefs.swipeEnabled) return;
    if (!('ontouchstart' in window)) return;

    // Edge zone width (px) — swipes starting here use a reduced threshold
    const EDGE_ZONE = 28;
    const EDGE_THRESHOLD = 24; // very small: edge-swipe fires even from middle-ish release

    let startX = 0;
    let startY = 0;
    let startT = 0;
    let tracking = false;
    let fromLeftEdge = false;
    let fromRightEdge = false;

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const target = e.target as HTMLElement | null;
      // Ignore swipes originating on interactive/scrollable widgets
      if (target?.closest('input, textarea, select, [role="slider"], [data-no-swipe], .no-swipe')) {
        tracking = false;
        return;
      }
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      startT = Date.now();
      tracking = true;
      const w = window.innerWidth;
      fromLeftEdge = startX <= EDGE_ZONE;
      fromRightEdge = startX >= w - EDGE_ZONE;
    };

    const onEnd = (e: TouchEvent) => {
      if (!tracking) return;
      tracking = false;
      const t = e.changedTouches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      const dt = Date.now() - startT;
      if (dt > 800) return;

      const edgeSwipe = (fromLeftEdge && dx > 0) || (fromRightEdge && dx < 0);
      const threshold = edgeSwipe ? EDGE_THRESHOLD : prefs.swipeThreshold;
      const verticalRatio = edgeSwipe ? 1.2 : 0.6; // edge swipes tolerate more vertical drift

      if (Math.abs(dx) < threshold) return;
      if (Math.abs(dy) > Math.abs(dx) * verticalRatio) return;

      const idx = paths.indexOf(location.pathname);
      if (idx === -1) return;
      if (dx < 0 && idx < paths.length - 1) navigate(paths[idx + 1]);
      else if (dx > 0 && idx > 0) navigate(paths[idx - 1]);
    };


    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchend', onEnd);
    };
  }, [paths, location.pathname, navigate, prefs.swipeEnabled, prefs.swipeThreshold]);
}
