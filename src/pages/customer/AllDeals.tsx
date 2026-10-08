import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useCart } from '@/contexts/CartContext';
import { useToast } from '@/hooks/use-toast';
import CustomerHeader from '@/components/CustomerHeader';
import { Button } from '@/components/ui/button';
import { Utensils, Plus, Check, Flame, LayoutGrid, Store, ArrowLeft } from 'lucide-react';
import type { MenuItem } from '@/types';
import { motion } from 'framer-motion';
import { resolveImg } from '@/lib/img';

type DealItem = Omit<MenuItem, 'restaurant'> & {
  restaurant?: { id: string; name: string; image_url: string | null };
};

const discountPercent = (d: DealItem) =>
  d.discount_price ? Math.round(((Number(d.price) - Number(d.discount_price)) / Number(d.price)) * 100) : 0;

export default function AllDeals() {
  const { toast } = useToast();
  const { addItem, getRestaurantId, items: cartItems } = useCart();
  const [deals, setDeals] = useState<DealItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'restaurant' | 'item'>('restaurant');
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchDeals = async () => {
      const { data } = await supabase
        .from('menu_items')
        .select(`*, restaurant:restaurant_id (id, name, image_url)`)
        .eq('is_available', true)
        .eq('is_deal', true)
        .not('discount_price', 'is', null)
        .order('updated_at', { ascending: false });
      if (data) setDeals(data as unknown as DealItem[]);
      setLoading(false);
    };
    fetchDeals();
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, { restaurant: DealItem['restaurant']; items: DealItem[] }>();
    deals.forEach((d) => {
      const key = d.restaurant_id;
      if (!map.has(key)) map.set(key, { restaurant: d.restaurant, items: [] });
      map.get(key)!.items.push(d);
    });
    // sort items within each restaurant by biggest discount first
    map.forEach((g) => g.items.sort((a, b) => discountPercent(b) - discountPercent(a)));
    return Array.from(map.entries());
  }, [deals]);

  const itemWise = useMemo(
    () => [...deals].sort((a, b) => discountPercent(b) - discountPercent(a)),
    [deals]
  );

  const quickAdd = (e: React.MouseEvent, deal: DealItem) => {
    e.preventDefault();
    e.stopPropagation();
    const currentRestaurantId = getRestaurantId();
    if (currentRestaurantId && currentRestaurantId !== deal.restaurant_id) {
      toast({
        title: 'Different restaurant',
        description: 'Your cart has items from another restaurant. Clear it first.',
        variant: 'destructive',
      });
      return;
    }
    addItem({
      id: deal.id,
      name: deal.name,
      price: deal.price,
      discount_price: deal.discount_price,
      image_url: deal.image_url,
      restaurant_id: deal.restaurant_id,
      restaurant_name: deal.restaurant?.name,
    } as any);
    setAddedIds((prev) => new Set(prev).add(deal.id));
    toast({ title: 'Added to cart', description: deal.name });
  };

  const renderCard = (deal: DealItem, idx: number) => (
    <motion.div
      key={deal.id}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.35, delay: Math.min(idx, 6) * 0.04 }}
      whileHover={{ y: -6 }}
    >
      <Link to={`/restaurant/${deal.restaurant_id}`} className="group block">
        <div className="relative overflow-hidden rounded-3xl aspect-[4/3] mb-3 bg-gradient-to-br from-primary/10 to-accent/40 shadow-sm group-hover:shadow-2xl group-hover:shadow-primary/10 transition-all duration-500">
          {deal.image_url ? (
            <img
              src={resolveImg(deal.image_url)}
              alt={deal.name}
              loading="lazy"
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            />
          ) : deal.restaurant?.image_url ? (
            <img
              src={resolveImg(deal.restaurant.image_url)}
              alt={deal.restaurant.name}
              loading="lazy"
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
            onClick={(e) => quickAdd(e, deal)}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            aria-label={`Add ${deal.name} to cart`}
            className={`absolute bottom-3 right-3 h-9 w-9 rounded-full inline-flex items-center justify-center shadow-lg transition-colors ${
              addedIds.has(deal.id) || cartItems.some((c) => c.menuItem.id === deal.id)
                ? 'bg-green-500 text-white'
                : 'bg-white text-primary hover:bg-primary hover:text-primary-foreground'
            }`}
          >
            {addedIds.has(deal.id) || cartItems.some((c) => c.menuItem.id === deal.id) ? (
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
  );

  return (
    <div className="min-h-screen bg-background">
      <CustomerHeader />
      <main className="container mx-auto px-4 py-6 md:py-10 max-w-7xl space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="icon" className="rounded-full">
              <Link to="/restaurants" aria-label="Back to restaurants">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight flex items-center gap-2">
                <Flame className="w-6 h-6 text-destructive" /> All Fresh Deals
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {deals.length} discounted items across {grouped.length} restaurants
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-muted/60 rounded-full p-1">
            <Button
              size="sm"
              variant={view === 'restaurant' ? 'default' : 'ghost'}
              className="rounded-full gap-1.5"
              onClick={() => setView('restaurant')}
            >
              <Store className="w-4 h-4" /> Restaurant wise
            </Button>
            <Button
              size="sm"
              variant={view === 'item' ? 'default' : 'ghost'}
              className="rounded-full gap-1.5"
              onClick={() => setView('item')}
            >
              <LayoutGrid className="w-4 h-4" /> Item wise
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-[4/3] bg-muted rounded-3xl" />
                <div className="h-4 w-28 bg-muted rounded mt-3" />
                <div className="h-4 w-16 bg-muted rounded mt-2" />
              </div>
            ))}
          </div>
        ) : deals.length === 0 ? (
          <div className="bg-card border-2 border-dashed border-border rounded-[2.5rem] py-16 px-6 text-center">
            <Flame className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-lg font-bold">No deals available right now</p>
            <p className="text-sm text-muted-foreground mt-1">Check back soon for fresh discounts.</p>
          </div>
        ) : view === 'restaurant' ? (
          <div className="space-y-10">
            {grouped.map(([rid, group]) => (
              <section key={rid} className="space-y-4">
                <Link
                  to={`/restaurant/${rid}`}
                  className="flex items-center gap-3 group w-fit"
                >
                  <div className="w-11 h-11 rounded-2xl overflow-hidden bg-muted flex items-center justify-center shrink-0">
                    {group.restaurant?.image_url ? (
                      <img
                        src={resolveImg(group.restaurant.image_url)}
                        alt={group.restaurant.name}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Store className="w-5 h-5 text-primary/50" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-lg font-extrabold tracking-tight group-hover:text-primary transition-colors">
                      {group.restaurant?.name || 'Restaurant'}
                    </h2>
                    <p className="text-xs text-muted-foreground font-medium">
                      {group.items.length} deal{group.items.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </Link>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {group.items.map((deal, idx) => renderCard(deal, idx))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {itemWise.map((deal, idx) => renderCard(deal, idx))}
          </div>
        )}
      </main>
    </div>
  );
}
