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
    const hasTouch = 'ontouchstart' in window || (navigator.maxTouchPoints ?? 0) > 0;
    if (!hasTouch) return;

    // Edge zone width (px) — swipes starting here use a reduced threshold
    const EDGE_ZONE = 32;
    const EDGE_THRESHOLD = 20;
    const MIN_THRESHOLD = 30;
    const MIN_DURATION_MS = 30;
    const MAX_DURATION_MS = 1500;
    const SCROLL_LOCK_DY = 28;


    let startX = 0;
    let startY = 0;
    let startT = 0;
    let tracking = false;
    let locked = false; // vertical-scroll lock: swipe cancelled for this gesture
    let intentDecided = false; // once horizontal or vertical intent is set, don't flip
    let horizontalIntent = false;
    let fromLeftEdge = false;
    let fromRightEdge = false;

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [role="slider"], [data-no-swipe], .no-swipe')) {
        tracking = false;
        return;
      }
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      startT = Date.now();
      tracking = true;
      locked = false;
      intentDecided = false;
      horizontalIntent = false;
      const w = window.innerWidth;
      fromLeftEdge = startX <= EDGE_ZONE;
      fromRightEdge = startX >= w - EDGE_ZONE;
    };

    const emitHint = (dir: 'left' | 'right' | null, progress: number, label: string | null) => {
      window.dispatchEvent(new CustomEvent('swipe-nav-hint', {
        detail: { dir, progress, label },
      }));
    };

    const getLabel = (offset: number) => {
      const idx = paths.indexOf(location.pathname);
      if (idx === -1) return null;
      const target = idx + offset;
      if (target < 0 || target >= paths.length) return null;
      return paths[target];
    };

    const onMove = (e: TouchEvent) => {
      if (!tracking || locked || e.touches.length !== 1) return;
      const t = e.touches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      const adx = Math.abs(dx);
      const ady = Math.abs(dy);

      // Decide gesture intent as soon as movement is meaningful.
      if (!intentDecided) {
        if (ady >= SCROLL_LOCK_DY && ady > adx * 1.5) {
          locked = true;
          emitHint(null, 0, null);
          return;
        }
        if (adx >= 8 && adx > ady) {
          intentDecided = true;
          horizontalIntent = true;
        } else {
          return;
        }
      }

      if (!horizontalIntent) return;

      const edgeSwipe = (fromLeftEdge && dx > 0) || (fromRightEdge && dx < 0);
      const rawThreshold = edgeSwipe ? EDGE_THRESHOLD : prefs.swipeThreshold;
      const threshold = Math.max(rawThreshold, edgeSwipe ? EDGE_THRESHOLD : MIN_THRESHOLD);
      const dir: 'left' | 'right' = dx < 0 ? 'left' : 'right';
      const label = getLabel(dir === 'left' ? 1 : -1);
      if (!label) { emitHint(null, 0, null); return; }
      const progress = Math.min(1, adx / threshold);
      emitHint(dir, progress, label);
    };

    const onEnd = (e: TouchEvent) => {
      const wasTracking = tracking;
      const wasLocked = locked;
      const wasHorizontal = horizontalIntent;
      tracking = false;
      locked = false;
      intentDecided = false;
      horizontalIntent = false;
      emitHint(null, 0, null);
      if (!wasTracking || wasLocked || !wasHorizontal) return;

      const t = e.changedTouches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      const dt = Date.now() - startT;
      if (dt < MIN_DURATION_MS || dt > MAX_DURATION_MS) return;

      const edgeSwipe = (fromLeftEdge && dx > 0) || (fromRightEdge && dx < 0);
      const rawThreshold = edgeSwipe ? EDGE_THRESHOLD : prefs.swipeThreshold;
      const threshold = Math.max(rawThreshold, edgeSwipe ? EDGE_THRESHOLD : MIN_THRESHOLD);
      const verticalRatio = edgeSwipe ? 1.5 : 1.0;

      if (Math.abs(dx) < threshold) return;
      if (Math.abs(dy) > Math.abs(dx) * verticalRatio) return;

      const idx = paths.indexOf(location.pathname);
      if (idx === -1) return;
      if (dx < 0 && idx < paths.length - 1) navigate(paths[idx + 1]);
      else if (dx > 0 && idx > 0) navigate(paths[idx - 1]);
    };

    const opts: AddEventListenerOptions = { passive: true, capture: true };
    document.addEventListener('touchstart', onStart, opts);
    document.addEventListener('touchmove', onMove, opts);
    document.addEventListener('touchend', onEnd, opts);
    document.addEventListener('touchcancel', onEnd, opts);
    return () => {
      document.removeEventListener('touchstart', onStart, opts);
      document.removeEventListener('touchmove', onMove, opts);
      document.removeEventListener('touchend', onEnd, opts);
      document.removeEventListener('touchcancel', onEnd, opts);
    };

  }, [paths, location.pathname, navigate, prefs.swipeEnabled, prefs.swipeThreshold]);
}


