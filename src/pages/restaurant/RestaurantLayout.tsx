import { useEffect, useState } from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  LayoutDashboard, ShoppingBag, UtensilsCrossed, Wallet, User, LogOut, Menu, X, Store, AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/restaurant', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/restaurant/orders', icon: ShoppingBag, label: 'Orders' },
  { path: '/restaurant/menu', icon: UtensilsCrossed, label: 'Menu' },
  { path: '/restaurant/wallet', icon: Wallet, label: 'Wallet' },
  { path: '/restaurant/profile', icon: User, label: 'Profile' },
];

export default function RestaurantLayout() {
  const { user, role, signOut, profile, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [restaurant, setRestaurant] = useState<any | null | undefined>(undefined);

  useEffect(() => {
    if (!isLoading && (!user || role !== 'restaurant')) {
      navigate('/auth?role=restaurant', { replace: true });
    }
  }, [user, role, isLoading, navigate]);

  useEffect(() => {
    if (!user || role !== 'restaurant') return;
    const load = async () => {
      const { data } = await supabase.from('restaurants').select('*').eq('owner_id', user.id).maybeSingle();
      setRestaurant(data ?? null);
    };
    load();
    const channel = supabase
      .channel('rest-self')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurants', filter: `owner_id=eq.${user.id}` },
        () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, role]);

  if (isLoading || restaurant === undefined) {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-pulse text-muted-foreground">Loading...</div></div>;
  }
  if (!user || role !== 'restaurant') return null;

  const needsSetup = !restaurant;
  const pending = restaurant?.approval_status === 'pending';
  const rejected = restaurant?.approval_status === 'rejected';

  return (
    <div className="min-h-screen bg-background flex">
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-card border-r transform transition-transform duration-200 ease-in-out lg:relative lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          <div className="h-16 flex items-center justify-between px-4 border-b">
            <Link to="/restaurant" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
                <Store className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-bold">Restaurant</span>
            </Link>
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link key={item.path} to={item.path} onClick={() => setSidebarOpen(false)}
                  className={cn("flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent")}>
                  <item.icon className="w-5 h-5" /><span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="p-4 border-t">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-primary font-semibold">{profile?.full_name?.charAt(0) || 'R'}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{restaurant?.name || profile?.full_name}</p>
                {restaurant && (
                  <Badge className={
                    restaurant.approval_status === 'approved' ? 'bg-success/10 text-success text-xs'
                    : restaurant.approval_status === 'rejected' ? 'bg-destructive/10 text-destructive text-xs'
                    : 'bg-warning/10 text-warning text-xs'
                  }>{restaurant.approval_status}</Badge>
                )}
              </div>
            </div>
            <Button variant="outline" size="sm" className="w-full" onClick={signOut}>
              <LogOut className="w-4 h-4 mr-2" /> Sign Out
            </Button>
          </div>
        </div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <div className="flex-1 flex flex-col min-w-0 pb-16 lg:pb-0">
        <header className="h-14 lg:h-16 flex items-center gap-3 px-4 border-b bg-card lg:px-6 sticky top-0 z-30">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <h1 className="text-base lg:text-lg font-semibold">
            {navItems.find((i) => i.path === location.pathname)?.label || 'Restaurant'}
          </h1>
        </header>

        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          {needsSetup ? (
            <div className="max-w-xl mx-auto mt-10">
              <Card className="border-warning">
                <CardContent className="py-10 text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-warning/10 mx-auto flex items-center justify-center">
                    <Store className="w-8 h-8 text-warning" />
                  </div>
                  <h2 className="text-xl font-bold">Set up your restaurant</h2>
                  <p className="text-sm text-muted-foreground">Create your restaurant profile. An admin will review and approve it.</p>
                  <Button onClick={() => navigate('/restaurant/profile')} className="gradient-primary">Set Up Now</Button>
                </CardContent>
              </Card>
            </div>
          ) : pending && location.pathname !== '/restaurant/profile' ? (
            <div className="max-w-xl mx-auto mt-10">
              <Card className="border-warning">
                <CardContent className="py-10 text-center space-y-4">
                  <AlertCircle className="w-12 h-12 text-warning mx-auto" />
                  <h2 className="text-xl font-bold">Awaiting Approval</h2>
                  <p className="text-sm text-muted-foreground">Your restaurant is under admin review. You'll be notified once approved.</p>
                </CardContent>
              </Card>
            </div>
          ) : rejected && location.pathname !== '/restaurant/profile' ? (
            <div className="max-w-xl mx-auto mt-10">
              <Card className="border-destructive">
                <CardContent className="py-10 text-center space-y-4">
                  <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
                  <h2 className="text-xl font-bold">Application Rejected</h2>
                  <p className="text-sm text-muted-foreground">{restaurant.rejection_reason || 'Please update your profile and contact support.'}</p>
                  <Button onClick={() => navigate('/restaurant/profile')}>Edit Profile</Button>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Outlet context={{ restaurant }} />
          )}
        </main>

        {/* Mobile bottom nav */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-card border-t flex">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path}
                className={cn("flex-1 flex flex-col items-center justify-center py-2 text-[10px] gap-0.5",
                  isActive ? "text-primary" : "text-muted-foreground")}>
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
