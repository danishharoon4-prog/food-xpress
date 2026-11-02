// Native Firebase Cloud Messaging (FCM) registration for Android/iOS via Capacitor.
// On the web this is a no-op — existing VAPID Web Push flow keeps working.
import { Capacitor } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

let registeredUser: string | null = null;
let currentToken: string | null = null;
let generation = 0;
let listeners: PluginListenerHandle[] = [];
let lifecycle: Promise<void> = Promise.resolve();
let tokenWrites: Promise<void> = Promise.resolve();

async function removeListeners() {
  const previous = listeners;
  listeners = [];
  await Promise.all(previous.map((listener) => listener.remove()));
}

// FCM push requires google-services.json (Android) / GoogleService-Info.plist (iOS)
// to be present in the native project. Without them, PushNotifications.register()
// causes a NATIVE crash (Java-level, uncatchable in JS). Enable via env flag only
// after Firebase is properly configured in the native project.
// APKs built with google-services.json append "FXPushReady" to the user agent
// (see .github/workflows/main.yml), so the live website knows it is safe.
const FCM_ENABLED =
  import.meta.env.VITE_FCM_ENABLED === 'true' ||
  (typeof navigator !== 'undefined' && navigator.userAgent.includes('FXPushReady'));

export async function registerFcmForCurrentUser(userId: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  if (!FCM_ENABLED) return; // safety: no google-services.json -> would crash
  if (registeredUser === userId) return;
  registeredUser = userId;
  const attempt = ++generation;
  lifecycle = lifecycle.then(async () => {
    try {
    await removeListeners();
    await tokenWrites;
    if (attempt !== generation) return;
    const { PushNotifications } = await import('@capacitor/push-notifications');

    const perm = await PushNotifications.checkPermissions();
    let status = perm.receive;
    if (status === 'prompt' || status === 'prompt-with-rationale') {
      const req = await PushNotifications.requestPermissions();
      status = req.receive;
    }
    if (attempt !== generation) return;
    if (status !== 'granted') {
      registeredUser = null;
      return;
    }

    // Attach before register(): some devices emit the token immediately.
    listeners.push(await PushNotifications.addListener('registration', (t) => {
      if (attempt !== generation) return;
      currentToken = t.value;
      tokenWrites = tokenWrites.then(async () => {
        if (attempt !== generation) return;
        try {
          const { data } = await supabase.auth.getSession();
          if (attempt !== generation || data.session?.user.id !== userId) return;
          const { error } = await supabase.rpc('register_device_push_token', {
            _token: t.value,
            _platform: Capacitor.getPlatform(),
          });
          if (error) throw error;
        } catch {
          console.error('FCM token save failed; registration can be retried');
          if (attempt === generation) registeredUser = null;
        }
      });
    }));

    listeners.push(await PushNotifications.addListener('registrationError', () => {
      if (attempt !== generation) return;
      console.error('FCM registration error');
      registeredUser = null;
    }));

    // Foreground FCM: Android suppresses notification-payload messages while the
    // app is in foreground. Re-emit via LocalNotifications so users still get a
    // heads-up banner on the high-importance channel.
    listeners.push(await PushNotifications.addListener('pushNotificationReceived', async (notif) => {
      if (attempt !== generation) return;
      try {
        const { fireBrowserNotification } = await import('@/lib/browserNotify');
        const title = notif.title || (notif.data as any)?.title || 'Notification';
        const body = notif.body || (notif.data as any)?.body || '';
        fireBrowserNotification(title, body);
      } catch (e) {
        console.error('Foreground push re-emit failed', e);
      }
    }));

    listeners.push(await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      if (attempt !== generation) return;
      const data = action.notification?.data as Record<string, string> | undefined;
      const orderId = data?.order_id;
      if (orderId) {
        window.location.href = `/order/${orderId}`;
      }
    }));
    if (attempt !== generation) return;
    await PushNotifications.register();
    } catch {
      console.error('FCM setup failed');
      if (attempt === generation) registeredUser = null;
    }
  });
  await lifecycle;
}

export async function unregisterFcmToken(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  ++generation;
  const previousUser = registeredUser;
  registeredUser = null;
  lifecycle = lifecycle.then(async () => {
    try {
      await removeListeners();
      // Finish any in-flight save before deleting, while logout still has auth.
      await tokenWrites;
      const token = currentToken;
      currentToken = null;
      if (!token) return;
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user.id;
      if (!userId || (previousUser && previousUser !== userId)) return;
      const { error } = await supabase.from('device_push_tokens')
        .delete().eq('token', token).eq('user_id', userId);
      if (error) throw error;
    } catch {
      console.error('FCM token cleanup failed');
    }
  });
  await lifecycle;
}
