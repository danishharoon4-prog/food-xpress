import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Users, Search, Ban, ShieldCheck, Trash2, Bike, Store, User as UserIcon, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import type { AppRole } from '@/types';

interface UserRow {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  created_at: string;
  is_banned: boolean;
  banned_reason: string | null;
  role: AppRole;
}

const ROLE_META: Record<AppRole, { label: string; icon: typeof UserIcon; color: string }> = {
  customer: { label: 'Customers', icon: UserIcon, color: 'bg-blue-500/10 text-blue-600' },
  rider: { label: 'Riders', icon: Bike, color: 'bg-green-500/10 text-green-600' },
  restaurant: { label: 'Restaurants', icon: Store, color: 'bg-orange-500/10 text-orange-600' },
  admin: { label: 'Admins', icon: Shield, color: 'bg-purple-500/10 text-purple-600' },
};

export default function AdminUsers() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'all' | AppRole>('all');

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    setLoading(true);
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('user_roles').select('user_id, role'),
    ]);
    const roleMap = new Map<string, AppRole>();
    (roles || []).forEach((r: { user_id: string; role: AppRole }) => roleMap.set(r.user_id, r.role));
    const merged: UserRow[] = (profiles || []).map((p) => ({
      id: p.id,
      full_name: p.full_name,
      email: p.email,
      phone: p.phone,
      city: p.city,
      created_at: p.created_at,
      is_banned: (p as { is_banned?: boolean }).is_banned ?? false,
      banned_reason: (p as { banned_reason?: string | null }).banned_reason ?? null,
      role: roleMap.get(p.id) || 'customer',
    }));
    setUsers(merged);
    setLoading(false);
  };

  const handleBan = async (u: UserRow) => {
    const reason = u.is_banned ? null : (prompt('Reason for ban (optional):') ?? '');
    const { error } = await supabase.rpc('admin_set_user_ban' as never, {
      _user_id: u.id, _banned: !u.is_banned, _reason: reason,
    } as never);
    if (error) return toast.error(error.message);
    toast.success(u.is_banned ? 'User unbanned' : 'User banned');
    fetchUsers();
  };

  const handleDelete = async (u: UserRow) => {
    const { data, error } = await supabase.functions.invoke('admin-delete-user', {
      body: { user_id: u.id },
    });
    if (error || (data as { error?: string })?.error) {
      return toast.error(error?.message || (data as { error?: string })?.error || 'Failed to delete');
    }
    toast.success('User deleted');
    fetchUsers();
  };

  const filtered = users
    .filter((u) => tab === 'all' || u.role === tab)
    .filter((u) => {
      const q = search.toLowerCase().trim();
      if (!q) return true;
      return (
        u.full_name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.phone?.toLowerCase().includes(q)
      );
    });

  const counts = users.reduce((acc, u) => {
    acc[u.role] = (acc[u.role] || 0) + 1;
    return acc;
  }, {} as Record<AppRole, number>);

  if (loading) {
    return <div className="animate-pulse text-muted-foreground">Loading users...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Users</h2>
          <p className="text-sm text-muted-foreground">Manage all platform users by role</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name, email, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Role summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(Object.keys(ROLE_META) as AppRole[]).map((r) => {
          const meta = ROLE_META[r];
          const Icon = meta.icon;
          return (
            <Card key={r} className="cursor-pointer hover:border-primary transition" onClick={() => setTab(r)}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${meta.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{counts[r] || 0}</p>
                  <p className="text-xs text-muted-foreground">{meta.label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="w-full sm:w-auto flex-wrap h-auto">
          <TabsTrigger value="all">All ({users.length})</TabsTrigger>
          <TabsTrigger value="customer">Customers ({counts.customer || 0})</TabsTrigger>
          <TabsTrigger value="rider">Riders ({counts.rider || 0})</TabsTrigger>
          <TabsTrigger value="restaurant">Restaurants ({counts.restaurant || 0})</TabsTrigger>
          <TabsTrigger value="admin">Admins ({counts.admin || 0})</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {filtered.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center">
                <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No users found.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{filtered.length} user{filtered.length !== 1 ? 's' : ''}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {filtered.map((u) => {
                    const meta = ROLE_META[u.role];
                    const Icon = meta.icon;
                    const isSelf = u.id === currentUser?.id;
                    return (
                      <div key={u.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 hover:bg-accent/30">
                        <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${meta.color}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium truncate">{u.full_name || 'Unnamed'}</p>
                            <Badge variant="outline" className="text-xs capitalize">{u.role}</Badge>
                            {u.is_banned && <Badge variant="destructive" className="text-xs">Banned</Badge>}
                            {isSelf && <Badge variant="secondary" className="text-xs">You</Badge>}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {u.email || 'No email'} {u.phone && `• ${u.phone}`} {u.city && `• ${u.city}`}
                          </div>
                          {u.is_banned && u.banned_reason && (
                            <p className="text-xs text-destructive mt-0.5">Reason: {u.banned_reason}</p>
                          )}
                        </div>
                        <div className="flex gap-2 sm:justify-end">
                          <Button
                            size="sm"
                            variant={u.is_banned ? 'default' : 'outline'}
                            disabled={isSelf}
                            onClick={() => handleBan(u)}
                          >
                            {u.is_banned ? (
                              <><ShieldCheck className="w-4 h-4 mr-1" /> Unban</>
                            ) : (
                              <><Ban className="w-4 h-4 mr-1" /> Ban</>
                            )}
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="destructive" disabled={isSelf}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete {u.full_name}?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This permanently removes the user account and all associated data. This cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(u)} className="bg-destructive text-destructive-foreground">
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
