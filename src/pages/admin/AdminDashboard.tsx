import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import {
  ShoppingBag, Users, Bike, Banknote, TrendingUp, Clock, Store,
  UtensilsCrossed, AlertCircle, CheckCircle2, XCircle, ArrowRight, Package,
  Bell, Radio,
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
  todayDelivered: number;
}

interface RecentOrder {
  id: string;
  order_number: string;
  status: string;
  total: number;
  created_at: string;
  restaurant?: { name: string } | null;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
  data: any;
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

const typeColors: Record<string, string> = {
  success: 'text-success bg-success/10',
  warning: 'text-warning bg-warning/10',
  info: 'text-info bg-info/10',
  error: 'text-destructive bg-destructive/10',
};

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalOrders: 0, totalRevenue: 0, todayRevenue: 0, avgOrderValue: 0,
    onlineRiders: 0, totalRiders: 0, pendingRiders: 0,
    totalCustomers: 0, totalRestaurants: 0, pendingRestaurants: 0,
    totalMenuItems: 0, pendingOrders: 0, activeOrders: 0,
    deliveredOrders: 0, cancelledOrders: 0, todayOrders: 0, todayDelivered: 0,
  });
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [tick, setTick] = useState(0); // for time-ago refresh
  const initialLoad = useRef(true);

  // Tick every 30s so "time ago" refreshes
  useEffect(() => {
    const t = setInterval(() => setTick(x => x + 1), 30000);
    return () => clearInterval(t);
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
      // Revenue = delivered orders only (real money earned)
      const deliveredList = orders.filter(o => o.status === 'delivered');
      const totalRevenue = deliveredList.reduce((s, o) => s + Number(o.total), 0);
      const deliveredOrders = deliveredList.length;
      const cancelledOrders = orders.filter(o => o.status === 'cancelled').length;
      const pendingOrders = orders.filter(o => o.status === 'pending').length;
      const activeOrders = orders.filter(o => !['delivered', 'cancelled'].includes(o.status)).length;
      const todayOrdersArr = orders.filter(o => o.created_at.startsWith(today));
      const todayDeliveredArr = todayOrdersArr.filter(o => o.status === 'delivered');
      const todayRevenue = todayDeliveredArr.reduce((s, o) => s + Number(o.total), 0);
      const avgOrderValue = deliveredOrders > 0 ? totalRevenue / deliveredOrders : 0;

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
        todayDelivered: todayDeliveredArr.length,
      });

      setRecentOrders((recentRes.data || []) as unknown as RecentOrder[]);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error fetching dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchNotifications = async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('notifications')
      .select('id, title, message, type, is_read, created_at, data')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(15);
    setNotifications((data || []) as Notification[]);
  };

  const markAllRead = async () => {
    if (!user?.id) return;
    const unread = notifications.filter(n => !n.is_read).map(n => n.id);
    if (unread.length === 0) return;
    await supabase.from('notifications').update({ is_read: true }).in('id', unread);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    toast.success('All notifications marked as read');
  };

  useEffect(() => {
    fetchAll();
    fetchNotifications();

    const channel = supabase
      .channel('admin-dashboard-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        fetchAll();
        if (payload.eventType === 'INSERT' && !initialLoad.current) {
          const o: any = payload.new;
          toast.success(`New order #${o.order_number || ''}`, {
            description: `PKR ${Number(o.total).toLocaleString()}`,
          });
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurants' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'riders' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchAll())
      .subscribe((status) => {
        setLive(status === 'SUBSCRIBED');
      });

    let notifChannel: any = null;
    if (user?.id) {
      notifChannel = supabase
        .channel(`admin-notifs-${user.id}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
          (payload) => {
            const n = payload.new as Notification;
            setNotifications(prev => [n, ...prev].slice(0, 15));
          }
        )
        .subscribe();
    }

    // Allow order-insert toasts after mount
    const t = setTimeout(() => { initialLoad.current = false; }, 2000);

    return () => {
      supabase.removeChannel(channel);
      if (notifChannel) supabase.removeChannel(notifChannel);
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const primaryCards = [
    { title: "Today's Orders", value: stats.todayOrders, icon: TrendingUp, color: 'text-primary', bgColor: 'bg-primary/10' },
    { title: "Today's Revenue", value: `PKR ${stats.todayRevenue.toLocaleString()}`, icon: Banknote, color: 'text-success', bgColor: 'bg-success/10', hint: `${stats.todayDelivered} delivered` },
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

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="space-y-6" data-tick={tick}>
      {/* Live status header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${live ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
            <span className="relative flex h-2 w-2">
              {live && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${live ? 'bg-success' : 'bg-muted-foreground'}`} />
            </span>
            {live ? 'Live' : 'Reconnecting…'}
          </div>
          <span className="text-xs text-muted-foreground">
            Last updated {timeAgo(lastUpdate.toISOString())}
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={() => { fetchAll(); fetchNotifications(); }}>
          <Radio className="w-4 h-4 mr-1.5" /> Refresh
        </Button>
      </div>

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
                {(stat as any).hint && (
                  <p className="text-xs text-muted-foreground mt-1">{(stat as any).hint}</p>
                )}
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

      {/* Recent Orders + Notifications */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
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
                          {(o as any).restaurant?.name || 'N/A'} · {timeAgo(o.created_at)}
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

        {/* Live Notifications */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Bell className="w-4 h-4" /> Notifications
              {unreadCount > 0 && (
                <Badge className="bg-destructive text-destructive-foreground text-xs">{unreadCount}</Badge>
              )}
            </CardTitle>
            {unreadCount > 0 && (
              <Button size="sm" variant="ghost" onClick={markAllRead}>Mark all read</Button>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {notifications.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No notifications yet.</p>
            ) : (
              <ScrollArea className="h-[420px]">
                <div className="space-y-1 p-3">
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`p-3 rounded-lg border ${!n.is_read ? 'bg-primary/5 border-primary/30' : 'bg-background'}`}
                    >
                      <div className="flex items-start gap-2">
                        <div className={`p-1.5 rounded ${typeColors[n.type] || 'bg-muted'} shrink-0`}>
                          <Bell className="w-3 h-3" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium truncate">{n.title}</p>
                            {!n.is_read && <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />}
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.message}</p>
                          <p className="text-[10px] text-muted-foreground mt-1">{timeAgo(n.created_at)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
