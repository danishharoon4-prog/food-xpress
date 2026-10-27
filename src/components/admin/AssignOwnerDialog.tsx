import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { UserCheck } from 'lucide-react';

type P = { id: string; full_name: string; email: string | null; phone: string | null };

export default function AssignOwnerDialog({ open, onOpenChange, restaurantId, restaurantName, currentOwnerId, onDone }: {
  open: boolean; onOpenChange: (v: boolean) => void; restaurantId: string; restaurantName: string;
  currentOwnerId: string | null; onDone: () => void;
}) {
  const [users, setUsers] = useState<P[]>([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) return;
    setQ('');
    supabase.from('profiles').select('id, full_name, email, phone').order('full_name').limit(1000)
      .then(({ data }) => setUsers((data as P[]) || []));
  }, [open]);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return users.filter(u => !s || [u.full_name, u.email, u.phone].some(v => v?.toLowerCase().includes(s))).slice(0, 50);
  }, [users, q]);

  const current = users.find(u => u.id === currentOwnerId);

  const assign = async (userId: string | null) => {
    if (userId && !confirm('Is user ko is restaurant ka owner bana dein? Us ka role "restaurant" ho jayega.')) return;
    setBusy(true);
    const { error } = await supabase.rpc('admin_assign_restaurant_owner' as never, { _restaurant_id: restaurantId, _user_id: userId } as never);
    setBusy(false);
    if (error) toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    else { toast({ title: userId ? 'Owner assigned' : 'Owner removed' }); onOpenChange(false); onDone(); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Assign Owner — {restaurantName}</DialogTitle></DialogHeader>
        <div className="text-sm rounded-md border p-3 flex items-center justify-between gap-2">
          <div>
            <p className="text-xs text-muted-foreground">Current owner</p>
            <p className="font-medium">{current ? `${current.full_name} (${current.email || current.phone || ''})` : currentOwnerId ? 'Unknown user' : 'None'}</p>
          </div>
          {currentOwnerId && <Button size="sm" variant="outline" disabled={busy} onClick={() => assign(null)}>Remove</Button>}
        </div>
        <Input placeholder="Search name, email or phone..." value={q} onChange={e => setQ(e.target.value)} />
        <div className="max-h-72 overflow-y-auto divide-y border rounded-md">
          {list.map(u => (
            <div key={u.id} className="flex items-center justify-between gap-2 p-2">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{u.full_name}</p>
                <p className="text-xs text-muted-foreground truncate">{u.email || ''} {u.phone ? `· ${u.phone}` : ''}</p>
              </div>
              <Button size="sm" disabled={busy || u.id === currentOwnerId} onClick={() => assign(u.id)}>
                <UserCheck className="w-4 h-4 mr-1" />{u.id === currentOwnerId ? 'Owner' : 'Assign'}
              </Button>
            </div>
          ))}
          {list.length === 0 && <p className="p-4 text-sm text-center text-muted-foreground">No users found</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
