import { useEffect, useRef, useState, useCallback } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { MapPin, Loader2, LocateFixed } from 'lucide-react';
import { loadGoogleMaps } from '@/lib/googleMapsLoader';

interface LocationPickerProps {
  value: string;
  onChange: (address: string, coords?: { latitude: number; longitude: number }) => void;
  placeholder?: string;
  initialCoords?: { latitude: number; longitude: number } | null;
}

// Default center: Mansehra, Pakistan
const DEFAULT_CENTER = { lat: 34.3309, lng: 73.1968 };

export function LocationPicker({ value, onChange, placeholder = "Your address will appear here...", initialCoords }: LocationPickerProps) {
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(
    initialCoords ?? null
  );
  const { toast } = useToast();

  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    setResolving(true);
    try {
      const { data, error } = await supabase.functions.invoke('location-services', {
        body: { action: 'geocode', latitude: lat, longitude: lng },
      });
      const address = !error && data?.address
        ? data.address
        : `Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`;
      onChange(address, { latitude: lat, longitude: lng });
    } finally {
      setResolving(false);
    }
  }, [onChange]);

  const setPin = useCallback((lat: number, lng: number, recenter = false) => {
    setCoords({ latitude: lat, longitude: lng });
    if (markerRef.current) {
      markerRef.current.setPosition({ lat, lng });
    }
    if (mapRef.current && recenter) {
      mapRef.current.panTo({ lat, lng });
    }
    reverseGeocode(lat, lng);
  }, [reverseGeocode]);

  const locateMe = useCallback(() => {
    if (!navigator.geolocation) {
      toast({ title: 'GPS not available', description: 'Your browser does not support geolocation.', variant: 'destructive' });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setPin(pos.coords.latitude, pos.coords.longitude, true);
      },
      (err) => {
        setLocating(false);
        toast({
          title: 'Location error',
          description: err.code === err.PERMISSION_DENIED
            ? 'Please allow location access in your browser.'
            : 'Could not detect your location. Try again.',
          variant: 'destructive',
        });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [setPin, toast]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const google = await loadGoogleMaps();
        if (cancelled || !mapDivRef.current) return;

        // Use saved coords if provided; otherwise try GPS silently, else default center
        let initialCenter: { lat: number; lng: number };
        if (initialCoords) {
          initialCenter = { lat: initialCoords.latitude, lng: initialCoords.longitude };
        } else {
          initialCenter = await new Promise<{ lat: number; lng: number }>((resolve) => {
            if (!navigator.geolocation) return resolve(DEFAULT_CENTER);
            navigator.geolocation.getCurrentPosition(
              (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
              () => resolve(DEFAULT_CENTER),
              { timeout: 5000, enableHighAccuracy: true }
            );
          });
        }

        const map = new google.maps.Map(mapDivRef.current, {
          center: initialCenter,
          zoom: 15,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          clickableIcons: false,
        });
        mapRef.current = map;

        const marker = new google.maps.Marker({
          position: initialCenter,
          map,
          draggable: true,
          animation: google.maps.Animation.DROP,
        });
        markerRef.current = marker;

        map.addListener('click', (e: any) => {
          if (!e.latLng) return;
          setPin(e.latLng.lat(), e.latLng.lng(), true);
        });
        marker.addListener('dragend', (e: any) => {
          if (!e.latLng) return;
          setPin(e.latLng.lat(), e.latLng.lng(), false);
        });

        setLoading(false);
        // If we already had saved coords + address, don't re-geocode (avoid overwriting saved address)
        if (!initialCoords) {
          setPin(initialCenter.lat, initialCenter.lng, false);
        } else {
          setCoords({ latitude: initialCenter.lat, longitude: initialCenter.lng });
        }
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-3">
      <div className="relative w-full rounded-lg overflow-hidden border border-border" style={{ height: 320 }}>
        <div ref={mapDivRef} className="w-full h-full" />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}
        {!loading && (
          <div className="absolute top-2 left-2 right-2 bg-background/90 backdrop-blur rounded-md px-3 py-2 text-xs text-muted-foreground flex items-center gap-2 shadow-sm">
            <MapPin className="w-3.5 h-3.5 text-primary" />
            Tap the map or drag the pin to set your exact location
          </div>
        )}
        {!loading && (
          <Button
            type="button"
            size="sm"
            onClick={locateMe}
            disabled={locating}
            className="absolute bottom-3 right-3 gradient-primary shadow-glow"
          >
            {locating ? (
              <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Locating…</>
            ) : (
              <><LocateFixed className="w-4 h-4 mr-1" /> Use my GPS</>
            )}
          </Button>
        )}
      </div>

      <div className="relative">
        <MapPin className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
        <Textarea
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value, coords ?? undefined)}
          rows={2}
          className="pl-10"
        />
        {resolving && (
          <Loader2 className="absolute right-3 top-3 w-4 h-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {coords && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <MapPin className="w-3 h-3" />
          Pinned: {coords.latitude.toFixed(6)}, {coords.longitude.toFixed(6)}
        </p>
      )}
    </div>
  );
}
