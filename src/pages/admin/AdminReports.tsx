import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  Loader2, TrendingUp, Banknote, ShoppingBag, Users, Download, Search, RefreshCw,
} from 'lucide-react';
import { format, subDays, startOfDay } from 'date-fns';
import { toast } from 'sonner';
import { useCallback, useRef } from 'react';

type Order = {
  id: string;
  order_number: string;
  status: string;
  total: number;
  subtotal: number;
  delivery_fee: number | null;
  created_at: string;
  customer_id: string;
  rider_id: string | null;
  restaurant_id: string | null;
};

type Lookup = Record<string, string>;

const RANGE_OPTIONS = [
  { label: 'Last 7 days', value: '7' },
  { label: 'Last 30 days', value: '30' },
  { label: 'Last 90 days', value: '90' },
  { label: 'All time', value: 'all' },
];

const STATUS_COLORS: Record<string, string> = {
  pending: 'hsl(var(--muted-foreground))',
  confirmed: 'hsl(var(--primary))',
  preparing: '#f59e0b',
  ready_for_pickup: '#8b5cf6',
  picked_up: '#06b6d4',
  awaiting_confirmation: '#3b82f6',
  delivered: '#10b981',
  cancelled: 'hsl(var(--destructive))',
};

export default function AdminReports() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Lookup>({});
  const [restaurants, setRestaurants] = useState<Lookup>({});
  const [range, setRange] = useState('30');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [restaurantFilter, setRestaurantFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: ord, error }, { data: profs }, { data: rests }] = await Promise.all([
        supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(2000),
        supabase.from('profiles').select('id, full_name'),
        supabase.from('restaurants').select('id, name'),
      ]);
      if (error) toast.error('Failed to load orders');
      setOrders((ord ?? []) as Order[]);
      setCustomers(Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.full_name])));
      setRestaurants(Object.fromEntries((rests ?? []).map((r: any) => [r.id, r.name])));
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const cutoff = range === 'all' ? null : startOfDay(subDays(new Date(), Number(range))).getTime();
    return orders.filter((o) => {
      if (cutoff && new Date(o.created_at).getTime() < cutoff) return false;
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (restaurantFilter !== 'all' && o.restaurant_id !== restaurantFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const customer = customers[o.customer_id]?.toLowerCase() ?? '';
        if (!o.order_number.toLowerCase().includes(q) && !customer.includes(q)) return false;
      }
      return true;
    });
  }, [orders, range, statusFilter, restaurantFilter, search, customers]);

  const stats = useMemo(() => {
    const delivered = filtered.filter((o) => o.status === 'delivered');
    const revenue = delivered.reduce((s, o) => s + Number(o.total || 0), 0);
    const aov = delivered.length ? revenue / delivered.length : 0;
    const uniqueCustomers = new Set(filtered.map((o) => o.customer_id)).size;
    return { total: filtered.length, revenue, aov, customers: uniqueCustomers, delivered: delivered.length };
  }, [filtered]);

  const dailySeries = useMemo(() => {
    const map = new Map<string, { date: string; orders: number; revenue: number }>();
    filtered.forEach((o) => {
      const d = format(new Date(o.created_at), 'MMM dd');
      const entry = map.get(d) ?? { date: d, orders: 0, revenue: 0 };
      entry.orders += 1;
      if (o.status === 'delivered') entry.revenue += Number(o.total || 0);
      map.set(d, entry);
    });
    return Array.from(map.values()).reverse();
  }, [filtered]);

  const statusBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((o) => map.set(o.status, (map.get(o.status) ?? 0) + 1));
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  const topRestaurants = useMemo(() => {
    const map = new Map<string, { name: string; orders: number; revenue: number }>();
    filtered.forEach((o) => {
      if (!o.restaurant_id) return;
      const name = restaurants[o.restaurant_id] ?? 'Unknown';
      const entry = map.get(o.restaurant_id) ?? { name, orders: 0, revenue: 0 };
      entry.orders += 1;
      if (o.status === 'delivered') entry.revenue += Number(o.total || 0);
      map.set(o.restaurant_id, entry);
    });
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 8);
  }, [filtered, restaurants]);

  const exportCSV = () => {
    const headers = ['Order #', 'Date', 'Customer', 'Restaurant', 'Status', 'Subtotal', 'Delivery Fee', 'Total'];
    const rows = filtered.map((o) => [
      o.order_number,
      format(new Date(o.created_at), 'yyyy-MM-dd HH:mm'),
      customers[o.customer_id] ?? '',
      o.restaurant_id ? restaurants[o.restaurant_id] ?? '' : '',
      o.status,
      o.subtotal,
      o.delivery_fee ?? 0,
      o.total,
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Reports</h2>
          <p className="text-sm text-muted-foreground">Orders, revenue and performance insights.</p>
        </div>
        <Button variant="outline" onClick={exportCSV}>
          <Download className="w-4 h-4 mr-2" /> Export CSV
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4 grid gap-3 md:grid-cols-4">
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger><SelectValue placeholder="Date range" /></SelectTrigger>
            <SelectContent>
              {RANGE_OPTIONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {Object.keys(STATUS_COLORS).map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={restaurantFilter} onValueChange={setRestaurantFilter}>
            <SelectTrigger><SelectValue placeholder="Restaurant" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All restaurants</SelectItem>
              {Object.entries(restaurants).map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search order # or customer" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* KPI cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard icon={ShoppingBag} label="Total Orders" value={stats.total.toString()} />
        <StatCard icon={TrendingUp} label="Delivered" value={stats.delivered.toString()} />
        <StatCard icon={Banknote} label="Revenue" value={`PKR ${Math.round(stats.revenue).toLocaleString()}`} />
        <StatCard icon={Users} label="Unique Customers" value={stats.customers.toString()} sub={`AOV PKR ${Math.round(stats.aov)}`} />
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="status">Status</TabsTrigger>
          <TabsTrigger value="restaurants">Top Restaurants</TabsTrigger>
          <TabsTrigger value="orders">Orders Table</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Orders & Revenue Trend</CardTitle>
              <CardDescription>Orders count and delivered revenue per day.</CardDescription>
            </CardHeader>
            <CardContent className="h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailySeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="orders" stroke="hsl(var(--primary))" strokeWidth={2} />
                  <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="status">
          <Card>
            <CardHeader>
              <CardTitle>Order Status Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusBreakdown} dataKey="value" nameKey="name" outerRadius={120} label>
                    {statusBreakdown.map((s) => (
                      <Cell key={s.name} fill={STATUS_COLORS[s.name] ?? 'hsl(var(--muted))'} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="restaurants">
          <Card>
            <CardHeader>
              <CardTitle>Top Restaurants by Revenue</CardTitle>
            </CardHeader>
            <CardContent className="h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topRestaurants} layout="vertical" margin={{ left: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} width={140} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders">
          <Card>
            <CardHeader>
              <CardTitle>Orders ({filtered.length})</CardTitle>
              <CardDescription>Filtered list of orders.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Restaurant</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.slice(0, 200).map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-medium">{o.order_number}</TableCell>
                      <TableCell>{format(new Date(o.created_at), 'MMM dd, HH:mm')}</TableCell>
                      <TableCell>{customers[o.customer_id] ?? '—'}</TableCell>
                      <TableCell>{o.restaurant_id ? restaurants[o.restaurant_id] ?? '—' : '—'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" style={{ borderColor: STATUS_COLORS[o.status], color: STATUS_COLORS[o.status] }}>
                          {o.status.replace(/_/g, ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">PKR {Number(o.total).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No orders match the filters.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
              {filtered.length > 200 && (
                <p className="text-xs text-muted-foreground mt-3">Showing first 200 of {filtered.length}. Use Export CSV for the full list.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="py-5 flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
        </div>
        <div className="p-2 rounded-lg bg-primary/10 text-primary">
          <Icon className="w-5 h-5" />
        </div>
      </CardContent>
    </Card>
  );
}
