import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Loader2,
  Bike,
  Home,
  Store,
  Radio,
  Locate,
  LocateFixed,
  Route,
  Clock,
  Navigation,
  MapPin,
  PackageCheck,
} from 'lucide-react';
import { loadGoogleMaps } from '@/lib/googleMapsLoader';
import { useLocation } from '@/hooks/useLocation';
import { Button } from '@/components/ui/button';

interface Coords {
  lat: number;
  lng: number;
}

interface Props {
  /** Rider id — omit / null for self-delivery mode */
  riderId?: string | null;
  customerCoords: Coords | null;
  restaurantCoords?: Coords | null;
  /** Current order status — used to gate what we show */
  orderStatus?: string;
  /** Restaurant delivering itself (no rider) */
  isSelfDelivery?: boolean;
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
  orderStatus,
  isSelfDelivery = false,
  height = 280,
}: Props) {
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const riderMarkerRef = useRef<any>(null);
  const riderPulseRef = useRef<any>(null);
  const routeLineRef = useRef<any>(null);
  const pulseIntervalRef = useRef<number | null>(null);
  const googleRef = useRef<any>(null);
  // Refs used to smoothly animate the rider marker between fixes
  const currentRiderPosRef = useRef<Coords | null>(null);
  const animRafRef = useRef<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [riderCoords, setRiderCoords] = useState<Coords | null>(null);
  const [autoFollow, setAutoFollow] = useState(true);
  const autoFollowRef = useRef(true);
  const hasInitialFitRef = useRef(false);
  const programmaticMoveRef = useRef(false);
  const [distanceInfo, setDistanceInfo] = useState<{
    distance: { text: string; value: number };
    duration: { text: string; value: number };
  } | null>(null);
  const prevDistanceRef = useRef<number | null>(null);
  const prevDurationRef = useRef<number | null>(null);
  const [distanceDelta, setDistanceDelta] = useState<'down' | 'up' | null>(null);
  const [durationDelta, setDurationDelta] = useState<'down' | 'up' | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [pingKey, setPingKey] = useState(0);


  const { calculateDistance, getDirectionsUrl } = useLocation();

  const trackingRider = !isSelfDelivery && !!riderId;

  // Origin used for distance/ETA + route line
  const originCoords: Coords | null = useMemo(() => {
    if (trackingRider) return riderCoords;
    return restaurantCoords || null;
  }, [trackingRider, riderCoords, restaurantCoords]);

  useEffect(() => {
    autoFollowRef.current = autoFollow;
  }, [autoFollow]);

  // Initialize map
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const google = await loadGoogleMaps();
        if (cancelled || !mapDivRef.current) return;
        googleRef.current = google;

        const center =
          customerCoords || restaurantCoords || { lat: 34.3299, lng: 73.1985 };

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

        // For self-delivery, we don't wait for rider — fit both immediately
        if (!trackingRider) {
          const bounds = new google.maps.LatLngBounds();
          if (customerCoords) bounds.extend(customerCoords);
          if (restaurantCoords) bounds.extend(restaurantCoords);
          if (customerCoords && restaurantCoords) {
            map.fitBounds(bounds, 70);
            hasInitialFitRef.current = true;
          }
        }

        if (trackingRider) {
          const { data: riderData } = await supabase
            .from('riders')
            .select('current_latitude, current_longitude')
            .eq('id', riderId!)
            .single();

          if (riderData?.current_latitude && riderData?.current_longitude) {
            setRiderCoords({
              lat: riderData.current_latitude,
              lng: riderData.current_longitude,
            });
            setLastUpdated(new Date());
          }
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
  }, [riderId, isSelfDelivery]);

  // Realtime rider position
  useEffect(() => {
    if (!trackingRider || !riderId) return;
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
            setLastUpdated(new Date());
            setPingKey((k) => k + 1);
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [riderId, trackingRider]);

  // Draw / update rider marker — with smooth interpolation between fixes
  useEffect(() => {
    const google = googleRef.current;
    const map = mapRef.current;
    if (!google || !map || !trackingRider || !riderCoords) return;


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
  }, [riderCoords, customerCoords, restaurantCoords, trackingRider]);

  // Draw a simple straight route line from origin -> customer
  useEffect(() => {
    const google = googleRef.current;
    const map = mapRef.current;
    if (!google || !map || !originCoords || !customerCoords) return;

    if (routeLineRef.current) {
      routeLineRef.current.setPath([originCoords, customerCoords]);
    } else {
      routeLineRef.current = new google.maps.Polyline({
        path: [originCoords, customerCoords],
        map,
        strokeColor: '#2563eb',
        strokeOpacity: 0,
        icons: [
          {
            icon: {
              path: 'M 0,-1 0,1',
              strokeOpacity: 0.9,
              strokeWeight: 3,
              scale: 3,
            },
            offset: '0',
            repeat: '14px',
          },
        ],
      });
    }
  }, [originCoords, customerCoords]);

  // Distance + ETA
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!originCoords || !customerCoords) {
        setDistanceInfo(null);
        return;
      }
      try {
        const info = await calculateDistance(originCoords, customerCoords);
        if (!cancelled) setDistanceInfo(info);
      } catch (e) {
        console.error('Distance calc failed', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [originCoords, customerCoords, calculateDistance]);

  const openDirections = async () => {
    if (!originCoords || !customerCoords) return;
    try {
      const url = await getDirectionsUrl(originCoords, customerCoords);
      window.open(url, '_blank');
    } catch {
      window.open(
        `https://www.google.com/maps/dir/?api=1&origin=${originCoords.lat},${originCoords.lng}&destination=${customerCoords.lat},${customerCoords.lng}`,
        '_blank'
      );
    }
  };

  const openOriginPin = () => {
    if (!originCoords) return;
    window.open(
      `https://www.google.com/maps?q=${originCoords.lat},${originCoords.lng}`,
      '_blank'
    );
  };

  // Contextual label for the origin (what's moving toward the customer)
  const isPickedUp = orderStatus === 'picked_up';
  const originLabel = trackingRider
    ? isPickedUp
      ? 'Rider picked up your order'
      : 'Rider is on the way'
    : 'Restaurant is delivering';

  return (
    <div className="rounded-2xl overflow-hidden border border-border/60 bg-card shadow-sm animate-fade-in">
      {/* Header */}
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

      {/* Context strip */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/40 bg-background/60">
        <div
          className={`w-7 h-7 rounded-full flex items-center justify-center text-white shrink-0 ${
            trackingRider ? 'bg-[#2563eb]' : 'bg-[#f97316]'
          }`}
        >
          {trackingRider ? (
            isPickedUp ? <PackageCheck className="w-3.5 h-3.5" /> : <Bike className="w-3.5 h-3.5" />
          ) : (
            <Store className="w-3.5 h-3.5" />
          )}
        </div>
        <p className="text-xs font-medium text-foreground flex-1 min-w-0 truncate">{originLabel}</p>
        {lastUpdated && trackingRider && (
          <span className="text-[10px] text-muted-foreground shrink-0">
            {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      {/* Map */}
      <div className="relative w-full" style={{ height }}>
        <div ref={mapDivRef} className="w-full h-full" />

        {!loading && !error && trackingRider && (
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
            {autoFollow ? <LocateFixed className="w-3.5 h-3.5" /> : <Locate className="w-3.5 h-3.5" />}
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
        {!loading && !error && trackingRider && !riderCoords && (
          <div className="absolute bottom-2 left-2 right-2 rounded-lg bg-background/95 backdrop-blur px-3 py-2 text-xs text-muted-foreground flex items-center gap-2 shadow-md animate-fade-in">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            Waiting for rider's live location…
          </div>
        )}
      </div>

      {/* ETA / Distance stats */}
      <div className="grid grid-cols-2 gap-2 px-3 py-3 border-t border-border/40 bg-background/60">
        <div className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-card px-3 py-2">
          <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Route className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Distance</p>
            <p className="text-sm font-bold truncate">
              {distanceInfo?.distance?.text || (trackingRider && !riderCoords ? '—' : 'Calculating…')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-card px-3 py-2">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">ETA</p>
            <p className="text-sm font-bold truncate">
              {distanceInfo?.duration?.text || (trackingRider && !riderCoords ? '—' : 'Calculating…')}
            </p>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 px-3 pb-3">
        {trackingRider && (
          <Button
            variant="outline"
            size="sm"
            onClick={openOriginPin}
            disabled={!riderCoords}
            className="flex-1"
          >
            <MapPin className="w-4 h-4 mr-1.5" />
            Rider Pin
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={openDirections}
          disabled={!originCoords || !customerCoords}
          className="flex-1"
        >
          <Navigation className="w-4 h-4 mr-1.5" />
          Directions
        </Button>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-around px-3 py-2 bg-muted/30 border-t border-border/40 text-[11px]">
        {trackingRider && (
          <span className="flex items-center gap-1.5 text-foreground/80">
            <span className="w-6 h-6 rounded-full bg-[#2563eb] text-white flex items-center justify-center shadow-sm">
              <Bike className="w-3.5 h-3.5" />
            </span>
            Rider
          </span>
        )}
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
