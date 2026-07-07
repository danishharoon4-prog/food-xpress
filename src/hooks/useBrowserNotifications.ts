import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { fireBrowserNotification, requestNotificationPermission } from '@/lib/browserNotify';
import { ensurePushSubscription } from '@/lib/pushSubscription';
import { DEFAULT_PREFS, NotifPrefs, STATUS_TO_PREF } from '@/lib/notificationPrefs';

const PROMPT_KEY = 'notif-permission-prompted';

type GlobalToggles = {
  notifications_toast_enabled: boolean;
  notifications_push_enabled: boolean;
  notifications_sound_enabled: boolean;
};

export function useBrowserNotifications() {
  const { user } = useAuth();
  const { toast } = useToast();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const prefsRef = useRef<NotifPrefs | null>(null);
  const globalsRef = useRef<GlobalToggles>({
    notifications_toast_enabled: true,
    notifications_push_enabled: true,
    notifications_sound_enabled: true,
  });

  useEffect(() => {
    if (!user) return;

    // Load current user's prefs
    (async () => {
      const { data } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      prefsRef.current = (data as NotifPrefs | null) ?? { user_id: user.id, ...DEFAULT_PREFS };
    })();

    // Load global platform toggles
    (async () => {
      const { data } = await supabase
        .from('platform_settings')
        .select('notifications_toast_enabled, notifications_push_enabled, notifications_sound_enabled')
        .limit(1)
        .maybeSingle();
      if (data) globalsRef.current = data as GlobalToggles;
    })();

    // Auto-prompt permission once per browser, then subscribe to Web Push.
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      const already = localStorage.getItem(PROMPT_KEY);
      if (!already) {
        localStorage.setItem(PROMPT_KEY, '1');
        setTimeout(() => {
          requestNotificationPermission().then((p) => {
            if (p === 'granted') ensurePushSubscription();
          });
        }, 1500);
      }
    } else if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      ensurePushSubscription();
    }

    // Subscribe to notifications for this user
    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const n = payload.new as { title?: string; message?: string; type?: string; data?: any };
          const title = n.title || 'Notification';
          const body = n.message || '';
          const orderId = n.data?.order_id;
          const status = n.data?.status as string | undefined;

          // Check per-event pref
          const prefs = prefsRef.current;
          if (prefs && status) {
            const col = STATUS_TO_PREF[status];
            if (col && (prefs as any)[col] === false) return;
          }

          const g = globalsRef.current;

          // In-app toast
          if (g.notifications_toast_enabled && (!prefs || prefs.toast_enabled)) {
            toast({
              title,
              description: body,
              variant: n.type === 'warning' || n.type === 'error' ? 'destructive' : 'default',
            });
          }

          // Browser / mobile notification
          if (g.notifications_push_enabled && (!prefs || prefs.push_enabled)) {
            const silent = !(g.notifications_sound_enabled && (!prefs || prefs.sound_enabled));
            fireBrowserNotification(title, body, {
              tag: orderId ? `order-${orderId}` : undefined,
              url: orderId ? `/order/${orderId}` : undefined,
              silent,
            });
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [user, toast]);
}
