// Fire native browser notifications alongside any in-app toast/popup.
// On mobile browsers (Android Chrome/Edge/Firefox), `new Notification()`
// is not allowed — we must use ServiceWorkerRegistration.showNotification().
// On Capacitor native, use @capacitor/local-notifications instead.
import { toast as sonnerToast } from 'sonner';
import { Capacitor } from '@capacitor/core';
import { ensureNotificationsSW } from './notificationsSW';

const toText = (v: unknown): string => {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return '';
};

async function ensureNativeNotifPermission(): Promise<boolean> {
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display === 'granted') return true;
    const req = await LocalNotifications.requestPermissions();
    return req.display === 'granted';
  } catch {
    return false;
  }
}

export function requestNotificationPermission() {
  // Native app path.
  if (Capacitor.isNativePlatform()) {
    return ensureNativeNotifPermission().then((ok) =>
      (ok ? 'granted' : 'denied') as NotificationPermission,
    );
  }
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return Promise.resolve('unsupported' as NotificationPermission);
  }
  // Kick off SW registration in parallel so showNotification is ready on mobile.
  ensureNotificationsSW();
  if (Notification.permission === 'default') {
    return Notification.requestPermission()
      .then((perm) => {
        if (perm === 'granted') ensureNotificationsSW();
        return perm;
      })
      .catch(() => 'denied' as NotificationPermission);
  }
  return Promise.resolve(Notification.permission);
}

// Simple de-dupe so identical messages don't spawn multiple notifications.
let lastKey = '';
let lastTs = 0;
let nativeNotifId = 1;
let channelEnsured = false;

const HIGH_CHANNEL_ID = 'food-express-high';

async function ensureHighImportanceChannel() {
  if (channelEnsured) return;
  channelEnsured = true;
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.createChannel({
      id: HIGH_CHANNEL_ID,
      name: 'Food Express Alerts',
      description: 'Order updates and important alerts',
      importance: 5, // IMPORTANCE_HIGH -> heads-up
      visibility: 1,
      sound: 'default',
      lights: true,
      lightColor: '#FF6F00',
      vibration: true,
    });
  } catch {
    channelEnsured = false;
  }
}

async function fireNativeNotification(title: string, body: string) {
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') {
      const req = await LocalNotifications.requestPermissions();
      if (req.display !== 'granted') return;
    }
    await ensureHighImportanceChannel();
    await LocalNotifications.schedule({
      notifications: [
        {
          id: nativeNotifId++,
          title: title || 'Notification',
          body: body || '',
          schedule: { at: new Date(Date.now() + 100) },
          smallIcon: 'ic_stat_notification',
          channelId: HIGH_CHANNEL_ID,
        },
      ],
    });
  } catch (e) {
    console.error('Native notification failed', e);
  }
}

export function fireBrowserNotification(
  title: unknown,
  body?: unknown,
  opts?: { tag?: string; silent?: boolean; url?: string },
) {
  const t = toText(title).trim();
  const b = toText(body).trim();
  if (!t && !b) return;

  const key = `${t}|${b}`;
  const now = Date.now();
  if (key === lastKey && now - lastTs < 1500) return;
  lastKey = key;
  lastTs = now;

  const finalTitle = t || 'Notification';

  // Native (Capacitor) — use LocalNotifications plugin.
  if (Capacitor.isNativePlatform()) {
    fireNativeNotification(finalTitle, b);
    return;
  }

  // Web browser path.
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return;

  const notifOpts: NotificationOptions = {
    body: b || undefined,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: opts?.tag,
    silent: opts?.silent,
    data: { url: opts?.url || window.location.pathname },
  };

  // Prefer service-worker notifications (works on mobile + desktop).
  ensureNotificationsSW()
    .then((reg) => {
      if (reg && typeof reg.showNotification === 'function') {
        return reg.showNotification(finalTitle, notifOpts);
      }
      // Desktop fallback when no SW is available (e.g. Lovable preview).
      try { new Notification(finalTitle, notifOpts); } catch { /* noop */ }
    })
    .catch(() => {
      try { new Notification(finalTitle, notifOpts); } catch { /* noop */ }
    });
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
