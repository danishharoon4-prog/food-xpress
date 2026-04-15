import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import CustomerHeader from '@/components/CustomerHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Search, MapPin, Clock, Star, Heart } from 'lucide-react';
import type { Restaurant } from '@/types';

export default function Restaurants() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchRestaurants();
  }, []);

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

  const filteredRestaurants = restaurants.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.cuisine_type?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      <CustomerHeader />

      <main className="container py-8">
        {/* Hero */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">Find Your Favorite Food</h1>
          <p className="text-muted-foreground mb-6">Browse restaurants and order delicious meals</p>
          
          <div className="max-w-md mx-auto relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Search restaurants or cuisines..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-12"
            />
          </div>
        </div>

        {/* Restaurants Grid */}
        {loading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <div className="h-40 bg-muted rounded-t-lg" />
                <CardContent className="p-4">
                  <div className="h-5 w-32 bg-muted rounded mb-2" />
                  <div className="h-4 w-24 bg-muted rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredRestaurants.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground">
              {search ? 'No restaurants found matching your search.' : 'No restaurants available yet.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredRestaurants.map((restaurant) => (
              <Link key={restaurant.id} to={`/restaurant/${restaurant.id}`}>
                <Card className="overflow-hidden hover:shadow-soft-lg transition-shadow cursor-pointer group">
                  <div className="h-40 bg-gradient-to-br from-primary/20 to-accent overflow-hidden relative">
                    {restaurant.image_url ? (
                      <img
                        src={restaurant.image_url}
                        alt={restaurant.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-4xl font-bold text-primary/30">
                          {restaurant.name.charAt(0)}
                        </span>
                      </div>
                    )}
                    {/* Favorite Button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 h-9 w-9 rounded-full bg-card/80 backdrop-blur-sm hover:bg-card shadow-sm"
                      onClick={(e) => toggleFavorite(e, restaurant.id)}
                    >
                      <Heart
                        className={`w-5 h-5 transition-colors ${
                          favoriteIds.has(restaurant.id)
                            ? 'fill-destructive text-destructive'
                            : 'text-muted-foreground'
                        }`}
                      />
                    </Button>
                  </div>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">
                        {restaurant.name}
                      </h3>
                      <Badge variant="secondary" className="text-xs">
                        <Star className="w-3 h-3 mr-1 fill-warning text-warning" />
                        4.5
                      </Badge>
                    </div>
                    
                    {restaurant.cuisine_type && (
                      <p className="text-sm text-muted-foreground mb-3">{restaurant.cuisine_type}</p>
                    )}

                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {restaurant.address && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          <span className="truncate max-w-[120px]">{restaurant.address}</span>
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {restaurant.opening_time?.slice(0, 5)} - {restaurant.closing_time?.slice(0, 5)}
                      </span>
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
