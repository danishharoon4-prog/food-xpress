import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Store, Eye, CheckCircle2, XCircle, Clock } from 'lucide-react';
import type { Restaurant } from '@/types';

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

export default function AdminRestaurants() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewing, setReviewing] = useState<Restaurant | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [editingRestaurant, setEditingRestaurant] = useState<Restaurant | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [cuisineType, setCuisineType] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  useEffect(() => { fetchRestaurants(); }, []);

  const fetchRestaurants = async () => {
    const { data, error } = await supabase
      .from('restaurants').select('*').order('created_at', { ascending: false });
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else setRestaurants(data as Restaurant[]);
    setLoading(false);
  };

  const counts = {
    all: restaurants.length,
    pending: restaurants.filter(r => (r as any).approval_status === 'pending').length,
    approved: restaurants.filter(r => (r as any).approval_status === 'approved').length,
    rejected: restaurants.filter(r => (r as any).approval_status === 'rejected').length,
  };
  const filtered = filter === 'all' ? restaurants : restaurants.filter(r => (r as any).approval_status === filter);

  const resetForm = () => {
    setName(''); setDescription(''); setCuisineType(''); setAddress(''); setCity(''); setImageUrl('');
    setEditingRestaurant(null);
  };

  const openDialog = (restaurant?: Restaurant) => {
    if (restaurant) {
      setEditingRestaurant(restaurant);
      setName(restaurant.name);
      setDescription(restaurant.description || '');
      setCuisineType(restaurant.cuisine_type || '');
      setAddress(restaurant.address || '');
      setCity(restaurant.city || '');
      setImageUrl(restaurant.image_url || '');
    } else { resetForm(); }
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const restaurantData = {
      name, description: description || null, cuisine_type: cuisineType || null,
      address: address || null, city: city || null, image_url: imageUrl || null,
    };
    if (editingRestaurant) {
      const { error } = await supabase.from('restaurants').update(restaurantData).eq('id', editingRestaurant.id);
      if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
      else { toast({ title: 'Restaurant updated' }); setDialogOpen(false); fetchRestaurants(); }
    } else {
      const { error } = await supabase.from('restaurants').insert(restaurantData);
      if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
      else { toast({ title: 'Restaurant added' }); setDialogOpen(false); fetchRestaurants(); }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this restaurant?')) return;
    const { error } = await supabase.from('restaurants').delete().eq('id', id);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Restaurant deleted' }); fetchRestaurants(); }
  };

  const openReview = (r: Restaurant) => { setReviewing(r); setRejectReason(''); setReviewOpen(true); };

  const approve = async () => {
    if (!reviewing) return;
    const { error } = await supabase.rpc('approve_restaurant', {
      _restaurant_id: reviewing.id, _approve: true, _reason: null,
    });
    if (error) toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Restaurant approved' }); setReviewOpen(false); fetchRestaurants(); }
  };

  const reject = async () => {
    if (!reviewing) return;
    if (!rejectReason.trim()) { toast({ title: 'Reason required', variant: 'destructive' }); return; }
    const { error } = await supabase.rpc('approve_restaurant', {
      _restaurant_id: reviewing.id, _approve: false, _reason: rejectReason.trim(),
    });
    if (error) toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Restaurant rejected' }); setReviewOpen(false); fetchRestaurants(); }
  };

  const statusBadge = (s?: string) => {
    if (s === 'pending') return <Badge className="bg-warning/10 text-warning hover:bg-warning/10"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
    if (s === 'approved') return <Badge className="bg-success/10 text-success hover:bg-success/10"><CheckCircle2 className="w-3 h-3 mr-1" />Approved</Badge>;
    if (s === 'rejected') return <Badge className="bg-destructive/10 text-destructive hover:bg-destructive/10"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
    return null;
  };

  if (loading) return <div className="animate-pulse text-muted-foreground">Loading restaurants...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Restaurants</h2>
          {counts.pending > 0 && (
            <p className="text-sm text-warning mt-1 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> {counts.pending} awaiting review
            </p>
          )}
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => openDialog()} className="gradient-primary">
              <Plus className="w-4 h-4 mr-2" />Add Restaurant
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingRestaurant ? 'Edit Restaurant' : 'Add Restaurant'}</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><Label htmlFor="name">Name *</Label><Input id="name" value={name} onChange={(e) => setName(e.target.value)} required /></div>
              <div><Label htmlFor="description">Description</Label><Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
              <div><Label htmlFor="cuisineType">Cuisine Type</Label><Input id="cuisineType" value={cuisineType} onChange={(e) => setCuisineType(e.target.value)} placeholder="e.g., Pakistani" /></div>
              <div><Label htmlFor="address">Address</Label><Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} /></div>
              <div><Label htmlFor="city">City *</Label><Input id="city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g., Mansehra" required /></div>
              <div><Label htmlFor="imageUrl">Image URL</Label><Input id="imageUrl" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." /></div>
              <Button type="submit" className="w-full">{editingRestaurant ? 'Update' : 'Add'} Restaurant</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as StatusFilter)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
          <TabsTrigger value="pending" className="data-[state=active]:bg-warning/10 data-[state=active]:text-warning">
            Pending ({counts.pending})
          </TabsTrigger>
          <TabsTrigger value="approved">Approved ({counts.approved})</TabsTrigger>
          <TabsTrigger value="rejected">Rejected ({counts.rejected})</TabsTrigger>
        </TabsList>
      </Tabs>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <Store className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No restaurants in this category.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((restaurant) => {
            const status = (restaurant as any).approval_status;
            const isPending = status === 'pending';
            return (
              <Card key={restaurant.id} className={isPending ? 'border-warning' : ''}>
                {restaurant.image_url && (
                  <div className="h-40 overflow-hidden rounded-t-lg">
                    <img src={restaurant.image_url} alt={restaurant.name} className="w-full h-full object-cover" />
                  </div>
                )}
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-start justify-between gap-2 text-base">
                    <span className="truncate">{restaurant.name}</span>
                    {statusBadge(status)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{restaurant.cuisine_type || 'No cuisine type'}</p>
                  {restaurant.city && <p className="text-xs text-muted-foreground mb-2">📍 {restaurant.city}</p>}
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{restaurant.description || 'No description'}</p>
                  <div className="flex flex-wrap gap-2">
                    {isPending ? (
                      <Button size="sm" className="gradient-primary flex-1" onClick={() => openReview(restaurant)}>
                        <Eye className="w-4 h-4 mr-1" />Review
                      </Button>
                    ) : (
                      <>
                        <Button variant="outline" size="sm" onClick={() => openDialog(restaurant)}>
                          <Pencil className="w-4 h-4 mr-1" />Edit
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => openReview(restaurant)}>
                          <Eye className="w-4 h-4 mr-1" />View
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDelete(restaurant.id)} className="text-destructive hover:text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Review dialog */}
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Review Restaurant {reviewing && statusBadge((reviewing as any).approval_status)}
            </DialogTitle>
          </DialogHeader>
          {reviewing && (
            <div className="space-y-3">
              {reviewing.image_url && (
                <img src={reviewing.image_url} alt={reviewing.name} className="w-full h-40 object-cover rounded-lg" />
              )}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-muted-foreground text-xs">Name</p><p className="font-medium">{reviewing.name}</p></div>
                <div><p className="text-muted-foreground text-xs">Cuisine</p><p className="font-medium">{reviewing.cuisine_type || '—'}</p></div>
                <div><p className="text-muted-foreground text-xs">City</p><p className="font-medium">{reviewing.city || '—'}</p></div>
                <div><p className="text-muted-foreground text-xs">Hours</p><p className="font-medium">{(reviewing as any).opening_time?.slice(0,5)} – {(reviewing as any).closing_time?.slice(0,5)}</p></div>
              </div>
              <div><p className="text-muted-foreground text-xs">Address</p><p className="text-sm">{reviewing.address || '—'}</p></div>
              <div><p className="text-muted-foreground text-xs">Description</p><p className="text-sm">{reviewing.description || '—'}</p></div>
              {(reviewing as any).rejection_reason && (
                <div className="p-3 rounded bg-destructive/10 text-destructive text-sm">
                  <p className="font-medium text-xs mb-1">Previous Rejection Reason</p>
                  {(reviewing as any).rejection_reason}
                </div>
              )}
              {(reviewing as any).approval_status !== 'approved' && (
                <div>
                  <Label htmlFor="reason">Rejection Reason (required to reject)</Label>
                  <Textarea id="reason" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={2} placeholder="Explain why this is being rejected..." />
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            {reviewing && (reviewing as any).approval_status !== 'approved' && (
              <Button variant="outline" className="text-destructive" onClick={reject}>
                <XCircle className="w-4 h-4 mr-1" />Reject
              </Button>
            )}
            {reviewing && (reviewing as any).approval_status !== 'approved' && (
              <Button className="gradient-primary" onClick={approve}>
                <CheckCircle2 className="w-4 h-4 mr-1" />Approve
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
