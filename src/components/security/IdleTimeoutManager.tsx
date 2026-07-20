import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const IDLE_KEY = 'fx.security.idle_minutes';

export function getIdleTimeoutMinutes(role: string | null): number {
  try {
    const raw = localStorage.getItem(IDLE_KEY);
    const n = raw ? parseInt(raw, 10) : NaN;
    if (Number.isFinite(n) && n >= 0) {
      // Admins can never disable timeout; cap at 30 min.
      if (role === 'admin') return Math.min(n === 0 ? 30 : n, 30);
      return n;
    }
  } catch {}
  return role === 'admin' ? 30 : 60;
}

export function setIdleTimeoutMinutes(minutes: number) {
  try { localStorage.setItem(IDLE_KEY, String(minutes)); } catch {}
}

export default function IdleTimeoutManager() {
  const { user, role, signOut } = useAuth();
  const lastActivity = useRef<number>(Date.now());
  const warnedRef = useRef<boolean>(false);

  useEffect(() => {
    if (!user) return;
    const minutes = getIdleTimeoutMinutes(role ?? null);
    if (minutes === 0) return; // disabled (non-admin only)

    const timeoutMs = minutes * 60 * 1000;
    const warnMs = Math.max(timeoutMs - 60_000, timeoutMs * 0.9);

    const reset = () => {
      lastActivity.current = Date.now();
      warnedRef.current = false;
    };
    const events = ['mousemove', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach(e => window.addEventListener(e, reset, { passive: true }));

    const interval = setInterval(() => {
      const idle = Date.now() - lastActivity.current;
      if (idle >= timeoutMs) {
        toast.error('Signed out due to inactivity');
        signOut();
      } else if (idle >= warnMs && !warnedRef.current) {
        warnedRef.current = true;
        toast.warning('You will be signed out in ~1 minute due to inactivity');
      }
    }, 15_000);

    return () => {
      events.forEach(e => window.removeEventListener(e, reset));
      clearInterval(interval);
    };
  }, [user, role, signOut]);

  return null;
}
