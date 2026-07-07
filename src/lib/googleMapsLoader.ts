import { supabase } from '@/integrations/supabase/client';

let mapsLoaderPromise: Promise<any> | null = null;

export async function loadGoogleMaps(): Promise<any> {
  if (typeof window === 'undefined') {
    throw new Error('Maps can only load in the browser');
  }
  if (mapsLoaderPromise) return mapsLoaderPromise;

  mapsLoaderPromise = (async () => {
    const w = window as any;
    const ensureLibraries = async () => {
      const google = w.google;
      if (!google?.maps) throw new Error('Google Maps was not initialized');
      if (google.maps.importLibrary) {
        await google.maps.importLibrary('maps');
        await google.maps.importLibrary('marker');
      }
      if (!google.maps.Map) throw new Error('Google Maps library is unavailable');
      return google;
    };

    if (w.google?.maps?.Map) {
      return ensureLibraries();
    }

    let key = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined;
    if (!key) {
      const { data, error } = await supabase.functions.invoke('location-services', {
        body: { action: 'get_key' },
      });
      if (error || !data?.key) throw new Error('Failed to load map');
      key = data.key as string;
    }

    await new Promise<void>((resolve, reject) => {
      if (w.google?.maps?.Map) return resolve();
      const existing = document.getElementById('google-maps-js') as HTMLScriptElement | null;
      const cbName = '__initGoogleMaps_' + Math.random().toString(36).slice(2);
      (w as any)[cbName] = () => { delete (w as any)[cbName]; resolve(); };

      if (existing) {
        // Wait for already-injected scripts too. Older components injected the
        // async script without a callback, where Map is exposed only after
        // importLibrary('maps') runs, so importLibrary is enough to continue.
        const waitReady = () => {
          if (w.google?.maps?.Map || w.google?.maps?.importLibrary) {
            delete (w as any)[cbName];
            resolve();
            return true;
          }
          return false;
        };
        if (waitReady()) return;
        existing.addEventListener('load', () => { waitReady(); }, { once: true });
        existing.addEventListener('error', () => reject(new Error('Maps load failed')), { once: true });
        const interval = setInterval(() => { if (waitReady()) clearInterval(interval); }, 100);
        setTimeout(() => {
          clearInterval(interval);
          if (!w.google?.maps?.Map && !w.google?.maps?.importLibrary) reject(new Error('Maps load timeout'));
        }, 15000);
        return;
      }

      const script = document.createElement('script');
      script.id = 'google-maps-js';
      const tracking = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID;
      const channel = tracking ? `&channel=${tracking}` : '';
      script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&callback=${cbName}${channel}`;
      script.async = true;
      script.defer = true;
      script.onerror = () => reject(new Error('Maps load failed'));
      document.head.appendChild(script);
    });

    return ensureLibraries();
  })();

  mapsLoaderPromise.catch(() => { mapsLoaderPromise = null; });
  return mapsLoaderPromise;
}
