import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ShoppingBag, Users, Bike, Banknote, TrendingUp, Clock, Store,
  UtensilsCrossed, AlertCircle, CheckCircle2, XCircle, ArrowRight, Package
} from 'lucide-react';

interface DashboardStats {
  totalOrders: number;
  totalRevenue: number;
  todayRevenue: number;
  avgOrderValue: number;
  onlineRiders: number;
  totalRiders: number;
  pendingRiders: number;
  totalCustomers: number;
  totalRestaurants: number;
  pendingRestaurants: number;
  totalMenuItems: number;
  pendingOrders: number;
  activeOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  todayOrders: number;
}

interface RecentOrder {
  id: string;
  order_number: string;
  status: string;
  total: number;
  created_at: string;
  restaurant?: { name: string } | null;
}

const statusColors: Record<string, string> = {
  pending: 'bg-warning/10 text-warning',
  confirmed: 'bg-info/10 text-info',
  preparing: 'bg-info/10 text-info',
  ready_for_pickup: 'bg-primary/10 text-primary',
  picked_up: 'bg-primary/10 text-primary',
  on_the_way: 'bg-primary/10 text-primary',
  awaiting_confirmation: 'bg-warning/10 text-warning',
  delivered: 'bg-success/10 text-success',
  cancelled: 'bg-destructive/10 text-destructive',
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalOrders: 0, totalRevenue: 0, todayRevenue: 0, avgOrderValue: 0,
    onlineRiders: 0, totalRiders: 0, pendingRiders: 0,
    totalCustomers: 0, totalRestaurants: 0, pendingRestaurants: 0,
    totalMenuItems: 0, pendingOrders: 0, activeOrders: 0,
    deliveredOrders: 0, cancelledOrders: 0, todayOrders: 0,
  });
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAll();
    const channel = supabase
      .channel('admin-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurants' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'riders' }, () => fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchAll = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];

      const [
        ordersRes, recentRes, ridersRes, pendingRidersRes,
        customersRes, restaurantsRes, pendingRestRes, menuRes,
      ] = await Promise.all([
        supabase.from('orders').select('total, status, created_at'),
        supabase.from('orders').select('id, order_number, status, total, created_at, restaurant:restaurants(name)').order('created_at', { ascending: false }).limit(8),
        supabase.from('riders').select('is_online', { count: 'exact' }),
        supabase.from('riders').select('*', { count: 'exact', head: true }).eq('is_verified', false),
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('restaurants').select('approval_status', { count: 'exact' }),
        supabase.from('restaurants').select('*', { count: 'exact', head: true }).eq('approval_status', 'pending'),
        supabase.from('menu_items').select('*', { count: 'exact', head: true }),
      ]);

      const orders = ordersRes.data || [];
      const totalOrders = orders.length;
      const totalRevenue = orders.reduce((s, o) => s + Number(o.total), 0);
      const deliveredOrders = orders.filter(o => o.status === 'delivered').length;
      const cancelledOrders = orders.filter(o => o.status === 'cancelled').length;
      const pendingOrders = orders.filter(o => o.status === 'pending').length;
      const activeOrders = orders.filter(o => !['delivered', 'cancelled'].includes(o.status)).length;
      const todayOrdersArr = orders.filter(o => o.created_at.startsWith(today));
      const todayRevenue = todayOrdersArr.reduce((s, o) => s + Number(o.total), 0);
      const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      const ridersRows = ridersRes.data || [];
      const onlineRiders = ridersRows.filter((r: any) => r.is_online).length;

      setStats({
        totalOrders, totalRevenue, todayRevenue, avgOrderValue,
        onlineRiders, totalRiders: ridersRes.count || 0,
        pendingRiders: pendingRidersRes.count || 0,
        totalCustomers: customersRes.count || 0,
        totalRestaurants: restaurantsRes.count || 0,
        pendingRestaurants: pendingRestRes.count || 0,
        totalMenuItems: menuRes.count || 0,
        pendingOrders, activeOrders, deliveredOrders, cancelledOrders,
        todayOrders: todayOrdersArr.length,
      });

      setRecentOrders((recentRes.data || []) as unknown as RecentOrder[]);
    } catch (error) {
      console.error('Error fetching dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const primaryCards = [
    { title: "Today's Orders", value: stats.todayOrders, icon: TrendingUp, color: 'text-primary', bgColor: 'bg-primary/10' },
    { title: "Today's Revenue", value: `PKR ${stats.todayRevenue.toLocaleString()}`, icon: Banknote, color: 'text-success', bgColor: 'bg-success/10' },
    { title: 'Active Orders', value: stats.activeOrders, icon: Package, color: 'text-info', bgColor: 'bg-info/10' },
    { title: 'Pending Orders', value: stats.pendingOrders, icon: Clock, color: 'text-warning', bgColor: 'bg-warning/10' },
  ];

  const secondaryCards = [
    { title: 'Total Orders', value: stats.totalOrders, icon: ShoppingBag, color: 'text-primary', bgColor: 'bg-primary/10' },
    { title: 'Total Revenue', value: `PKR ${stats.totalRevenue.toLocaleString()}`, icon: Banknote, color: 'text-success', bgColor: 'bg-success/10' },
    { title: 'Avg Order Value', value: `PKR ${Math.round(stats.avgOrderValue).toLocaleString()}`, icon: TrendingUp, color: 'text-info', bgColor: 'bg-info/10' },
    { title: 'Delivered', value: stats.deliveredOrders, icon: CheckCircle2, color: 'text-success', bgColor: 'bg-success/10' },
    { title: 'Cancelled', value: stats.cancelledOrders, icon: XCircle, color: 'text-destructive', bgColor: 'bg-destructive/10' },
    { title: 'Online Riders', value: `${stats.onlineRiders}/${stats.totalRiders}`, icon: Bike, color: 'text-info', bgColor: 'bg-info/10' },
    { title: 'Customers', value: stats.totalCustomers, icon: Users, color: 'text-warning', bgColor: 'bg-warning/10' },
    { title: 'Restaurants', value: stats.totalRestaurants, icon: Store, color: 'text-primary', bgColor: 'bg-primary/10' },
    { title: 'Menu Items', value: stats.totalMenuItems, icon: UtensilsCrossed, color: 'text-primary', bgColor: 'bg-primary/10' },
  ];

  if (loading) {
    return (
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(8)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-2"><div className="h-4 w-24 bg-muted rounded" /></CardHeader>
            <CardContent><div className="h-8 w-16 bg-muted rounded" /></CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Alerts */}
      {(stats.pendingRestaurants > 0 || stats.pendingRiders > 0 || stats.pendingOrders > 0) && (
        <div className="grid gap-3 md:grid-cols-3">
          {stats.pendingOrders > 0 && (
            <Card className="border-warning/40 bg-warning/5">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-warning" />
                  <div>
                    <p className="text-sm font-medium">{stats.pendingOrders} order{stats.pendingOrders !== 1 && 's'} pending</p>
                    <p className="text-xs text-muted-foreground">Awaiting confirmation</p>
                  </div>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link to="/admin/orders">View <ArrowRight className="w-3.5 h-3.5 ml-1" /></Link>
                </Button>
              </CardContent>
            </Card>
          )}
          {stats.pendingRestaurants > 0 && (
            <Card className="border-warning/40 bg-warning/5">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Store className="w-5 h-5 text-warning" />
                  <div>
                    <p className="text-sm font-medium">{stats.pendingRestaurants} restaurant{stats.pendingRestaurants !== 1 && 's'} awaiting approval</p>
                    <p className="text-xs text-muted-foreground">Review to approve or reject</p>
                  </div>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link to="/admin/restaurants">Review <ArrowRight className="w-3.5 h-3.5 ml-1" /></Link>
                </Button>
              </CardContent>
            </Card>
          )}
          {stats.pendingRiders > 0 && (
            <Card className="border-warning/40 bg-warning/5">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bike className="w-5 h-5 text-warning" />
                  <div>
                    <p className="text-sm font-medium">{stats.pendingRiders} rider{stats.pendingRiders !== 1 && 's'} pending verification</p>
                    <p className="text-xs text-muted-foreground">Verify documents</p>
                  </div>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link to="/admin/riders">Verify <ArrowRight className="w-3.5 h-3.5 ml-1" /></Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Primary today stats */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Today</h3>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {primaryCards.map((stat) => (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <stat.icon className={`w-4 h-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Overall stats */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Overview</h3>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
          {secondaryCards.map((stat) => (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <stat.icon className={`w-4 h-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Recent Orders */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Recent Orders</CardTitle>
          <Button asChild size="sm" variant="ghost">
            <Link to="/admin/orders">View all <ArrowRight className="w-3.5 h-3.5 ml-1" /></Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recentOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No orders yet.</p>
          ) : (
            <div className="space-y-2">
              {recentOrders.map((o) => (
                <Link
                  key={o.id}
                  to="/admin/orders"
                  className="flex items-center justify-between gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                      <ShoppingBag className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">#{o.order_number}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {(o as any).restaurant?.name || 'N/A'} · {new Date(o.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge className={`${statusColors[o.status] || 'bg-muted'} text-xs`}>
                      {o.status.replace(/_/g, ' ')}
                    </Badge>
                    <span className="text-sm font-semibold text-primary">
                      PKR {Number(o.total).toLocaleString()}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
