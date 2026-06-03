import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useLocation } from '@/hooks/useLocation';
import { supabase } from '@/integrations/supabase/client';
import { MapPin, Crosshair, Loader2, Navigation, Search } from 'lucide-react';

interface LocationPickerProps {
  value: string;
  onChange: (address: string, coords?: { latitude: number; longitude: number }) => void;
  placeholder?: string;
}

interface Prediction {
  place_id: string;
  description: string;
  main_text?: string;
  secondary_text?: string;
}

export function LocationPicker({ value, onChange, placeholder = "Enter your delivery address..." }: LocationPickerProps) {
  const { loading, detectLocation } = useLocation();
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [search, setSearch] = useState('');
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const sessionTokenRef = useRef<string>(crypto.randomUUID());
  const debounceRef = useRef<number | null>(null);

  const handleDetectLocation = async () => {
    try {
      const data = await detectLocation();
      setCoords({ latitude: data.latitude, longitude: data.longitude });
      onChange(data.address, { latitude: data.latitude, longitude: data.longitude });
    } catch {
      /* handled in hook */
    }
  };

  const openInMaps = () => {
    if (coords) {
      window.open(`https://www.google.com/maps?q=${coords.latitude},${coords.longitude}`, '_blank');
    } else if (value) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(value)}`, '_blank');
    }
  };

  // Debounced autocomplete
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (search.trim().length < 3) {
      setPredictions([]);
      return;
    }
    debounceRef.current = window.setTimeout(async () => {
      setSearching(true);
      try {
        const { data, error } = await supabase.functions.invoke('location-services', {
          body: { action: 'autocomplete', input: search, sessionToken: sessionTokenRef.current },
        });
        if (!error && data?.predictions) {
          setPredictions(data.predictions);
          setShowDropdown(true);
        }
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [search]);

  const handleSelectPlace = async (p: Prediction) => {
    setShowDropdown(false);
    setSearch(p.description);
    setSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke('location-services', {
        body: { action: 'place_details', placeId: p.place_id, sessionToken: sessionTokenRef.current },
      });
      if (!error && data?.latitude && data?.longitude) {
        const newCoords = { latitude: Number(data.latitude), longitude: Number(data.longitude) };
        setCoords(newCoords);
        onChange(data.address || p.description, newCoords);
      } else {
        onChange(p.description);
      }
      // Refresh session token after a selection (Google billing best practice)
      sessionTokenRef.current = crypto.randomUUID();
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Google Maps search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => predictions.length > 0 && setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
          placeholder="Search address on Google Maps..."
          className="pl-10 pr-10"
        />
        {searching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
        )}
        {showDropdown && predictions.length > 0 && (
          <div className="absolute z-50 mt-1 w-full bg-popover border border-border rounded-md shadow-lg max-h-72 overflow-auto">
            {predictions.map((p) => (
              <button
                key={p.place_id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelectPlace(p)}
                className="w-full text-left px-3 py-2 hover:bg-accent flex items-start gap-2 border-b border-border last:border-b-0"
              >
                <MapPin className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{p.main_text || p.description}</p>
                  {p.secondary_text && (
                    <p className="text-xs text-muted-foreground truncate">{p.secondary_text}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

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
