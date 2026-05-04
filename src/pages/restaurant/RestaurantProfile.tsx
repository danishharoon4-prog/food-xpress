import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

export default function RestaurantProfile() {
  const { user } = useAuth();
  const { restaurant } = useOutletContext<{ restaurant: any }>();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', description: '', cuisine_type: '', address: '', image_url: '',
    opening_time: '09:00', closing_time: '22:00', is_active: true,
  });

  useEffect(() => {
    if (restaurant) {
      setForm({
        name: restaurant.name || '',
        description: restaurant.description || '',
        cuisine_type: restaurant.cuisine_type || '',
        address: restaurant.address || '',
        image_url: restaurant.image_url || '',
        opening_time: restaurant.opening_time?.slice(0,5) || '09:00',
        closing_time: restaurant.closing_time?.slice(0,5) || '22:00',
        is_active: restaurant.is_active ?? true,
      });
    }
  }, [restaurant]);

  const save = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Name required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    if (restaurant) {
      const { error } = await supabase.from('restaurants').update({
        ...form,
      }).eq('id', restaurant.id);
      setSaving(false);
      if (error) return toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
      toast({ title: 'Saved' });
    } else {
      const { error } = await supabase.from('restaurants').insert({
        ...form, owner_id: user!.id, city: 'Mansehra', approval_status: 'pending', is_active: false,
      });
      setSaving(false);
      if (error) return toast({ title: 'Create failed', description: error.message, variant: 'destructive' });
      toast({ title: 'Submitted for approval', description: 'An admin will review your restaurant shortly.' });
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader><CardTitle>Restaurant Profile</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {restaurant?.approval_status === 'rejected' && (
            <div className="p-3 rounded bg-destructive/10 text-destructive text-sm">
              Rejected: {restaurant.rejection_reason || 'Please update and resubmit.'}
            </div>
          )}
          <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} /></div>
          <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} rows={3} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Cuisine</Label><Input value={form.cuisine_type} onChange={(e) => setForm({...form, cuisine_type: e.target.value})} placeholder="e.g. Pakistani" /></div>
            <div><Label>City</Label><Input value="Mansehra" disabled /></div>
          </div>
          <div><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({...form, address: e.target.value})} /></div>
          <div><Label>Image URL</Label><Input value={form.image_url} onChange={(e) => setForm({...form, image_url: e.target.value})} placeholder="https://..." /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Opens</Label><Input type="time" value={form.opening_time} onChange={(e) => setForm({...form, opening_time: e.target.value})} /></div>
            <div><Label>Closes</Label><Input type="time" value={form.closing_time} onChange={(e) => setForm({...form, closing_time: e.target.value})} /></div>
          </div>
          {restaurant && (
            <div className="flex items-center justify-between p-3 rounded bg-muted">
              <div>
                <p className="font-medium text-sm">Restaurant Open</p>
                <p className="text-xs text-muted-foreground">Toggle off to pause new orders</p>
              </div>
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({...form, is_active: v})} />
            </div>
          )}
          <Button onClick={save} disabled={saving} className="w-full gradient-primary">
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {restaurant ? 'Save Changes' : 'Submit for Approval'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
