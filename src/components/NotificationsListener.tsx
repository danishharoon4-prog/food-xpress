import { useBrowserNotifications } from '@/hooks/useBrowserNotifications';

export function NotificationsListener() {
  useBrowserNotifications();
  return null;
}
