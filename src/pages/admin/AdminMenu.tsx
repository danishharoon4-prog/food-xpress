import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, UtensilsCrossed, LayoutGrid, List } from 'lucide-react';
import type { MenuItem, Restaurant } from '@/types';
import ImageCropInput from '@/components/ImageCropInput';

export default function AdminMenu() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const { toast } = useToast();

  // Form state
  const [restaurantId, setRestaurantId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [discountPrice, setDiscountPrice] = useState('');
  const [isDeal, setIsDeal] = useState(false);
  const [dealLabel, setDealLabel] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isAvailable, setIsAvailable] = useState(true);
  const [isFeatured, setIsFeatured] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [menuRes, restaurantsRes] = await Promise.all([
      supabase.from('menu_items').select('*, restaurant:restaurants(name)').order('created_at', { ascending: false }),
      supabase.from('restaurants').select('*').eq('is_active', true),
    ]);

    if (menuRes.data) setMenuItems(menuRes.data as unknown as MenuItem[]);
    if (restaurantsRes.data) setRestaurants(restaurantsRes.data as Restaurant[]);
    setLoading(false);
  };

  const resetForm = () => {
    setRestaurantId('');
    setName('');
    setDescription('');
    setPrice('');
    setDiscountPrice('');
    setIsDeal(false);
    setDealLabel('');
    setImageUrl('');
    setIsAvailable(true);
    setIsFeatured(false);
    setEditingItem(null);
  };

  const openDialog = (item?: MenuItem) => {
    if (item) {
      setEditingItem(item);
      setRestaurantId(item.restaurant_id);
      setName(item.name);
      setDescription(item.description || '');
      setPrice(String(item.price));
      setDiscountPrice(item.discount_price ? String(item.discount_price) : '');
      setIsDeal(item.is_deal);
      setDealLabel(item.deal_label || '');
      setImageUrl(item.image_url || '');
      setIsAvailable(item.is_available);
      setIsFeatured(item.is_featured);
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const itemData: any = {
      restaurant_id: restaurantId,
      name,
      description: description || null,
      price: parseFloat(price),
      discount_price: discountPrice ? parseFloat(discountPrice) : null,
      is_deal: isDeal,
      deal_label: dealLabel || null,
      image_url: imageUrl || null,
      is_available: isAvailable,
      is_featured: isFeatured,
    };

    if (editingItem) {
      const { error } = await supabase
        .from('menu_items')
        .update(itemData)
        .eq('id', editingItem.id);

      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: 'Menu item updated' });
        setDialogOpen(false);
        fetchData();
      }
    } else {
      const { error } = await supabase.from('menu_items').insert(itemData);

      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: 'Menu item added' });
        setDialogOpen(false);
        fetchData();
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this menu item?')) return;

    const { error } = await supabase.from('menu_items').delete().eq('id', id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Deleted', description: 'Menu item removed' });
      fetchData();
    }
  };

  if (loading) {
    return <div className="animate-pulse text-muted-foreground">Loading menu...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Menu Items</h2>
        <div className="flex items-center gap-2">
          <div className="flex items-center border rounded-md p-0.5">
            <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="sm" className="h-8 px-2" onClick={() => setViewMode('list')}>
              <List className="w-4 h-4" />
            </Button>
            <Button variant={viewMode === 'grid' ? 'secondary' : 'ghost'} size="sm" className="h-8 px-2" onClick={() => setViewMode('grid')}>
              <LayoutGrid className="w-4 h-4" />
            </Button>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => openDialog()} className="gradient-primary">
              <Plus className="w-4 h-4 mr-2" />
              Add Item
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingItem ? 'Edit Item' : 'Add Menu Item'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Restaurant *</Label>
                <Select value={restaurantId} onValueChange={setRestaurantId} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select restaurant" />
                  </SelectTrigger>
                  <SelectContent>
                    {restaurants.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="itemName">Name *</Label>
                <Input id="itemName" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="itemDesc">Description</Label>
                <Textarea id="itemDesc" value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="itemPrice">Price (PKR) *</Label>
                <Input
                  id="itemPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  required
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="itemDeal">Fresh Deal</Label>
                <Switch id="itemDeal" checked={isDeal} onCheckedChange={setIsDeal} />
              </div>
              {isDeal && (
                <>
                  <div>
                    <Label htmlFor="discountPrice">Discount Price (PKR) *</Label>
                    <Input
                      id="discountPrice"
                      type="number"
                      min="0"
                      step="0.01"
                      value={discountPrice}
                      onChange={(e) => setDiscountPrice(e.target.value)}
                      required={isDeal}
                    />
                  </div>
                  <div>
                    <Label htmlFor="dealLabel">Deal Label</Label>
                    <Input
                      id="dealLabel"
                      placeholder="e.g. Today Only, Hot Deal, Flash Sale"
                      value={dealLabel}
                      onChange={(e) => setDealLabel(e.target.value)}
                    />
                  </div>
                </>
              )}
              <div>
              <ImageCropInput label="Item Image" value={imageUrl} onChange={setImageUrl} aspect={1} previewClassName="w-full h-40 object-cover rounded-md border" />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="itemAvailable">Available</Label>
                <Switch id="itemAvailable" checked={isAvailable} onCheckedChange={setIsAvailable} />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="itemFeatured">Featured</Label>
                <Switch id="itemFeatured" checked={isFeatured} onCheckedChange={setIsFeatured} />
              </div>
              <Button type="submit" className="w-full">{editingItem ? 'Update' : 'Add'} Item</Button>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {menuItems.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <UtensilsCrossed className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No menu items yet. Add your first item!</p>
          </CardContent>
        </Card>
      ) : viewMode === 'list' ? (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Image</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Restaurant</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Discount</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead>Available</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {menuItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.name} className="w-12 h-12 rounded object-cover" />
                      ) : (
                        <div className="w-12 h-12 rounded bg-muted flex items-center justify-center">
                          <UtensilsCrossed className="w-4 h-4 text-muted-foreground" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{(item as any).restaurant?.name || '—'}</TableCell>
                    <TableCell className="max-w-[240px] truncate text-muted-foreground" title={item.description || ''}>
                      {item.description || '—'}
                    </TableCell>
                    <TableCell className="text-right">PKR {Number(item.price).toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      {item.discount_price ? `PKR ${Number(item.discount_price).toLocaleString()}` : '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {item.is_featured && <Badge variant="secondary">Featured</Badge>}
                        {item.is_deal && <Badge className="bg-destructive/10 text-destructive hover:bg-destructive/10">Deal</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={item.is_available ? 'bg-success/10 text-success hover:bg-success/10' : 'bg-muted text-muted-foreground hover:bg-muted'}>
                        {item.is_available ? 'Yes' : 'No'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex gap-1">
                        <Button variant="outline" size="sm" onClick={() => openDialog(item)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDelete(item.id)} className="text-destructive hover:text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {menuItems.map((item) => (
            <Card key={item.id} className="overflow-hidden">
              {item.image_url && (
                <div className="h-32 overflow-hidden">
                  <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                </div>
              )}
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold">{item.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {(item as any).restaurant?.name || 'Unknown restaurant'}
                    </p>
                  </div>
                  <span className="font-bold text-primary">PKR {Number(item.price).toLocaleString()}</span>
                </div>
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{item.description}</p>
                <div className="flex gap-2 mb-3 flex-wrap">
                  {item.is_featured && (
                    <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">Featured</span>
                  )}
                  {item.is_deal && (
                    <span className="text-xs px-2 py-1 rounded-full bg-destructive/10 text-destructive font-medium">Deal -{Math.round(((item.price - (item.discount_price || 0)) / item.price) * 100)}%</span>
                  )}
                  <span className={`text-xs px-2 py-1 rounded-full ${item.is_available ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
                    {item.is_available ? 'Available' : 'Unavailable'}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => openDialog(item)}>
                    <Pencil className="w-4 h-4 mr-1" /> Edit
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleDelete(item.id)} className="text-destructive">
                    <Trash2 className="w-4 h-4 mr-1" /> Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
