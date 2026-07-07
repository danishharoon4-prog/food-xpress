import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLocation } from '@/hooks/useLocation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bike, MapPin, Clock, Route, Loader2, Navigation, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { loadGoogleMaps } from '@/lib/googleMapsLoader';


interface LiveRiderTrackingProps {
  riderId: string | null;
  customerCoords: { lat: number; lng: number } | null;
  orderStatus: string;
}

interface RiderLocation {
  current_latitude: number | null;
  current_longitude: number | null;
  is_online: boolean;
}

interface DistanceInfo {
  distance: { text: string; value: number };
  duration: { text: string; value: number };
}

export function LiveRiderTracking({ riderId, customerCoords, orderStatus }: LiveRiderTrackingProps) {
  const { calculateDistance, getDirectionsUrl } = useLocation();
  const [riderLocation, setRiderLocation] = useState<RiderLocation | null>(null);
  const [distanceInfo, setDistanceInfo] = useState<DistanceInfo | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const riderMarkerRef = useRef<any>(null);
  const customerMarkerRef = useRef<any>(null);
  const [mapError, setMapError] = useState<string | null>(null);


  // Fetch initial rider location
  const fetchRiderLocation = useCallback(async () => {
    if (!riderId) return;
    
    console.log('Fetching rider location for:', riderId);
    const { data, error } = await supabase
      .from('riders')
      .select('current_latitude, current_longitude, is_online')
      .eq('id', riderId)
      .single();
    
    if (error) {
      console.error('Error fetching rider location:', error);
      return;
    }
    
    if (data) {
      console.log('Rider location:', data);
      setRiderLocation(data);
      setLastUpdated(new Date());
    }
    setLoading(false);
  }, [riderId]);

  // Calculate distance when rider location changes
  useEffect(() => {
    const updateDistance = async () => {
      if (!riderLocation?.current_latitude || !riderLocation?.current_longitude || !customerCoords) {
        return;
      }
      
      try {
        const distance = await calculateDistance(
          { lat: riderLocation.current_latitude, lng: riderLocation.current_longitude },
          customerCoords
        );
        setDistanceInfo(distance);
      } catch (error) {
        console.error('Error calculating distance:', error);
      }
    };
    
    updateDistance();
  }, [riderLocation, customerCoords, calculateDistance]);

  // Subscribe to real-time rider location updates
  useEffect(() => {
    if (!riderId) {
      setLoading(false);
      return;
    }
    
    fetchRiderLocation();
    
    // Real-time subscription for rider location updates
    const channel = supabase
      .channel(`rider-location-${riderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'riders',
          filter: `id=eq.${riderId}`,
        },
        (payload) => {
          console.log('Rider location updated:', payload.new);
          setRiderLocation({
            current_latitude: payload.new.current_latitude,
            current_longitude: payload.new.current_longitude,
            is_online: payload.new.is_online,
          });
          setLastUpdated(new Date());
        }
      )
      .subscribe();
    
    return () => {
      console.log('Unsubscribing from rider location updates');
      supabase.removeChannel(channel);
    };
  }, [riderId, fetchRiderLocation]);

  const openRiderLocation = async () => {
    if (riderLocation?.current_latitude && riderLocation?.current_longitude) {
      window.open(
        `https://www.google.com/maps?q=${riderLocation.current_latitude},${riderLocation.current_longitude}`,
        '_blank'
      );
    }
  };

  const openDirections = async () => {
    if (riderLocation?.current_latitude && riderLocation?.current_longitude && customerCoords) {
      const url = await getDirectionsUrl(
        { lat: riderLocation.current_latitude, lng: riderLocation.current_longitude },
        customerCoords
      );
      window.open(url, '_blank');
    }
  };

  // Only show tracking for relevant order statuses
  const showTracking = ['picked_up', 'on_the_way'].includes(orderStatus);
  
  if (!riderId || !showTracking) {
    return null;
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading rider location...
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasLocation = riderLocation?.current_latitude && riderLocation?.current_longitude;

  return (
    <Card className="border-primary/50 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Bike className="w-5 h-5 text-primary" />
              {riderLocation?.is_online && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" />
              )}
            </div>
            Live Rider Tracking
          </div>
          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
            <span className="w-2 h-2 bg-green-500 rounded-full mr-1.5 animate-pulse" />
            Live
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasLocation ? (
          <>
            {/* Distance and ETA */}
            {distanceInfo && (
              <div className="flex items-center gap-6 p-3 rounded-lg bg-background">
                <div className="flex items-center gap-2">
                  <Route className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-lg font-bold">{distanceInfo.distance.text}</p>
                    <p className="text-xs text-muted-foreground">away</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-lg font-bold">{distanceInfo.duration.text}</p>
                    <p className="text-xs text-muted-foreground">ETA</p>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={openRiderLocation}
                className="flex-1"
              >
                <MapPin className="w-4 h-4 mr-2" />
                See Rider Location
              </Button>
              {customerCoords && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={openDirections}
                  className="flex-1"
                >
                  <Navigation className="w-4 h-4 mr-2" />
                  Track Route
                </Button>
              )}
            </div>

            {/* Last Updated */}
            {lastUpdated && (
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  Last updated: {lastUpdated.toLocaleTimeString()}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={fetchRiderLocation}
                  className="h-6 px-2"
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Refresh
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-4 text-muted-foreground">
            <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>Waiting for rider location...</p>
            <p className="text-xs">The rider will share their location soon</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
