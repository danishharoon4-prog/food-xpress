import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Bike, DollarSign, ShoppingBag, Star, MapPin } from 'lucide-react';
import type { Rider, RiderWallet } from '@/types';

export default function RiderDashboard() {
  const { user } = useAuth();
  const [rider, setRider] = useState<Rider | null>(null);
  const [wallet, setWallet] = useState<RiderWallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingOrders, setPendingOrders] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    if (user) fetchRiderData();
  }, [user]);

  const fetchRiderData = async () => {
    // Fetch or create rider profile
    let { data: riderData } = await supabase
      .from('riders')
      .select('*')
      .eq('user_id', user!.id)
      .maybeSingle();

    if (!riderData) {
      // Create rider profile
      const { data: newRider } = await supabase
        .from('riders')
        .insert({ user_id: user!.id })
        .select()
        .single();
      riderData = newRider;
    }

    if (riderData) {
      setRider(riderData as Rider);

      // Fetch wallet
      const { data: walletData } = await supabase
        .from('rider_wallets')
        .select('*')
        .eq('rider_id', riderData.id)
        .maybeSingle();

      if (walletData) setWallet(walletData as RiderWallet);

      // Count pending orders assigned to this rider
      const { count } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('rider_id', riderData.id)
        .in('status', ['confirmed', 'preparing', 'ready_for_pickup', 'picked_up', 'on_the_way']);

      setPendingOrders(count || 0);
    }

    setLoading(false);
  };

  const toggleOnline = async () => {
    if (!rider) return;

    const { error } = await supabase
      .from('riders')
      .update({ is_online: !rider.is_online })
      .eq('id', rider.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setRider({ ...rider, is_online: !rider.is_online });
      toast({
        title: rider.is_online ? 'You are now offline' : 'You are now online',
        description: rider.is_online ? 'You won\'t receive new orders' : 'You can now receive orders',
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${rider?.is_online ? 'bg-success/10' : 'bg-muted'}`}>
                <Bike className={`w-6 h-6 ${rider?.is_online ? 'text-success' : 'text-muted-foreground'}`} />
              </div>
              <div>
                <h2 className="text-xl font-bold">{rider?.is_online ? 'Online' : 'Offline'}</h2>
                <p className="text-sm text-muted-foreground">
                  {rider?.is_online ? 'You can receive orders' : 'Go online to receive orders'}
                </p>
              </div>
            </div>
            <Switch checked={rider?.is_online} onCheckedChange={toggleOnline} />
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Wallet Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">PKR {Number(wallet?.balance || 0).toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Earned</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">PKR {Number(wallet?.total_earned || 0).toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Deliveries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rider?.total_deliveries || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Rating</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1">
              <Star className="w-5 h-5 text-warning fill-warning" />
              <span className="text-2xl font-bold">{Number(rider?.average_rating || 0).toFixed(1)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Orders */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5" />
            Active Orders
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pendingOrders > 0 ? (
            <p className="text-lg">You have <span className="font-bold text-primary">{pendingOrders}</span> active order(s)</p>
          ) : (
            <p className="text-muted-foreground">No active orders. {rider?.is_online ? 'Waiting for new orders...' : 'Go online to receive orders.'}</p>
          )}
        </CardContent>
      </Card>

      {/* Bonus Points */}
      <Card>
        <CardHeader>
          <CardTitle>Bonus Points</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="text-3xl font-bold text-primary">{wallet?.bonus_points || 0}</div>
            <p className="text-sm text-muted-foreground">Points earned from on-time deliveries and high ratings</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
