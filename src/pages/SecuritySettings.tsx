import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import MfaCard from '@/components/security/MfaCard';
import RecentLoginsCard from '@/components/security/RecentLoginsCard';
import { getIdleTimeoutMinutes, setIdleTimeoutMinutes } from '@/components/security/IdleTimeoutManager';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Clock, LogOut, Shield } from 'lucide-react';
import { Navigate } from 'react-router-dom';

export default function SecuritySettings() {
  const { user, role, signOut } = useAuth();
  const [minutes, setMinutes] = useState<number>(() => getIdleTimeoutMinutes(role ?? null));

  if (!user) return <Navigate to="/auth" replace />;

  const isAdmin = role === 'admin';
  const options = isAdmin
    ? [{ v: 15, l: '15 minutes' }, { v: 30, l: '30 minutes' }]
    : [{ v: 15, l: '15 minutes' }, { v: 30, l: '30 minutes' }, { v: 60, l: '1 hour' }, { v: 0, l: 'Never' }];

  const saveTimeout = (v: string) => {
    const n = parseInt(v, 10);
    setMinutes(n);
    setIdleTimeoutMinutes(n);
    toast.success('Idle timeout updated');
  };

  const signOutEverywhere = async () => {
    if (!confirm('Sign out from ALL devices and sessions?')) return;
    try {
      await supabase.auth.signOut({ scope: 'global' });
    } catch {}
    signOut();
  };

  return (
    <div className="max-w-3xl mx-auto p-4 lg:p-6 space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
          <Shield className="w-5 h-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Security</h1>
          <p className="text-sm text-muted-foreground">Manage 2FA, sessions, and login history.</p>
        </div>
      </div>

      <MfaCard />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Clock className="w-5 h-5" /> Auto sign-out</CardTitle>
          <CardDescription>
            Automatically sign out after this much inactivity.
            {isAdmin && <span className="block mt-1 text-amber-600">Admins are capped at 30 minutes.</span>}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-xs space-y-2">
            <Label>Idle timeout</Label>
            <Select value={String(minutes)} onValueChange={saveTimeout}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {options.map(o => (
                  <SelectItem key={o.v} value={String(o.v)}>{o.l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <RecentLoginsCard />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><LogOut className="w-5 h-5" /> Sign out everywhere</CardTitle>
          <CardDescription>End your session on all devices and browsers.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={signOutEverywhere}>Sign out all devices</Button>
        </CardContent>
      </Card>
    </div>
  );
}
