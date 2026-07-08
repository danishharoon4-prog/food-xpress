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
import { MapPin, Clock, Star, Heart, Utensils, Tag, Flame, Trophy } from 'lucide-react';
import GlobalSearch from '@/components/GlobalSearch';
import type { Restaurant, MenuItem } from '@/types';
import { motion } from 'framer-motion';

type TopItem = {
  id: string;
  name: string;
  price: number;
  discount_price: number | null;
  image_url: string | null;
  is_deal: boolean;
  deal_label: string | null;
  restaurant_id: string;
  restaurant_name: string;
  restaurant_image: string | null;
  total_sold: number;
};

type TopRatedRestaurant = {
  id: string;
  name: string;
  image_url: string | null;
  cuisine_type: string | null;
  city: string | null;
  avg_rating: number;
  rating_count: number;
};

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

type DealItem = Omit<MenuItem, 'restaurant'> & {
  restaurant?: { id: string; name: string; image_url: string | null };
};

export default function Restaurants() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [deals, setDeals] = useState<DealItem[]>([]);
  const [topItems, setTopItems] = useState<TopItem[]>([]);
  const [topRated, setTopRated] = useState<TopRatedRestaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [dealsLoading, setDealsLoading] = useState(true);
  const [topItemsLoading, setTopItemsLoading] = useState(true);
  const [topRatedLoading, setTopRatedLoading] = useState(true);
  const [city, setCity] = useState<string>('all');
  const [cuisine, setCuisine] = useState<string>('all');
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [ratings, setRatings] = useState<Record<string, { avg: number; count: number }>>({});

  useEffect(() => {
    fetchRestaurants();
    fetchDeals();
    fetchTopItems();
    fetchTopRated();
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
    if (data) {
      setRestaurants(data as Restaurant[]);
      fetchRatings(data.map((r) => r.id));
    }
    setLoading(false);
  };

  const fetchRatings = async (restaurantIds: string[]) => {
    if (!restaurantIds.length) return;
    const results = await Promise.all(
      restaurantIds.map(async (rid) => {
        const { data } = await supabase.rpc('get_restaurant_rating_summary', {
          _restaurant_id: rid,
        });
        const row = Array.isArray(data) ? data[0] : data;
        return { rid, avg: Number(row?.avg_rating ?? 0), count: Number(row?.rating_count ?? 0) };
      }),
    );
    const map: Record<string, { avg: number; count: number }> = {};
    results.forEach((r) => {
      if (r.count > 0) map[r.rid] = { avg: r.avg, count: r.count };
    });
    setRatings(map);
  };

  const fetchDeals = async () => {
    const { data } = await supabase
      .from('menu_items')
      .select(`
        *,
        restaurant:restaurant_id (id, name, image_url)
      `)
      .eq('is_available', true)
      .eq('is_deal', true)
      .not('discount_price', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(12);
    if (data) setDeals(data as DealItem[]);
    setDealsLoading(false);
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

  const discountPercent = (item: DealItem) => {
    if (!item.discount_price || item.price <= 0) return 0;
    return Math.round(((item.price - item.discount_price) / item.price) * 100);
  };

  return (
    <div className="min-h-screen bg-background">
      <CustomerHeader />

      <main className="container max-w-6xl py-10 md:py-16 space-y-14">
        {/* Hero */}
        <motion.section
          className="text-center space-y-8"
          initial="hidden"
          animate="show"
          variants={fadeUp}
        >
          <motion.div variants={fadeUp} custom={0} className="space-y-3 max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-[1.05]">
              Find your{' '}
              <motion.span
                className="inline-block text-primary"
                animate={{ rotate: [0, -2, 2, -1, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              >
                favorite
              </motion.span>{' '}
              flavors
            </h1>
            <p className="text-muted-foreground text-lg md:text-xl font-medium">
              Delicious meals from your local favorites, delivered fast.
            </p>
          </motion.div>

          <motion.div variants={fadeUp} custom={1} className="max-w-3xl mx-auto">
            <motion.div
              whileHover={{ y: -2, boxShadow: '0 30px 60px -20px hsl(var(--primary) / 0.25)' }}
              transition={{ duration: 0.3 }}
              className="rounded-3xl border border-border/60 bg-card p-2 md:p-3 shadow-[0_20px_50px_-20px_hsl(var(--primary)/0.15)] focus-within:ring-4 focus-within:ring-primary/10"
            >
              <GlobalSearch placeholder="Search for restaurants, cuisines, or dishes..." />
            </motion.div>
          </motion.div>
        </motion.section>

        {/* Filter pills — cuisines + city select */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4"
        >
          {['all', ...cuisines].map((c, idx) => {
            const active = cuisine === c;
            return (
              <motion.button
                key={c}
                onClick={() => setCuisine(c)}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.2 + idx * 0.04 }}
                whileHover={{ y: -2, scale: 1.03 }}
                whileTap={{ scale: 0.95 }}
                className={`relative flex-none px-6 py-2.5 rounded-2xl text-sm font-bold whitespace-nowrap transition-colors ${
                  active
                    ? 'text-primary-foreground shadow-lg shadow-primary/25'
                    : 'bg-card text-muted-foreground border border-border/60 hover:border-primary/40'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="activeCuisinePill"
                    className="absolute inset-0 rounded-2xl bg-primary"
                    transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                  />
                )}
                <span className="relative z-10">{c === 'all' ? 'All' : c}</span>
              </motion.button>
            );
          })}

          {cities.length > 0 && (
            <>
              <div className="h-6 w-px bg-border shrink-0 mx-1" />
              <Select value={city} onValueChange={setCity}>
                <SelectTrigger className="flex-none h-11 w-auto min-w-[160px] rounded-2xl bg-card border-border/60 font-bold text-sm">
                  <MapPin className="w-4 h-4 mr-1.5 text-primary" />
                  <SelectValue placeholder="All cities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All cities</SelectItem>
                  {cities.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}

          {(city !== 'all' || cuisine !== 'all') && (
            <Button
              variant="ghost"
              size="sm"
              className="flex-none h-11 rounded-2xl text-muted-foreground hover:text-foreground font-semibold"
              onClick={() => { setCity('all'); setCuisine('all'); }}
            >
              Clear
            </Button>
          )}
        </motion.section>

        {/* Fresh Deals Section */}
        <section className="space-y-6">
          <div className="flex items-end justify-between px-2">
            <div>
              <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">Fresh Deals</h2>
              <p className="text-sm text-muted-foreground mt-1">Limited-time discounts from top spots</p>
            </div>
            {deals.length > 0 && (
              <span className="text-primary text-sm font-bold hover:underline underline-offset-4 cursor-default">
                Top Discounts
              </span>
            )}
          </div>

          {dealsLoading ? (
            <div className="flex gap-5 overflow-x-auto pb-2 scrollbar-hide">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="min-w-[240px] max-w-[240px] animate-pulse">
                  <div className="h-40 bg-muted rounded-3xl" />
                  <div className="h-4 w-32 bg-muted rounded mt-3" />
                  <div className="h-4 w-20 bg-muted rounded mt-2" />
                </div>
              ))}
            </div>
          ) : deals.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="relative overflow-hidden bg-card border-2 border-dashed border-border rounded-[2.5rem] py-14 px-6 text-center flex flex-col items-center justify-center gap-4 transition-colors hover:border-primary/30 group"
            >
              <motion.div
                animate={{ rotate: [12, 0, 12], y: [0, -6, 0] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
                className="w-20 h-20 bg-background rounded-3xl flex items-center justify-center shadow-sm"
              >
                <Tag className="w-10 h-10 text-primary/50" strokeWidth={1.5} />
              </motion.div>
              <div className="space-y-1.5">
                <p className="text-lg font-bold">No new deals just yet</p>
                <p className="text-muted-foreground text-sm max-w-sm mx-auto leading-relaxed">
                  We're cooking up something special. Check back soon for exclusive rewards from top-rated restaurants.
                </p>
              </div>
            </motion.div>
          ) : (
            <div className="flex gap-5 overflow-x-auto pb-3 scrollbar-hide -mx-4 px-4">
              {deals.map((deal, idx) => (
                <motion.div
                  key={deal.id}
                  initial={{ opacity: 0, x: 30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: idx * 0.05 }}
                  whileHover={{ y: -6 }}
                  className="min-w-[240px] max-w-[240px] flex-shrink-0"
                >
                  <Link to={`/restaurant/${deal.restaurant_id}`} className="group block">
                  <div className="relative overflow-hidden rounded-3xl aspect-[4/3] mb-3 bg-gradient-to-br from-primary/10 to-accent/40 shadow-sm group-hover:shadow-2xl group-hover:shadow-primary/10 transition-all duration-500">
                    {deal.image_url ? (
                      <img
                        src={deal.image_url}
                        alt={deal.name}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      />
                    ) : deal.restaurant?.image_url ? (
                      <img
                        src={deal.restaurant.image_url}
                        alt={deal.restaurant.name}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Utensils className="w-10 h-10 text-primary/40" />
                      </div>
                    )}
                    <div className="absolute top-3 left-3 bg-destructive text-destructive-foreground text-[11px] font-extrabold tracking-wide px-3 py-1 rounded-full">
                      -{discountPercent(deal)}%
                    </div>
                    {deal.deal_label && (
                      <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md text-white text-[10px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full">
                        {deal.deal_label}
                      </div>
                    )}
                  </div>
                  <div className="px-1">
                    <h3 className="font-bold text-base truncate group-hover:text-primary transition-colors">
                      {deal.name}
                    </h3>
                    <p className="text-xs text-muted-foreground truncate mb-2 font-medium">
                      {deal.restaurant?.name || 'Restaurant'}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-extrabold text-primary">
                        PKR {Number(deal.discount_price).toLocaleString()}
                      </span>
                      <span className="text-xs text-muted-foreground line-through font-medium">
                        PKR {Number(deal.price).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </section>

        {/* Restaurants Grid */}
        <section className="space-y-6">
          <div className="flex items-end justify-between px-2">
            <div>
              <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">Nearby Favorites</h2>
              {!loading && (
                <p className="text-sm text-muted-foreground mt-1">
                  <span className="font-semibold text-foreground">{filteredRestaurants.length}</span>{' '}
                  {filteredRestaurants.length === 1 ? 'restaurant' : 'restaurants'}
                  {city !== 'all' && <> in <span className="font-semibold text-foreground">{city}</span></>}
                </p>
              )}
            </div>
          </div>

          {loading ? (
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="aspect-[1.4] bg-muted rounded-[2rem] mb-4" />
                  <div className="h-5 w-40 bg-muted rounded mb-2" />
                  <div className="h-4 w-28 bg-muted rounded" />
                </div>
              ))}
            </div>
          ) : filteredRestaurants.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto mb-4 rotate-12">
                <Utensils className="w-8 h-8 text-primary/50" />
              </div>
              <p className="font-bold text-lg mb-1">No restaurants found</p>
              <p className="text-sm text-muted-foreground">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="grid gap-8 md:gap-10 sm:grid-cols-2 lg:grid-cols-3">
              {filteredRestaurants.map((restaurant, idx) => {
                const r = ratings[restaurant.id];
                const isFav = favoriteIds.has(restaurant.id);
                return (
                  <motion.div
                    key={restaurant.id}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-40px' }}
                    transition={{ duration: 0.5, delay: (idx % 6) * 0.06, ease: [0.22, 1, 0.36, 1] }}
                    whileHover={{ y: -8 }}
                  >
                  <Link to={`/restaurant/${restaurant.id}`} className="group block">
                    <div className="relative overflow-hidden rounded-[2rem] aspect-[1.4] mb-5 bg-gradient-to-br from-primary/10 to-accent/40 shadow-sm group-hover:shadow-2xl group-hover:shadow-primary/10 transition-all duration-500">
                      {restaurant.image_url ? (
                        <img
                          src={restaurant.image_url}
                          alt={restaurant.name}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="text-6xl font-extrabold text-primary/40">
                            {restaurant.name.charAt(0)}
                          </span>
                        </div>
                      )}

                      {/* Rating pill */}
                      <div className="absolute top-4 right-4 bg-card/95 backdrop-blur-md px-3 py-1.5 rounded-xl shadow-sm flex items-center gap-1.5">
                        <span className="text-sm font-extrabold">
                          {r ? r.avg.toFixed(1) : 'New'}
                        </span>
                        <Star className="w-4 h-4 text-primary fill-primary" />
                      </div>

                      {/* Favorite */}
                      <motion.button
                        onClick={(e) => toggleFavorite(e, restaurant.id)}
                        whileHover={{ scale: 1.12 }}
                        whileTap={{ scale: 0.85 }}
                        className="absolute top-4 left-4 h-10 w-10 rounded-full bg-card/95 backdrop-blur-md hover:bg-card shadow-sm inline-flex items-center justify-center"
                        aria-label="Toggle favorite"
                      >
                        <motion.span
                          key={isFav ? 'on' : 'off'}
                          initial={{ scale: 0.6 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                        >
                          <Heart
                            className={`w-[18px] h-[18px] transition-colors ${
                              isFav ? 'fill-destructive text-destructive' : 'text-foreground'
                            }`}
                          />
                        </motion.span>
                      </motion.button>

                      {/* Bottom chips */}
                      <div className="absolute bottom-4 left-4 flex gap-2">
                        {restaurant.cuisine_type && (
                          <span className="bg-primary text-primary-foreground px-3 py-1.5 rounded-full text-[10px] font-extrabold uppercase tracking-widest">
                            {restaurant.cuisine_type}
                          </span>
                        )}
                        {restaurant.opening_time && restaurant.closing_time && (
                          <span className="bg-black/60 backdrop-blur-md text-white px-3 py-1.5 rounded-full text-[10px] font-extrabold uppercase tracking-widest inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {restaurant.opening_time.slice(0, 5)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="px-2">
                      <div className="flex justify-between items-start gap-2">
                        <h3 className="text-lg md:text-xl font-extrabold group-hover:text-primary transition-colors leading-tight">
                          {restaurant.name}
                        </h3>
                        {r && (
                          <span className="text-muted-foreground text-xs font-bold shrink-0 mt-1">
                            ({r.count})
                          </span>
                        )}
                      </div>
                      {restaurant.cuisine_type && (
                        <p className="text-sm text-muted-foreground mt-1 font-medium truncate">
                          {restaurant.cuisine_type}
                        </p>
                      )}
                      {restaurant.address && (
                        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border/50">
                          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <MapPin className="w-3.5 h-3.5 text-primary" />
                          </div>
                          <span className="text-xs font-semibold text-muted-foreground truncate">
                            {restaurant.address}
                          </span>
                        </div>
                      )}
                    </div>
                  </Link>
                  </motion.div>
                );
              })}
            </div>
          )}
        </section>

        {/* Badge kept from original spec for context */}
        <div className="hidden">
          <Badge>hidden</Badge>
          <Card><CardContent>hidden</CardContent></Card>
        </div>
      </main>
    </div>
  );
}
