import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Search, Utensils, Store, Loader2 } from 'lucide-react';

interface RestaurantHit {
  id: string;
  name: string;
  cuisine_type: string | null;
  image_url: string | null;
}

interface ItemHit {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  restaurant_id: string;
  restaurants: { id: string; name: string } | null;
}

export default function GlobalSearch({ placeholder = 'Search restaurants or items...' }: { placeholder?: string }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [restaurants, setRestaurants] = useState<RestaurantHit[]>([]);
  const [items, setItems] = useState<ItemHit[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setRestaurants([]);
      setItems([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      const [rRes, iRes] = await Promise.all([
        supabase
          .from('restaurants')
          .select('id, name, cuisine_type, image_url')
          .eq('is_active', true)
          .eq('approval_status', 'approved')
          .or(`name.ilike.%${q}%,cuisine_type.ilike.%${q}%`)
          .limit(5),
        supabase
          .from('menu_items')
          .select('id, name, price, image_url, restaurant_id, restaurants:restaurant_id(id, name)')
          .eq('is_available', true)
          .ilike('name', `%${q}%`)
          .limit(8),
      ]);
      setRestaurants((rRes.data as any) || []);
      setItems((iRes.data as any) || []);
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const goto = (path: string) => {
    setOpen(false);
    setQuery('');
    navigate(path);
  };

  const hasResults = restaurants.length > 0 || items.length > 0;

  return (
    <div ref={wrapRef} className="relative w-full">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="pl-10 h-12 rounded-xl"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {open && query.trim().length >= 2 && (
        <div className="absolute z-50 mt-2 left-0 right-0 bg-popover border rounded-xl shadow-lg max-h-[70vh] overflow-y-auto">
          {!hasResults && !loading && (
            <div className="p-4 text-sm text-muted-foreground text-center">No results found</div>
          )}

          {restaurants.length > 0 && (
            <div className="p-2">
              <p className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <Store className="w-3 h-3" /> Restaurants
              </p>
              {restaurants.map((r) => (
                <button
                  key={r.id}
                  onClick={() => goto(`/restaurant/${r.id}`)}
                  className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted text-left"
                >
                  <div className="w-10 h-10 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                    {r.image_url ? (
                      <img src={r.image_url} alt={r.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Store className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{r.name}</p>
                    {r.cuisine_type && (
                      <p className="text-xs text-muted-foreground truncate">{r.cuisine_type}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {items.length > 0 && (
            <div className="p-2 border-t">
              <p className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <Utensils className="w-3 h-3" /> Menu Items
              </p>
              {items.map((i) => (
                <button
                  key={i.id}
                  onClick={() => goto(`/restaurant/${i.restaurant_id}`)}
                  className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted text-left"
                >
                  <div className="w-10 h-10 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                    {i.image_url ? (
                      <img src={i.image_url} alt={i.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Utensils className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{i.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {i.restaurants?.name || 'Restaurant'}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-primary whitespace-nowrap">
                    PKR {Number(i.price).toLocaleString()}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
