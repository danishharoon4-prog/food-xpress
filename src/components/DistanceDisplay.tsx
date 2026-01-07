import { useEffect, useState } from 'react';
import { useLocation } from '@/hooks/useLocation';
import { MapPin, Clock, Route, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DistanceDisplayProps {
  restaurantCoords?: { lat: number; lng: number } | null;
  customerCoords?: { lat: number; lng: number } | null;
  showDirectionsButton?: boolean;
}

interface DistanceInfo {
  distance: { text: string; value: number };
  duration: { text: string; value: number };
}

export function DistanceDisplay({ 
  restaurantCoords, 
  customerCoords, 
  showDirectionsButton = false 
}: DistanceDisplayProps) {
  const { calculateDistance, getDirectionsUrl } = useLocation();
  const [distanceInfo, setDistanceInfo] = useState<DistanceInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [directionsUrl, setDirectionsUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchDistance = async () => {
      if (!restaurantCoords || !customerCoords) return;
      
      setLoading(true);
      try {
        const [distance, url] = await Promise.all([
          calculateDistance(restaurantCoords, customerCoords),
          showDirectionsButton ? getDirectionsUrl(restaurantCoords, customerCoords) : Promise.resolve(null),
        ]);
        
        setDistanceInfo(distance);
        if (url) setDirectionsUrl(url);
      } catch (error) {
        console.error('Failed to calculate distance:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDistance();
  }, [restaurantCoords, customerCoords, calculateDistance, getDirectionsUrl, showDirectionsButton]);

  if (!restaurantCoords || !customerCoords) {
    return null;
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        Calculating distance...
      </div>
    );
  }

  if (!distanceInfo) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1.5">
          <Route className="w-4 h-4 text-primary" />
          <span className="font-medium">{distanceInfo.distance.text}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="w-4 h-4 text-primary" />
          <span className="font-medium">{distanceInfo.duration.text}</span>
        </div>
      </div>

      {showDirectionsButton && directionsUrl && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.open(directionsUrl, '_blank')}
          className="w-full"
        >
          <ExternalLink className="w-4 h-4 mr-2" />
          Get Directions in Google Maps
        </Button>
      )}
    </div>
  );
}
