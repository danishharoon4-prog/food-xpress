import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Shield, User } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface AuditRow {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: any;
  created_at: string;
}

const ACTION_COLORS: Record<string, string> = {
  'user.banned': 'destructive',
  'user.unbanned': 'secondary',
  'user.role_changed': 'default',
  'restaurant.approved': 'secondary',
  'restaurant.rejected': 'destructive',
  'restaurant.location_approved': 'secondary',
  'restaurant.location_rejected': 'destructive',
};

export default function AdminAuditLog() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');

  useEffect(() => {
    (async () => {
      setLoading(true);
      let q = supabase
        .from('admin_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (actionFilter !== 'all') q = q.eq('action', actionFilter);
      const { data } = await q;
      setRows((data as AuditRow[]) || []);
      setLoading(false);
    })();
  }, [actionFilter]);

  const filtered = rows.filter(r => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      r.actor_email?.toLowerCase().includes(s) ||
      r.action.toLowerCase().includes(s) ||
      r.target_id?.toLowerCase().includes(s) ||
      JSON.stringify(r.details || {}).toLowerCase().includes(s)
    );
  });

  const uniqueActions = Array.from(new Set(rows.map(r => r.action)));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
          <Shield className="w-5 h-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Admin Audit Log</h1>
          <p className="text-sm text-muted-foreground">All privileged actions taken by admins.</p>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Input
          placeholder="Search by admin email, target, action…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-56"><SelectValue placeholder="All actions" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            {uniqueActions.map(a => (
              <SelectItem key={a} value={a}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent activity ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center p-6"><Loader2 className="animate-spin w-5 h-5" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">No audit entries yet.</p>
          ) : (
            <div className="space-y-2">
              {filtered.map(r => (
                <details key={r.id} className="p-3 rounded-lg border group">
                  <summary className="cursor-pointer flex items-start justify-between gap-3 list-none">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={(ACTION_COLORS[r.action] as any) || 'outline'}>{r.action}</Badge>
                        {r.target_type && (
                          <span className="text-xs text-muted-foreground">on {r.target_type}</span>
                        )}
                      </div>
                      <p className="text-sm font-medium mt-1 flex items-center gap-1">
                        <User className="w-3.5 h-3.5" />
                        {r.actor_email || 'Unknown admin'}
                      </p>
                      {r.target_id && (
                        <p className="text-xs text-muted-foreground font-mono truncate">Target: {r.target_id}</p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                    </span>
                  </summary>
                  {r.details && Object.keys(r.details).length > 0 && (
                    <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-x-auto">
                      {JSON.stringify(r.details, null, 2)}
                    </pre>
                  )}
                </details>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
