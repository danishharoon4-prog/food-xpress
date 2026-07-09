import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

/**
 * When enabled and running on a native Android build, this hook starts a
 * foreground-service background location watcher and pushes rider coords
 * into `riders.current_latitude/longitude`. Falls back to a no-op on web
 * (the RiderDashboard already runs a foreground watcher there).
 */
export function useBackgroundRiderTracking(riderId: string | null, enabled: boolean) {
  useEffect(() => {
    if (!enabled || !riderId) return;
    if (!Capacitor.isNativePlatform()) return;

    let watcherId: string | null = null;
    let lastPushed = 0;
    let cancelled = false;

    (async () => {
      try {
        const mod = await import('@capacitor-community/background-geolocation');
        const BackgroundGeolocation: any = (mod as any).BackgroundGeolocation ?? (mod as any).default;
        const id = await BackgroundGeolocation.addWatcher(
          {
            backgroundMessage: 'Sharing your live location for active deliveries',
            backgroundTitle: 'Food Xpress — On duty',
            requestPermissions: true,
            stale: false,
            distanceFilter: 25,
          },
          async (location, error) => {
            if (error) return;
            if (!location) return;
            const now = Date.now();
            if (now - lastPushed < 15000) return;
            lastPushed = now;
            await supabase
              .from('riders')
              .update({
                current_latitude: location.latitude,
                current_longitude: location.longitude,
              })
              .eq('id', riderId);
          }
        );
        if (cancelled) {
          BackgroundGeolocation.removeWatcher({ id });
        } else {
          watcherId = id;
        }
      } catch (e) {
        console.warn('Background geolocation unavailable:', e);
      }
    })();

    return () => {
      cancelled = true;
      if (watcherId) {
        import('@capacitor-community/background-geolocation').then((mod) => {
          const bg: any = (mod as any).BackgroundGeolocation ?? (mod as any).default;
          bg.removeWatcher({ id: watcherId! });
        });
      }
    };
  }, [riderId, enabled]);
}
