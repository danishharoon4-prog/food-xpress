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
  const [isStale, setIsStale] = useState(false);

  // How long without a rider fix before we consider the location stale
  const STALE_AFTER_MS = 15_000;



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
      if (animRafRef.current) {
        cancelAnimationFrame(animRafRef.current);
        animRafRef.current = null;
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
      currentRiderPosRef.current = riderCoords;
    } else {
      // Smoothly interpolate from previous position → new fix
      const from = currentRiderPosRef.current || riderCoords;
      const to = riderCoords;
      const DURATION = 700; // ms — matches typical realtime fix cadence
      const start = performance.now();
      if (animRafRef.current) cancelAnimationFrame(animRafRef.current);

      const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / DURATION);
        const k = easeOutCubic(t);
        const lat = from.lat + (to.lat - from.lat) * k;
        const lng = from.lng + (to.lng - from.lng) * k;
        const pos = { lat, lng };
        riderMarkerRef.current?.setPosition(pos);
        riderPulseRef.current?.setPosition(pos);
        // Live-update the origin end of the route so the dashed line tracks the bike
        if (routeLineRef.current && customerCoords) {
          routeLineRef.current.setPath([pos, customerCoords]);
        }
        if (autoFollowRef.current) {
          programmaticMoveRef.current = true;
          mapRef.current?.panTo(pos);
        }
        if (t < 1) {
          animRafRef.current = requestAnimationFrame(tick);
        } else {
          currentRiderPosRef.current = to;
          animRafRef.current = null;
          window.setTimeout(() => {
            programmaticMoveRef.current = false;
          }, 60);
        }
      };
      animRafRef.current = requestAnimationFrame(tick);
    }

    // Initial fit — only fires the first time we have all three points
    if (autoFollowRef.current && !hasInitialFitRef.current) {
      programmaticMoveRef.current = true;
      const bounds = new google.maps.LatLngBounds();
      bounds.extend(riderCoords);
      if (customerCoords) bounds.extend(customerCoords);
      if (restaurantCoords) bounds.extend(restaurantCoords);
      map.fitBounds(bounds, 70);
      hasInitialFitRef.current = true;
      window.setTimeout(() => {
        programmaticMoveRef.current = false;
      }, 400);
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

  // Distance + ETA — paused while the rider fix is stale to avoid showing
  // misleading numbers computed from a frozen position.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!originCoords || !customerCoords) {
        setDistanceInfo(null);
        return;
      }
      if (trackingRider && isStale) {
        // Keep the last known ETA/distance visible; just don't refresh it.
        return;
      }

      try {
        const info = await calculateDistance(originCoords, customerCoords);
        if (cancelled) return;

        // Compare vs previous fix to show a subtle "getting closer" / "delayed" cue
        const prevD = prevDistanceRef.current;
        const prevT = prevDurationRef.current;
        if (prevD != null && Math.abs(info.distance.value - prevD) > 5) {
          setDistanceDelta(info.distance.value < prevD ? 'down' : 'up');
        }
        if (prevT != null && Math.abs(info.duration.value - prevT) > 5) {
          setDurationDelta(info.duration.value < prevT ? 'down' : 'up');
        }
        prevDistanceRef.current = info.distance.value;
        prevDurationRef.current = info.duration.value;

        setDistanceInfo(info);
      } catch (e) {
        console.error('Distance calc failed', e);
      }

    })();
    return () => {
      cancelled = true;
    };
  }, [originCoords, customerCoords, calculateDistance, trackingRider, isStale]);

  // Stale-location watchdog: mark rider as stale if no fix arrives within
  // STALE_AFTER_MS. Resets on every new lastUpdated timestamp.
  useEffect(() => {
    if (!trackingRider) {
      setIsStale(false);
      return;
    }
    if (!lastUpdated) return;
    setIsStale(false);
    const t = window.setTimeout(() => setIsStale(true), STALE_AFTER_MS);
    return () => window.clearTimeout(t);
  }, [lastUpdated, trackingRider]);

  // Dim the rider marker + pulse when stale so the map communicates
  // "this is the last known position, not live".
  useEffect(() => {
    if (!riderMarkerRef.current) return;
    riderMarkerRef.current.setOpacity?.(isStale ? 0.55 : 1);
    if (riderPulseRef.current) {
      // Hide the pulsing ring entirely while stale — it implies live signal
      riderPulseRef.current.setVisible?.(!isStale);
    }
  }, [isStale]);



  // Auto-clear the delta chips a moment after they light up
  useEffect(() => {
    if (!distanceDelta) return;
    const t = window.setTimeout(() => setDistanceDelta(null), 2200);
    return () => window.clearTimeout(t);
  }, [distanceDelta, distanceInfo?.distance?.value]);

  useEffect(() => {
    if (!durationDelta) return;
    const t = window.setTimeout(() => setDurationDelta(null), 2200);
    return () => window.clearTimeout(t);
  }, [durationDelta, distanceInfo?.duration?.value]);


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
  const showStale = trackingRider && isStale && !!lastUpdated;
  const originLabel = trackingRider
    ? showStale
      ? 'Last known rider location'
      : isPickedUp
        ? 'Rider picked up your order'
        : 'Rider is on the way'
    : 'Restaurant is delivering';

  // Human-friendly "X seconds/minutes ago"
  const formatAgo = (d: Date) => {
    const s = Math.floor((Date.now() - d.getTime()) / 1000);
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m} min ago`;
    return `${Math.floor(m / 60)}h ago`;
  };

  return (
    <div className="rounded-2xl overflow-hidden border border-border/60 bg-card shadow-sm animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b border-border/40">
        <div className="flex items-center gap-2">
          <span key={pingKey} className="relative flex h-2 w-2">
            {!showStale && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
            )}
            <span
              className={`relative inline-flex rounded-full h-2 w-2 transition-colors duration-300 ${
                showStale ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
            />
          </span>
          <span className="text-xs font-semibold tracking-wide uppercase text-foreground">
            {showStale ? 'Signal Paused' : 'Live Tracking'}
          </span>
        </div>
        <div
          className={`flex items-center gap-1 text-[10px] transition-colors ${
            showStale ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'
          }`}
        >
          <Radio key={`radio-${pingKey}`} className="w-3 h-3 animate-fade-in" />
          {showStale ? 'Waiting for signal' : 'Realtime'}
        </div>
      </div>


      {/* Context strip */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/40 bg-background/60">
        <div
          className={`w-7 h-7 rounded-full flex items-center justify-center text-white shrink-0 transition-transform duration-300 ${
            trackingRider ? 'bg-[#2563eb]' : 'bg-[#f97316]'
          }`}
          style={{ transform: pingKey ? 'scale(1)' : 'scale(1)' }}
        >
          {trackingRider ? (
            isPickedUp ? <PackageCheck className="w-3.5 h-3.5" /> : <Bike key={pingKey} className="w-3.5 h-3.5 animate-fade-in" />
          ) : (
            <Store className="w-3.5 h-3.5" />
          )}
        </div>

        <p className="text-xs font-medium text-foreground flex-1 min-w-0 truncate">{originLabel}</p>
        {lastUpdated && trackingRider && (
          <span
            key={`upd-${pingKey}`}
            className={`text-[10px] shrink-0 animate-fade-in flex items-center gap-1 px-1.5 py-0.5 rounded-full transition-colors ${
              showStale
                ? 'text-amber-700 dark:text-amber-400 bg-amber-500/10'
                : 'text-muted-foreground'
            }`}
            title={
              showStale
                ? `No GPS update since ${lastUpdated.toLocaleTimeString()}`
                : 'Last GPS update'
            }
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                showStale ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'
              }`}
            />
            {showStale
              ? `Last known · ${formatAgo(lastUpdated)}`
              : lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
        <div
          className={`relative flex items-center gap-2.5 rounded-xl border bg-card px-3 py-2 transition-all duration-500 ${
            distanceDelta === 'down'
              ? 'border-emerald-500/50 shadow-[0_0_0_3px_hsl(var(--primary)/0.05)]'
              : distanceDelta === 'up'
                ? 'border-amber-500/50'
                : 'border-border/60'
          }`}
        >
          <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Route className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Distance</p>
            <p
              key={`d-${distanceInfo?.distance?.text ?? 'none'}`}
              className="text-sm font-bold truncate animate-fade-in"
            >
              {distanceInfo?.distance?.text || (trackingRider && !riderCoords ? '—' : 'Calculating…')}
            </p>
          </div>
          {distanceDelta && (
            <span
              className={`absolute top-1.5 right-1.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full animate-fade-in ${
                distanceDelta === 'down'
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                  : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
              }`}
            >
              {distanceDelta === 'down' ? '↓ closer' : '↑ farther'}
            </span>
          )}
        </div>

        <div
          className={`relative flex items-center gap-2.5 rounded-xl border bg-card px-3 py-2 transition-all duration-500 ${
            durationDelta === 'down'
              ? 'border-emerald-500/50'
              : durationDelta === 'up'
                ? 'border-amber-500/50'
                : 'border-border/60'
          }`}
        >
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">ETA</p>
            <p
              key={`t-${distanceInfo?.duration?.text ?? 'none'}`}
              className="text-sm font-bold truncate animate-fade-in"
            >
              {distanceInfo?.duration?.text || (trackingRider && !riderCoords ? '—' : 'Calculating…')}
            </p>
          </div>
          {durationDelta && (
            <span
              className={`absolute top-1.5 right-1.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full animate-fade-in ${
                durationDelta === 'down'
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                  : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
              }`}
            >
              {durationDelta === 'down' ? '↓ sooner' : '↑ delayed'}
            </span>
          )}
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
