import { useEffect, useRef, useState } from 'react';
import { Loader2, MapPin, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { loadGoogleMaps } from '@/lib/googleMapsLoader';

interface Props {
  latitude: number | null | undefined;
  longitude: number | null | undefined;
  address?: string;
  height?: number;
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
