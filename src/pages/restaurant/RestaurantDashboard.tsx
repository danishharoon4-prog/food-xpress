import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { ShoppingBag, Banknote, UtensilsCrossed, Clock } from 'lucide-react';

export default function RestaurantDashboard() {
  const { restaurant } = useOutletContext<{ restaurant: any }>();
  const [stats, setStats] = useState({ today: 0, todayRevenue: 0, total: 0, items: 0 });

  useEffect(() => {
    if (!restaurant?.id) return;
    const load = async () => {
      const todayStart = new Date(); todayStart.setHours(0,0,0,0);
      const [orders, items] = await Promise.all([
        supabase.from('orders').select('total, created_at, status').eq('restaurant_id', restaurant.id),
        supabase.from('menu_items').select('id', { count: 'exact', head: true }).eq('restaurant_id', restaurant.id),
      ]);
      const all = orders.data || [];
      const today = all.filter(o => new Date(o.created_at) >= todayStart);
      setStats({
        today: today.length,
        todayRevenue: today.reduce((s, o) => s + Number(o.total || 0), 0),
        total: all.length,
        items: items.count || 0,
      });
    };
    load();
  }, [restaurant?.id]);

  const cards = [
    { label: "Today's Orders", value: stats.today, icon: ShoppingBag, color: 'text-primary bg-primary/10' },
    { label: "Today's Revenue", value: `PKR ${stats.todayRevenue.toLocaleString()}`, icon: Banknote, color: 'text-success bg-success/10' },
    { label: 'Total Orders', value: stats.total, icon: Clock, color: 'text-info bg-info/10' },
    { label: 'Menu Items', value: stats.items, icon: UtensilsCrossed, color: 'text-warning bg-warning/10' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl lg:text-2xl font-bold">{restaurant.name}</h2>
        <p className="text-sm text-muted-foreground">{restaurant.cuisine_type || '—'} · {restaurant.city}</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-4">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${c.color}`}>
                <c.icon className="w-5 h-5" />
              </div>
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className="text-lg lg:text-2xl font-bold mt-1">{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
