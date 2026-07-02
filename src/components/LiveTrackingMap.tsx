import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, MapPin } from 'lucide-react';

interface Coords {
  lat: number;
  lng: number;
}

interface Props {
  riderId: string;
  customerCoords: Coords | null;
  restaurantCoords?: Coords | null;
  height?: number;
}

let mapsLoaderPromise: Promise<any> | null = null;

async function loadGoogleMaps(): Promise<any> {
  if (typeof window !== 'undefined' && (window as any).google?.maps) {
    return (window as any).google;
  }
  if (mapsLoaderPromise) return mapsLoaderPromise;

  mapsLoaderPromise = (async () => {
    const { data, error } = await supabase.functions.invoke('location-services', {
      body: { action: 'get_key' },
    });
    if (error || !data?.key) throw new Error('Failed to load map');
    const key = data.key as string;

    await new Promise<void>((resolve, reject) => {
      if ((window as any).google?.maps) return resolve();

      const cbName = '__lovableInitGoogleMaps__';
      (window as any)[cbName] = () => resolve();

      const existing = document.getElementById('google-maps-js') as HTMLScriptElement | null;
      if (existing) {
        const start = Date.now();
        const check = setInterval(() => {
          if ((window as any).google?.maps) {
            clearInterval(check);
            resolve();
          } else if (Date.now() - start > 15000) {
            clearInterval(check);
            reject(new Error('Maps load timeout'));
          }
        }, 100);
        return;
      }
      const script = document.createElement('script');
      script.id = 'google-maps-js';
      script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places&loading=async&callback=${cbName}`;
      script.async = true;
      script.defer = true;
      script.onerror = () => reject(new Error('Maps load failed'));
      document.head.appendChild(script);
    });

    return (window as any).google;
  })();

  mapsLoaderPromise.catch(() => {
    mapsLoaderPromise = null;
  });

  return mapsLoaderPromise;
}

export function LiveTrackingMap({
  riderId,
  customerCoords,
  restaurantCoords,
  height = 280,
}: Props) {
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const riderMarkerRef = useRef<any>(null);
  const googleRef = useRef<any>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [riderCoords, setRiderCoords] = useState<Coords | null>(null);

  // Initial map setup
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const google = await loadGoogleMaps();
        if (cancelled || !mapDivRef.current) return;
        googleRef.current = google;

        const center =
          customerCoords || restaurantCoords || { lat: 34.3299, lng: 73.1985 };

        const map = new google.maps.Map(mapDivRef.current, {
          center,
          zoom: 14,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: true,
          clickableIcons: false,
        });
        mapRef.current = map;

        if (customerCoords) {
          new google.maps.Marker({
            position: customerCoords,
            map,
            title: 'Your delivery location',
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 9,
              fillColor: '#16a34a',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2,
            },
            label: { text: 'You', color: '#fff', fontSize: '10px', fontWeight: '700' },
          });
        }

        if (restaurantCoords) {
          new google.maps.Marker({
            position: restaurantCoords,
            map,
            title: 'Restaurant',
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 9,
              fillColor: '#f97316',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2,
            },
            label: { text: 'R', color: '#fff', fontSize: '10px', fontWeight: '700' },
          });
        }

        // Fetch initial rider location
        const { data: riderData } = await supabase
          .from('riders')
          .select('current_latitude, current_longitude')
          .eq('id', riderId)
          .single();

        if (riderData?.current_latitude && riderData?.current_longitude) {
          setRiderCoords({
            lat: riderData.current_latitude,
            lng: riderData.current_longitude,
          });
        }

        setLoading(false);
      } catch (err: any) {
        console.error(err);
        setError('Could not load map');
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [riderId]);

  // Realtime rider updates
  useEffect(() => {
    if (!riderId) return;
    const channel = supabase
      .channel(`live-map-rider-${riderId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'riders', filter: `id=eq.${riderId}` },
        (payload) => {
          const lat = (payload.new as any).current_latitude;
          const lng = (payload.new as any).current_longitude;
          if (typeof lat === 'number' && typeof lng === 'number') {
            setRiderCoords({ lat, lng });
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [riderId]);

  // Update rider marker + recenter
  useEffect(() => {
    const google = googleRef.current;
    const map = mapRef.current;
    if (!google || !map || !riderCoords) return;

    if (!riderMarkerRef.current) {
      riderMarkerRef.current = new google.maps.Marker({
        position: riderCoords,
        map,
        title: 'Rider live location',
        icon: {
          path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
          fillColor: '#2563eb',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
          scale: 1.8,
          anchor: new google.maps.Point(12, 22),
        },
      });
    } else {
      riderMarkerRef.current.setPosition(riderCoords);
    }

    // Fit bounds to include rider + customer (+ restaurant)
    const bounds = new google.maps.LatLngBounds();
    bounds.extend(riderCoords);
    if (customerCoords) bounds.extend(customerCoords);
    if (restaurantCoords) bounds.extend(restaurantCoords);
    map.fitBounds(bounds, 60);
  }, [riderCoords, customerCoords, restaurantCoords]);

  return (
    <div className="space-y-2">
      <div
        className="relative w-full rounded-lg overflow-hidden border"
        style={{ height }}
      >
        <div ref={mapDivRef} className="w-full h-full" />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-destructive bg-background/80">
            {error}
          </div>
        )}
        {!loading && !error && !riderCoords && (
          <div className="absolute bottom-2 left-2 right-2 rounded-md bg-background/90 backdrop-blur px-3 py-2 text-xs text-muted-foreground flex items-center gap-2 shadow">
            <MapPin className="w-3.5 h-3.5" />
            Waiting for rider's live location...
          </div>
        )}
      </div>
      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#2563eb]" /> Rider
        </span>
        {restaurantCoords && (
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#f97316]" /> Restaurant
          </span>
        )}
        {customerCoords && (
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#16a34a]" /> You
          </span>
        )}
      </div>
    </div>
  );
}
