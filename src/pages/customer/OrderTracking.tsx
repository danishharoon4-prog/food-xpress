import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import CustomerHeader from '@/components/CustomerHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { DistanceDisplay } from '@/components/DistanceDisplay';
import { LiveRiderTracking } from '@/components/LiveRiderTracking';
import { CheckCircle2, Clock, Package, Bike, MapPin, Phone, Star } from 'lucide-react';
import type { Order, OrderStatus, Rider, Profile } from '@/types';

const statusSteps: { status: OrderStatus; label: string; icon: React.ComponentType<any> }[] = [
  { status: 'pending', label: 'Order Placed', icon: Clock },
  { status: 'confirmed', label: 'Confirmed', icon: CheckCircle2 },
  { status: 'preparing', label: 'Preparing', icon: Package },
  { status: 'ready_for_pickup', label: 'Ready', icon: Package },
  { status: 'picked_up', label: 'Picked Up', icon: Bike },
  { status: 'on_the_way', label: 'On the Way', icon: Bike },
  { status: 'delivered', label: 'Delivered', icon: CheckCircle2 },
];

const getStatusIndex = (status: OrderStatus) => {
  if (status === 'cancelled') return -1;
  return statusSteps.findIndex((s) => s.status === status);
};

export default function OrderTracking() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [rider, setRider] = useState<(Rider & { profile?: Profile }) | null>(null);
  const [loading, setLoading] = useState(true);

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

  const currentStepIndex = getStatusIndex(order.status);
  const isCancelled = order.status === 'cancelled';
  const isDelivered = order.status === 'delivered';

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
            </div>
          </CardContent>
        </Card>

        {/* Status Timeline */}
        {!isCancelled && (
          <Card>
            <CardHeader>
              <CardTitle>Order Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <div className="flex justify-between">
                  {statusSteps.slice(0, -1).map((step, index) => {
                    const isCompleted = currentStepIndex >= index;
                    const isCurrent = currentStepIndex === index;

                    return (
                      <div key={step.status} className="flex flex-col items-center text-center flex-1">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 transition-colors ${
                            isCompleted
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground'
                          } ${isCurrent ? 'ring-4 ring-primary/20' : ''}`}
                        >
                          <step.icon className="w-5 h-5" />
                        </div>
                        <span className={`text-xs ${isCompleted ? 'font-medium' : 'text-muted-foreground'}`}>
                          {step.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {/* Progress Line */}
                <div className="absolute top-5 left-0 right-0 h-0.5 bg-muted -z-10 mx-8">
                  <div
                    className="h-full bg-primary transition-all duration-500"
                    style={{ width: `${Math.max(0, (currentStepIndex / (statusSteps.length - 2)) * 100)}%` }}
                  />
                </div>
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
