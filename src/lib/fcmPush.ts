// Native Firebase Cloud Messaging (FCM) registration for Android/iOS via Capacitor.
// On the web this is a no-op — existing VAPID Web Push flow keeps working.
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

let registered = false;

export async function registerFcmForCurrentUser(userId: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  if (registered) return;
  registered = true;

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');

    const perm = await PushNotifications.checkPermissions();
    let status = perm.receive;
    if (status === 'prompt' || status === 'prompt-with-rationale') {
      const req = await PushNotifications.requestPermissions();
      status = req.receive;
    }
    if (status !== 'granted') {
      registered = false;
      return;
    }

    await PushNotifications.register();

    PushNotifications.addListener('registration', async (t) => {
      const token = t.value;
      const platform = Capacitor.getPlatform() as 'android' | 'ios';
      try {
        await supabase
          .from('device_push_tokens')
          .upsert(
            { user_id: userId, token, platform },
            { onConflict: 'token' },
          );
      } catch (e) {
        console.error('FCM token save failed', e);
      }
    });

    PushNotifications.addListener('registrationError', (err) => {
      console.error('FCM registration error', err);
      registered = false;
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      const data = action.notification?.data as Record<string, string> | undefined;
      const orderId = data?.order_id;
      if (orderId) {
        window.location.href = `/order/${orderId}`;
      }
    });
  } catch (err) {
    console.error('FCM setup failed', err);
    registered = false;
  }
}

export async function unregisterFcmToken(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  registered = false;
}
