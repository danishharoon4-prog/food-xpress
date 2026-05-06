import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wallet, TrendingUp, Calendar, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function RestaurantWallet() {
  const { restaurant } = useOutletContext<{ restaurant: any }>();
  const [stats, setStats] = useState({ total: 0, today: 0, week: 0, month: 0, count: 0 });
  const [recent, setRecent] = useState<any[]>([]);

  useEffect(() => {
    if (!restaurant?.id) return;
    (async () => {
      const { data } = await supabase
        .from('orders')
        .select('id, order_number, subtotal, total, delivery_fee, status, created_at, actual_delivery_time')
        .eq('restaurant_id', restaurant.id)
        .eq('status', 'delivered')
        .order('actual_delivery_time', { ascending: false });

      const all = data || [];
      const now = new Date();
      const startToday = new Date(now); startToday.setHours(0, 0, 0, 0);
      const startWeek = new Date(now); startWeek.setDate(now.getDate() - 7);
      const startMonth = new Date(now); startMonth.setMonth(now.getMonth() - 1);

      const sum = (rows: any[]) => rows.reduce((s, o) => s + Number(o.subtotal || 0), 0);
      setStats({
        total: sum(all),
        today: sum(all.filter(o => new Date(o.actual_delivery_time || o.created_at) >= startToday)),
        week: sum(all.filter(o => new Date(o.actual_delivery_time || o.created_at) >= startWeek)),
        month: sum(all.filter(o => new Date(o.actual_delivery_time || o.created_at) >= startMonth)),
        count: all.length,
      });
      setRecent(all.slice(0, 15));
    })();
  }, [restaurant?.id]);

  const cards = [
    { label: 'Total Earnings', value: `PKR ${stats.total.toLocaleString()}`, icon: Wallet, color: 'text-primary bg-primary/10' },
    { label: 'Today', value: `PKR ${stats.today.toLocaleString()}`, icon: TrendingUp, color: 'text-success bg-success/10' },
    { label: 'This Week', value: `PKR ${stats.week.toLocaleString()}`, icon: Calendar, color: 'text-info bg-info/10' },
    { label: 'Delivered Orders', value: stats.count, icon: CheckCircle2, color: 'text-warning bg-warning/10' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-4">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${c.color}`}>
                <c.icon className="w-5 h-5" />
              </div>
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className="text-base lg:text-xl font-bold mt-1">{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Recent Earnings</CardTitle></CardHeader>
        <CardContent className="p-0">
          {recent.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">No completed orders yet.</div>
          ) : (
            <div className="divide-y">
              {recent.map((o) => (
                <div key={o.id} className="flex items-center justify-between p-4">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">#{o.order_number}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(o.actual_delivery_time || o.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-success">+PKR {Number(o.subtotal).toLocaleString()}</p>
                    <Badge variant="outline" className="text-[10px]">delivered</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        Payouts are processed by admin. Contact support for withdrawals.
      </p>
    </div>
  );
}
