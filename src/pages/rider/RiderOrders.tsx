import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { MapPin, Phone, Navigation } from 'lucide-react';
import type { Order, OrderStatus } from '@/types';

const statusColors: Record<OrderStatus, string> = {
  pending: 'bg-warning/10 text-warning',
  confirmed: 'bg-info/10 text-info',
  preparing: 'bg-info/10 text-info',
  ready_for_pickup: 'bg-primary/10 text-primary',
  picked_up: 'bg-primary/10 text-primary',
  on_the_way: 'bg-primary/10 text-primary',
  delivered: 'bg-success/10 text-success',
  cancelled: 'bg-destructive/10 text-destructive',
};

export default function RiderOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [riderId, setRiderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (user) fetchOrders();
  }, [user]);

  const fetchOrders = async () => {
    // Get rider ID
    const { data: rider } = await supabase
      .from('riders')
      .select('id')
      .eq('user_id', user!.id)
      .maybeSingle();

    if (rider) {
      setRiderId(rider.id);

      const { data } = await supabase
        .from('orders')
        .select('*, restaurant:restaurants(name, address)')
        .eq('rider_id', rider.id)
        .order('created_at', { ascending: false });

      if (data) setOrders(data as unknown as Order[]);
    }
    setLoading(false);
  };

  const updateStatus = async (orderId: string, newStatus: OrderStatus) => {
    const updateData: Partial<Order> = { status: newStatus };
    if (newStatus === 'delivered') {
      updateData.actual_delivery_time = new Date().toISOString();
    }

    const { error } = await supabase.from('orders').update(updateData).eq('id', orderId);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }

    // If order is delivered, create earnings and update stats
    if (newStatus === 'delivered' && riderId) {
      const order = orders.find(o => o.id === orderId);
      if (order) {
        const earningAmount = Number(order.delivery_fee) || 50; // Default 50 if no delivery fee
        
        // Create earning record
        await supabase.from('rider_earnings').insert({
          rider_id: riderId,
          order_id: orderId,
          amount: earningAmount,
          description: `Delivery for order #${order.order_number}`,
          distance_km: 3,
        });

        // Get current wallet and update
        const { data: wallet } = await supabase
          .from('rider_wallets')
          .select('balance, total_earned')
          .eq('rider_id', riderId)
          .single();

        if (wallet) {
          await supabase
            .from('rider_wallets')
            .update({
              balance: (wallet.balance || 0) + earningAmount,
              total_earned: (wallet.total_earned || 0) + earningAmount
            })
            .eq('rider_id', riderId);
        }

        // Get current deliveries and increment
        const { data: riderData } = await supabase
          .from('riders')
          .select('total_deliveries')
          .eq('id', riderId)
          .single();

        await supabase
          .from('riders')
          .update({ total_deliveries: (riderData?.total_deliveries || 0) + 1 })
          .eq('id', riderId);
      }
    }

    toast({ title: 'Updated', description: `Order marked as ${newStatus.replace(/_/g, ' ')}` });
    fetchOrders();
  };

  const getNextStatus = (status: OrderStatus): OrderStatus | null => {
    const flow: Record<string, OrderStatus> = {
      ready_for_pickup: 'picked_up',
      picked_up: 'on_the_way',
      on_the_way: 'delivered',
    };
    return flow[status] || null;
  };

  if (loading) {
    return <div className="animate-pulse text-muted-foreground">Loading orders...</div>;
  }

  const activeOrders = orders.filter((o) => !['delivered', 'cancelled'].includes(o.status));
  const completedOrders = orders.filter((o) => ['delivered', 'cancelled'].includes(o.status));

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Your Orders</h2>

      {/* Active Orders */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Active Orders ({activeOrders.length})</h3>
        {activeOrders.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No active orders. Go online to receive new orders.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {activeOrders.map((order) => (
              <Card key={order.id} className="border-primary/50">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">#{order.order_number}</CardTitle>
                    <Badge className={statusColors[order.status]}>{order.status.replace(/_/g, ' ')}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 mt-1 text-primary" />
                      <div>
                        <p className="text-sm font-medium">Pickup: {(order as any).restaurant?.name}</p>
                        <p className="text-xs text-muted-foreground">{(order as any).restaurant?.address}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Navigation className="w-4 h-4 mt-1 text-success" />
                      <div>
                        <p className="text-sm font-medium">Deliver to:</p>
                        <p className="text-xs text-muted-foreground">{order.delivery_address}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="font-bold text-lg">PKR {Number(order.total).toLocaleString()}</span>
                    {getNextStatus(order.status) && (
                      <Button onClick={() => updateStatus(order.id, getNextStatus(order.status)!)} className="gradient-primary">
                        Mark as {getNextStatus(order.status)?.replace(/_/g, ' ')}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Completed Orders */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Completed ({completedOrders.length})</h3>
        <div className="space-y-2">
          {completedOrders.slice(0, 5).map((order) => (
            <Card key={order.id}>
              <CardContent className="py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium">#{order.order_number}</p>
                  <p className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  <Badge className={statusColors[order.status]}>{order.status}</Badge>
                  <p className="text-sm font-medium mt-1">PKR {Number(order.total).toLocaleString()}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
