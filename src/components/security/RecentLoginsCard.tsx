import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Monitor, MapPin, AlertTriangle, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface LoginRow {
  id: string;
  ip_address: string | null;
  user_agent: string | null;
  city: string | null;
  country: string | null;
  is_new_device: boolean;
  created_at: string;
}

export default function RecentLoginsCard() {
  const { user } = useAuth();
  const [rows, setRows] = useState<LoginRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('login_history')
        .select('id,ip_address,user_agent,city,country,is_new_device,created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      setRows((data as LoginRow[]) || []);
      setLoading(false);
    })();
  }, [user]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Monitor className="w-5 h-5" /> Recent sign-ins
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center p-6"><Loader2 className="animate-spin w-5 h-5" /></div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sign-in history yet.</p>
        ) : (
          <div className="space-y-2">
            {rows.map(r => (
              <div key={r.id} className="flex items-start justify-between gap-3 p-3 rounded-lg border">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{r.ip_address || 'Unknown IP'}</span>
                    {r.is_new_device && (
                      <Badge variant="destructive" className="gap-1 text-xs">
                        <AlertTriangle className="w-3 h-3" /> New device
                      </Badge>
                    )}
                  </div>
                  {(r.city || r.country) && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3" />
                      {[r.city, r.country].filter(Boolean).join(', ')}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground truncate mt-0.5" title={r.user_agent || ''}>
                    {r.user_agent?.slice(0, 80) || 'Unknown device'}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
