import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import CustomerHeader from '@/components/CustomerHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  ShoppingBag, Heart, MapPin, Clock, Star, ArrowRight,
  User, Package, TrendingUp, Utensils, Activity
} from 'lucide-react';
import { OrderProgressIndicator } from '@/components/OrderProgressIndicator';
import type { OrderStatus } from '@/types';

interface DashboardStats {
  totalOrders: number;
  totalFavorites: number;
  activeOrders: number;
}

interface RecentOrder {
  id: string;
  order_number: string;
  status: string;
  total: number;
  created_at: string;
  estimated_delivery_time?: string | null;
  restaurant: { name: string } | null;
}

interface ActiveOrder {
  id: string;
  order_number: string;
  status: OrderStatus;
  total: number;
  created_at: string;
  estimated_delivery_time: string | null;
  restaurants: { name: string; image_url: string | null } | null;
}

interface FavoriteRestaurant {
  id: string;
  restaurant_id: string;
  restaurants: { id: string; name: string; cuisine_type: string | null; image_url: string | null } | null;
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  preparing: 'bg-orange-100 text-orange-800',
  ready_for_pickup: 'bg-indigo-100 text-indigo-800',
  picked_up: 'bg-purple-100 text-purple-800',
  on_the_way: 'bg-cyan-100 text-cyan-800',
  awaiting_confirmation: 'bg-amber-100 text-amber-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

export default function Dashboard() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({ totalOrders: 0, totalFavorites: 0, activeOrders: 0 });
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [favorites, setFavorites] = useState<FavoriteRestaurant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    fetchDashboardData();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchDashboardData = async () => {
    if (!user) return;

    const [ordersRes, favRes, activeRes] = await Promise.all([
      supabase
        .from('orders')
        .select('id, order_number, status, total, created_at, restaurants:restaurant_id(name)')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('favorite_restaurants')
        .select('id, restaurant_id, restaurants:restaurant_id(id, name, cuisine_type, image_url)')
        .eq('user_id', user.id)
        .limit(4),
      supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('customer_id', user.id)
        .not('status', 'in', '("delivered","cancelled")'),
    ]);

    const totalOrdersRes = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', user.id);

    setRecentOrders((ordersRes.data as any) || []);
    setFavorites((favRes.data as any) || []);
    setStats({
      totalOrders: totalOrdersRes.count || 0,
      totalFavorites: favRes.data?.length || 0,
      activeOrders: activeRes.count || 0,
    });
    setLoading(false);
  };

  if (!user) return null;

  const initials = profile?.full_name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase() || 'U';

  return (
    <div className="min-h-screen bg-background">
      <CustomerHeader />

      <main className="container py-8">
        {/* Welcome Banner */}
        <div className="relative rounded-2xl bg-gradient-to-r from-primary to-primary/70 text-primary-foreground p-6 md:p-8 mb-8 overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-primary-foreground/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-1/2 w-32 h-32 bg-primary-foreground/5 rounded-full translate-y-1/2" />
          <div className="relative flex items-center gap-4">
            <Avatar className="h-16 w-16 border-2 border-primary-foreground/30">
              <AvatarImage src={profile?.avatar_url || ''} />
              <AvatarFallback className="bg-primary-foreground/20 text-primary-foreground text-xl font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">
                Welcome back, {profile?.full_name?.split(' ')[0] || 'User'}! 👋
              </h1>
              <p className="text-primary-foreground/80 mt-1">
                {stats.activeOrders > 0
                  ? `You have ${stats.activeOrders} active order${stats.activeOrders > 1 ? 's' : ''}`
                  : 'What would you like to eat today?'}
              </p>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="border-none shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Package className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalOrders}</p>
                <p className="text-xs text-muted-foreground">Total Orders</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <Heart className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalFavorites}</p>
                <p className="text-xs text-muted-foreground">Favorites</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-accent flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.activeOrders}</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
            </CardContent>
          </Card>
          <Link to="/restaurants">
            <Card className="border-none shadow-sm hover:shadow-md transition-shadow cursor-pointer group h-full">
              <CardContent className="p-4 flex items-center gap-3 h-full">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Utensils className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold group-hover:text-primary transition-colors">Order Now</p>
                  <p className="text-xs text-muted-foreground">Browse restaurants</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Recent Orders */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ShoppingBag className="w-5 h-5 text-primary" />
                  Recent Orders
                </CardTitle>
                <Link to="/orders">
                  <Button variant="ghost" size="sm">
                    View All <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
                    ))}
                  </div>
                ) : recentOrders.length === 0 ? (
                  <div className="text-center py-8">
                    <ShoppingBag className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
                    <p className="text-muted-foreground mb-3">No orders yet</p>
                    <Link to="/restaurants">
                      <Button size="sm">Start Ordering</Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentOrders.map((order) => (
                      <Link key={order.id} to={`/order/${order.id}`}>
                        <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <Package className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium text-sm">{order.order_number}</p>
                              <p className="text-xs text-muted-foreground">
                                {(order.restaurant as any)?.name || 'Restaurant'} •{' '}
                                {new Date(order.created_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge className={`text-xs ${statusColors[order.status] || 'bg-muted'}`}>
                              {order.status?.replace(/_/g, ' ')}
                            </Badge>
                            <p className="text-sm font-semibold mt-1">PKR {Number(order.total).toLocaleString()}</p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Profile Card */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-4">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={profile?.avatar_url || ''} />
                    <AvatarFallback className="bg-primary/10 text-primary font-bold">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{profile?.full_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{profile?.email || user.email}</p>
                  </div>
                </div>
                {profile?.permanent_address && (
                  <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 p-2 rounded-md mb-3">
                    <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    <span className="line-clamp-2">{profile.permanent_address}</span>
                  </div>
                )}
                <Link to="/profile">
                  <Button variant="outline" size="sm" className="w-full">
                    <User className="w-4 h-4 mr-2" />
                    Edit Profile
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Favorite Restaurants */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Heart className="w-5 h-5 text-destructive" />
                  Favorites
                </CardTitle>
              </CardHeader>
              <CardContent>
                {favorites.length === 0 ? (
                  <div className="text-center py-4">
                    <Heart className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
                    <p className="text-sm text-muted-foreground">No favorites yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {favorites.map((fav) => (
                      <Link key={fav.id} to={`/restaurant/${fav.restaurant_id}`}>
                        <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary/20 to-accent overflow-hidden flex-shrink-0">
                            {(fav.restaurants as any)?.image_url ? (
                              <img
                                src={(fav.restaurants as any).image_url}
                                alt={(fav.restaurants as any)?.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Utensils className="w-4 h-4 text-primary/40" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{(fav.restaurants as any)?.name}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {(fav.restaurants as any)?.cuisine_type || 'Restaurant'}
                            </p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
