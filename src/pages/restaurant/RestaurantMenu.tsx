import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import ImageCropInput from '@/components/ImageCropInput';
import CategoryManager from '@/components/CategoryManager';
import type { MenuItemSize } from '@/types';

export default function RestaurantMenu() {
  const { restaurant } = useOutletContext<{ restaurant: any }>();
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [cats, setCats] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [newCat, setNewCat] = useState('');
  const [editing, setEditing] = useState<any | null>(null);
  const emptyForm = { name: '', description: '', price: '', discount_price: '', is_deal: false, deal_label: '', image_url: '', category_id: '', is_available: true, is_featured: false, sizes: [] as MenuItemSize[] };
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    if (!restaurant?.id) return;
    const [i, c] = await Promise.all([
      supabase.from('menu_items').select('*').eq('restaurant_id', restaurant.id).order('created_at', { ascending: false }),
      supabase.from('menu_categories').select('*').eq('restaurant_id', restaurant.id).order('display_order'),
    ]);
    setItems(i.data || []); setCats(c.data || []);
  };
  useEffect(() => { load(); }, [restaurant?.id]);

  const reset = () => { setEditing(null); setForm(emptyForm); };

  const save = async () => {
    if (!form.name.trim() || !form.price) return toast({ title: 'Name and price required', variant: 'destructive' });
    const cleanSizes = form.sizes
      .map((s) => ({ name: s.name.trim(), price: Number(s.price) }))
      .filter((s) => s.name.length > 0);
    if (cleanSizes.some((s) => !Number.isFinite(s.price) || s.price <= 0)) {
      return toast({ title: 'Invalid size price', description: 'Each size must have a price greater than 0.', variant: 'destructive' });
    }
    if (new Set(cleanSizes.map((s) => s.name.toLowerCase())).size !== cleanSizes.length) {
      return toast({ title: 'Duplicate size', description: 'Size names must be unique.', variant: 'destructive' });
    }
    const payload: any = {
      restaurant_id: restaurant.id, name: form.name, description: form.description || null,
      price: Number(form.price), discount_price: form.discount_price ? Number(form.discount_price) : null,
      is_deal: form.is_deal, deal_label: form.deal_label || null,
      image_url: form.image_url || null,
      category_id: form.category_id || null, is_available: form.is_available,
      is_featured: form.is_featured,
      sizes: cleanSizes.length > 0 ? cleanSizes : null,
    };
    const { error } = editing
      ? await supabase.from('menu_items').update(payload).eq('id', editing.id)
      : await supabase.from('menu_items').insert(payload);
    if (error) return toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
    toast({ title: editing ? 'Updated' : 'Added' });
    setOpen(false); reset(); load();
  };

  const del = async (id: string) => {
    if (!confirm('Delete this item?')) return;
    const { error } = await supabase.from('menu_items').delete().eq('id', id);
    if (error) return toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
    load();
  };

  const addCategory = async () => {
    if (!newCat.trim()) return;
    const { error } = await supabase.from('menu_categories').insert({ restaurant_id: restaurant.id, name: newCat, display_order: cats.length });
    if (error) return toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    setNewCat(''); setCatOpen(false); load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Menu Items ({items.length})</h2>
        <div className="flex gap-2">
          <Dialog open={catOpen} onOpenChange={setCatOpen}>
            <DialogTrigger asChild><Button variant="outline" size="sm">Categories</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Categories</DialogTitle></DialogHeader>
              <CategoryManager restaurantId={restaurant?.id} onChanged={load} />
            </DialogContent>
          </Dialog>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
            <DialogTrigger asChild><Button size="sm" className="gradient-primary"><Plus className="w-4 h-4 mr-1" />Add Item</Button></DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editing ? 'Edit' : 'Add'} Menu Item</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} /></div>
                <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} rows={2} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Base Price (PKR)</Label><Input type="number" value={form.price} onChange={(e) => setForm({...form, price: e.target.value})} />
                    <p className="text-[11px] text-muted-foreground mt-1">Used when no sizes are configured. If you add sizes below, customers must pick a size and its price will apply.</p>
                  </div>
                  <div><Label>Category</Label>
                    <Select value={form.category_id || 'none'} onValueChange={(v) => setForm({...form, category_id: v === 'none' ? '' : v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Uncategorized</SelectItem>
                        {cats.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2 p-3 rounded bg-muted">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Size Variants (optional)</Label>
                      <p className="text-[11px] text-muted-foreground">Add sizes like Small / Medium / Large with separate prices (useful for pizzas, drinks, etc.)</p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => setForm({ ...form, sizes: [...form.sizes, { name: '', price: 0 }] })}>
                      <Plus className="w-3 h-3 mr-1" />Add Size
                    </Button>
                  </div>
                  {form.sizes.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No sizes — single-price item.</p>
                  ) : (
                    <div className="space-y-2">
                      {form.sizes.map((s, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <Input placeholder="Size name (e.g. Large)" value={s.name}
                            onChange={(e) => setForm({ ...form, sizes: form.sizes.map((x, i) => i === idx ? { ...x, name: e.target.value } : x) })} />
                          <Input type="number" placeholder="Price" className="w-28" value={s.price || ''}
                            onChange={(e) => setForm({ ...form, sizes: form.sizes.map((x, i) => i === idx ? { ...x, price: Number(e.target.value) } : x) })} />
                          <Button type="button" size="icon" variant="ghost" onClick={() => setForm({ ...form, sizes: form.sizes.filter((_, i) => i !== idx) })}>
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between p-3 rounded bg-muted">
                  <Label>Fresh Deal</Label>
                  <Switch checked={form.is_deal} onCheckedChange={(v) => setForm({...form, is_deal: v})} />
                </div>
                {form.is_deal && (
                  <>
                    <div><Label>Discount Price (PKR)</Label><Input type="number" value={form.discount_price} onChange={(e) => setForm({...form, discount_price: e.target.value})} /></div>
                    <div><Label>Deal Label</Label><Input value={form.deal_label} onChange={(e) => setForm({...form, deal_label: e.target.value})} placeholder="e.g. Today Only, Hot Deal" /></div>
                  </>
                )}
                <ImageCropInput label="Item Image" value={form.image_url} onChange={(v) => setForm({...form, image_url: v})} aspect={1} previewClassName="w-full h-40 object-cover rounded-md border" />
                <div className="flex items-center justify-between p-3 rounded bg-muted">
                  <Label>Featured</Label>
                  <Switch checked={form.is_featured} onCheckedChange={(v) => setForm({...form, is_featured: v})} />
                </div>
                <div className="flex items-center justify-between p-3 rounded bg-muted">
                  <Label>Available</Label>
                  <Switch checked={form.is_available} onCheckedChange={(v) => setForm({...form, is_available: v})} />
                </div>
                <Button onClick={save} className="w-full gradient-primary">{editing ? 'Save' : 'Add Item'}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {(() => {
        const groups = new Map<string, { name: string; items: any[] }>();
        for (const c of cats) groups.set(c.id, { name: c.name, items: [] });
        groups.set('uncategorized', { name: 'Uncategorized', items: [] });
        for (const it of items) {
          const key = it.category_id && groups.has(it.category_id) ? it.category_id : 'uncategorized';
          groups.get(key)!.items.push(it);
        }
        const rendered = [...groups.values()].filter((g) => g.items.length > 0);
        if (rendered.length === 0) {
          return <p className="text-sm text-muted-foreground text-center py-8">No menu items yet. Add your first item.</p>;
        }
        return (
          <div className="space-y-6">
            {rendered.map((g) => (
              <div key={g.name}>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold">{g.name}</h3>
                  <span className="text-xs text-muted-foreground">({g.items.length})</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {g.items.map((it) => (
                    <Card key={it.id}>
                      <CardContent className="p-3">
                        {it.image_url && <img src={it.image_url} className="w-full h-32 object-cover rounded mb-2" alt={it.name} />}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold truncate">{it.name}</p>
                            {it.is_deal && it.discount_price ? (
                              <div className="flex items-center gap-2">
                                <p className="text-sm text-primary font-bold">PKR {Number(it.discount_price).toLocaleString()}</p>
                                <p className="text-xs text-muted-foreground line-through">PKR {Number(it.price).toLocaleString()}</p>
                              </div>
                            ) : (
                              <p className="text-sm text-primary font-bold">PKR {Number(it.price).toLocaleString()}</p>
                            )}
                            {it.is_deal && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive">Deal</span>}
                            {!it.is_available && <span className="text-xs text-muted-foreground">Unavailable</span>}
                          </div>
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" onClick={() => {
                              setEditing(it);
                              setForm({ name: it.name, description: it.description || '', price: String(it.price), discount_price: it.discount_price ? String(it.discount_price) : '', is_deal: it.is_deal || false, deal_label: it.deal_label || '', image_url: it.image_url || '', category_id: it.category_id || '', is_available: it.is_available, is_featured: it.is_featured || false, sizes: Array.isArray(it.sizes) ? it.sizes : [] });
                              setOpen(true);
                            }}><Pencil className="w-4 h-4" /></Button>
                            <Button size="icon" variant="ghost" onClick={() => del(it.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}
