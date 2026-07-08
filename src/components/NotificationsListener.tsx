import { useEffect } from 'react';
import { useBrowserNotifications } from '@/hooks/useBrowserNotifications';
import { useAuth } from '@/contexts/AuthContext';
import { registerFcmForCurrentUser } from '@/lib/fcmPush';

export function NotificationsListener() {
  useBrowserNotifications();
  const { user } = useAuth();

  useEffect(() => {
    if (user?.id) {
      registerFcmForCurrentUser(user.id);
    }
  }, [user?.id]);

  return null;
}
