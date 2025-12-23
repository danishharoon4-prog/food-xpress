import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bike, Star, DollarSign, Package } from 'lucide-react';
import type { Rider } from '@/types';

interface RiderProfile {
  full_name: string;
  phone: string;
}

interface RiderWalletInfo {
  balance: number;
  total_earned: number;
}

interface RiderWithDetails extends Omit<Rider, 'profile'> {
  profile?: RiderProfile;
  wallet?: RiderWalletInfo;
}

export default function AdminRiders() {
  const [riders, setRiders] = useState<RiderWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRiders();
  }, []);

  const fetchRiders = async () => {
    // Fetch all riders
    const { data: ridersData } = await supabase
      .from('riders')
      .select('*')
      .order('created_at', { ascending: false });

    if (ridersData && ridersData.length > 0) {
      // Fetch profiles for all rider user_ids
      const userIds = ridersData.map(r => r.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, phone')
        .in('id', userIds);

      // Fetch wallets for all riders
      const riderIds = ridersData.map(r => r.id);
      const { data: wallets } = await supabase
        .from('rider_wallets')
        .select('rider_id, balance, total_earned')
        .in('rider_id', riderIds);

      // Combine data
      const combinedRiders = ridersData.map(rider => ({
        ...rider,
        profile: profiles?.find(p => p.id === rider.user_id),
        wallet: wallets?.find(w => w.rider_id === rider.id)
      }));

      setRiders(combinedRiders as RiderWithDetails[]);
    }
    setLoading(false);
  };

  if (loading) {
    return <div className="animate-pulse text-muted-foreground">Loading riders...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Registered Riders</h2>
        <Badge variant="outline">{riders.length} riders</Badge>
      </div>

      {riders.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <Bike className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No riders registered yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {riders.map((rider) => (
            <Card key={rider.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{rider.profile?.full_name || 'Unknown'}</CardTitle>
                  <Badge className={rider.is_online ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}>
                    {rider.is_online ? 'Online' : 'Offline'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <p><span className="text-muted-foreground">Phone:</span> {rider.profile?.phone || 'N/A'}</p>
                  <p><span className="text-muted-foreground">Vehicle:</span> {rider.vehicle_type} - {rider.vehicle_number || 'N/A'}</p>
                  
                  <div className="flex items-center gap-4 pt-2 border-t">
                    <div className="flex items-center gap-1">
                      <Package className="w-4 h-4 text-muted-foreground" />
                      <span>{rider.total_deliveries} deliveries</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-warning fill-warning" />
                      <span>{Number(rider.average_rating).toFixed(1)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 pt-2 border-t">
                    <div className="flex items-center gap-1">
                      <DollarSign className="w-4 h-4 text-success" />
                      <span className="text-success font-medium">PKR {Number(rider.wallet?.balance || 0).toLocaleString()}</span>
                    </div>
                    <span className="text-muted-foreground text-xs">
                      Total: PKR {Number(rider.wallet?.total_earned || 0).toLocaleString()}
                    </span>
                  </div>
                </div>
                <Badge className="mt-3" variant={rider.is_verified ? 'default' : 'secondary'}>
                  {rider.is_verified ? 'Verified' : 'Pending Verification'}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
