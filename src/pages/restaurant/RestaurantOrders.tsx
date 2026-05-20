import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { User, Phone, MapPin, Bike, Clock, Package, StickyNote, ChevronDown, ChevronUp } from 'lucide-react';
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
  preparing: 'ready_for_pickup',
};

export default function RestaurantOrders() {
  const { restaurant } = useOutletContext<{ restaurant: any }>();
  const { toast } = useToast();
  const [orders, setOrders] = useState<any[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

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

  const advance = async (id: string, status: OrderStatus) => {
    const { error } = await supabase.from('orders').update({ status }).eq('id', id);
    if (error) return toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    toast({ title: `Marked ${status.replace(/_/g, ' ')}` });
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
          <Card key={o.id} className="overflow-hidden">
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
                  {o.customer?.phone && (
                    <a
                      href={`tel:${o.customer.phone}`}
                      className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                    >
                      <Phone className="w-3 h-3" /> {o.customer.phone}
                    </a>
                  )}
                  <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
                    <span>{o.delivery_address}</span>
                  </p>
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
                    Subtotal PKR {Number(o.subtotal).toLocaleString()} · Delivery PKR {Number(o.delivery_fee || 0).toLocaleString()}
                  </p>
                  <p className="font-bold text-primary text-base">
                    Total PKR {Number(o.total).toLocaleString()}
                  </p>
                </div>
                {next && (
                  <Button size="sm" onClick={() => advance(o.id, next)} className="gradient-primary">
                    Mark {next.replace(/_/g, ' ')}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
