import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useCart } from '@/contexts/CartContext';
import CustomerHeader from '@/components/CustomerHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, MapPin, Clock, Star, Plus, Minus, ShoppingCart } from 'lucide-react';
import type { Restaurant, MenuItem, MenuItemSize } from '@/types';
import { resolveImg } from '@/lib/img';

type MenuCategory = { id: string; name: string; display_order: number };

export default function RestaurantMenu() {
  const { id } = useParams<{ id: string }>();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [sizePickerItem, setSizePickerItem] = useState<MenuItem | null>(null);
  const [pickedSize, setPickedSize] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const { items, addItem, removeItem, updateQuantity, getItemCount, getSubtotal, makeCartKey } = useCart();
  const { toast } = useToast();

  useEffect(() => {
    if (id) fetchData();
  }, [id]);

  const fetchData = async () => {
    const [restaurantRes, menuRes, catRes] = await Promise.all([
      supabase.from('restaurants').select('*').eq('id', id).single(),
      supabase.from('menu_items').select('*').eq('restaurant_id', id).eq('is_available', true).order('is_featured', { ascending: false }),
      supabase.from('menu_categories').select('id, name, display_order').eq('restaurant_id', id).order('display_order'),
    ]);

    if (restaurantRes.data) setRestaurant(restaurantRes.data as Restaurant);
    if (menuRes.data) setMenuItems(menuRes.data as unknown as MenuItem[]);
    if (catRes.data) setCategories(catRes.data as MenuCategory[]);
    setLoading(false);
  };

  // (scroll-to-category removed — replaced with real filtering)

  const hasSizes = (item: MenuItem) => Array.isArray(item.sizes) && item.sizes.length > 0;

  const getItemQuantity = (menuItem: MenuItem) => {
    if (hasSizes(menuItem)) {
      // sum across all sizes of this menu item
      return items
        .filter((i) => i.menuItem.id === menuItem.id)
        .reduce((n, i) => n + i.quantity, 0);
    }
    const key = makeCartKey(menuItem.id, null);
    const item = items.find((i) => i.cartKey === key);
    return item?.quantity || 0;
  };

  const handleAddToCart = (menuItem: MenuItem) => {
    if (hasSizes(menuItem)) {
      setPickedSize(menuItem.sizes![0].name);
      setSizePickerItem(menuItem);
      return;
    }
    addItem(menuItem);
    toast({
      title: 'Added to cart',
      description: `${menuItem.name} added to your cart`,
    });
  };

  const confirmSizeAdd = () => {
    if (!sizePickerItem) return;
    const size = sizePickerItem.sizes!.find((s) => s.name === pickedSize);
    if (!size) return;
    addItem(sizePickerItem, 1, { selectedSize: size });
    toast({
      title: 'Added to cart',
      description: `${sizePickerItem.name} (${size.name}) added to your cart`,
    });
    setSizePickerItem(null);
    setPickedSize('');
  };

  const handleUpdateQuantity = (menuItem: MenuItem, delta: number) => {
    if (hasSizes(menuItem)) {
      // For sized items, +delta always opens size picker; -delta removes last-added variant
      if (delta > 0) {
        setPickedSize(menuItem.sizes![0].name);
        setSizePickerItem(menuItem);
        return;
      }
      const variants = items.filter((i) => i.menuItem.id === menuItem.id);
      if (variants.length === 0) return;
      const last = variants[variants.length - 1];
      updateQuantity(last.cartKey, last.quantity - 1);
      return;
    }
    const key = makeCartKey(menuItem.id, null);
    const current = items.find((i) => i.cartKey === key);
    const currentQty = current?.quantity || 0;
    const newQty = currentQty + delta;
    if (newQty <= 0) removeItem(key);
    else updateQuantity(key, newQty);
  };

  const itemCount = getItemCount();
  const subtotal = getSubtotal();

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <CustomerHeader />
        <div className="container py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-48 bg-muted rounded-lg" />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-32 bg-muted rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen bg-background">
        <CustomerHeader />
        <div className="container py-16 text-center">
          <p className="text-muted-foreground">Restaurant not found</p>
          <Link to="/restaurants">
            <Button className="mt-4">Back to Restaurants</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <CustomerHeader />

      <main className="container py-6">
        <Link to="/restaurants" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Restaurants
        </Link>

        <div className="relative rounded-2xl overflow-hidden mb-8">
          <div className="h-48 md:h-64 bg-gradient-to-br from-primary/20 to-accent">
            {restaurant.image_url && (
              <img
                src={resolveImg(restaurant.image_url)}
                alt={restaurant.name}
                className="w-full h-full object-cover"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
            )}
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-6">
            <h1 className="text-3xl font-bold mb-2">{restaurant.name}</h1>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              {restaurant.cuisine_type && (
                <Badge variant="secondary">{restaurant.cuisine_type}</Badge>
              )}
              <span className="flex items-center gap-1 text-muted-foreground">
                <Star className="w-4 h-4 fill-warning text-warning" />
                4.5 (120+ reviews)
              </span>
              <span className="flex items-center gap-1 text-muted-foreground">
                <Clock className="w-4 h-4" />
                {restaurant.opening_time?.slice(0, 5)} - {restaurant.closing_time?.slice(0, 5)}
              </span>
              {restaurant.address && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <MapPin className="w-4 h-4" />
                  {restaurant.address}
                </span>
              )}
            </div>
          </div>
        </div>

        {menuItems.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground">No menu items available yet.</p>
          </div>
        ) : (
          (() => {
            const grouped = new Map<string, MenuItem[]>();
            const uncategorized: MenuItem[] = [];
            menuItems.forEach((it) => {
              const cid = (it as any).category_id as string | null;
              if (cid) {
                if (!grouped.has(cid)) grouped.set(cid, []);
                grouped.get(cid)!.push(it);
              } else {
                uncategorized.push(it);
              }
            });
            const orderedCats = categories.filter((c) => grouped.has(c.id));
            const showTabs = orderedCats.length > 0;

            const renderCard = (item: MenuItem) => {
              const qty = getItemQuantity(item);
              const sized = hasSizes(item);
              const priceLabel = sized
                ? `From PKR ${Math.min(...item.sizes!.map((s) => Number(s.price))).toLocaleString()}`
                : `PKR ${Number(item.price).toLocaleString()}`;
              return (
                <Card key={item.id} className="overflow-hidden hover:shadow-md transition-shadow">
                  <div className="flex gap-3 p-3">
                    <div className="w-24 h-24 sm:w-28 sm:h-28 flex-shrink-0 rounded-lg overflow-hidden bg-muted">
                      {item.image_url ? (
                        <img
                          src={resolveImg(item.image_url)}
                          alt={item.name}
                          loading="lazy"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const img = e.currentTarget as HTMLImageElement;
                            img.style.display = 'none';
                            const fb = img.nextElementSibling as HTMLElement | null;
                            if (fb) fb.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div
                        className="w-full h-full items-center justify-center text-2xl font-bold text-primary/30"
                        style={{ display: item.image_url ? 'none' : 'flex' }}
                      >
                        {item.name.charAt(0)}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div className="min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h3 className="font-semibold text-sm sm:text-base truncate">{item.name}</h3>
                          {item.is_featured && (
                            <Badge className="bg-primary/10 text-primary text-[10px] px-1.5 py-0 flex-shrink-0">
                              Popular
                            </Badge>
                          )}
                        </div>
                        {item.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
                        )}
                        {sized && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {item.sizes!.map((s) => (
                              <span key={s.name} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                {s.name} · PKR {Number(s.price).toLocaleString()}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-2">
                        <span className="font-bold text-primary text-sm sm:text-base whitespace-nowrap">{priceLabel}</span>
                        {qty === 0 ? (
                          <Button size="sm" onClick={() => handleAddToCart(item)} className="gradient-primary h-8 px-3 text-xs">
                            <Plus className="w-3.5 h-3.5 mr-1" />
                            {sized ? 'Select' : 'Add'}
                          </Button>
                        ) : (
                          <div className="flex items-center gap-1">
                            <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => handleUpdateQuantity(item, -1)}>
                              <Minus className="w-3.5 h-3.5" />
                            </Button>
                            <span className="w-5 text-center text-sm font-medium">{qty}</span>
                            <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => handleUpdateQuantity(item, 1)}>
                              <Plus className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            };

            const totalCount = menuItems.length;
            const catCounts = new Map<string, number>();
            orderedCats.forEach((c) => catCounts.set(c.id, grouped.get(c.id)!.length));

            const filteredItems =
              activeCategory === 'all'
                ? menuItems
                : activeCategory === 'other'
                ? uncategorized
                : grouped.get(activeCategory) ?? [];

            const activeCatName =
              activeCategory === 'all'
                ? 'All Items'
                : activeCategory === 'other'
                ? 'Other'
                : orderedCats.find((c) => c.id === activeCategory)?.name ?? 'Menu';

            const chipBase =
              'flex-shrink-0 px-4 py-2 rounded-full border text-sm font-medium whitespace-nowrap transition-all active:scale-95';
            const chipInactive =
              'border-border bg-card text-foreground/80 hover:border-primary/40';
            const chipActive =
              'border-primary bg-primary text-primary-foreground shadow-sm';

            return (
              <>
                {showTabs && (
                  <div className="sticky top-14 md:top-16 z-30 -mx-4 md:mx-0 mb-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b">
                    <div className="flex gap-2 overflow-x-auto px-4 py-3 scrollbar-hide">
                      <button
                        onClick={() => setActiveCategory('all')}
                        className={`${chipBase} ${activeCategory === 'all' ? chipActive : chipInactive}`}
                      >
                        All <span className="opacity-70">({totalCount})</span>
                      </button>
                      {orderedCats.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => setActiveCategory(c.id)}
                          className={`${chipBase} ${activeCategory === c.id ? chipActive : chipInactive}`}
                        >
                          {c.name} <span className="opacity-70">({catCounts.get(c.id)})</span>
                        </button>
                      ))}
                      {uncategorized.length > 0 && (
                        <button
                          onClick={() => setActiveCategory('other')}
                          className={`${chipBase} ${activeCategory === 'other' ? chipActive : chipInactive}`}
                        >
                          Other <span className="opacity-70">({uncategorized.length})</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <section>
                  <div className="flex items-baseline justify-between mb-3">
                    <h2 className="text-lg md:text-2xl font-bold">{activeCatName}</h2>
                    <span className="text-xs text-muted-foreground">{filteredItems.length} items</span>
                  </div>
                  {filteredItems.length === 0 ? (
                    <div className="text-center py-16 text-muted-foreground">
                      No items in this category.
                    </div>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2">
                      {filteredItems.map(renderCard)}
                    </div>
                  )}
                </section>
              </>
            );
          })()
        )}
      </main>


      {/* Size Picker Dialog */}
      <Dialog open={!!sizePickerItem} onOpenChange={(open) => !open && setSizePickerItem(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Choose a size</DialogTitle>
            <DialogDescription>
              {sizePickerItem?.name} — pick which size you'd like to add.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {sizePickerItem?.sizes?.map((s) => (
              <button
                key={s.name}
                type="button"
                onClick={() => setPickedSize(s.name)}
                className={`w-full text-left flex items-center justify-between rounded-lg border px-4 py-3 transition ${
                  pickedSize === s.name
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/40'
                }`}
              >
                <span className="font-medium">{s.name}</span>
                <span className="font-bold text-primary">PKR {Number(s.price).toLocaleString()}</span>
              </button>
            ))}
          </div>
          <Button className="w-full gradient-primary" onClick={confirmSizeAdd} disabled={!pickedSize}>
            Add to Cart
          </Button>
        </DialogContent>
      </Dialog>

      {itemCount > 0 && (
        <div className="fixed bottom-16 md:bottom-0 left-0 right-0 p-3 md:p-4 bg-card border-t shadow-soft-xl z-40">
          <div className="container">
            <Link to="/cart">
              <Button className="w-full gradient-primary h-12 md:h-14 text-sm md:text-base">
                <ShoppingCart className="w-5 h-5 mr-2" />
                View Cart ({itemCount}) • PKR {subtotal.toLocaleString()}
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
