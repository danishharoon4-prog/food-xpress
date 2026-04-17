import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ShoppingBag, User, Phone, Bike } from 'lucide-react';
import { DeliveryCountdown } from '@/components/DeliveryCountdown';
import type { Order, OrderStatus } from '@/types';

const statusColors: Record<OrderStatus, string> = {
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

interface RiderWithProfile {
  id: string;
  user_id: string;
  is_online: boolean;
  is_verified: boolean;
  profile?: { full_name: string; phone?: string | null };
}

interface OrderWithRelations extends Order {
  customer?: { full_name: string; phone: string | null } | null;
  assigned_rider?: { id: string; profile?: { full_name: string; phone: string | null } | null } | null;
}

export default function AdminOrders() {
  const [orders, setOrders] = useState<OrderWithRelations[]>([]);
  const [riders, setRiders] = useState<RiderWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchOrders();
    fetchRiders();
    
    // Real-time subscription
    const channel = supabase
      .channel('admin-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchOrders();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchOrders = async () => {
    const { data, error } = await supabase
      .from('orders')
      .select('*, restaurant:restaurants(name), order_items(*)')
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      setLoading(false);
      return;
    }

    const baseOrders = (data || []) as unknown as OrderWithRelations[];

    // Fetch customer profiles in one query
    const customerIds = Array.from(new Set(baseOrders.map((o) => o.customer_id).filter(Boolean)));
    let customersById: Record<string, { full_name: string; phone: string | null }> = {};
    if (customerIds.length > 0) {
      const { data: customers } = await supabase
        .from('profiles')
        .select('id, full_name, phone')
        .in('id', customerIds);
      customersById = (customers || []).reduce((acc, c) => {
        acc[c.id] = { full_name: c.full_name, phone: c.phone };
        return acc;
      }, {} as Record<string, { full_name: string; phone: string | null }>);
    }

    // Fetch assigned rider profiles
    const riderIds = Array.from(new Set(baseOrders.map((o) => o.rider_id).filter(Boolean) as string[]));
    let ridersById: Record<string, { id: string; profile?: { full_name: string; phone: string | null } | null }> = {};
    if (riderIds.length > 0) {
      const { data: ridersData } = await supabase
        .from('riders')
        .select('id, user_id')
        .in('id', riderIds);
      const userIds = (ridersData || []).map((r) => r.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, phone')
        .in('id', userIds);
      ridersById = (ridersData || []).reduce((acc, r) => {
        const profile = profiles?.find((p) => p.id === r.user_id);
        acc[r.id] = { id: r.id, profile: profile ? { full_name: profile.full_name, phone: profile.phone } : null };
        return acc;
      }, {} as Record<string, { id: string; profile?: { full_name: string; phone: string | null } | null }>);
    }

    const enriched = baseOrders.map((o) => ({
      ...o,
      customer: customersById[o.customer_id] || null,
      assigned_rider: o.rider_id ? ridersById[o.rider_id] || null : null,
    }));

    setOrders(enriched);
    setLoading(false);
  };

  const fetchRiders = async () => {
    // Fetch all riders
    const { data: ridersData } = await supabase
      .from('riders')
      .select('id, user_id, is_online, is_verified');

    if (ridersData && ridersData.length > 0) {
      // Fetch profiles for these riders
      const userIds = ridersData.map(r => r.user_id);
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, phone')
        .in('id', userIds);

      // Map profiles to riders
      const ridersWithProfiles = ridersData.map(rider => ({
        ...rider,
        profile: profilesData?.find(p => p.id === rider.user_id)
      }));

      setRiders(ridersWithProfiles as RiderWithProfile[]);
    }
  };

  const updateStatus = async (orderId: string, status: OrderStatus) => {
    const { error } = await supabase.from('orders').update({ status }).eq('id', orderId);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Updated', description: `Order status changed to ${status}` });
    }
  };

  const assignRider = async (orderId: string, riderId: string) => {
    const { error } = await supabase
      .from('orders')
      .update({ rider_id: riderId, status: 'ready_for_pickup' as OrderStatus })
      .eq('id', orderId);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Rider Assigned', description: 'Order assigned to rider successfully' });
      fetchOrders();
    }
  };

  if (loading) {
    return <div className="animate-pulse text-muted-foreground">Loading orders...</div>;
  }

  const getRiderName = (riderId: string | null) => {
    if (!riderId) return null;
    const rider = riders.find(r => r.id === riderId);
    return rider?.profile?.full_name || 'Unknown Rider';
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Orders</h2>

      {orders.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <ShoppingBag className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No orders yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <Card key={order.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-lg">#{order.order_number}</CardTitle>
                  <Badge className={statusColors[order.status]}>{order.status.replace(/_/g, ' ')}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Restaurant</p>
                    <p className="font-medium">{(order as any).restaurant?.name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Total</p>
                    <p className="font-bold text-primary">PKR {Number(order.total).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Delivery Address</p>
                    <p className="text-sm">{order.delivery_address}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Items</p>
                    <p className="text-sm">{order.order_items?.length || 0} items</p>
                  </div>
                </div>

                {/* Rider Assignment */}
                <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Rider Assignment</span>
                  </div>
                  {order.rider_id ? (
                    <p className="text-sm text-success">Assigned to: {getRiderName(order.rider_id)}</p>
                  ) : (
                    <Select onValueChange={(riderId) => assignRider(order.id, riderId)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a rider to assign" />
                      </SelectTrigger>
                      <SelectContent>
                        {riders.filter(r => r.is_online).length === 0 ? (
                          <SelectItem value="_none" disabled>No online riders</SelectItem>
                        ) : (
                          riders.filter(r => r.is_online).map((rider) => (
                            <SelectItem key={rider.id} value={rider.id}>
                              {rider.profile?.full_name || 'Rider'} {rider.is_online ? '(Online)' : '(Offline)'}
                            </SelectItem>
                          ))
                        )}
                        {riders.filter(r => !r.is_online).map((rider) => (
                          <SelectItem key={rider.id} value={rider.id}>
                            {rider.profile?.full_name || 'Rider'} (Offline)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="mt-4 flex items-center gap-4 flex-wrap">
                  <Select
                    value={order.status}
                    onValueChange={(value) => updateStatus(order.id, value as OrderStatus)}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="confirmed">Confirmed</SelectItem>
                      <SelectItem value="preparing">Preparing</SelectItem>
                      <SelectItem value="ready_for_pickup">Ready for Pickup</SelectItem>
                      <SelectItem value="picked_up">Picked Up</SelectItem>
                      <SelectItem value="on_the_way">On the Way</SelectItem>
                      <SelectItem value="delivered">Delivered</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-xs text-muted-foreground">
                    {new Date(order.created_at).toLocaleString()}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
