import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useCart } from '@/contexts/CartContext';
import CustomerHeader from '@/components/CustomerHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, MapPin, Clock, Star, Plus, Minus, ShoppingCart } from 'lucide-react';
import type { Restaurant, MenuItem } from '@/types';

export default function RestaurantMenu() {
  const { id } = useParams<{ id: string }>();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { items, addItem, removeItem, updateQuantity, getItemCount, getSubtotal } = useCart();
  const { toast } = useToast();

  useEffect(() => {
    if (id) fetchData();
  }, [id]);

  const fetchData = async () => {
    const [restaurantRes, menuRes] = await Promise.all([
      supabase.from('restaurants').select('*').eq('id', id).single(),
      supabase.from('menu_items').select('*').eq('restaurant_id', id).eq('is_available', true).order('is_featured', { ascending: false }),
    ]);

    if (restaurantRes.data) setRestaurant(restaurantRes.data as Restaurant);
    if (menuRes.data) setMenuItems(menuRes.data as unknown as MenuItem[]);
    setLoading(false);
  };

  const getItemQuantity = (menuItemId: string) => {
    const item = items.find((i) => i.menuItem.id === menuItemId);
    return item?.quantity || 0;
  };

  const handleAddToCart = (menuItem: MenuItem) => {
    addItem(menuItem);
    toast({
      title: 'Added to cart',
      description: `${menuItem.name} added to your cart`,
    });
  };

  const handleUpdateQuantity = (menuItem: MenuItem, delta: number) => {
    const currentQty = getItemQuantity(menuItem.id);
    const newQty = currentQty + delta;
    
    if (newQty <= 0) {
      removeItem(menuItem.id);
    } else {
      updateQuantity(menuItem.id, newQty);
    }
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
        {/* Back Button */}
        <Link to="/restaurants" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Restaurants
        </Link>

        {/* Restaurant Header */}
        <div className="relative rounded-2xl overflow-hidden mb-8">
          <div className="h-48 md:h-64 bg-gradient-to-br from-primary/20 to-accent">
            {restaurant.image_url && (
              <img
                src={restaurant.image_url}
                alt={restaurant.name}
                className="w-full h-full object-cover"
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

        {/* Menu Items */}
        <h2 className="text-2xl font-bold mb-6">Menu</h2>
        
        {menuItems.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground">No menu items available yet.</p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {menuItems.map((item) => {
              const qty = getItemQuantity(item.id);

              return (
                <Card key={item.id} className="overflow-hidden hover:shadow-md transition-shadow">
                  <div className="flex gap-3 p-3">
                    <div className="w-24 h-24 sm:w-28 sm:h-28 flex-shrink-0 rounded-lg overflow-hidden bg-muted">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-primary/30">
                          {item.name.charAt(0)}
                        </div>
                      )}
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
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {item.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-2">
                        <span className="font-bold text-primary text-sm sm:text-base whitespace-nowrap">
                          PKR {Number(item.price).toLocaleString()}
                        </span>

                        {qty === 0 ? (
                          <Button
                            size="sm"
                            onClick={() => handleAddToCart(item)}
                            className="gradient-primary h-8 px-3 text-xs"
                          >
                            <Plus className="w-3.5 h-3.5 mr-1" />
                            Add
                          </Button>
                        ) : (
                          <div className="flex items-center gap-1">
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-7 w-7"
                              onClick={() => handleUpdateQuantity(item, -1)}
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </Button>
                            <span className="w-5 text-center text-sm font-medium">{qty}</span>
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-7 w-7"
                              onClick={() => handleUpdateQuantity(item, 1)}
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      {/* Cart Footer */}
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
