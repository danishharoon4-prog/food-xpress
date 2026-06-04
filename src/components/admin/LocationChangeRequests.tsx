import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { MapPin, CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react';

interface ChangeRequest {
  id: string;
  restaurant_id: string;
  requested_address: string;
  requested_latitude: number | null;
  requested_longitude: number | null;
  reason: string | null;
  status: string;
  created_at: string;
  restaurants: { name: string; address: string | null; latitude: number | null; longitude: number | null } | null;
}

export default function LocationChangeRequests() {
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState<ChangeRequest | null>(null);
  const [notes, setNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const { toast } = useToast();

  const fetchRequests = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('restaurant_location_change_requests' as any)
      .select('*, restaurants:restaurant_id(name, address, latitude, longitude)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (!error && data) setRequests(data as any);
    setLoading(false);
  };

  useEffect(() => { fetchRequests(); }, []);

  const handleReview = async (approve: boolean) => {
    if (!reviewing) return;
    setProcessing(true);
    const { error } = await supabase.rpc('apply_restaurant_location_change' as any, {
      _request_id: reviewing.id,
      _approve: approve,
      _notes: notes || null,
    });
    setProcessing(false);
    if (error) {
      toast({ title: 'Failed', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: approve ? 'Location updated' : 'Request rejected' });
    setReviewing(null);
    setNotes('');
    fetchRequests();
  };

  if (loading) return null;
  if (requests.length === 0) return null;

  return (
    <Card className="border-warning">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="w-4 h-4 text-warning" />
          Location Change Requests
          <Badge variant="secondary">{requests.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {requests.map((r) => (
          <div key={r.id} className="p-3 border rounded-lg flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">{r.restaurants?.name || 'Restaurant'}</p>
              <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                <p className="flex items-start gap-1"><MapPin className="w-3 h-3 mt-0.5 shrink-0" /><span><b>Current:</b> {r.restaurants?.address || '—'}</span></p>
                <p className="flex items-start gap-1"><MapPin className="w-3 h-3 mt-0.5 shrink-0 text-primary" /><span><b>Requested:</b> {r.requested_address}</span></p>
                {r.reason && <p className="italic">Reason: {r.reason}</p>}
              </div>
            </div>
            <Button size="sm" onClick={() => { setReviewing(r); setNotes(''); }}>Review</Button>
          </div>
        ))}
      </CardContent>

      <Dialog open={!!reviewing} onOpenChange={(o) => !o && setReviewing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Review Location Change</DialogTitle></DialogHeader>
          {reviewing && (
            <div className="space-y-3 text-sm">
              <p><b>Restaurant:</b> {reviewing.restaurants?.name}</p>
              <div className="p-2 rounded bg-muted">
                <p className="text-xs text-muted-foreground">Current address</p>
                <p>{reviewing.restaurants?.address || '—'}</p>
                {reviewing.restaurants?.latitude && (
                  <p className="text-xs text-muted-foreground">📍 {Number(reviewing.restaurants.latitude).toFixed(6)}, {Number(reviewing.restaurants.longitude).toFixed(6)}</p>
                )}
              </div>
              <div className="p-2 rounded bg-primary/5 border border-primary/30">
                <p className="text-xs text-muted-foreground">Requested address</p>
                <p>{reviewing.requested_address}</p>
                {reviewing.requested_latitude && (
                  <p className="text-xs text-muted-foreground">📍 {Number(reviewing.requested_latitude).toFixed(6)}, {Number(reviewing.requested_longitude).toFixed(6)}</p>
                )}
              </div>
              {reviewing.reason && <p className="text-xs"><b>Reason:</b> {reviewing.reason}</p>}
              <Textarea placeholder="Admin notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="destructive" disabled={processing} onClick={() => handleReview(false)}>
              {processing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <XCircle className="w-4 h-4 mr-1" />}
              Reject
            </Button>
            <Button disabled={processing} onClick={() => handleReview(true)} className="gradient-primary">
              {processing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
              Approve & Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
