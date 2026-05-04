import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
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

  const load = async () => {
    if (!restaurant?.id) return;
    const { data } = await supabase
      .from('orders')
      .select('*, order_items(item_name, quantity, item_price)')
      .eq('restaurant_id', restaurant.id)
      .order('created_at', { ascending: false })
      .limit(100);
    setOrders(data || []);
  };

  useEffect(() => {
    load();
    if (!restaurant?.id) return;
    const ch = supabase.channel('rest-orders').on('postgres_changes',
      { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurant.id}` },
      () => load()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [restaurant?.id]);

  const advance = async (id: string, status: OrderStatus) => {
    const { error } = await supabase.from('orders').update({ status }).eq('id', id);
    if (error) return toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    toast({ title: `Marked ${status.replace(/_/g, ' ')}` });
    load();
  };

  return (
    <div className="space-y-3">
      {orders.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No orders yet.</p>}
      {orders.map((o) => {
        const next = nextStatus[o.status];
        return (
          <Card key={o.id}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <p className="font-semibold">#{o.order_number}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(o.created_at).toLocaleString()}
                  </p>
                </div>
                <Badge className={statusColors[o.status]}>{o.status.replace(/_/g, ' ')}</Badge>
              </div>
              <ul className="text-sm space-y-0.5">
                {(o.order_items || []).map((it: any, i: number) => (
                  <li key={i} className="flex justify-between">
                    <span>×{it.quantity} {it.item_name}</span>
                    <span className="text-muted-foreground">PKR {Number(it.item_price * it.quantity).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between pt-2 border-t">
                <span className="font-bold text-primary">PKR {Number(o.total).toLocaleString()}</span>
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
