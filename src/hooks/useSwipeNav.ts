import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useNavPrefs } from './useNavPrefs';

/**
 * Horizontal swipe navigation between the given ordered paths.
 * Swipe left  → next path
 * Swipe right → previous path
 *
 * Uses pointer events which work reliably in Capacitor Android WebView,
 * regular mobile browsers and desktop (mouse drag).
 */
export function useSwipeNav(paths: string[]) {
  const navigate = useNavigate();
  const location = useLocation();
  const { prefs } = useNavPrefs();

  // Keep latest values in refs so the effect stays mounted per component
  // (we only rebind when swipe pref toggles).
  const pathsRef = useRef(paths);
  const locationRef = useRef(location);
  const thresholdRef = useRef(prefs.swipeThreshold);
  useEffect(() => { pathsRef.current = paths; }, [paths]);
  useEffect(() => { locationRef.current = location; }, [location]);
  useEffect(() => { thresholdRef.current = prefs.swipeThreshold; }, [prefs.swipeThreshold]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!prefs.swipeEnabled) return;

    const EDGE_ZONE = 40;
    const EDGE_THRESHOLD = 24;
    const MIN_THRESHOLD = 40;
    const MAX_DURATION_MS = 1500;
    const H_INTENT_PX = 10; // px horizontal before we lock horizontal intent

    let startX = 0;
    let startY = 0;
    let startT = 0;
    let pointerId: number | null = null;
    let tracking = false;
    let locked = false;
    let horizontalIntent = false;
    let fromLeftEdge = false;
    let fromRightEdge = false;

    const emitHint = (dir: 'left' | 'right' | null, progress: number, label: string | null) => {
      window.dispatchEvent(new CustomEvent('swipe-nav-hint', { detail: { dir, progress, label } }));
    };

    const getLabel = (offset: number) => {
      const p = pathsRef.current;
      const idx = p.indexOf(locationRef.current.pathname);
      if (idx === -1) return null;
      const target = idx + offset;
      if (target < 0 || target >= p.length) return null;
      return p[target];
    };

    const reset = () => {
      tracking = false;
      locked = false;
      horizontalIntent = false;
      pointerId = null;
      emitHint(null, 0, null);
    };

    const onDown = (e: PointerEvent) => {
      // Only primary touch/pen input; ignore mouse to keep desktop drag-free.
      if (e.pointerType === 'mouse') return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [role="slider"], [data-no-swipe], .no-swipe')) return;
      startX = e.clientX;
      startY = e.clientY;
      startT = Date.now();
      pointerId = e.pointerId;
      tracking = true;
      locked = false;
      horizontalIntent = false;
      const w = window.innerWidth;
      fromLeftEdge = startX <= EDGE_ZONE;
      fromRightEdge = startX >= w - EDGE_ZONE;
    };

    const onMove = (e: PointerEvent) => {
      if (!tracking || locked) return;
      if (pointerId !== null && e.pointerId !== pointerId) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const adx = Math.abs(dx);
      const ady = Math.abs(dy);

      if (!horizontalIntent) {
        // If clearly vertical first, cancel this gesture.
        if (ady > 16 && ady > adx * 1.3) { locked = true; emitHint(null, 0, null); return; }
        if (adx < H_INTENT_PX) return;
        horizontalIntent = true;
      }

      const edgeSwipe = (fromLeftEdge && dx > 0) || (fromRightEdge && dx < 0);
      const rawThreshold = edgeSwipe ? EDGE_THRESHOLD : thresholdRef.current;
      const threshold = Math.max(rawThreshold, edgeSwipe ? EDGE_THRESHOLD : MIN_THRESHOLD);
      const dir: 'left' | 'right' = dx < 0 ? 'left' : 'right';
      const label = getLabel(dir === 'left' ? 1 : -1);
      if (!label) { emitHint(null, 0, null); return; }
      emitHint(dir, Math.min(1, adx / threshold), label);
    };

    const onUp = (e: PointerEvent) => {
      if (!tracking) return;
      if (pointerId !== null && e.pointerId !== pointerId) return;
      const wasHorizontal = horizontalIntent;
      const wasLocked = locked;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const dt = Date.now() - startT;
      reset();
      if (wasLocked || !wasHorizontal) return;
      if (dt > MAX_DURATION_MS) return;

      const edgeSwipe = (fromLeftEdge && dx > 0) || (fromRightEdge && dx < 0);
      const rawThreshold = edgeSwipe ? EDGE_THRESHOLD : thresholdRef.current;
      const threshold = Math.max(rawThreshold, edgeSwipe ? EDGE_THRESHOLD : MIN_THRESHOLD);
      if (Math.abs(dx) < threshold) return;
      if (Math.abs(dy) > Math.abs(dx)) return;

      const p = pathsRef.current;
      const idx = p.indexOf(locationRef.current.pathname);
      if (idx === -1) return;
      if (dx < 0 && idx < p.length - 1) navigate(p[idx + 1]);
      else if (dx > 0 && idx > 0) navigate(p[idx - 1]);
    };

    const opts: AddEventListenerOptions = { passive: true, capture: true };
    window.addEventListener('pointerdown', onDown, opts);
    window.addEventListener('pointermove', onMove, opts);
    window.addEventListener('pointerup', onUp, opts);
    window.addEventListener('pointercancel', onUp, opts);
    return () => {
      window.removeEventListener('pointerdown', onDown, opts);
      window.removeEventListener('pointermove', onMove, opts);
      window.removeEventListener('pointerup', onUp, opts);
      window.removeEventListener('pointercancel', onUp, opts);
    };
  }, [navigate, prefs.swipeEnabled]);
}
