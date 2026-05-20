import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

const PROMPT_KEY = 'notif-permission-prompted';

export function useBrowserNotifications() {
  const { user } = useAuth();
  const { toast } = useToast();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!user) return;

    // Auto-prompt permission once per browser
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      const already = localStorage.getItem(PROMPT_KEY);
      if (!already) {
        localStorage.setItem(PROMPT_KEY, '1');
        // Slight delay so it doesn't block initial render
        setTimeout(() => {
          Notification.requestPermission().catch(() => {});
        }, 1500);
      }
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
          const n = payload.new as { title?: string; message?: string; type?: string };
          const title = n.title || 'Notification';
          const body = n.message || '';

          // In-app toast
          toast({
            title,
            description: body,
            variant: n.type === 'warning' || n.type === 'error' ? 'destructive' : 'default',
          });

          // Browser notification
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            try {
              new Notification(title, { body, icon: '/favicon.ico' });
            } catch { /* noop */ }
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
