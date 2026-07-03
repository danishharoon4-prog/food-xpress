import { useEffect, useRef, useState, useCallback } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { MapPin, Loader2, LocateFixed } from 'lucide-react';

interface LocationPickerProps {
  value: string;
  onChange: (address: string, coords?: { latitude: number; longitude: number }) => void;
  placeholder?: string;
}

// Default center: Mansehra, Pakistan
const DEFAULT_CENTER = { lat: 34.3309, lng: 73.1968 };

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
      const existing = document.getElementById('google-maps-js');
      if (existing) {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () => reject(new Error('Maps load failed')));
        if ((window as any).google?.maps) resolve();
        return;
      }
      const script = document.createElement('script');
      script.id = 'google-maps-js';
      script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places&loading=async`;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Maps load failed'));
      document.head.appendChild(script);
    });

    return (window as any).google;
  })();

  return mapsLoaderPromise;
}

export function LocationPicker({ value, onChange, placeholder = "Your address will appear here..." }: LocationPickerProps) {
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
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

        // Try GPS for initial centering only (silent — no manual button)
        const initialCenter = await new Promise<{ lat: number; lng: number }>((resolve) => {
          if (!navigator.geolocation) return resolve(DEFAULT_CENTER);
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            () => resolve(DEFAULT_CENTER),
            { timeout: 5000, enableHighAccuracy: true }
          );
        });

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
        // Trigger initial reverse geocode so address auto-fills
        setPin(initialCenter.lat, initialCenter.lng, false);
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
