import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Bike, Home, Store, Radio, Locate, LocateFixed } from 'lucide-react';
import { loadGoogleMaps } from '@/lib/googleMapsLoader';

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

// SVG icon builders — inline data URLs so Google Marker can render them.
const iconSvg = (svgInner: string, bg: string, size = 42) => {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size + 10}" viewBox="0 0 ${size} ${size + 10}">
  <defs>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="1.5" flood-color="#000" flood-opacity="0.28"/>
    </filter>
  </defs>
  <g filter="url(#shadow)">
    <path d="M${size / 2} ${size + 8} L${size / 2 - 6} ${size - 4} L${size / 2 + 6} ${size - 4} Z" fill="${bg}"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 3}" fill="${bg}" stroke="#ffffff" stroke-width="2.5"/>
    <g transform="translate(${size / 2 - 10}, ${size / 2 - 10})" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      ${svgInner}
    </g>
  </g>
</svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

// Lucide-style icon paths (20x20)
const BIKE_SVG = `<circle cx="5.5" cy="15.5" r="3.5"/><circle cx="14.5" cy="15.5" r="3.5"/><path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" fill="#fff"/><path d="m14 15 -3-8 -3 4h4l3 4"/><path d="M8 7h2"/>`;
const HOME_SVG = `<path d="m3 10 7-7 7 7"/><path d="M5 9v9h10V9"/><path d="M8 18v-4h4v4"/>`;
const STORE_SVG = `<path d="M2 7h16l-1 3H3z"/><path d="M4 10v8h12v-8"/><path d="M8 18v-4h4v4"/><path d="M4 7 5 3h10l1 4"/>`;

