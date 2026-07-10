import { Link, useLocation } from 'react-router-dom';
import { Home, UtensilsCrossed, ShoppingBag, ShoppingCart, User } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { useSwipeNav } from '@/hooks/useSwipeNav';
import { cn } from '@/lib/utils';

const items = [
  { path: '/dashboard', label: 'Home', icon: Home },
  { path: '/restaurants', label: 'Browse', icon: UtensilsCrossed },
  { path: '/cart', label: 'Cart', icon: ShoppingCart, showBadge: true },
  { path: '/orders', label: 'Orders', icon: ShoppingBag },
  { path: '/profile', label: 'Profile', icon: User },
];

export default function CustomerBottomNav() {
  const location = useLocation();
  const { getItemCount } = useCart();
  const count = getItemCount();
  return (
    <>
    <div className="md:hidden h-16" aria-hidden="true" />
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur border-t flex">
      {items.map(({ path, label, icon: Icon, showBadge }) => {
        const active = location.pathname === path;
        return (
          <Link key={path} to={path}
            className={cn('flex-1 flex flex-col items-center justify-center py-2 text-[10px] gap-0.5 relative',
              active ? 'text-primary' : 'text-muted-foreground')}>
            <Icon className="w-5 h-5" />
            {showBadge && count > 0 && (
              <span className="absolute top-1 right-1/4 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-medium">
                {count}
              </span>
            )}
            {label}
          </Link>
        );
      })}
    </nav>
    </>
  );
}
