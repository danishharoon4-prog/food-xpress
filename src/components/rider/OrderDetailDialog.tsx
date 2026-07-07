import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Phone, MapPin, Clock, Store, User, Plus } from 'lucide-react';
import { DeliveryCountdown } from '@/components/DeliveryCountdown';
import { CustomerLocationMap } from '@/components/CustomerLocationMap';

interface Props {
  orderId: string | null;
  open: boolean;
  onClose: () => void;
  onUpdated?: () => void;
}

interface OrderDetail {
  id: string;
  order_number: string;
  status: string;
  delivery_address: string;
  delivery_latitude: number | null;
  delivery_longitude: number | null;
  subtotal: number;
  delivery_fee: number;
  total: number;
  special_instructions: string | null;
  estimated_delivery_time: string | null;
  created_at: string;
  customer_id: string;
  restaurant_id: string | null;
  rider_id: string | null;
  restaurant?: { name: string; address: string | null; city: string | null; owner_id: string | null } | null;
  restaurantPhone?: string | null;
  items: Array<{ item_name: string; item_price: number; quantity: number; subtotal: number; special_instructions: string | null }>;
  customer?: { full_name: string; phone: string | null } | null;
}

export function OrderDetailDialog({ orderId, open, onClose, onUpdated }: Props) {
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [customMinutes, setCustomMinutes] = useState('');
  const [savingEta, setSavingEta] = useState(false);
  const [myRiderId, setMyRiderId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open && orderId) load();
    if (!open) setOrder(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, orderId]);

  const load = async () => {
    setLoading(true);
    const [{ data: o }, { data: userRes }] = await Promise.all([
      supabase
        .from('orders')
        .select('*, restaurant:restaurants(name, address, city), order_items(item_name, item_price, quantity, subtotal, special_instructions)')
        .eq('id', orderId!)
        .maybeSingle(),
      supabase.auth.getUser(),
    ]);

    if (!o) { setLoading(false); return; }

    const uid = userRes?.user?.id;
    if (uid) {
      const { data: rider } = await supabase
        .from('riders')
        .select('id')
        .eq('user_id', uid)
        .maybeSingle();
      setMyRiderId(rider?.id ?? null);
    }

    const { data: cust } = await supabase
      .from('profiles')
      .select('full_name, phone')
      .eq('id', o.customer_id)
      .maybeSingle();

    setOrder({
      ...(o as any),
      items: (o as any).order_items || [],
      customer: cust || null,
    });
    setLoading(false);
  };

  const adjustEta = async (minutesDelta: number) => {
    if (!order) return;
    const base = order.estimated_delivery_time ? new Date(order.estimated_delivery_time).getTime() : Date.now();
    const newEta = new Date(base + minutesDelta * 60_000).toISOString();
    await saveEta(newEta);
  };

  const setExactEta = async () => {
    if (!order) return;
    const mins = parseInt(customMinutes, 10);
    if (isNaN(mins) || mins < 1 || mins > 240) {
      toast({ title: 'Invalid', description: 'Enter minutes from now (1-240)', variant: 'destructive' });
      return;
    }
    const newEta = new Date(Date.now() + mins * 60_000).toISOString();
    await saveEta(newEta);
    setCustomMinutes('');
  };

  const saveEta = async (newEta: string) => {
    if (!order) return;
    if (!order.rider_id || order.rider_id !== myRiderId) {
      toast({
        title: 'Not your delivery yet',
        description: 'Accept & pick up this order before setting an arrival time.',
        variant: 'destructive',
      });
      return;
    }
    setSavingEta(true);
    const { data, error } = await supabase.rpc('update_order_eta', { _order_id: order.id, _new_eta: newEta });
    setSavingEta(false);
    if (error || data === false) {
      toast({
        title: 'Failed',
        description: error?.message || 'Could not update ETA. Make sure the order is still active and assigned to you.',
        variant: 'destructive',
      });
      return;
    }
    toast({ title: 'ETA updated', description: 'Customer and admin will see the new arrival time.' });
    setOrder({ ...order, estimated_delivery_time: newEta });
    onUpdated?.();
  };

  const canEditEta = !!order
    && !!order.rider_id
    && order.rider_id === myRiderId
    && !['delivered', 'cancelled', 'awaiting_confirmation'].includes(order.status);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Order #{order?.order_number || '...'}</DialogTitle>
          <DialogDescription>Full order details and ETA management</DialogDescription>
        </DialogHeader>

        {loading || !order ? (
          <div className="py-8 text-center text-muted-foreground animate-pulse">Loading...</div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <Badge>{order.status.replace(/_/g, ' ')}</Badge>
              <DeliveryCountdown estimatedDeliveryTime={order.estimated_delivery_time} status={order.status} />
            </div>

            {/* Restaurant */}
            <div className="p-3 rounded-lg border bg-muted/30">
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Store className="w-3 h-3" /> Pickup</p>
              <p className="font-medium">{order.restaurant?.name || 'Restaurant'}</p>
              <p className="text-sm text-muted-foreground">{order.restaurant?.address}</p>
              {order.restaurant?.city && <p className="text-xs text-primary mt-1">📍 {order.restaurant.city}</p>}
            </div>

            {/* Customer */}
            <div className="p-3 rounded-lg border bg-muted/30">
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><User className="w-3 h-3" /> Customer</p>
              <p className="font-medium">{order.customer?.full_name || 'Customer'}</p>
              {order.customer?.phone && (
                <a href={`tel:${order.customer.phone}`} className="text-sm text-primary hover:underline flex items-center gap-1 mt-1">
                  <Phone className="w-3.5 h-3.5" /> {order.customer.phone}
                </a>
              )}
              {order.status !== 'delivered' && (
                <>
                  <p className="text-sm text-muted-foreground mt-2 flex items-start gap-1">
                    <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {order.delivery_address}
                  </p>
                  <div className="mt-3">
                    <CustomerLocationMap
                      latitude={order.delivery_latitude}
                      longitude={order.delivery_longitude}
                      address={order.delivery_address}
                    />
                  </div>
                </>
              )}
            </div>

            {/* Items */}
            <div>
              <p className="text-sm font-medium mb-2">Items</p>
              <div className="border rounded-lg divide-y">
                {order.items.map((it, i) => (
                  <div key={i} className="p-3 flex items-start justify-between gap-3 text-sm">
                    <div className="flex-1">
                      <p className="font-medium">{it.quantity}× {it.item_name}</p>
                      {it.special_instructions && (
                        <p className="text-xs text-muted-foreground italic mt-0.5">"{it.special_instructions}"</p>
                      )}
                      <p className="text-xs text-muted-foreground">PKR {Number(it.item_price).toLocaleString()} each</p>
                    </div>
                    <p className="font-medium">PKR {Number(it.subtotal).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Totals */}
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>PKR {Number(order.subtotal).toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Delivery Fee</span><span>PKR {Number(order.delivery_fee).toLocaleString()}</span></div>
              <div className="flex justify-between font-bold text-base pt-1"><span>Total</span><span>PKR {Number(order.total).toLocaleString()}</span></div>
            </div>

            {order.special_instructions && (
              <div className="p-3 rounded-lg border bg-warning/5 text-sm">
                <p className="text-xs text-muted-foreground mb-1">Special instructions</p>
                <p>{order.special_instructions}</p>
              </div>
            )}

            {/* ETA controls (only if order still active) */}
            {canEditEta && (
              <div className="border rounded-lg p-4 space-y-3 bg-primary/5">
                <p className="font-medium text-sm flex items-center gap-2"><Clock className="w-4 h-4 text-primary" /> Update Estimated Arrival</p>
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="outline" disabled={savingEta} onClick={() => adjustEta(5)}><Plus className="w-3 h-3 mr-1" />5 min</Button>
                  <Button size="sm" variant="outline" disabled={savingEta} onClick={() => adjustEta(10)}><Plus className="w-3 h-3 mr-1" />10 min</Button>
                  <Button size="sm" variant="outline" disabled={savingEta} onClick={() => adjustEta(15)}><Plus className="w-3 h-3 mr-1" />15 min</Button>
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <Label className="text-xs">Set exact arrival (minutes from now)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={240}
                      value={customMinutes}
                      onChange={(e) => setCustomMinutes(e.target.value)}
                      placeholder="e.g. 25"
                    />
                  </div>
                  <Button size="sm" onClick={setExactEta} disabled={savingEta || !customMinutes}>Set ETA</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