export function LiveTrackingMap({
  riderId,
  customerCoords,
  restaurantCoords,
  height = 260,
}: Props) {
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const riderMarkerRef = useRef<any>(null);
  const riderPulseRef = useRef<any>(null);
  const pulseIntervalRef = useRef<number | null>(null);
  const googleRef = useRef<any>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [riderCoords, setRiderCoords] = useState<Coords | null>(null);
  const [autoFollow, setAutoFollow] = useState(true);
  const autoFollowRef = useRef(true);
  const hasInitialFitRef = useRef(false);
  const programmaticMoveRef = useRef(false);

  useEffect(() => {
    autoFollowRef.current = autoFollow;
  }, [autoFollow]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const google = await loadGoogleMaps();
        if (cancelled || !mapDivRef.current) return;
        googleRef.current = google;

        const center =
          customerCoords || restaurantCoords || { lat: 34.3299, lng: 73.1985 };

        // Minimal compact map style
        const compactStyle: any[] = [
          { elementType: 'geometry', stylers: [{ color: '#f7f9fc' }] },
          { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
          { elementType: 'labels.text.fill', stylers: [{ color: '#5b6472' }] },
          { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }] },
          { featureType: 'poi', stylers: [{ visibility: 'off' }] },
          { featureType: 'transit', stylers: [{ visibility: 'off' }] },
          { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
          { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#eef1f6' }] },
          { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#e4e9f2' }] },
          { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#d6ebf5' }] },
        ];

        const map = new google.maps.Map(mapDivRef.current, {
          center,
          zoom: 14,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          zoomControl: true,
          zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_BOTTOM },
          clickableIcons: false,
          gestureHandling: 'greedy',
          styles: compactStyle,
        });
        mapRef.current = map;

        // Disable auto-follow when the user drags the map manually
        map.addListener('dragstart', () => {
          if (!programmaticMoveRef.current && autoFollowRef.current) {
            setAutoFollow(false);
          }
        });

        if (customerCoords) {
          new google.maps.Marker({
            position: customerCoords,
            map,
            title: 'Your delivery location',
            icon: {
              url: iconSvg(HOME_SVG, '#16a34a'),
              scaledSize: new google.maps.Size(42, 52),
              anchor: new google.maps.Point(21, 50),
            },
          });
        }

        if (restaurantCoords) {
          new google.maps.Marker({
            position: restaurantCoords,
            map,
            title: 'Restaurant',
            icon: {
              url: iconSvg(STORE_SVG, '#f97316'),
              scaledSize: new google.maps.Size(42, 52),
              anchor: new google.maps.Point(21, 50),
            },
          });
        }

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
      if (pulseIntervalRef.current) {
        window.clearInterval(pulseIntervalRef.current);
        pulseIntervalRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [riderId]);

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

  useEffect(() => {
    const google = googleRef.current;
    const map = mapRef.current;
    if (!google || !map || !riderCoords) return;

    // Pulse ring under rider
    if (!riderPulseRef.current) {
      riderPulseRef.current = new google.maps.Marker({
        position: riderCoords,
        map,
        clickable: false,
        zIndex: 1,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 12,
          fillColor: '#2563eb',
          fillOpacity: 0.25,
          strokeColor: '#2563eb',
          strokeOpacity: 0.5,
          strokeWeight: 1,
        },
      });

      // Animate pulse
      let step = 0;
      pulseIntervalRef.current = window.setInterval(() => {
        step = (step + 1) % 30;
        const t = step / 30;
        const scale = 10 + t * 20;
        const opacity = 0.35 * (1 - t);
        riderPulseRef.current?.setIcon({
          path: google.maps.SymbolPath.CIRCLE,
          scale,
          fillColor: '#2563eb',
          fillOpacity: opacity,
          strokeColor: '#2563eb',
          strokeOpacity: opacity + 0.15,
          strokeWeight: 1,
        });
      }, 60);
    } else {
      riderPulseRef.current.setPosition(riderCoords);
    }

    if (!riderMarkerRef.current) {
      riderMarkerRef.current = new google.maps.Marker({
        position: riderCoords,
        map,
        title: 'Rider live location',
        zIndex: 999,
        animation: google.maps.Animation.DROP,
        icon: {
          url: iconSvg(BIKE_SVG, '#2563eb'),
          scaledSize: new google.maps.Size(46, 56),
          anchor: new google.maps.Point(23, 54),
        },
      });
    } else {
      riderMarkerRef.current.setPosition(riderCoords);
    }

    if (autoFollowRef.current) {
      programmaticMoveRef.current = true;
      map.panTo(riderCoords);
      if (!hasInitialFitRef.current) {
        const bounds = new google.maps.LatLngBounds();
        bounds.extend(riderCoords);
        if (customerCoords) bounds.extend(customerCoords);
        if (restaurantCoords) bounds.extend(restaurantCoords);
        map.fitBounds(bounds, 70);
        hasInitialFitRef.current = true;
      }
      window.setTimeout(() => {
        programmaticMoveRef.current = false;
      }, 300);
    }
  }, [riderCoords, customerCoords, restaurantCoords, autoFollow]);

  return (
    <div className="rounded-2xl overflow-hidden border border-border/60 bg-card shadow-sm animate-fade-in">
      {/* Compact header */}
      <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b border-border/40">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-xs font-semibold tracking-wide uppercase text-foreground">
            Live Tracking
          </span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Radio className="w-3 h-3" />
          Realtime
        </div>
      </div>

      <div className="relative w-full" style={{ height }}>
        <div ref={mapDivRef} className="w-full h-full" />

        {/* Auto-follow toggle */}
        {!loading && !error && (
          <button
            type="button"
            onClick={() => setAutoFollow((v) => !v)}
            disabled={!riderCoords}
            className={`absolute top-2 right-2 z-10 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-semibold shadow-md backdrop-blur transition-all border ${
              autoFollow
                ? 'bg-primary text-primary-foreground border-primary/60 shadow-primary/30'
                : 'bg-background/90 text-foreground border-border hover:bg-background'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            title={autoFollow ? 'Auto-follow rider is ON' : 'Auto-follow rider is OFF'}
          >
            {autoFollow ? (
              <LocateFixed className="w-3.5 h-3.5" />
            ) : (
              <Locate className="w-3.5 h-3.5" />
            )}
            {autoFollow ? 'Following' : 'Follow rider'}
          </button>
        )}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-sm">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-destructive bg-background/80">
            {error}
          </div>
        )}
        {!loading && !error && !riderCoords && (
          <div className="absolute bottom-2 left-2 right-2 rounded-lg bg-background/95 backdrop-blur px-3 py-2 text-xs text-muted-foreground flex items-center gap-2 shadow-md animate-fade-in">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            Waiting for rider's live location...
          </div>
        )}
      </div>

      {/* Compact legend */}
      <div className="flex items-center justify-around px-3 py-2 bg-muted/30 border-t border-border/40 text-[11px]">
        <span className="flex items-center gap-1.5 text-foreground/80">
          <span className="w-6 h-6 rounded-full bg-[#2563eb] text-white flex items-center justify-center shadow-sm">
            <Bike className="w-3.5 h-3.5" />
          </span>
          Rider
        </span>
        {restaurantCoords && (
          <span className="flex items-center gap-1.5 text-foreground/80">
            <span className="w-6 h-6 rounded-full bg-[#f97316] text-white flex items-center justify-center shadow-sm">
              <Store className="w-3.5 h-3.5" />
            </span>
            Restaurant
          </span>
        )}
        {customerCoords && (
          <span className="flex items-center gap-1.5 text-foreground/80">
            <span className="w-6 h-6 rounded-full bg-[#16a34a] text-white flex items-center justify-center shadow-sm">
              <Home className="w-3.5 h-3.5" />
            </span>
            You
          </span>
        )}
      </div>
    </div>
  );
}
