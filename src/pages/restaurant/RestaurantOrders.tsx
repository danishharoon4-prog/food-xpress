import { useEffect, useRef, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { User, Phone, MapPin, Bike, Clock, Package, StickyNote, ChevronDown, ChevronUp, ExternalLink, Truck, Search, Loader2, XCircle, RefreshCw, AlertTriangle } from 'lucide-react';
import type { OrderStatus } from '@/types';

const statusColors: Record<string, string> = {
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

const nextStatus: Record<string, OrderStatus | null> = {
  pending: 'confirmed',
  confirmed: 'preparing',
  // 'preparing' → handled via pickup-choice dialog
};

export default function RestaurantOrders() {
  const { restaurant } = useOutletContext<{ restaurant: any }>();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [orders, setOrders] = useState<any[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [pickupOrder, setPickupOrder] = useState<any | null>(null);
  const [pickupSubmitting, setPickupSubmitting] = useState<'self' | 'rider' | null>(null);
  const [cancelOrder, setCancelOrder] = useState<any | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelSubmitting, setCancelSubmitting] = useState(false);

  const submitCancel = async () => {
    if (!cancelOrder) return;
    const reason = cancelReason.trim();
    if (reason.length < 3) {
      toast({ title: 'Reason required', description: 'Please provide a short reason (min 3 chars).', variant: 'destructive' });
      return;
    }
    setCancelSubmitting(true);
    const { error } = await supabase.rpc('cancel_order', { _order_id: cancelOrder.id, _reason: reason });
    setCancelSubmitting(false);
    if (error) {
      toast({ title: 'Cancel failed', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Order cancelled', description: 'The customer has been notified.' });
    setCancelOrder(null);
    setCancelReason('');
    load();
  };

  const load = async () => {
    if (!restaurant?.id) return;
    const { data } = await supabase
      .from('orders')
      .select('*, order_items(item_name, quantity, item_price, special_instructions)')
      .eq('restaurant_id', restaurant.id)
      .order('created_at', { ascending: false })
      .limit(100);

    const list = data || [];
    const customerIds = Array.from(new Set(list.map((o) => o.customer_id).filter(Boolean)));
    const riderIds = Array.from(new Set(list.map((o) => o.rider_id).filter(Boolean)));

    const [{ data: customers }, { data: riders }] = await Promise.all([
      customerIds.length
        ? supabase.from('profiles').select('id, full_name, phone, email').in('id', customerIds)
        : Promise.resolve({ data: [] as any[] }),
      riderIds.length
        ? supabase
            .from('riders')
            .select('id, user_id, vehicle_type, vehicle_number, average_rating')
            .in('id', riderIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const riderUserIds = (riders || []).map((r: any) => r.user_id).filter(Boolean);
    const { data: riderProfiles } = riderUserIds.length
      ? await supabase.from('profiles').select('id, full_name, phone').in('id', riderUserIds)
      : { data: [] as any[] };

    const customerMap = new Map((customers || []).map((c: any) => [c.id, c]));
    const riderProfileMap = new Map((riderProfiles || []).map((p: any) => [p.id, p]));
    const riderMap = new Map(
      (riders || []).map((r: any) => [r.id, { ...r, profile: riderProfileMap.get(r.user_id) }]),
    );

    setOrders(
      list.map((o) => ({
        ...o,
        customer: customerMap.get(o.customer_id),
        rider: o.rider_id ? riderMap.get(o.rider_id) : null,
      })),
    );
  };

  useEffect(() => {
    load();
    if (!restaurant?.id) return;
    const ch = supabase
      .channel('rest-orders')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurant.id}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [restaurant?.id]);

  // Handle ?highlight=<orderId> — auto-expand + scroll + pulse
  useEffect(() => {
    const hid = searchParams.get('highlight');
    if (!hid || orders.length === 0) return;
    const found = orders.find((o) => o.id === hid);
    if (!found) return;
    setExpanded((prev) => ({ ...prev, [hid]: true }));
    setHighlightId(hid);
    setTimeout(() => {
      cardRefs.current[hid]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
    const t = setTimeout(() => {
      setHighlightId(null);
      searchParams.delete('highlight');
      setSearchParams(searchParams, { replace: true });
    }, 3000);
    return () => clearTimeout(t);
  }, [searchParams, orders, setSearchParams]);


  const advance = async (id: string, status: OrderStatus) => {
    const { error } = await supabase.from('orders').update({ status }).eq('id', id);
    if (error) return toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    toast({ title: `Marked ${status.replace(/_/g, ' ')}` });
    load();
  };

  const chooseDelivery = async (mode: 'self' | 'rider') => {
    if (!pickupOrder) return;
    setPickupSubmitting(mode);
    const { error } = await supabase.rpc('mark_ready_for_pickup', {
      _order_id: pickupOrder.id,
      _self_delivery: mode === 'self',
    });
    setPickupSubmitting(null);
    if (error) return toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    toast({
      title: mode === 'self' ? 'Self delivery started' : 'Looking for a rider',
      description: mode === 'self'
        ? 'Delivery fee removed. Mark on the way / delivered as you go.'
        : 'All available riders in your city have been notified.',
    });
    setPickupOrder(null);
    load();
  };

  return (
    <div className="space-y-3">
      {orders.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">No orders yet.</p>
      )}
      {orders.map((o) => {
        const next = nextStatus[o.status];
        const isOpen = expanded[o.id];
        return (
          <Card
            key={o.id}
            ref={(el) => { cardRefs.current[o.id] = el; }}
            className={`overflow-hidden transition-all ${highlightId === o.id ? 'ring-2 ring-primary shadow-lg animate-pulse' : ''}`}
          >
            <CardContent className="p-4 space-y-3">

              {/* Header */}
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <p className="font-semibold">#{o.order_number}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(o.created_at).toLocaleString()}
                  </p>
                </div>
                <Badge className={statusColors[o.status]}>{o.status.replace(/_/g, ' ')}</Badge>
              </div>

              {/* Customer */}
              <div className="rounded-lg bg-muted/40 p-3 space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <User className="w-4 h-4 text-primary" />
                  Customer
                </div>
                <div className="text-sm space-y-1 pl-6">
                  <p className="font-medium">{o.customer?.full_name || 'Customer'}</p>
                  {o.customer?.phone ? (
                    <a
                      href={`tel:${o.customer.phone}`}
                      className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                    >
                      <Phone className="w-3 h-3" /> {o.customer.phone}
                    </a>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">No phone on file</p>
                  )}
                  {o.delivery_address && (
                    <a
                      href={
                        o.delivery_latitude && o.delivery_longitude
                          ? `https://www.google.com/maps?q=${o.delivery_latitude},${o.delivery_longitude}`
                          : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(o.delivery_address)}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-1.5 text-xs text-primary hover:underline"
                    >
                      <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
                      <span className="break-all">{o.delivery_address}</span>
                      <ExternalLink className="w-3 h-3 mt-0.5 shrink-0 opacity-60" />
                    </a>
                  )}
                </div>
              </div>

              {/* Rider */}
              {o.rider ? (
                <div className="rounded-lg bg-primary/5 p-3 space-y-1.5">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Bike className="w-4 h-4 text-primary" />
                    Rider
                  </div>
                  <div className="text-sm space-y-1 pl-6">
                    <p className="font-medium">{o.rider.profile?.full_name || 'Rider'}</p>
                    {o.rider.profile?.phone && (
                      <a
                        href={`tel:${o.rider.profile.phone}`}
                        className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                      >
                        <Phone className="w-3 h-3" /> {o.rider.profile.phone}
                      </a>
                    )}
                    <p className="text-xs text-muted-foreground capitalize">
                      {o.rider.vehicle_type || 'bike'}
                      {o.rider.vehicle_number ? ` · ${o.rider.vehicle_number}` : ''}
                      {o.rider.average_rating ? ` · ★ ${Number(o.rider.average_rating).toFixed(1)}` : ''}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground flex items-center gap-2">
                  <Bike className="w-4 h-4" />
                  No rider assigned yet
                </div>
              )}

              {/* Items toggle */}
              <button
                type="button"
                onClick={() => setExpanded((p) => ({ ...p, [o.id]: !isOpen }))}
                className="flex items-center justify-between w-full text-sm font-medium pt-1"
              >
                <span className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-primary" />
                  {o.order_items?.length || 0} item{(o.order_items?.length || 0) === 1 ? '' : 's'}
                </span>
                {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {isOpen && (
                <ul className="text-sm space-y-1 pl-6">
                  {(o.order_items || []).map((it: any, i: number) => (
                    <li key={i} className="space-y-0.5">
                      <div className="flex justify-between">
                        <span>×{it.quantity} {it.item_name}</span>
                        <span className="text-muted-foreground">
                          PKR {Number(it.item_price * it.quantity).toLocaleString()}
                        </span>
                      </div>
                      {it.special_instructions && (
                        <p className="text-[11px] text-muted-foreground italic pl-3">
                          “{it.special_instructions}”
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {o.special_instructions && (
                <div className="text-xs text-muted-foreground bg-warning/5 border border-warning/20 rounded-md p-2 flex gap-2">
                  <StickyNote className="w-3.5 h-3.5 mt-0.5 shrink-0 text-warning" />
                  <span>{o.special_instructions}</span>
                </div>
              )}

              {o.status === 'cancelled' && o.cancellation_reason && (
                <div className="text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-md p-2">
                  Cancelled: {o.cancellation_reason}
                </div>
              )}

              <Separator />

              {/* Footer */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="text-sm">
                  <p className="text-xs text-muted-foreground">
                    Subtotal PKR {Number(o.subtotal).toLocaleString()} · Delivery {Number(o.delivery_fee || 0) === 0 ? <span className="text-success font-medium">FREE</span> : `PKR ${Number(o.delivery_fee).toLocaleString()}`}
                  </p>
                  <p className="font-bold text-primary text-base">
                    Total PKR {Number(o.total).toLocaleString()}
                  </p>
                  {o.is_self_delivery && (
                    <Badge variant="outline" className="mt-1 text-[10px] border-success text-success">
                      <Truck className="w-3 h-3 mr-1" /> Self delivery
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap">
                  {next && (
                    <Button size="sm" onClick={() => advance(o.id, next)} className="gradient-primary">
                      Mark {next.replace(/_/g, ' ')}
                    </Button>
                  )}
                  {o.status === 'preparing' && (
                    <Button size="sm" onClick={() => setPickupOrder(o)} className="gradient-primary">
                      Ready for Pickup
                    </Button>
                  )}
                  {o.is_self_delivery && o.status === 'on_the_way' && (
                    <Button size="sm" onClick={() => advance(o.id, 'awaiting_confirmation' as OrderStatus)} className="gradient-primary">
                      Mark Delivered
                    </Button>
                  )}
                  {['pending','confirmed','preparing','ready_for_pickup'].includes(o.status) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setCancelOrder(o); setCancelReason(''); }}
                      className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      <XCircle className="w-4 h-4 mr-1" /> Can't Fulfil
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Dialog open={!!pickupOrder} onOpenChange={(o) => !o && setPickupOrder(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>How will this order be delivered?</DialogTitle>
            <DialogDescription>
              Choose whether you'll deliver order <span className="font-semibold text-foreground">#{pickupOrder?.order_number}</span> yourself, or notify riders to pick it up.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-2">
            <button
              type="button"
              disabled={!!pickupSubmitting}
              onClick={() => chooseDelivery('self')}
              className="text-left rounded-xl border-2 border-transparent hover:border-primary p-4 bg-muted/40 transition-all disabled:opacity-60"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-success/10 text-success flex items-center justify-center shrink-0">
                  {pickupSubmitting === 'self' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Truck className="w-5 h-5" />}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm">Deliver Itself</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Delivery fee will be removed (free delivery). You handle the drop-off.
                  </p>
                </div>
              </div>
            </button>

            <button
              type="button"
              disabled={!!pickupSubmitting}
              onClick={() => chooseDelivery('rider')}
              className="text-left rounded-xl border-2 border-transparent hover:border-primary p-4 bg-muted/40 transition-all disabled:opacity-60"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  {pickupSubmitting === 'rider' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm">Rider Lookup</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Notify all online riders in your city. First to accept picks it up.
                  </p>
                </div>
              </div>
            </button>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPickupOrder(null)} disabled={!!pickupSubmitting}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!cancelOrder} onOpenChange={(o) => { if (!o) { setCancelOrder(null); setCancelReason(''); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="w-5 h-5" /> Cancel this order?
            </DialogTitle>
            <DialogDescription>
              Order <span className="font-semibold text-foreground">#{cancelOrder?.order_number}</span> will be cancelled and the customer will be notified. Any payment will be refunded.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <label className="text-xs font-medium text-muted-foreground">Reason (shown to customer)</label>
            <Textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="e.g. Out of ingredients, kitchen closed, unable to fulfil right now…"
              rows={3}
              disabled={cancelSubmitting}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setCancelOrder(null); setCancelReason(''); }} disabled={cancelSubmitting}>
              Keep Order
            </Button>
            <Button variant="destructive" onClick={submitCancel} disabled={cancelSubmitting}>
              {cancelSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <XCircle className="w-4 h-4 mr-1" />}
              Cancel Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
