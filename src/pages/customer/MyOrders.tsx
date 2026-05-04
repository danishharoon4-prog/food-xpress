import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import CustomerHeader from '@/components/CustomerHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ShoppingBag, ArrowRight, X } from 'lucide-react';
import FeedbackDialog from '@/components/FeedbackDialog';
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

type OrderWithItems = Omit<Order, 'restaurant' | 'order_items'> & {
  restaurant?: { name: string } | null;
  order_items?: Array<{ id: string; item_name: string; quantity: number; item_price: number }>;
};

export default function MyOrders() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (user) fetchOrders();
  }, [user]);

  const fetchOrders = async () => {
    const { data } = await supabase
      .from('orders')
      .select('*, restaurant:restaurants(name), order_items(id, item_name, quantity, item_price)')
      .eq('customer_id', user!.id)
      .order('created_at', { ascending: false });

    if (data) setOrders(data as unknown as OrderWithItems[]);
    setLoading(false);
  };

  const handleCancel = async () => {
    if (!cancelOrderId || !cancelReason.trim()) return;
    setCancelling(true);
    const { data, error } = await supabase.rpc('cancel_order', {
      _order_id: cancelOrderId,
      _reason: cancelReason.trim(),
    });
    setCancelling(false);
    if (error || !data) {
      toast({
        title: 'Could not cancel',
        description: error?.message || 'Order can only be cancelled before it is being prepared.',
        variant: 'destructive',
      });
    } else {
      toast({ title: 'Order cancelled', description: 'Your order has been cancelled.' });
      setCancelOrderId(null);
      setCancelReason('');
      fetchOrders();
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <CustomerHeader />
        <div className="container py-16 text-center">
          <p className="text-muted-foreground mb-4">Please sign in to view your orders</p>
          <Link to="/auth">
            <Button className="gradient-primary">Sign In</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <CustomerHeader />

      <main className="container py-8">
        <h1 className="text-2xl font-bold mb-6">My Orders</h1>

        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="py-6">
                  <div className="h-6 w-32 bg-muted rounded mb-2" />
                  <div className="h-4 w-48 bg-muted rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-6">
              <ShoppingBag className="w-10 h-10 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold mb-2">No orders yet</h2>
            <p className="text-muted-foreground mb-6">Start ordering delicious food!</p>
            <Link to="/restaurants">
              <Button className="gradient-primary">Browse Restaurants</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const canCancel = order.status === 'pending' || order.status === 'confirmed';
              return (
                <Card key={order.id} className="hover:shadow-soft-lg transition-shadow">
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between gap-3">
                      <Link to={`/order/${order.id}`} className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1 flex-wrap">
                          <h3 className="font-semibold">#{order.order_number}</h3>
                          <Badge className={statusColors[order.status]}>
                            {order.status.replace(/_/g, ' ')}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {order.restaurant?.name || 'Restaurant'}
                        </p>
                        {/* Items list with quantities */}
                        {order.order_items && order.order_items.length > 0 && (
                          <ul className="mt-2 space-y-0.5">
                            {order.order_items.map((item) => (
                              <li key={item.id} className="text-sm text-foreground/80 flex items-center gap-2">
                                <span className="inline-flex items-center justify-center min-w-[1.5rem] h-5 px-1.5 rounded bg-primary/10 text-primary text-xs font-semibold">
                                  ×{item.quantity}
                                </span>
                                <span className="truncate">{item.item_name}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          {new Date(order.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </Link>
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <span className="font-bold text-primary whitespace-nowrap">
                          PKR {Number(order.total).toLocaleString()}
                        </span>
                        <Link to={`/order/${order.id}`}>
                          <ArrowRight className="w-5 h-5 text-muted-foreground" />
                        </Link>
                        {canCancel && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive h-7 text-xs"
                            onClick={(e) => {
                              e.preventDefault();
                              setCancelOrderId(order.id);
                              setCancelReason('');
                            }}
                          >
                            <X className="w-3 h-3 mr-1" /> Cancel
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      <AlertDialog open={!!cancelOrderId} onOpenChange={(open) => !open && setCancelOrderId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this order?</AlertDialogTitle>
            <AlertDialogDescription>
              You can only cancel before the restaurant starts preparing. Please share a reason so we can improve.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="cancel-reason">Reason for cancellation</Label>
            <Textarea
              id="cancel-reason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="e.g. Ordered by mistake, changed my mind..."
              rows={3}
              maxLength={500}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>Keep Order</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              disabled={!cancelReason.trim() || cancelling}
              className="bg-destructive hover:bg-destructive/90"
            >
              {cancelling ? 'Cancelling...' : 'Confirm Cancel'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
