import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import CustomerHeader from '@/components/CustomerHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { MapPin, Clock, Star, Heart, Utensils, Tag, Flame, Trophy, Plus, Check, ArrowUpDown } from 'lucide-react';
import GlobalSearch from '@/components/GlobalSearch';
import type { Restaurant, MenuItem } from '@/types';
import { motion } from 'framer-motion';
import { resolveImg } from '@/lib/img';

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
  const { addItem, getRestaurantId, items: cartItems } = useCart();
  const navigate = useNavigate();
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
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
  const [sortBy, setSortBy] = useState<'recommended' | 'rating' | 'name'>('recommended');
  const [openNow, setOpenNow] = useState(false);
  const [favOnly, setFavOnly] = useState(false);
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
      .eq('approval_status', 'approved')
      .order('name');
    if (data) {
      setRestaurants(data as Restaurant[]);
      fetchRatings(data.map((r) => r.id));
    }
    setLoading(false);
  };

  const fetchRatings = async (restaurantIds: string[]) => {
    if (!restaurantIds.length) return;
    // Single query: pull all ratings for these restaurants and aggregate client-side.
    const { data } = await supabase
      .from('ratings')
      .select('restaurant_id, food_rating, restaurant_rating')
      .in('restaurant_id', restaurantIds);

    const agg: Record<string, { sum: number; n: number; count: number }> = {};
    (data ?? []).forEach((row: any) => {
      const parts: number[] = [];
      if (row.food_rating != null) parts.push(Number(row.food_rating));
      if (row.restaurant_rating != null) parts.push(Number(row.restaurant_rating));
      if (!parts.length) return;
      const avg = parts.reduce((a, b) => a + b, 0) / parts.length;
      const cur = agg[row.restaurant_id] ?? { sum: 0, n: 0, count: 0 };
      cur.sum += avg;
      cur.n += 1;
      cur.count += 1;
      agg[row.restaurant_id] = cur;
    });
    const map: Record<string, { avg: number; count: number }> = {};
    Object.entries(agg).forEach(([rid, v]) => {
      if (v.count > 0) map[rid] = { avg: v.sum / v.n, count: v.count };
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
    if (data) setDeals(data as unknown as DealItem[]);
    setDealsLoading(false);
  };

  const fetchTopItems = async () => {
    const { data } = await supabase.rpc('get_top_selling_items', { _limit: 10 });
    if (data) setTopItems(data as TopItem[]);
    setTopItemsLoading(false);
  };

  const fetchTopRated = async () => {
    const { data } = await supabase.rpc('get_top_rated_restaurants', { _limit: 8 });
    if (data) setTopRated(data as TopRatedRestaurant[]);
    setTopRatedLoading(false);
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

  const quickAdd = async (
    e: React.MouseEvent,
    payload: {
      id: string;
      name: string;
      price: number;
      discount_price: number | null;
      image_url: string | null;
      restaurant_id: string;
      restaurant_name?: string;
    }
  ) => {
    e.preventDefault();
    e.stopPropagation();

    // If this item has size variants, redirect to the restaurant menu to pick a size
    const { data: sizesRow } = await supabase
      .from('menu_items')
      .select('sizes')
      .eq('id', payload.id)
      .maybeSingle();
    const sizesArr = (sizesRow?.sizes as unknown as { name: string; price: number }[] | null) || null;
    if (sizesArr && Array.isArray(sizesArr) && sizesArr.length > 0) {
      toast({
        title: 'Choose a size',
        description: `${payload.name} has multiple sizes — please pick one.`,
      });
      navigate(`/restaurant/${payload.restaurant_id}`);
      return;
    }

    const currentRestaurantId = getRestaurantId();
    const switching =
      currentRestaurantId && currentRestaurantId !== payload.restaurant_id && cartItems.length > 0;

    const menuItem: MenuItem = {
      id: payload.id,
      restaurant_id: payload.restaurant_id,
      category_id: null,
      name: payload.name,
      description: null,
      price: Number(payload.price),
      discount_price: payload.discount_price != null ? Number(payload.discount_price) : null,
      is_deal: payload.discount_price != null,
      deal_label: null,
      image_url: payload.image_url,
      is_available: true,
      is_featured: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    addItem(menuItem, 1);

    // Visual "added" feedback
    setAddedIds((prev) => new Set(prev).add(payload.id));
    setTimeout(() => {
      setAddedIds((prev) => {
        const n = new Set(prev);
        n.delete(payload.id);
        return n;
      });
    }, 1400);

    if (switching) {
      toast({
        title: 'Cart replaced',
        description: `Started a new cart with ${payload.name}${
          payload.restaurant_name ? ` from ${payload.restaurant_name}` : ''
        }.`,
      });
    } else {
      toast({
        title: 'Added to cart',
        description: `${payload.name} added to your cart.`,
      });
    }
  };

  const cities = Array.from(
    new Set(restaurants.map((r) => r.city).filter((c): c is string => !!c))
  ).sort();

  const cuisines = Array.from(
    new Set(restaurants.map((r) => r.cuisine_type).filter((c): c is string => !!c))
  ).sort();

  const isOpenNow = (r: Restaurant) => {
    if (!r.opening_time || !r.closing_time) return true;
    const now = new Date();
    const cur = now.getHours() * 60 + now.getMinutes();
    const [oh, om] = r.opening_time.split(':').map(Number);
    const [ch, cm] = r.closing_time.split(':').map(Number);
    const open = oh * 60 + om;
    const close = ch * 60 + cm;
    return close > open ? cur >= open && cur <= close : cur >= open || cur <= close;
  };

  const filteredRestaurants = restaurants
    .filter((r) => {
      const matchesCity = city === 'all' || r.city === city;
      const matchesCuisine = cuisine === 'all' || r.cuisine_type === cuisine;
      const matchesFav = !favOnly || favoriteIds.has(r.id);
      const matchesOpen = !openNow || isOpenNow(r);
      return matchesCity && matchesCuisine && matchesFav && matchesOpen;
    })
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'rating') {
        const ra = ratings[a.id]?.avg ?? 0;
        const rb = ratings[b.id]?.avg ?? 0;
        return rb - ra;
      }
      return 0;
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

          <button
            onClick={() => setOpenNow((v) => !v)}
            className={`flex-none h-11 px-4 rounded-2xl text-sm font-bold border transition-colors inline-flex items-center gap-1.5 ${
              openNow
                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                : 'bg-card text-muted-foreground border-border/60 hover:border-primary/40'
            }`}
          >
            <Clock className="w-4 h-4" /> Open now
          </button>

          <button
            onClick={() => {
              if (!user) {
                toast({ title: 'Sign in required', description: 'Sign in to filter by favorites', variant: 'destructive' });
                return;
              }
              setFavOnly((v) => !v);
            }}
            className={`flex-none h-11 px-4 rounded-2xl text-sm font-bold border transition-colors inline-flex items-center gap-1.5 ${
              favOnly
                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                : 'bg-card text-muted-foreground border-border/60 hover:border-primary/40'
            }`}
          >
            <Heart className={`w-4 h-4 ${favOnly ? 'fill-current' : ''}`} /> Favorites
          </button>

          <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
            <SelectTrigger className="flex-none h-11 w-auto min-w-[170px] rounded-2xl bg-card border-border/60 font-bold text-sm">
              <ArrowUpDown className="w-4 h-4 mr-1.5 text-primary" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recommended">Recommended</SelectItem>
              <SelectItem value="rating">Top Rated</SelectItem>
              <SelectItem value="name">A – Z</SelectItem>
            </SelectContent>
          </Select>

          {(city !== 'all' || cuisine !== 'all' || openNow || favOnly || sortBy !== 'recommended') && (
            <Button
              variant="ghost"
              size="sm"
              className="flex-none h-11 rounded-2xl text-muted-foreground hover:text-foreground font-semibold"
              onClick={() => { setCity('all'); setCuisine('all'); setOpenNow(false); setFavOnly(false); setSortBy('recommended'); }}
            >
              Clear
            </Button>
          )}
        </motion.section>

        {/* Top Selling Items */}
        {(topItemsLoading || topItems.length > 0) && (
          <section className="space-y-6">
            <div className="flex items-end justify-between px-2">
              <div>
                <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight flex items-center gap-2">
                  <Flame className="w-6 h-6 text-orange-500" /> Top Selling
                </h2>
                <p className="text-sm text-muted-foreground mt-1">Most-ordered dishes by customers like you</p>
              </div>
            </div>

            {topItemsLoading ? (
              <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-2 scrollbar-hide">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="min-w-[150px] max-w-[150px] sm:min-w-[180px] sm:max-w-[180px] animate-pulse">
                    <div className="h-28 sm:h-32 bg-muted rounded-2xl" />
                    <div className="h-4 w-24 bg-muted rounded mt-3" />
                    <div className="h-4 w-16 bg-muted rounded mt-2" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-3 scrollbar-hide -mx-4 px-4">
                {topItems.map((item, idx) => {
                  const displayPrice = item.discount_price ?? item.price;
                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: 30 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.4, delay: idx * 0.05 }}
                      whileHover={{ y: -6 }}
                      className="min-w-[150px] max-w-[150px] sm:min-w-[180px] sm:max-w-[180px] flex-shrink-0"
                    >
                      <Link to={`/restaurant/${item.restaurant_id}`} className="group block">
                        <div className="relative overflow-hidden rounded-3xl aspect-[4/3] mb-3 bg-gradient-to-br from-orange-500/10 to-primary/10 shadow-sm group-hover:shadow-2xl group-hover:shadow-primary/10 transition-all duration-500">
                          {item.image_url ? (
                            <img src={resolveImg(item.image_url)} alt={item.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                          ) : item.restaurant_image ? (
                            <img src={resolveImg(item.restaurant_image)} alt={item.restaurant_name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Utensils className="w-10 h-10 text-primary/40" />
                            </div>
                          )}
                          <div className="absolute top-3 left-3 bg-orange-500 text-white text-[10px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full flex items-center gap-1">
                            <Flame className="w-3 h-3" /> #{idx + 1}
                          </div>
                          <div className="absolute bottom-3 right-3 bg-black/70 backdrop-blur-md text-white text-[10px] font-extrabold px-2.5 py-1 rounded-full">
                            {item.total_sold} sold
                          </div>
                          <motion.button
                            type="button"
                            onClick={(e) =>
                              quickAdd(e, {
                                id: item.id,
                                name: item.name,
                                price: item.price,
                                discount_price: item.discount_price,
                                image_url: item.image_url,
                                restaurant_id: item.restaurant_id,
                                restaurant_name: item.restaurant_name,
                              })
                            }
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            aria-label={`Add ${item.name} to cart`}
                            className={`absolute bottom-3 left-3 h-9 w-9 rounded-full inline-flex items-center justify-center shadow-lg transition-colors ${
                              addedIds.has(item.id)
                                ? 'bg-green-500 text-white'
                                : 'bg-white text-primary hover:bg-primary hover:text-primary-foreground'
                            }`}
                          >
                            {addedIds.has(item.id) ? (
                              <Check className="w-4 h-4" strokeWidth={3} />
                            ) : (
                              <Plus className="w-4 h-4" strokeWidth={3} />
                            )}
                          </motion.button>
                        </div>
                        <div className="px-1">
                          <h3 className="font-bold text-sm truncate group-hover:text-primary transition-colors">{item.name}</h3>
                          <p className="text-[11px] text-muted-foreground truncate mb-1.5 font-medium">{item.restaurant_name}</p>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-extrabold text-primary">PKR {Number(displayPrice).toLocaleString()}</span>
                            {item.discount_price && (
                              <span className="text-[10px] text-muted-foreground line-through font-medium">PKR {Number(item.price).toLocaleString()}</span>
                            )}
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </section>
        )}

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
            <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-2 scrollbar-hide">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="min-w-[160px] max-w-[160px] sm:min-w-[190px] sm:max-w-[190px] animate-pulse">
                  <div className="h-32 bg-muted rounded-2xl" />
                  <div className="h-4 w-28 bg-muted rounded mt-3" />
                  <div className="h-4 w-16 bg-muted rounded mt-2" />
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
            <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-3 scrollbar-hide -mx-4 px-4">
              {deals.map((deal, idx) => (
                <motion.div
                  key={deal.id}
                  initial={{ opacity: 0, x: 30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: idx * 0.05 }}
                  whileHover={{ y: -6 }}
                  className="min-w-[160px] max-w-[160px] sm:min-w-[190px] sm:max-w-[190px] flex-shrink-0"
                >
                  <Link to={`/restaurant/${deal.restaurant_id}`} className="group block">
                  <div className="relative overflow-hidden rounded-3xl aspect-[4/3] mb-3 bg-gradient-to-br from-primary/10 to-accent/40 shadow-sm group-hover:shadow-2xl group-hover:shadow-primary/10 transition-all duration-500">
                    {deal.image_url ? (
                      <img
                        src={resolveImg(deal.image_url)}
                        alt={deal.name}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      />
                    ) : deal.restaurant?.image_url ? (
                      <img
                        src={resolveImg(deal.restaurant.image_url)}
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
                    <motion.button
                      type="button"
                      onClick={(e) =>
                        quickAdd(e, {
                          id: deal.id,
                          name: deal.name,
                          price: deal.price,
                          discount_price: deal.discount_price,
                          image_url: deal.image_url,
                          restaurant_id: deal.restaurant_id,
                          restaurant_name: deal.restaurant?.name,
                        })
                      }
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      aria-label={`Add ${deal.name} to cart`}
                      className={`absolute bottom-3 right-3 h-9 w-9 rounded-full inline-flex items-center justify-center shadow-lg transition-colors ${
                        addedIds.has(deal.id)
                          ? 'bg-green-500 text-white'
                          : 'bg-white text-primary hover:bg-primary hover:text-primary-foreground'
                      }`}
                    >
                      {addedIds.has(deal.id) ? (
                        <Check className="w-4 h-4" strokeWidth={3} />
                      ) : (
                        <Plus className="w-4 h-4" strokeWidth={3} />
                      )}
                    </motion.button>
                  </div>
                  <div className="px-1">
                    <h3 className="font-bold text-sm truncate group-hover:text-primary transition-colors">
                      {deal.name}
                    </h3>
                    <p className="text-[11px] text-muted-foreground truncate mb-1.5 font-medium">
                      {deal.restaurant?.name || 'Restaurant'}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-extrabold text-primary">
                        PKR {Number(deal.discount_price).toLocaleString()}
                      </span>
                      <span className="text-[10px] text-muted-foreground line-through font-medium">
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

        {/* Top Rated Restaurants */}
        {(topRatedLoading || topRated.length > 0) && (
          <section className="space-y-6">
            <div className="flex items-end justify-between px-2">
              <div>
                <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight flex items-center gap-2">
                  <Trophy className="w-6 h-6 text-yellow-500" /> Top Rated
                </h2>
                <p className="text-sm text-muted-foreground mt-1">Highest-rated spots loved by customers</p>
              </div>
            </div>

            {topRatedLoading ? (
              <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-2 scrollbar-hide">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="min-w-[170px] max-w-[170px] sm:min-w-[200px] sm:max-w-[200px] animate-pulse">
                    <div className="h-32 bg-muted rounded-2xl" />
                    <div className="h-4 w-28 bg-muted rounded mt-3" />
                    <div className="h-4 w-16 bg-muted rounded mt-2" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-3 scrollbar-hide -mx-4 px-4">
                {topRated.map((r, idx) => (
                  <motion.div
                    key={r.id}
                    initial={{ opacity: 0, x: 30 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: idx * 0.05 }}
                    whileHover={{ y: -6 }}
                    className="min-w-[170px] max-w-[170px] sm:min-w-[200px] sm:max-w-[200px] flex-shrink-0"
                  >
                    <Link to={`/restaurant/${r.id}`} className="group block">
                      <div className="relative overflow-hidden rounded-3xl aspect-[4/3] mb-3 bg-gradient-to-br from-yellow-500/10 to-primary/10 shadow-sm group-hover:shadow-2xl transition-all duration-500">
                        {r.image_url ? (
                          <img src={resolveImg(r.image_url)} alt={r.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Utensils className="w-10 h-10 text-primary/40" />
                          </div>
                        )}
                        <div className="absolute top-3 left-3 bg-yellow-500 text-black text-[10px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full flex items-center gap-1">
                          <Trophy className="w-3 h-3" /> #{idx + 1}
                        </div>
                        <div className="absolute bottom-3 right-3 bg-black/70 backdrop-blur-md text-white text-xs font-extrabold px-2.5 py-1 rounded-full flex items-center gap-1">
                          <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                          {Number(r.avg_rating).toFixed(1)}
                          <span className="text-white/70 font-medium">({r.rating_count})</span>
                        </div>
                      </div>
                      <div className="px-1">
                        <h3 className="font-bold text-sm truncate group-hover:text-primary transition-colors">{r.name}</h3>
                        <p className="text-[11px] text-muted-foreground truncate font-medium">
                          {r.cuisine_type || 'Restaurant'}{r.city ? ` · ${r.city}` : ''}
                        </p>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            )}
          </section>
        )}

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
            <div className="grid gap-5 sm:gap-6 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="aspect-[1.4] bg-muted rounded-2xl mb-3" />
                  <div className="h-4 w-32 bg-muted rounded mb-2" />
                  <div className="h-3 w-20 bg-muted rounded" />
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
            <div className="grid gap-5 sm:gap-6 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
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
                    <div className="relative overflow-hidden rounded-2xl aspect-[1.4] mb-3 bg-gradient-to-br from-primary/10 to-accent/40 shadow-sm group-hover:shadow-2xl group-hover:shadow-primary/10 transition-all duration-500">
                      {restaurant.image_url ? (
                        <img
                          src={resolveImg(restaurant.image_url)}
                          alt={restaurant.name}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="text-4xl sm:text-5xl font-extrabold text-primary/40">
                            {restaurant.name.charAt(0)}
                          </span>
                        </div>
                      )}

                      {/* Rating pill */}
                      <div className="absolute top-2.5 right-2.5 bg-card/95 backdrop-blur-md px-2 py-1 rounded-lg shadow-sm flex items-center gap-1">
                        <span className="text-xs font-extrabold">
                          {r ? r.avg.toFixed(1) : 'New'}
                        </span>
                        <Star className="w-3 h-3 text-primary fill-primary" />
                      </div>

                      {/* Favorite */}
                      <motion.button
                        onClick={(e) => toggleFavorite(e, restaurant.id)}
                        whileHover={{ scale: 1.12 }}
                        whileTap={{ scale: 0.85 }}
                        className="absolute top-2.5 left-2.5 h-8 w-8 rounded-full bg-card/95 backdrop-blur-md hover:bg-card shadow-sm inline-flex items-center justify-center"
                        aria-label="Toggle favorite"
                      >
                        <motion.span
                          key={isFav ? 'on' : 'off'}
                          initial={{ scale: 0.6 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                        >
                          <Heart
                            className={`w-4 h-4 transition-colors ${
                              isFav ? 'fill-destructive text-destructive' : 'text-foreground'
                            }`}
                          />
                        </motion.span>
                      </motion.button>

                      {/* Bottom chips */}
                      <div className="absolute bottom-2.5 left-2.5 flex gap-1.5">
                        {restaurant.cuisine_type && (
                          <span className="bg-primary text-primary-foreground px-2 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-wider">
                            {restaurant.cuisine_type}
                          </span>
                        )}
                        {restaurant.opening_time && restaurant.closing_time && (
                          <span className="bg-black/60 backdrop-blur-md text-white px-2 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-wider inline-flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            {restaurant.opening_time.slice(0, 5)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="px-1">
                      <div className="flex justify-between items-start gap-2">
                        <h3 className="text-sm sm:text-base font-extrabold group-hover:text-primary transition-colors leading-tight line-clamp-1">
                          {restaurant.name}
                        </h3>
                        {r && (
                          <span className="text-muted-foreground text-[10px] font-bold shrink-0 mt-0.5">
                            ({r.count})
                          </span>
                        )}
                      </div>
                      {restaurant.cuisine_type && (
                        <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 font-medium truncate">
                          {restaurant.cuisine_type}
                        </p>
                      )}
                      {restaurant.address && (
                        <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-border/50">
                          <MapPin className="w-3 h-3 text-primary shrink-0" />
                          <span className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground truncate">
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
