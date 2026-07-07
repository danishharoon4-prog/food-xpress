import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { fireBrowserNotification, requestNotificationPermission } from '@/lib/browserNotify';
import { ensurePushSubscription } from '@/lib/pushSubscription';

const PROMPT_KEY = 'notif-permission-prompted';

export function useBrowserNotifications() {
  const { user } = useAuth();
  const { toast } = useToast();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!user) return;

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
      // Already granted — make sure this browser has a live subscription.
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

          // In-app toast
          toast({
            title,
            description: body,
            variant: n.type === 'warning' || n.type === 'error' ? 'destructive' : 'default',
          });

          // Browser / mobile notification (uses SW showNotification when available)
          fireBrowserNotification(title, body, {
            tag: orderId ? `order-${orderId}` : undefined,
            url: orderId ? `/order/${orderId}` : undefined,
          });
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
