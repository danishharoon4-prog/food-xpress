import { useEffect } from 'react';
import { useBrowserNotifications } from '@/hooks/useBrowserNotifications';
import { useAuth } from '@/contexts/AuthContext';
import { registerFcmForCurrentUser, unregisterFcmToken } from '@/lib/fcmPush';

export function NotificationsListener() {
  useBrowserNotifications();
  const { user } = useAuth();

  useEffect(() => {
    if (user?.id) {
      registerFcmForCurrentUser(user.id);
    } else {
      unregisterFcmToken();
    }
  }, [user?.id]);

  return null;
}
