import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2 } from 'lucide-react';

interface Props {
  restaurantId: string;
  onChanged?: () => void;
}

export default function CategoryManager({ restaurantId, onChanged }: Props) {
  const { toast } = useToast();
  const [cats, setCats] = useState<{ id: string; name: string }[]>([]);
  const [newCat, setNewCat] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!restaurantId) return setCats([]);
    const { data } = await supabase.from('menu_categories').select('id, name').eq('restaurant_id', restaurantId).order('display_order');
    setCats(data || []);
  };
  useEffect(() => { load(); }, [restaurantId]);

  const add = async () => {
    const name = newCat.trim();
    if (!name) return;
    if (cats.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      return toast({ title: 'Category already exists', variant: 'destructive' });
    }
    setBusy(true);
    const { error } = await supabase.from('menu_categories').insert({ restaurant_id: restaurantId, name, display_order: cats.length });
    setBusy(false);
    if (error) return toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    setNewCat(''); await load(); onChanged?.();
  };

  const remove = async (id: string, name: string) => {
    if (!confirm(`Delete category "${name}"? Its items will become Uncategorized.`)) return;
    setBusy(true);
    const u = await supabase.from('menu_items').update({ category_id: null }).eq('category_id', id);
    const d = u.error ? u : await supabase.from('menu_categories').delete().eq('id', id);
    setBusy(false);
    if (d.error) return toast({ title: 'Delete failed', description: d.error.message, variant: 'destructive' });
    toast({ title: 'Category deleted' });
    await load(); onChanged?.();
  };

  if (!restaurantId) return <p className="text-xs text-muted-foreground">Select a restaurant first.</p>;

  return (
    <div className="space-y-2">
      <div className="space-y-1 max-h-56 overflow-y-auto">
        {cats.map((c) => (
          <div key={c.id} className="flex items-center justify-between p-2 rounded bg-muted text-sm">
            <span>{c.name}</span>
            <Button type="button" size="icon" variant="ghost" className="h-7 w-7" disabled={busy} onClick={() => remove(c.id, c.name)}>
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </div>
        ))}
        {cats.length === 0 && <p className="text-sm text-muted-foreground">No categories yet</p>}
      </div>
      <div className="flex gap-2">
        <Input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="New category (e.g. Burgers)"
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
        <Button type="button" onClick={add} disabled={busy}><Plus className="w-4 h-4 mr-1" />Add</Button>
      </div>
    </div>
  );
}
