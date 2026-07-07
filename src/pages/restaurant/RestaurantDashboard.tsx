import { useEffect, useMemo, useState } from 'react';
import { useOutletContext, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  ShoppingBag, Banknote, UtensilsCrossed, Clock, TrendingUp, Star, Store,
  ArrowUpRight, CheckCircle2, XCircle, ChefHat, BellRing, X, Power,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts';

const STATUS_COLORS: Record<string, string> = {
  pending: 'hsl(var(--warning))',
  confirmed: 'hsl(var(--info))',
  preparing: 'hsl(var(--info))',
  ready: 'hsl(var(--primary))',
  picked_up: 'hsl(var(--primary))',
  delivered: 'hsl(var(--success))',
  cancelled: 'hsl(var(--destructive))',
};

export default function RestaurantDashboard() {
  const { restaurant } = useOutletContext<{ restaurant: any }>();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<any[]>([]);
  const [itemsCount, setItemsCount] = useState(0);
  const [topItems, setTopItems] = useState<{ name: string; qty: number }[]>([]);
  const [recent, setRecent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newOrders, setNewOrders] = useState<{ id: string; order_number: string; total: number }[]>([]);

  useEffect(() => {
    if (!restaurant?.id) return;
    (async () => {
      setLoading(true);
      const since = new Date(); since.setDate(since.getDate() - 30);
      const [ordersRes, itemsRes, recentRes, orderItemsRes] = await Promise.all([
        supabase.from('orders')
          .select('id, total, subtotal, status, created_at, actual_delivery_time')
          .eq('restaurant_id', restaurant.id)
          .gte('created_at', since.toISOString()),
        supabase.from('menu_items').select('id', { count: 'exact', head: true }).eq('restaurant_id', restaurant.id),
        supabase.from('orders')
          .select('id, order_number, total, status, created_at')
          .eq('restaurant_id', restaurant.id)
          .order('created_at', { ascending: false })
          .limit(6),
        supabase.from('order_items')
          .select('quantity, menu_items!inner(name, restaurant_id)')
          .eq('menu_items.restaurant_id', restaurant.id)
          .limit(500),
      ]);
      setOrders(ordersRes.data || []);
      setItemsCount(itemsRes.count || 0);
      setRecent(recentRes.data || []);

      const agg: Record<string, number> = {};
      (orderItemsRes.data || []).forEach((r: any) => {
        const name = r.menu_items?.name || '—';
        agg[name] = (agg[name] || 0) + Number(r.quantity || 0);
      });
      setTopItems(Object.entries(agg).map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty).slice(0, 5));
      setLoading(false);
    })();
  }, [restaurant?.id]);

  // Realtime: new-order notification
  useEffect(() => {
    if (!restaurant?.id) return;
    const ch = supabase
      .channel(`rest-dash-orders-${restaurant.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurant.id}` },
        (payload) => {
          const o: any = payload.new;
          setNewOrders((prev) => [{ id: o.id, order_number: o.order_number, total: Number(o.total || 0) }, ...prev].slice(0, 5));
          setRecent((prev) => [{ id: o.id, order_number: o.order_number, total: o.total, status: o.status, created_at: o.created_at }, ...prev].slice(0, 6));
          setOrders((prev) => [o, ...prev]);
          try {
            const audio = new Audio('data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=');
            audio.play().catch(() => {});
          } catch {}
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [restaurant?.id]);

  const openNewOrder = (id: string) => {
    setNewOrders((prev) => prev.filter((n) => n.id !== id));
    navigate(`/restaurant/orders?highlight=${id}`);
  };

  const dismissNewOrder = (id: string) => {
    setNewOrders((prev) => prev.filter((n) => n.id !== id));
  };



  const stats = useMemo(() => {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const yStart = new Date(todayStart); yStart.setDate(yStart.getDate() - 1);
    const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - 7);
    const today = orders.filter(o => new Date(o.created_at) >= todayStart);
    const yesterday = orders.filter(o => new Date(o.created_at) >= yStart && new Date(o.created_at) < todayStart);
    const delivered = orders.filter(o => o.status === 'delivered');
    const revenueToday = today.filter(o => o.status === 'delivered').reduce((s, o) => s + Number(o.subtotal || 0), 0);
    const revenueYesterday = yesterday.filter(o => o.status === 'delivered').reduce((s, o) => s + Number(o.subtotal || 0), 0);
    const revenueWeek = orders.filter(o => o.status === 'delivered' && new Date(o.created_at) >= weekStart).reduce((s, o) => s + Number(o.subtotal || 0), 0);
    const totalRevenue = delivered.reduce((s, o) => s + Number(o.subtotal || 0), 0);
    const avgOrder = delivered.length ? totalRevenue / delivered.length : 0;
    const growth = revenueYesterday > 0 ? ((revenueToday - revenueYesterday) / revenueYesterday) * 100 : (revenueToday > 0 ? 100 : 0);
    return {
      todayCount: today.length,
      revenueToday, revenueWeek, totalRevenue, avgOrder, growth,
      delivered: delivered.length,
      cancelled: orders.filter(o => o.status === 'cancelled').length,
      pending: orders.filter(o => ['pending', 'confirmed', 'preparing', 'ready', 'picked_up'].includes(o.status)).length,
    };
  }, [orders]);

  const revenueTrend = useMemo(() => {
    const days: { date: string; label: string; revenue: number; orders: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
      const next = new Date(d); next.setDate(d.getDate() + 1);
      const dayOrders = orders.filter(o => {
        const t = new Date(o.created_at);
        return t >= d && t < next;
      });
      days.push({
        date: d.toISOString().slice(0, 10),
        label: d.toLocaleDateString(undefined, { weekday: 'short' }),
        revenue: dayOrders.filter(o => o.status === 'delivered').reduce((s, o) => s + Number(o.subtotal || 0), 0),
        orders: dayOrders.length,
      });
    }
    return days;
  }, [orders]);

  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    orders.forEach(o => { counts[o.status] = (counts[o.status] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [orders]);

  const cards = [
    {
      label: "Today's Revenue",
      value: `PKR ${Math.round(stats.revenueToday).toLocaleString()}`,
      icon: Banknote,
      accent: 'from-emerald-500/20 to-emerald-500/5 text-emerald-600 dark:text-emerald-400',
      trend: stats.growth,
    },
    {
      label: "Today's Orders",
      value: stats.todayCount,
      icon: ShoppingBag,
      accent: 'from-primary/20 to-primary/5 text-primary',
    },
    {
      label: 'Avg Order Value',
      value: `PKR ${Math.round(stats.avgOrder).toLocaleString()}`,
      icon: TrendingUp,
      accent: 'from-blue-500/20 to-blue-500/5 text-blue-600 dark:text-blue-400',
    },
    {
      label: 'Menu Items',
      value: itemsCount,
      icon: UtensilsCrossed,
      accent: 'from-amber-500/20 to-amber-500/5 text-amber-600 dark:text-amber-400',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Live new-order notifications */}
      {newOrders.length > 0 && (
        <div className="space-y-2">
          {newOrders.map((n) => (
            <button
              key={n.id}
              onClick={() => openNewOrder(n.id)}
              className="w-full text-left group relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/15 via-primary/10 to-transparent p-4 shadow-md hover:shadow-lg transition-all animate-fade-in"
            >
              <span className="absolute inset-0 rounded-2xl ring-2 ring-primary/40 animate-pulse pointer-events-none" />
              <div className="relative flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 animate-[pulse_1.2s_ease-in-out_infinite]">
                  <BellRing className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold uppercase tracking-wide text-primary">New Order</span>
                    <Badge variant="secondary" className="text-[10px]">Tap to view</Badge>
                  </div>
                  <p className="font-semibold text-sm truncate">
                    #{n.order_number} · PKR {Math.round(n.total).toLocaleString()}
                  </p>
                </div>
                <span
                  role="button"
                  aria-label="Dismiss"
                  onClick={(e) => { e.stopPropagation(); dismissNewOrder(n.id); }}
                  className="p-1.5 rounded-lg hover:bg-background/60 transition-colors"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </span>
              </div>
            </button>
          ))}
        </div>
      )}


      {/* Hero header */}
      <Card className="overflow-hidden border-0 shadow-lg">
        <div className="relative">
          {restaurant.image_url && (
            <div className="absolute inset-0">
              <img src={restaurant.image_url} alt="" className="w-full h-full object-cover opacity-20" />
              <div className="absolute inset-0 bg-gradient-to-r from-primary/90 via-primary/70 to-primary/50" />
            </div>
          )}
          {!restaurant.image_url && <div className="absolute inset-0 gradient-primary" />}
          <div className="relative p-5 lg:p-6 flex items-center gap-4 text-primary-foreground">
            <div className="w-16 h-16 lg:w-20 lg:h-20 rounded-2xl bg-white/20 backdrop-blur border border-white/30 overflow-hidden flex items-center justify-center shrink-0">
              {restaurant.logo_url ? (
                <img src={restaurant.logo_url} alt={restaurant.name} className="w-full h-full object-cover" />
              ) : (
                <Store className="w-8 h-8" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl lg:text-2xl font-bold truncate">{restaurant.name}</h2>
                {restaurant.is_active ? (
                  <Badge className="bg-white/25 hover:bg-white/25 text-white border-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 mr-1.5 animate-pulse" /> Open
                  </Badge>
                ) : (
                  <Badge className="bg-white/25 hover:bg-white/25 text-white border-0">Closed</Badge>
                )}
              </div>
              <p className="text-sm opacity-90 truncate">
                <ChefHat className="w-3.5 h-3.5 inline mr-1" />
                {restaurant.cuisine_type || '—'} · {restaurant.city}
              </p>
              <div className="flex items-center gap-3 mt-1 text-xs opacity-90">
                <span className="flex items-center gap-1"><Star className="w-3.5 h-3.5 fill-current" /> {Number(restaurant.rating || 0).toFixed(1)}</span>
                <span>·</span>
                <span>{restaurant.total_reviews || 0} reviews</span>
              </div>
            </div>
            <Button asChild variant="secondary" size="sm" className="hidden md:inline-flex">
              <Link to="/restaurant/orders">View Orders <ArrowUpRight className="w-3.5 h-3.5 ml-1" /></Link>
            </Button>
          </div>
        </div>
      </Card>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {cards.map((c) => (
          <Card key={c.label} className="overflow-hidden hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${c.accent} flex items-center justify-center mb-3`}>
                <c.icon className="w-5 h-5" />
              </div>
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <div className="flex items-baseline gap-2 mt-1">
                <p className="text-lg lg:text-2xl font-bold">{c.value}</p>
                {typeof c.trend === 'number' && (
                  <span className={`text-[10px] font-semibold ${c.trend >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                    {c.trend >= 0 ? '+' : ''}{c.trend.toFixed(0)}%
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Revenue — Last 7 days</CardTitle>
              <Badge variant="outline" className="text-xs">PKR {Math.round(stats.revenueWeek).toLocaleString()}</Badge>
            </div>
          </CardHeader>
          <CardContent className="pl-0">
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueTrend} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} width={50} />
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number) => [`PKR ${Math.round(v).toLocaleString()}`, 'Revenue']}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#rev)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Order Status</CardTitle></CardHeader>
          <CardContent>
            {statusData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">No orders yet</div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
                      {statusData.map((entry) => (
                        <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || 'hsl(var(--muted))'} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="flex flex-wrap gap-2 mt-2 justify-center">
              {statusData.map(s => (
                <div key={s.name} className="flex items-center gap-1 text-[11px]">
                  <span className="w-2 h-2 rounded-full" style={{ background: STATUS_COLORS[s.name] || 'hsl(var(--muted))' }} />
                  <span className="capitalize text-muted-foreground">{s.name}</span>
                  <span className="font-semibold">{s.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top items + Recent orders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Top Selling Items</CardTitle></CardHeader>
          <CardContent>
            {topItems.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">No sales yet</div>
            ) : (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topItems} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                    <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} width={90} />
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="qty" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Recent Orders</CardTitle>
              <Button asChild variant="ghost" size="sm" className="h-7 text-xs"><Link to="/restaurant/orders">View all</Link></Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {recent.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">No orders yet</div>
            ) : (
              <div className="divide-y">
                {recent.map(o => (
                  <div key={o.id} className="flex items-center justify-between px-5 py-3 hover:bg-muted/40 transition-colors">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">#{o.order_number}</p>
                      <p className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-sm">PKR {Number(o.total).toLocaleString()}</p>
                      <Badge
                        variant="outline"
                        className="text-[10px] capitalize"
                        style={{ color: STATUS_COLORS[o.status], borderColor: STATUS_COLORS[o.status] }}
                      >
                        {o.status === 'delivered' ? <CheckCircle2 className="w-2.5 h-2.5 mr-1 inline" /> :
                          o.status === 'cancelled' ? <XCircle className="w-2.5 h-2.5 mr-1 inline" /> :
                          <Clock className="w-2.5 h-2.5 mr-1 inline" />}
                        {o.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {loading && <p className="text-xs text-center text-muted-foreground">Loading stats…</p>}
    </div>
  );
}
