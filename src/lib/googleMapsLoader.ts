import { supabase } from '@/integrations/supabase/client';

let mapsLoaderPromise: Promise<any> | null = null;

export async function loadGoogleMaps(): Promise<any> {
  if (typeof window !== 'undefined' && (window as any).google?.maps?.Map) {
    return (window as any).google;
  }
  if (mapsLoaderPromise) return mapsLoaderPromise;

  mapsLoaderPromise = (async () => {
    let key = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined;
    if (!key) {
      const { data, error } = await supabase.functions.invoke('location-services', {
        body: { action: 'get_key' },
      });
      if (error || !data?.key) throw new Error('Failed to load map');
      key = data.key as string;
    }

    await new Promise<void>((resolve, reject) => {
      const w = window as any;
      if (w.google?.maps?.Map) return resolve();
      const existing = document.getElementById('google-maps-js') as HTMLScriptElement | null;
      const cbName = '__initGoogleMaps_' + Math.random().toString(36).slice(2);
      (w as any)[cbName] = () => { delete (w as any)[cbName]; resolve(); };

      if (existing) {
        // Wait for already-injected script to finish loading
        const waitReady = () => {
          if (w.google?.maps?.Map) { delete (w as any)[cbName]; resolve(); return true; }
          return false;
        };
        if (waitReady()) return;
        const interval = setInterval(() => { if (waitReady()) clearInterval(interval); }, 100);
        setTimeout(() => { clearInterval(interval); if (!w.google?.maps?.Map) reject(new Error('Maps load timeout')); }, 15000);
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

    const g = (window as any).google;
    if (g?.maps?.importLibrary) {
      await g.maps.importLibrary('maps');
      await g.maps.importLibrary('marker');
    }
    return g;
  })();

  mapsLoaderPromise.catch(() => { mapsLoaderPromise = null; });
  return mapsLoaderPromise;
}
