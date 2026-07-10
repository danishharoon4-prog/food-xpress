import { useEffect, useState, useCallback, ReactNode } from 'react';
import { Capacitor } from '@capacitor/core';
import { MapPin, Loader2, RefreshCw, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Status = 'checking' | 'ok' | 'denied' | 'disabled' | 'error';

interface Props {
  children: ReactNode;
}

/**
 * Blocks the whole app until the device has location permission granted
 * AND location services are actually turned on (GPS on).
 *
 * - On native (Capacitor Android/iOS) this enforces GPS strictly.
 * - On web browsers, permission is required; browsers don't expose a
 *   separate "location services off" state, so we treat POSITION_UNAVAILABLE
 *   as GPS/services disabled.
 */
export default function LocationGate({ children }: Props) {
  const [status, setStatus] = useState<Status>('checking');
  const [message, setMessage] = useState<string>('');

  const check = useCallback(async () => {
    setStatus('checking');
    setMessage('');
    // Only enforce location on native mobile apps. Web/browser users skip the gate.
    if (!Capacitor.isNativePlatform()) {
      setStatus('ok');
      return;
    }
    try {
      {
        const { Geolocation } = await import('@capacitor/geolocation');

        let perm = await Geolocation.checkPermissions();
        if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') {
          perm = await Geolocation.requestPermissions({ permissions: ['location'] });
        }
        if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') {
          setStatus('denied');
          setMessage('Location permission is required to use Food Express.');
          return;
        }
        // Now try to actually get a fix — this fails if GPS/location services are OFF.
        try {
          await Geolocation.getCurrentPosition({
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 30000,
          });
          setStatus('ok');
        } catch (err: any) {
          setStatus('disabled');
          setMessage(
            'Your device GPS / Location Services are turned OFF. Please turn on Location from your phone settings to continue.'
          );
        }
        return;
      }

      // Web browser path
      if (!navigator.geolocation) {
        setStatus('error');
        setMessage('Your browser does not support location. Please use a modern browser.');
        return;
      }
      await new Promise<void>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          () => resolve(),
          (e) => reject(e),
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
        );
      });
      setStatus('ok');
    } catch (e: any) {
      if (e && typeof e === 'object' && 'code' in e) {
        if (e.code === 1) {
          setStatus('denied');
          setMessage('Location permission was blocked. Please allow location in your browser settings.');
        } else if (e.code === 2) {
          setStatus('disabled');
          setMessage('Location is unavailable. Please turn on GPS / Location Services and try again.');
        } else {
          setStatus('disabled');
          setMessage('Could not detect your location. Please turn on GPS and try again.');
        }
      } else {
        setStatus('error');
        setMessage(e?.message || 'Unable to detect your location.');
      }
    }
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  const openNativeSettings = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) return;
    try {
      // Try the native-settings plugin if installed, otherwise fall back to App.
      // Both imports are wrapped so missing plugins don't crash.
      try {
        const dynImport = new Function('m', 'return import(m)') as (m: string) => Promise<any>;
        const mod: any = await dynImport('capacitor-native-settings').catch(() => null);
        if (mod?.NativeSettings) {
          if (Capacitor.getPlatform() === 'android') {
            await mod.NativeSettings.openAndroid({ option: mod.AndroidSettings?.Location ?? 'location' });
          } else {
            await mod.NativeSettings.openIOS({ option: mod.IOSSettings?.LocationServices ?? 'App-Prefs:Privacy&path=LOCATION' });
          }
          return;
        }
      } catch {}
      const { App } = await import('@capacitor/app');
      // On Android this opens app details; the user can then tap "Permissions" or go to system Location.
      await (App as any).openUrl?.({ url: 'package:app.lovable.fd539a18451b46e1813e630ffde4a82b' }).catch(() => {});
    } catch {}
  }, []);

  if (status === 'ok') return <>{children}</>;

  return (
    <div className="fixed inset-0 z-[9999] bg-background flex flex-col items-center justify-center px-6 text-center">
      <div className="max-w-sm w-full space-y-5">
        <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
          {status === 'checking' ? (
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
          ) : (
            <MapPin className="w-10 h-10 text-primary" />
          )}
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold">
            {status === 'checking' && 'Checking Location…'}
            {status === 'denied' && 'Location Access Needed'}
            {status === 'disabled' && 'Turn On GPS'}
            {status === 'error' && 'Location Error'}
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {status === 'checking'
              ? 'Please wait while we detect your location…'
              : message ||
                'Food Express needs your location to show nearby restaurants and deliver orders to the correct address.'}
          </p>
        </div>

        {status !== 'checking' && (
          <div className="space-y-2 pt-2">
            <Button onClick={check} className="w-full" size="lg">
              <RefreshCw className="w-4 h-4 mr-2" />
              I've Turned It On — Retry
            </Button>
            {Capacitor.isNativePlatform() && (
              <Button variant="outline" onClick={openNativeSettings} className="w-full" size="lg">
                <Settings className="w-4 h-4 mr-2" />
                Open Location Settings
              </Button>
            )}
            {!Capacitor.isNativePlatform() && (
              <p className="text-xs text-muted-foreground pt-1">
                Tip: Click the location icon in your browser's address bar to allow access.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
