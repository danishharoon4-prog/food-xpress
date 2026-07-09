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

    // Hide the specifier from Vite's static analyzer — the plugin has no web
    // entry and is only available inside the Capacitor Android runtime.
    const pkg = '@capacitor-community/background-geolocation';
    const loadBg = () =>
      (new Function('p', 'return import(p)') as (p: string) => Promise<any>)(pkg);

    (async () => {
      try {
        const mod = await loadBg();
        const BackgroundGeolocation: any = mod.BackgroundGeolocation ?? mod.default;
        const id = await BackgroundGeolocation.addWatcher(
          {
            backgroundMessage: 'Sharing your live location for active deliveries',
            backgroundTitle: 'Food Xpress — On duty',
            requestPermissions: true,
            stale: false,
            distanceFilter: 25,
          },
          async (location: any, error: any) => {
            if (error || !location) return;
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
        loadBg().then((mod: any) => {
          const bg = mod.BackgroundGeolocation ?? mod.default;
          bg.removeWatcher({ id: watcherId! });
        }).catch(() => {});
      }
    };

  }, [riderId, enabled]);
}
