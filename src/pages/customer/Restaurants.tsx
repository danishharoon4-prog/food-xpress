import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import CustomerHeader from '@/components/CustomerHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { MapPin, Clock, Star, Heart, Utensils } from 'lucide-react';
import GlobalSearch from '@/components/GlobalSearch';
import type { Restaurant } from '@/types';

export default function Restaurants() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [city, setCity] = useState<string>('all');
  const [cuisine, setCuisine] = useState<string>('all');
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchRestaurants();
  }, []);

  useEffect(() => {
    if (profile?.city && city === 'all') {
      setCity(profile.city);
    }
  }, [profile?.city]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (user) fetchFavorites();
  }, [user]);

  const fetchRestaurants = async () => {
    const { data } = await supabase
      .from('restaurants')
      .select('*')
      .eq('is_active', true)
      .order('name');
    if (data) setRestaurants(data as Restaurant[]);
    setLoading(false);
  };

  const fetchFavorites = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('favorite_restaurants')
      .select('restaurant_id')
      .eq('user_id', user.id);
    if (data) setFavoriteIds(new Set(data.map((f) => f.restaurant_id)));
  };

  const toggleFavorite = async (e: React.MouseEvent, restaurantId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      toast({ title: 'Sign in required', description: 'Please sign in to save favorites', variant: 'destructive' });
      return;
    }
    const isFav = favoriteIds.has(restaurantId);
    if (isFav) {
      await supabase.from('favorite_restaurants').delete().eq('user_id', user.id).eq('restaurant_id', restaurantId);
      setFavoriteIds((prev) => { const n = new Set(prev); n.delete(restaurantId); return n; });
      toast({ title: 'Removed from favorites' });
    } else {
      await supabase.from('favorite_restaurants').insert({ user_id: user.id, restaurant_id: restaurantId });
      setFavoriteIds((prev) => new Set(prev).add(restaurantId));
      toast({ title: 'Added to favorites ❤️' });
    }
  };

  const cities = Array.from(
    new Set(restaurants.map((r) => r.city).filter((c): c is string => !!c))
  ).sort();

  const cuisines = Array.from(
    new Set(restaurants.map((r) => r.cuisine_type).filter((c): c is string => !!c))
  ).sort();

  const filteredRestaurants = restaurants.filter((r) => {
    const matchesCity = city === 'all' || r.city === city;
    const matchesCuisine = cuisine === 'all' || r.cuisine_type === cuisine;
    return matchesCity && matchesCuisine;
  });

  return (
    <div className="min-h-screen bg-background">
      <CustomerHeader />

      <main className="container py-8">
        {/* Hero */}
        <div className="text-center mb-8 max-w-3xl mx-auto">
          <h1 className="text-3xl md:text-5xl font-bold mb-3 tracking-tight">
            Delicious food, <span className="text-primary">delivered fast</span>
          </h1>
          <p className="text-muted-foreground mb-6 md:text-lg">
            Discover restaurants and dishes near you
          </p>

          {/* Single unified search */}
          <div className="mb-4">
            <GlobalSearch placeholder="Search restaurants, cuisines, or dishes..." />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Select value={city} onValueChange={setCity}>
              <SelectTrigger className="h-10 w-auto min-w-[140px] rounded-full bg-muted/50 border-0">
                <MapPin className="w-4 h-4 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="All cities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All cities</SelectItem>
                {cities.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={cuisine} onValueChange={setCuisine}>
              <SelectTrigger className="h-10 w-auto min-w-[140px] rounded-full bg-muted/50 border-0">
                <Utensils className="w-4 h-4 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="All cuisines" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All cuisines</SelectItem>
                {cuisines.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {(city !== 'all' || cuisine !== 'all') && (
              <Button
                variant="ghost"
                size="sm"
                className="h-10 rounded-full text-muted-foreground hover:text-foreground"
                onClick={() => { setCity('all'); setCuisine('all'); }}
              >
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Results summary */}
        {!loading && (
          <div className="flex items-center justify-between mb-5 px-1">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{filteredRestaurants.length}</span>{' '}
              {filteredRestaurants.length === 1 ? 'restaurant' : 'restaurants'}
              {city !== 'all' && <> in <span className="font-medium text-foreground">{city}</span></>}
            </p>
          </div>
        )}

        {/* Restaurants Grid */}
        {loading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse border-0 shadow-none">
                <div className="h-44 bg-muted rounded-2xl" />
                <CardContent className="p-3">
                  <div className="h-5 w-32 bg-muted rounded mb-2" />
                  <div className="h-4 w-24 bg-muted rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredRestaurants.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <Utensils className="w-7 h-7 text-muted-foreground" />
            </div>
            <p className="font-medium mb-1">No restaurants found</p>
            <p className="text-sm text-muted-foreground">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredRestaurants.map((restaurant) => (
              <Link key={restaurant.id} to={`/restaurant/${restaurant.id}`} className="group">
                <Card className="overflow-hidden border-0 shadow-none bg-transparent transition-transform duration-200 group-hover:-translate-y-1">
                  <div className="h-44 bg-gradient-to-br from-primary/10 to-accent/40 overflow-hidden relative rounded-2xl">
                    {restaurant.image_url ? (
                      <img
                        src={restaurant.image_url}
                        alt={restaurant.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-5xl font-bold text-primary/40">
                          {restaurant.name.charAt(0)}
                        </span>
                      </div>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-3 right-3 h-9 w-9 rounded-full bg-card/90 backdrop-blur-sm hover:bg-card shadow-sm"
                      onClick={(e) => toggleFavorite(e, restaurant.id)}
                    >
                      <Heart
                        className={`w-[18px] h-[18px] transition-colors ${
                          favoriteIds.has(restaurant.id)
                            ? 'fill-destructive text-destructive'
                            : 'text-foreground'
                        }`}
                      />
                    </Button>
                  </div>
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="font-semibold text-base leading-tight group-hover:text-primary transition-colors">
                        {restaurant.name}
                      </h3>
                      <Badge variant="secondary" className="text-xs shrink-0 h-6">
                        <Star className="w-3 h-3 mr-1 fill-warning text-warning" />
                        4.5
                      </Badge>
                    </div>

                    {restaurant.cuisine_type && (
                      <p className="text-sm text-muted-foreground mb-2">{restaurant.cuisine_type}</p>
                    )}

                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {restaurant.address && (
                        <span className="flex items-center gap-1 min-w-0">
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span className="truncate">{restaurant.address}</span>
                        </span>
                      )}
                      {restaurant.opening_time && restaurant.closing_time && (
                        <span className="flex items-center gap-1 shrink-0">
                          <Clock className="w-3 h-3" />
                          {restaurant.opening_time.slice(0, 5)}-{restaurant.closing_time.slice(0, 5)}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
