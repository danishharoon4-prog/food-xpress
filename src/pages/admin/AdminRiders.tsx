import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bike, Star } from 'lucide-react';
import type { Rider } from '@/types';

export default function AdminRiders() {
  const [riders, setRiders] = useState<(Rider & { profile?: { full_name: string; phone: string } })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRiders();
  }, []);

  const fetchRiders = async () => {
    const { data } = await supabase
      .from('riders')
      .select('*, profile:profiles!riders_user_id_fkey(full_name, phone)')
      .order('created_at', { ascending: false });

    if (data) setRiders(data as any);
    setLoading(false);
  };

  if (loading) {
    return <div className="animate-pulse text-muted-foreground">Loading riders...</div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Riders</h2>

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
                  <p><span className="text-muted-foreground">Deliveries:</span> {rider.total_deliveries}</p>
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-warning fill-warning" />
                    <span>{Number(rider.average_rating).toFixed(1)}</span>
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
