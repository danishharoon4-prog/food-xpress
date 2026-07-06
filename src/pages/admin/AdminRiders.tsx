import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Bike, Star, DollarSign, Package, MapPin, FileImage, CheckCircle2, AlertCircle } from 'lucide-react';
import type { Rider } from '@/types';
import { useRiderDocSignedUrl } from '@/lib/riderDocUrl';

function AdminDocImage({ value, alt }: { value: string | null; alt: string }) {
  const src = useRiderDocSignedUrl(value);
  if (!src) return <div className="w-full h-40 rounded border bg-muted/30 animate-pulse" />;
  return (
    <a href={src} target="_blank" rel="noreferrer">
      <img src={src} alt={alt} className="w-full max-h-64 object-contain rounded border bg-muted/30" />
    </a>
  );
}

interface RiderProfile {
  full_name: string;
  phone: string;
  city: string | null;
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
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [docsRider, setDocsRider] = useState<RiderWithDetails | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchRiders();
  }, []);

  const toggleVerified = async (rider: RiderWithDetails, value: boolean) => {
    setUpdatingId(rider.id);
    const update: Record<string, unknown> = { is_verified: value };
    // If un-verifying, also force offline
    if (!value) update.is_online = false;
    const { error } = await supabase.from('riders').update(update).eq('id', rider.id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: value ? 'Rider activated' : 'Rider deactivated', description: rider.profile?.full_name || '' });
      fetchRiders();
    }
    setUpdatingId(null);
  };

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
        .select('id, full_name, phone, city')
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

  const cities = useMemo(
    () => Array.from(new Set(riders.map((r) => r.profile?.city).filter((c): c is string => !!c))).sort(),
    [riders]
  );

  const visibleRiders = cityFilter === 'all'
    ? riders
    : riders.filter((r) => r.profile?.city === cityFilter);

  if (loading) {
    return <div className="animate-pulse text-muted-foreground">Loading riders...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold">Registered Riders</h2>
        <div className="flex items-center gap-2">
          <Select value={cityFilter} onValueChange={setCityFilter}>
            <SelectTrigger className="w-44">
              <MapPin className="w-4 h-4 mr-1 text-muted-foreground" />
              <SelectValue placeholder="All cities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All cities</SelectItem>
              {cities.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant="outline">{visibleRiders.length} riders</Badge>
        </div>
      </div>

      {visibleRiders.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <Bike className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No riders found{cityFilter !== 'all' ? ` in ${cityFilter}` : ''}.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {visibleRiders.map((rider) => (
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
                  <p className="flex items-center gap-1"><MapPin className="w-3 h-3 text-muted-foreground" /> <span className="text-muted-foreground">City:</span> {rider.profile?.city || 'N/A'}</p>
                  <p><span className="text-muted-foreground">Vehicle:</span> {rider.vehicle_type} - {rider.vehicle_number || 'N/A'}</p>
                  {(rider as any).license_number && (
                    <p><span className="text-muted-foreground">License:</span> {(rider as any).license_number}</p>
                  )}
                  {(rider as any).address && (
                    <p className="text-xs text-muted-foreground">{(rider as any).address}</p>
                  )}

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

                {/* Verification controls */}
                <div className="mt-3 pt-3 border-t space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {rider.is_verified ? (
                        <CheckCircle2 className="w-4 h-4 text-success" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-warning" />
                      )}
                      <span className="text-sm font-medium">
                        {rider.is_verified ? 'Verified & Active' : 'Pending Verification'}
                      </span>
                    </div>
                    <Switch
                      checked={rider.is_verified}
                      disabled={updatingId === rider.id}
                      onCheckedChange={(v) => toggleVerified(rider, v)}
                    />
                  </div>
                  <Button variant="outline" size="sm" className="w-full" onClick={() => setDocsRider(rider)}>
                    <FileImage className="w-4 h-4 mr-1" /> View Documents
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Documents Dialog */}
      <Dialog open={!!docsRider} onOpenChange={(o) => !o && setDocsRider(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{docsRider?.profile?.full_name || 'Rider'} — Documents</DialogTitle>
          </DialogHeader>
          {docsRider && (
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { label: 'CNIC', url: (docsRider as any).cnic_image_url },
                { label: 'Vehicle Document', url: (docsRider as any).vehicle_doc_url },
                { label: 'Driving License', url: (docsRider as any).license_image_url },
              ].map(({ label, url }) => (
                <div key={label} className="space-y-2">
                  <p className="text-sm font-medium">{label}</p>
                  {url ? (
                    <AdminDocImage value={url} alt={label} />
                  ) : (
                    <div className="border rounded p-6 text-center text-xs text-muted-foreground bg-muted/30">Not uploaded</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
