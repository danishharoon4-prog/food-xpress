import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useNavPrefs } from './useNavPrefs';

/**
 * Horizontal swipe navigation between the given ordered paths.
 * Swipe left  → next path
 * Swipe right → previous path
 *
 * Uses native touch events (most reliable in Capacitor Android WebView,
 * even when the swipe crosses vertically-scrollable content). Falls back
 * to pointer events for desktop/pen input.
 */
export function useSwipeNav(paths: string[]) {
  const navigate = useNavigate();
  const location = useLocation();
  const { prefs } = useNavPrefs();

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

    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let lastY = 0;
    let startT = 0;
    let tracking = false;
    let fromLeftEdge = false;
    let fromRightEdge = false;
    let horizontalIntent = false;
    let cancelled = false;

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

    const isBlocked = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      return !!el?.closest?.('input, textarea, select, [role="slider"], [data-no-swipe], .no-swipe');
    };

    const begin = (x: number, y: number, target: EventTarget | null) => {
      if (isBlocked(target)) { tracking = false; return; }
      startX = lastX = x;
      startY = lastY = y;
      startT = Date.now();
      tracking = true;
      cancelled = false;
      horizontalIntent = false;
      const w = window.innerWidth;
      fromLeftEdge = x <= EDGE_ZONE;
      fromRightEdge = x >= w - EDGE_ZONE;
    };

    const move = (x: number, y: number) => {
      if (!tracking || cancelled) return;
      lastX = x; lastY = y;
      const dx = x - startX;
      const dy = y - startY;
      const adx = Math.abs(dx);
      const ady = Math.abs(dy);
      if (!horizontalIntent) {
        if (ady > 14 && ady > adx * 1.2) { cancelled = true; emitHint(null, 0, null); return; }
        if (adx < 10) return;
        horizontalIntent = true;
      }
      const edgeSwipe = (fromLeftEdge && dx > 0) || (fromRightEdge && dx < 0);
      const threshold = Math.max(edgeSwipe ? EDGE_THRESHOLD : thresholdRef.current, edgeSwipe ? EDGE_THRESHOLD : MIN_THRESHOLD);
      const dir: 'left' | 'right' = dx < 0 ? 'left' : 'right';
      const label = getLabel(dir === 'left' ? 1 : -1);
      if (!label) { emitHint(null, 0, null); return; }
      emitHint(dir, Math.min(1, adx / threshold), label);
    };

    const end = () => {
      if (!tracking) return;
      const wasHorizontal = horizontalIntent;
      const wasCancelled = cancelled;
      const dx = lastX - startX;
      const dy = lastY - startY;
      const dt = Date.now() - startT;
      tracking = false;
      horizontalIntent = false;
      cancelled = false;
      emitHint(null, 0, null);
      if (wasCancelled || !wasHorizontal) return;
      if (dt > MAX_DURATION_MS) return;

      const edgeSwipe = (fromLeftEdge && dx > 0) || (fromRightEdge && dx < 0);
      const threshold = Math.max(edgeSwipe ? EDGE_THRESHOLD : thresholdRef.current, edgeSwipe ? EDGE_THRESHOLD : MIN_THRESHOLD);
      if (Math.abs(dx) < threshold) return;
      if (Math.abs(dy) > Math.abs(dx)) return;

      const p = pathsRef.current;
      const idx = p.indexOf(locationRef.current.pathname);
      if (idx === -1) return;
      if (dx < 0 && idx < p.length - 1) navigate(p[idx + 1]);
      else if (dx > 0 && idx > 0) navigate(p[idx - 1]);
    };

    // Touch (primary path for mobile / Capacitor Android WebView)
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) { tracking = false; return; }
      const t = e.touches[0];
      begin(t.clientX, t.clientY, e.target);
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!tracking) return;
      const t = e.touches[0];
      if (!t) return;
      move(t.clientX, t.clientY);
    };
    const onTouchEnd = (e: TouchEvent) => {
      const t = e.changedTouches[0];
      if (t) { lastX = t.clientX; lastY = t.clientY; }
      end();
    };
    const onTouchCancel = () => { cancelled = false; end(); };

    // Pointer (desktop pen / mouse ignored intentionally)
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' || e.pointerType === 'touch') return; // touch handled above
      begin(e.clientX, e.clientY, e.target);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' || e.pointerType === 'touch') return;
      move(e.clientX, e.clientY);
    };
    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' || e.pointerType === 'touch') return;
      lastX = e.clientX; lastY = e.clientY;
      end();
    };

    const passive: AddEventListenerOptions = { passive: true };
    window.addEventListener('touchstart', onTouchStart, passive);
    window.addEventListener('touchmove', onTouchMove, passive);
    window.addEventListener('touchend', onTouchEnd, passive);
    window.addEventListener('touchcancel', onTouchCancel, passive);
    window.addEventListener('pointerdown', onPointerDown, passive);
    window.addEventListener('pointermove', onPointerMove, passive);
    window.addEventListener('pointerup', onPointerUp, passive);
    window.addEventListener('pointercancel', onPointerUp, passive);

    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchCancel);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [navigate, prefs.swipeEnabled]);
}
