import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Calendar, Package } from 'lucide-react';
import type { RiderEarning } from '@/types';

export default function RiderEarnings() {
  const { user } = useAuth();
  const [earnings, setEarnings] = useState<RiderEarning[]>([]);
  const [totalEarned, setTotalEarned] = useState(0);
  const [todayEarned, setTodayEarned] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    const { data: rider } = await supabase
      .from('riders')
      .select('id')
      .eq('user_id', user!.id)
      .maybeSingle();

    if (!rider) {
      setLoading(false);
      return;
    }

    const { data: earningsData } = await supabase
      .from('rider_earnings')
      .select('*')
      .eq('rider_id', rider.id)
      .order('created_at', { ascending: false })
      .limit(30);

    const all = (earningsData || []) as RiderEarning[];
    setEarnings(all);

    // Compute total earned across all records (use wallet for accuracy if needed)
    const { data: walletData } = await supabase
      .from('rider_wallets')
      .select('total_earned')
      .eq('rider_id', rider.id)
      .maybeSingle();

    setTotalEarned(Number(walletData?.total_earned || 0));

    // Today's earnings
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const todays = all.filter((e) => new Date(e.created_at) >= startOfDay);
    setTodayEarned(todays.reduce((sum, e) => sum + Number(e.amount) + Number(e.bonus_amount || 0), 0));
    setTodayCount(todays.length);

    setLoading(false);
  };

  if (loading) {
    return <div className="animate-pulse text-muted-foreground">Loading earnings...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Summary cards: only Today + Total */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="bg-gradient-to-br from-primary/10 to-accent border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Today's Earnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">PKR {todayEarned.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <Package className="w-3 h-3" /> {todayCount} delivery{todayCount === 1 ? '' : 's'} today
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4" /> Total Earned
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-success">PKR {totalEarned.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">Lifetime earnings</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Earnings */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Deliveries</CardTitle>
        </CardHeader>
        <CardContent>
          {earnings.length === 0 ? (
            <p className="text-muted-foreground text-center py-6">No earnings yet. Complete deliveries to earn!</p>
          ) : (
            <div className="space-y-3">
              {earnings.map((earning) => (
                <div key={earning.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="font-medium">Delivery Earning</p>
                    <p className="text-xs text-muted-foreground">
                      {earning.distance_km && `${earning.distance_km} km • `}
                      {new Date(earning.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-success">+PKR {Number(earning.amount).toLocaleString()}</p>
                    {earning.bonus_amount > 0 && (
                      <p className="text-xs text-primary">+{earning.bonus_amount} bonus</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
