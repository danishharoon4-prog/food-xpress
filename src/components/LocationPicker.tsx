import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useLocation } from '@/hooks/useLocation';
import { MapPin, Crosshair, Loader2, Navigation } from 'lucide-react';

interface LocationPickerProps {
  value: string;
  onChange: (address: string, coords?: { latitude: number; longitude: number }) => void;
  placeholder?: string;
}

export function LocationPicker({ value, onChange, placeholder = "Enter your delivery address..." }: LocationPickerProps) {
  const { loading, detectLocation } = useLocation();
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  const handleDetectLocation = async () => {
    try {
      const data = await detectLocation();
      setCoords({ latitude: data.latitude, longitude: data.longitude });
      onChange(data.address, { latitude: data.latitude, longitude: data.longitude });
    } catch (error) {
      // Error is already handled in the hook
    }
  };

  const openInMaps = () => {
    if (coords) {
      window.open(`https://www.google.com/maps?q=${coords.latitude},${coords.longitude}`, '_blank');
    } else if (value) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(value)}`, '_blank');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={handleDetectLocation}
          disabled={loading}
          className="flex-shrink-0"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Crosshair className="w-4 h-4 mr-2" />
          )}
          {loading ? 'Detecting...' : 'Use GPS'}
        </Button>
        
        {(coords || value) && (
          <Button
            type="button"
            variant="ghost"
            onClick={openInMaps}
            className="flex-shrink-0"
          >
            <Navigation className="w-4 h-4 mr-2" />
            View on Map
          </Button>
        )}
      </div>

      <div className="relative">
        <MapPin className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
        <Textarea
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="pl-10"
        />
      </div>

      {coords && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <MapPin className="w-3 h-3" />
          GPS: {coords.latitude.toFixed(6)}, {coords.longitude.toFixed(6)}
        </p>
      )}
    </div>
  );
}
