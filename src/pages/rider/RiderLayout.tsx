import { useEffect, useState } from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import RoleAvatar from '@/components/RoleAvatar';
import { RoleGuard } from '@/components/RoleGuard';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  LayoutDashboard,
  ShoppingBag,
  Wallet,
  Star,
  Settings,
  LogOut,
  Menu,
  X,
  Bike,
  AlertCircle,
  Headphones,
} from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSwipeNav } from '@/hooks/useSwipeNav';

const navItems = [
  { path: '/rider', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/rider/orders', icon: ShoppingBag, label: 'Orders' },
  { path: '/rider/earnings', icon: Wallet, label: 'Earnings' },
  { path: '/rider/ratings', icon: Star, label: 'Ratings' },
  { path: '/rider/support', icon: Headphones, label: 'Support' },
  { path: '/rider/settings', icon: Settings, label: 'Settings' },
];

function RiderLayoutInner() {
  const { user, signOut, profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isVerified, setIsVerified] = useState<boolean | null>(null);

  // Check verification status
  useEffect(() => {
    if (!user) return;

    const check = async () => {
      let { data } = await supabase
        .from('riders')
        .select('is_verified')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!data) {
        // Auto-create rider row
        const { data: created } = await supabase
          .from('riders')
          .insert({ user_id: user.id })
          .select('is_verified')
          .single();
        data = created;
      }
      setIsVerified(!!data?.is_verified);
    };
    check();

    // Re-check when admin verifies
    const channel = supabase
      .channel('rider-verification')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'riders', filter: `user_id=eq.${user.id}` },
        (payload: any) => {
          setIsVerified(!!payload.new?.is_verified);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  if (isVerified === null) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-3">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground">Loading your account…</p>
      </div>
    );
  }



  // Allowed routes when not verified: only Settings
  const allowedWhenUnverified =
    location.pathname === '/rider/settings' || location.pathname === '/rider/support';

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-card border-r transform transition-transform duration-200 ease-in-out lg:relative lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">
          <div className="h-16 flex items-center justify-between px-4 border-b">
            <Link to="/rider" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
                <Bike className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-bold">Rider Portal</span>
            </Link>
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              const isLocked = !isVerified && item.path !== '/rider/settings' && item.path !== '/rider/support';
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent",
                    isLocked && "opacity-50"
                  )}
                  aria-disabled={isLocked}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="flex-1">{item.label}</span>
                  {isLocked && <AlertCircle className="w-4 h-4 text-warning" />}
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t">
            <div className="flex items-center gap-3 mb-3">
              <RoleAvatar role="rider" avatarUrl={profile?.avatar_url} name={profile?.full_name} className="w-10 h-10 bg-white" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{profile?.full_name}</p>
                <Badge className={isVerified ? 'bg-success/10 text-success text-xs' : 'bg-warning/10 text-warning text-xs'}>
                  {isVerified ? 'Verified' : 'Pending'}
                </Badge>
              </div>
            </div>
            <Button variant="outline" size="sm" className="w-full" onClick={signOut}>
              <LogOut className="w-4 h-4 mr-2" /> Sign Out
            </Button>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <div className="flex-1 flex flex-col min-w-0 pb-16 lg:pb-0">
        <header className="h-14 lg:h-16 flex items-center gap-3 px-4 border-b bg-card lg:px-6 sticky top-0 z-30">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <h1 className="text-base lg:text-lg font-semibold">
            {navItems.find((item) => item.path === location.pathname)?.label || 'Rider'}
          </h1>
        </header>

        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          {!isVerified && !allowedWhenUnverified ? (
            <div className="max-w-xl mx-auto mt-10">
              <Card className="border-warning">
                <CardContent className="py-10 text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-warning/10 mx-auto flex items-center justify-center">
                    <AlertCircle className="w-8 h-8 text-warning" />
                  </div>
                  <h2 className="text-xl font-bold">Account Pending Verification</h2>
                  <p className="text-sm text-muted-foreground">
                    Your rider account isn't active yet. Please complete your profile and upload your CNIC, vehicle document, and driving license.
                    An admin will review and activate your account.
                  </p>
                  <Button onClick={() => navigate('/rider/settings')} className="gradient-primary">
                    Complete Profile
                  </Button>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Outlet />
          )}
        </main>

        {/* Mobile bottom nav */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-card border-t flex">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const isLocked = !isVerified && item.path !== '/rider/settings' && item.path !== '/rider/support';
            return (
              <Link key={item.path} to={item.path}
                className={cn("flex-1 flex flex-col items-center justify-center py-2 text-[10px] gap-0.5",
                  isActive ? "text-primary" : "text-muted-foreground",
                  isLocked && "opacity-50")}
                aria-disabled={isLocked}>
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

export default function RiderLayout() {
  return (
    <RoleGuard allow="rider">
      <RiderLayoutInner />
    </RoleGuard>
  );
}

