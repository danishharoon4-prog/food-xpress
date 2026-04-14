import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface LocationData {
  latitude: number;
  longitude: number;
  address: string;
}

interface DistanceData {
  distance: { text: string; value: number };
  duration: { text: string; value: number };
}

export function useLocation() {
  const [loading, setLoading] = useState(false);
  const [locationData, setLocationData] = useState<LocationData | null>(null);
  const { toast } = useToast();

  const getCurrentLocation = useCallback((): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by your browser'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => resolve(position),
        (error) => {
          switch (error.code) {
            case error.PERMISSION_DENIED:
              reject(new Error('Please allow location access to use this feature'));
              break;
            case error.POSITION_UNAVAILABLE:
              reject(new Error('Location information is unavailable'));
              break;
            case error.TIMEOUT:
              reject(new Error('Location request timed out'));
              break;
            default:
              reject(new Error('An unknown error occurred'));
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        }
      );
    });
  }, []);

  const getAddressFromCoordinates = useCallback(async (latitude: number, longitude: number): Promise<string> => {
    const { data, error } = await supabase.functions.invoke('location-services', {
      body: { action: 'geocode', latitude, longitude },
    });

    if (error) throw new Error(error.message);
    return data.address;
  }, []);

  const detectLocation = useCallback(async () => {
    setLoading(true);
    try {
      const position = await getCurrentLocation();
      const { latitude, longitude } = position.coords;
      
      // Try reverse geocoding, fallback to coordinate string if it fails
      let address: string;
      try {
        address = await getAddressFromCoordinates(latitude, longitude);
      } catch (geocodeError) {
        console.warn('Reverse geocoding failed, using coordinates as address:', geocodeError);
        address = `Lat: ${latitude.toFixed(6)}, Lng: ${longitude.toFixed(6)}`;
        toast({
          title: 'Location Detected',
          description: 'GPS coordinates captured. Address lookup unavailable.',
        });
      }
      
      const data = { latitude, longitude, address };
      setLocationData(data);
      
      return data;
    } catch (error: any) {
      toast({
        title: 'Location Error',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    } finally {
      setLoading(false);
    }
  }, [getCurrentLocation, getAddressFromCoordinates, toast]);

  const calculateDistance = useCallback(async (
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number }
  ): Promise<DistanceData> => {
    const { data, error } = await supabase.functions.invoke('location-services', {
      body: { action: 'distance', origin, destination },
    });

    if (error) throw new Error(error.message);
    return data;
  }, []);

  const getDirectionsUrl = useCallback(async (
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number }
  ): Promise<string> => {
    const { data, error } = await supabase.functions.invoke('location-services', {
      body: { action: 'directions_url', origin, destination },
    });

    if (error) throw new Error(error.message);
    return data.url;
  }, []);

  return {
    loading,
    locationData,
    setLocationData,
    detectLocation,
    calculateDistance,
    getDirectionsUrl,
    getCurrentLocation,
    getAddressFromCoordinates,
  };
}
