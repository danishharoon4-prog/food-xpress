import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Bike, ShoppingBag, Star, TrendingUp, Bell, BellOff, PackageCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Rider, RiderWallet } from '@/types';

export default function RiderDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rider, setRider] = useState<Rider | null>(null);
  const [wallet, setWallet] = useState<RiderWallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingOrders, setPendingOrders] = useState(0);
  const [availableCount, setAvailableCount] = useState(0);
  const [todayEarnings, setTodayEarnings] = useState(0);
  const [todayDeliveries, setTodayDeliveries] = useState(0);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default');
  const { toast } = useToast();

  // Audio for new-order alert
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const seenOrderIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (typeof Notification !== 'undefined') {
      setNotifPermission(Notification.permission);
    }
    // Pre-load tiny beep (data URI WAV)
    audioRef.current = new Audio(
      'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA='
    );
  }, []);

  useEffect(() => {
    if (user) fetchRiderData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Real-time subscription for stats updates
  useEffect(() => {
    if (!rider) return;

    const channel = supabase
      .channel('rider-stats')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rider_earnings', filter: `rider_id=eq.${rider.id}` }, () => fetchTodayStats())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rider_wallets', filter: `rider_id=eq.${rider.id}` }, () => fetchWallet())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `rider_id=eq.${rider.id}` }, () => fetchPendingOrders())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rider?.id]);

  // Listen for new ready_for_pickup orders & alert
  useEffect(() => {
    if (!rider || !rider.is_online || !rider.is_verified) return;

    // Initial available count
    refreshAvailable();

    const channel = supabase
      .channel('rider-new-orders')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders' },
        async (payload: any) => {
          const newRow = payload.new;
          if (newRow.status === 'ready_for_pickup' && !newRow.rider_id) {
            // Verify it matches city via re-fetching list (RLS filters for us)
            await refreshAvailable(newRow.id);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        async (payload: any) => {
          const newRow = payload.new;
          if (newRow.status === 'ready_for_pickup' && !newRow.rider_id) {
            await refreshAvailable(newRow.id);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rider?.is_online, rider?.is_verified]);

  const refreshAvailable = async (newlyArrivedId?: string) => {
    const { data } = await supabase
      .from('orders')
      .select('id, order_number, restaurant:restaurants(name)')
      .eq('status', 'ready_for_pickup')
      .is('rider_id', null);

    const list = data || [];
    setAvailableCount(list.length);

    // Detect newly seen orders
    list.forEach((o: any) => {
      if (!seenOrderIdsRef.current.has(o.id)) {
        seenOrderIdsRef.current.add(o.id);
        // Only alert if this fetch was triggered by a known new arrival
        if (newlyArrivedId && o.id === newlyArrivedId) {
          alertNewOrder(o.order_number, o.restaurant?.name);
        }
      }
    });
  };

  const alertNewOrder = (orderNumber: string, restaurantName?: string) => {
    // Sound
    audioRef.current?.play().catch(() => {});
    // Toast
    toast({
      title: '🛵 New Order Available!',
      description: `#${orderNumber}${restaurantName ? ` from ${restaurantName}` : ''}`,
    });
    // Browser notification
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        new Notification('New order ready for pickup', {
          body: `#${orderNumber}${restaurantName ? ` from ${restaurantName}` : ''}`,
          icon: '/favicon.ico',
          tag: `order-${orderNumber}`,
        });
      } catch { /* noop */ }
    }
  };

  const requestNotifPermission = async () => {
    if (typeof Notification === 'undefined') {
      toast({ title: 'Not supported', description: 'Browser notifications unavailable.', variant: 'destructive' });
      return;
    }
    const perm = await Notification.requestPermission();
    setNotifPermission(perm);
    if (perm === 'granted') {
      toast({ title: 'Notifications enabled', description: "You'll be alerted on new orders." });
    }
  };

  const fetchRiderData = async () => {
    let { data: riderData } = await supabase
      .from('riders')
      .select('*')
      .eq('user_id', user!.id)
      .maybeSingle();

    if (!riderData) {
      const { data: newRider } = await supabase
        .from('riders')
        .insert({ user_id: user!.id })
        .select()
        .single();
      riderData = newRider;
    }

    if (riderData) {
      setRider(riderData as Rider);
      await Promise.all([
        fetchWallet(riderData.id),
        fetchPendingOrders(riderData.id),
        fetchTodayStats(riderData.id),
      ]);
    }

    setLoading(false);
  };

  const fetchWallet = async (riderId?: string) => {
    const id = riderId || rider?.id;
    if (!id) return;
    const { data } = await supabase.from('rider_wallets').select('*').eq('rider_id', id).maybeSingle();
    if (data) setWallet(data as RiderWallet);
  };

  const fetchPendingOrders = async (riderId?: string) => {
    const id = riderId || rider?.id;
    if (!id) return;
    const { count } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('rider_id', id)
      .in('status', ['confirmed', 'preparing', 'ready_for_pickup', 'picked_up', 'on_the_way', 'awaiting_confirmation']);
    setPendingOrders(count || 0);
  };

  const fetchTodayStats = async (riderId?: string) => {
    const id = riderId || rider?.id;
    if (!id) return;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from('rider_earnings')
      .select('amount')
      .eq('rider_id', id)
      .gte('created_at', today.toISOString());
    if (data) {
      setTodayEarnings(data.reduce((s, e) => s + Number(e.amount), 0));
      setTodayDeliveries(data.length);
    }
  };

  const toggleOnline = async () => {
    if (!rider) return;
    if (!rider.is_verified) {
      toast({ title: 'Not verified', description: 'Wait for admin verification before going online.', variant: 'destructive' });
      return;
    }
    const { error } = await supabase.from('riders').update({ is_online: !rider.is_online }).eq('id', rider.id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setRider({ ...rider, is_online: !rider.is_online });
      toast({
        title: rider.is_online ? 'You are now offline' : 'You are now online',
        description: rider.is_online ? "You won't receive new orders" : 'Listening for new orders...',
      });
    }
  };

  if (loading) {
    return <div className="animate-pulse text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Online Toggle */}
      <Card className={rider?.is_online ? 'border-success' : ''}>
        <CardContent className="py-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${rider?.is_online ? 'bg-success/10' : 'bg-muted'}`}>
                <Bike className={`w-6 h-6 ${rider?.is_online ? 'text-success' : 'text-muted-foreground'}`} />
              </div>
              <div>
                <h2 className="text-xl font-bold">{rider?.is_online ? 'Online' : 'Offline'}</h2>
                <p className="text-sm text-muted-foreground">
                  {!rider?.is_verified
                    ? 'Awaiting admin verification'
                    : rider?.is_online
                      ? 'Listening for new orders'
                      : 'Go online to receive orders'}
                </p>
              </div>
            </div>
            <Switch checked={rider?.is_online} onCheckedChange={toggleOnline} disabled={!rider?.is_verified} />
          </div>
        </CardContent>
      </Card>

      {/* Notifications opt-in */}
      {rider?.is_verified && notifPermission !== 'granted' && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-4 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              {notifPermission === 'denied' ? <BellOff className="w-5 h-5 text-warning" /> : <Bell className="w-5 h-5 text-primary" />}
              <div>
                <p className="font-medium text-sm">Enable browser notifications</p>
                <p className="text-xs text-muted-foreground">
                  {notifPermission === 'denied'
                    ? 'Blocked. Allow notifications in your browser settings to get alerts.'
                    : 'Get alerted instantly when a new order is ready.'}
                </p>
              </div>
            </div>
            {notifPermission !== 'denied' && (
              <Button size="sm" onClick={requestNotifPermission}>Enable</Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Available orders banner */}
      {rider?.is_online && rider?.is_verified && (
        <Card className={availableCount > 0 ? 'border-primary border-2 bg-primary/5' : ''}>
          <CardContent className="py-4 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <PackageCheck className={`w-6 h-6 ${availableCount > 0 ? 'text-primary' : 'text-muted-foreground'}`} />
              <div>
                <p className="font-medium">{availableCount} order{availableCount !== 1 ? 's' : ''} ready for pickup in your city</p>
                <p className="text-xs text-muted-foreground">You can claim multiple orders at once.</p>
              </div>
            </div>
            <Button onClick={() => navigate('/rider/orders')} variant={availableCount > 0 ? 'default' : 'outline'} size="sm">
              View Orders
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Today's Stats */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Today's Earnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">PKR {todayEarnings.toLocaleString()}</div>
            <p className="text-sm text-muted-foreground mt-1">{todayDeliveries} deliveries today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ShoppingBag className="w-4 h-4" />
              Active Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{pendingOrders}</div>
            <p className="text-sm text-muted-foreground mt-1">
              {pendingOrders > 0 ? 'Orders in progress' : rider?.is_online ? 'Waiting for orders...' : 'Go online to receive'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Overall Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Wallet Balance</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-success">PKR {Number(wallet?.balance || 0).toLocaleString()}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Earned</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">PKR {Number(wallet?.total_earned || 0).toLocaleString()}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Deliveries</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{rider?.total_deliveries || 0}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Rating</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-1">
              <Star className="w-5 h-5 text-warning fill-warning" />
              <span className="text-2xl font-bold">{Number(rider?.average_rating || 0).toFixed(1)}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
