import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, MapPin, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  latitude: number | null | undefined;
  longitude: number | null | undefined;
  address?: string;
  height?: number;
}

let mapsLoaderPromise: Promise<any> | null = null;

async function loadGoogleMaps(): Promise<any> {
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
      const done = () => resolve();
      const existing = document.getElementById('google-maps-js') as HTMLScriptElement | null;
      if (existing) {
        if (w.google?.maps?.Map) return resolve();
        existing.addEventListener('load', done, { once: true });
        existing.addEventListener('error', () => reject(new Error('Maps load failed')), { once: true });
        return;
      }
      const cbName = '__initGoogleMaps_' + Math.random().toString(36).slice(2);
      (w as any)[cbName] = () => { delete (w as any)[cbName]; resolve(); };
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

    // Ensure the 'maps' library is loaded (required with loading=async)
    const g = (window as any).google;
    if (g?.maps?.importLibrary) {
      await g.maps.importLibrary('maps');
      await g.maps.importLibrary('marker');
    }

    return (window as any).google;
  })();

  // If loading fails, allow a retry on next mount
  mapsLoaderPromise.catch(() => { mapsLoaderPromise = null; });

  return mapsLoaderPromise;
}


export function CustomerLocationMap({ latitude, longitude, address, height = 240 }: Props) {
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const hasCoords =
    typeof latitude === 'number' && typeof longitude === 'number' &&
    !isNaN(latitude) && !isNaN(longitude);

  useEffect(() => {
    if (!hasCoords) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const google = await loadGoogleMaps();
        if (cancelled || !mapDivRef.current) return;
        const center = { lat: latitude as number, lng: longitude as number };
        const map = new google.maps.Map(mapDivRef.current, {
          center,
          zoom: 16,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: true,
          clickableIcons: false,
        });
        new google.maps.Marker({
          position: center,
          map,
          title: address || 'Customer location',
        });
        setLoading(false);
      } catch (err: any) {
        console.error(err);
        setError('Could not load map');
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [latitude, longitude, hasCoords, address]);

  const openDirections = () => {
    if (!hasCoords) return;
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`,
      '_blank'
    );
  };

  if (!hasCoords) {
    return (
      <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground flex items-center gap-2">
        <MapPin className="w-4 h-4" />
        Customer pin location not available — use the address above.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative w-full rounded-lg overflow-hidden border" style={{ height }}>
        <div ref={mapDivRef} className="w-full h-full" />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-destructive">
            {error}
          </div>
        )}
      </div>
      <Button size="sm" variant="outline" onClick={openDirections} className="w-full">
        <Navigation className="w-4 h-4 mr-2" /> Get Directions to Customer
      </Button>
    </div>
  );
}
