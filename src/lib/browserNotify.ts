// Fire native browser notifications alongside any in-app toast/popup.
import { toast as sonnerToast } from 'sonner';

const toText = (v: unknown): string => {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return '';
};

export function requestNotificationPermission() {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return;
  if (Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {});
  }
}

// Simple de-dupe so identical messages don't spawn multiple notifications
// when both a toast helper AND our monkey-patch run in the same tick.
let lastKey = '';
let lastTs = 0;

export function fireBrowserNotification(
  title: unknown,
  body?: unknown,
  opts?: { tag?: string; silent?: boolean },
) {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return;
  // Don't notify while the tab is focused — the in-app toast is already visible.
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') return;
  if (Notification.permission !== 'granted') return;

  const t = toText(title).trim();
  const b = toText(body).trim();
  if (!t && !b) return;

  const key = `${t}|${b}`;
  const now = Date.now();
  if (key === lastKey && now - lastTs < 1500) return;
  lastKey = key;
  lastTs = now;

  try {
    new Notification(t || 'Notification', {
      body: b || undefined,
      icon: '/favicon.ico',
      tag: opts?.tag,
      silent: opts?.silent,
    });
  } catch {
    /* noop */
  }
}

let sonnerPatched = false;

export function patchSonnerForBrowserNotifications() {
  if (sonnerPatched) return;
  sonnerPatched = true;

  const target = sonnerToast as unknown as Record<string, any>;

  const wrapVariant = (name: string, defaultTitle: string) => {
    const original = target[name];
    if (typeof original !== 'function') return;
    target[name] = (message: any, data?: any) => {
      fireBrowserNotification(toText(message) || defaultTitle, data?.description);
      return original.call(sonnerToast, message, data);
    };
  };

  wrapVariant('success', 'Success');
  wrapVariant('error', 'Error');
  wrapVariant('warning', 'Warning');
  wrapVariant('info', 'Notice');
  wrapVariant('message', 'Notification');
}
