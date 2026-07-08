import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { Button } from '@/components/ui/button';
import { UtensilsCrossed, ShoppingCart, User, LogOut, LayoutDashboard, Headphones } from 'lucide-react';
import CustomerBottomNav from './CustomerBottomNav';
import ThemeToggle from './ThemeToggle';

export default function CustomerHeader() {
  const { user, signOut } = useAuth();
  const { getItemCount } = useCart();
  const itemCount = getItemCount();

  return (
    <>
      <header className="sticky top-0 z-50 glass border-b">
        <div className="container flex items-center justify-between h-14 md:h-16">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl gradient-primary flex items-center justify-center shadow-glow animate-pop-in">
              <UtensilsCrossed className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-display text-2xl md:text-3xl hidden sm:block tracking-wide">FoodExpress</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-2">
            <Link to="/restaurants"><Button variant="ghost" size="sm" className="story-link">Restaurants</Button></Link>
            <Link to="/cart" className="relative">
              <Button variant="ghost" size="icon" className="hover-scale">
                <ShoppingCart className="h-5 w-5" />
                {itemCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full gradient-gold text-accent-foreground text-xs flex items-center justify-center font-semibold animate-pop-in">
                    {itemCount}
                  </span>
                )}
              </Button>
            </Link>
            <ThemeToggle />
            {user ? (
              <>
                <Link to="/dashboard"><Button variant="ghost" size="sm"><LayoutDashboard className="h-4 w-4 mr-1" />Dashboard</Button></Link>
                <Link to="/profile"><Button variant="ghost" size="sm">Profile</Button></Link>
                <Link to="/orders"><Button variant="ghost" size="sm">My Orders</Button></Link>
                <Link to="/support"><Button variant="ghost" size="sm"><Headphones className="h-4 w-4 mr-1" />Support</Button></Link>
                <Button variant="ghost" size="icon" onClick={signOut}><LogOut className="h-5 w-5" /></Button>
              </>
            ) : (
              <Link to="/auth"><Button className="gradient-primary shadow-glow hover-scale" size="sm"><User className="h-4 w-4 mr-2" />Sign In</Button></Link>
            )}
          </nav>

          {/* Mobile right actions */}
          <div className="flex md:hidden items-center gap-1">
            <ThemeToggle />
            {user ? (
              <>
                <Link to="/support"><Button variant="ghost" size="icon"><Headphones className="h-5 w-5" /></Button></Link>
                <Button variant="ghost" size="icon" onClick={signOut}><LogOut className="h-5 w-5" /></Button>
              </>
            ) : (
              <Link to="/auth"><Button className="gradient-primary" size="sm">Sign In</Button></Link>
            )}
          </div>
        </div>
      </header>
      {user && <CustomerBottomNav />}
    </>
  );
}
