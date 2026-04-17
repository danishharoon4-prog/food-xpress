import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import CustomerHeader from '@/components/CustomerHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { DistanceDisplay } from '@/components/DistanceDisplay';
import { LiveRiderTracking } from '@/components/LiveRiderTracking';
import { OrderProgressIndicator } from '@/components/OrderProgressIndicator';
import { DeliveryCountdown } from '@/components/DeliveryCountdown';
import { useToast } from '@/hooks/use-toast';
import { Bike, MapPin, Phone, Star, CheckCircle2 } from 'lucide-react';
import type { Order, OrderStatus, Rider, Profile } from '@/types';


export default function OrderTracking() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [rider, setRider] = useState<(Rider & { profile?: Profile }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (id) {
      fetchOrder();
      
      // Real-time subscription
      const channel = supabase
        .channel(`order-${id}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` }, () => {
          fetchOrder();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [id]);

  const fetchOrder = async () => {
    const { data } = await supabase
      .from('orders')
      .select('*, restaurant:restaurants(name, address, latitude, longitude), order_items(*), payment:payments(*)')
      .eq('id', id)
      .single();

    if (data) {
      setOrder(data as unknown as Order);

      // Fetch rider if assigned
      if (data.rider_id) {
        const { data: riderData } = await supabase
          .from('riders')
          .select('*, profile:profiles!riders_user_id_fkey(full_name, phone)')
          .eq('id', data.rider_id)
          .single();

        if (riderData) setRider(riderData as any);
      }
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <CustomerHeader />
        <div className="container py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-32 bg-muted rounded-lg" />
            <div className="h-64 bg-muted rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-background">
        <CustomerHeader />
        <div className="container py-16 text-center">
          <p className="text-muted-foreground">Order not found</p>
          <Link to="/orders">
            <Button className="mt-4">View All Orders</Button>
          </Link>
        </div>
      </div>
    );
  }

  const isCancelled = order.status === 'cancelled';
  const isDelivered = order.status === 'delivered';
  const isAwaitingConfirmation = order.status === 'awaiting_confirmation';

  const confirmDelivery = async () => {
    setConfirming(true);
    const { data, error } = await supabase.rpc('confirm_delivery', { _order_id: order.id });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else if (data === false) {
      toast({ title: 'Error', description: 'Could not confirm delivery.', variant: 'destructive' });
    } else {
      toast({ title: 'Delivery Confirmed!', description: 'Order marked as delivered & paid. Thank you!' });
    }
    setConfirming(false);
    fetchOrder();
  };

  return (
    <div className="min-h-screen bg-background pb-8">
      <CustomerHeader />

      <main className="container py-8 space-y-6">
        {/* Order Header */}
        <Card className={isCancelled ? 'border-destructive' : isDelivered ? 'border-success' : 'border-primary'}>
          <CardContent className="py-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold mb-1">Order #{order.order_number}</h1>
                <p className="text-muted-foreground">
                  Placed on {new Date(order.created_at).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge
                  className={`text-sm px-4 py-2 ${
                    isCancelled
                      ? 'bg-destructive/10 text-destructive'
                      : isDelivered
                      ? 'bg-success/10 text-success'
                      : 'bg-primary/10 text-primary'
                  }`}
                >
                  {order.status.replace(/_/g, ' ').toUpperCase()}
                </Badge>
                <DeliveryCountdown
                  estimatedDeliveryTime={order.estimated_delivery_time}
                  status={order.status}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Order Progress */}
        <Card>
          <CardHeader>
            <CardTitle>Order Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <OrderProgressIndicator status={order.status} />
          </CardContent>
        </Card>

        {/* Confirm Delivery Button */}
        {isAwaitingConfirmation && (
          <Card className="border-warning border-2 bg-warning/5">
            <CardContent className="py-6">
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6 text-warning" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Rider has arrived!</h3>
                    <p className="text-sm text-muted-foreground">Please confirm you have received your order</p>
                  </div>
                </div>
                <Button
                  onClick={confirmDelivery}
                  disabled={confirming}
                  size="lg"
                  className="gradient-primary w-full sm:w-auto"
                >
                  {confirming ? 'Confirming...' : 'Confirm Delivery'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Live Rider Tracking - Shows when rider is on the way */}
        {order.rider_id && (
          <LiveRiderTracking
            riderId={order.rider_id}
            customerCoords={
              order.delivery_latitude && order.delivery_longitude
                ? { lat: order.delivery_latitude, lng: order.delivery_longitude }
                : null
            }
            orderStatus={order.status}
          />
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {/* Rider Info */}
          {rider && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bike className="w-5 h-5 text-primary" />
                  Your Rider
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-xl font-bold text-primary">
                      {rider.profile?.full_name?.charAt(0) || 'R'}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">{rider.profile?.full_name || 'Rider'}</p>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Star className="w-4 h-4 fill-warning text-warning" />
                      <span>{Number(rider.average_rating).toFixed(1)}</span>
                      <span>• {rider.total_deliveries} deliveries</span>
                    </div>
                  </div>
                  {rider.profile?.phone && (
                    <a href={`tel:${rider.profile.phone}`}>
                      <Button variant="outline" size="icon">
                        <Phone className="w-4 h-4" />
                      </Button>
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Delivery Address */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary" />
                Delivery Address
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>{order.delivery_address}</p>
              
              {/* Distance and directions */}
              <DistanceDisplay
                restaurantCoords={
                  (order as any).restaurant?.latitude && (order as any).restaurant?.longitude
                    ? { lat: (order as any).restaurant.latitude, lng: (order as any).restaurant.longitude }
                    : null
                }
                customerCoords={
                  order.delivery_latitude && order.delivery_longitude
                    ? { lat: order.delivery_latitude, lng: order.delivery_longitude }
                    : null
                }
                showDirectionsButton
              />
            </CardContent>
          </Card>
        </div>

        {/* Order Items */}
        <Card>
          <CardHeader>
            <CardTitle>Order Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground mb-4">
              From: <span className="font-medium text-foreground">{(order as any).restaurant?.name}</span>
            </div>

            {order.order_items?.map((item) => (
              <div key={item.id} className="flex justify-between">
                <span>
                  {item.item_name} × {item.quantity}
                </span>
                <span>PKR {Number(item.subtotal).toLocaleString()}</span>
              </div>
            ))}

            <Separator />

            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>PKR {Number(order.subtotal).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Delivery Fee</span>
              <span>PKR {Number(order.delivery_fee).toLocaleString()}</span>
            </div>

            <Separator />

            <div className="flex justify-between font-bold text-lg">
              <span>Total</span>
              <span className="text-primary">PKR {Number(order.total).toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
