import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2, User, Store, CheckCircle2, Clock, XCircle, AlertCircle } from 'lucide-react';

const REQUIRED_FIELDS: Array<{ key: string; label: string }> = [
  { key: 'name', label: 'Restaurant name' },
  { key: 'description', label: 'Description' },
  { key: 'cuisine_type', label: 'Cuisine type' },
  { key: 'address', label: 'Address' },
  { key: 'image_url', label: 'Cover image URL' },
  { key: 'opening_time', label: 'Opening time' },
  { key: 'closing_time', label: 'Closing time' },
];

export default function RestaurantProfile() {
  const { user, profile } = useAuth();
  const { restaurant, refetchRestaurant } = useOutletContext<{ restaurant: any; refetchRestaurant: () => Promise<void> }>();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [savingPersonal, setSavingPersonal] = useState(false);

  const [form, setForm] = useState({
    name: '', description: '', cuisine_type: '', address: '', image_url: '',
    opening_time: '09:00', closing_time: '22:00', is_active: true,
  });
  const [personal, setPersonal] = useState({ full_name: '', phone: '', email: '' });

  useEffect(() => {
    if (restaurant) {
      setForm({
        name: restaurant.name || '',
        description: restaurant.description || '',
        cuisine_type: restaurant.cuisine_type || '',
        address: restaurant.address || '',
        image_url: restaurant.image_url || '',
        opening_time: restaurant.opening_time?.slice(0, 5) || '09:00',
        closing_time: restaurant.closing_time?.slice(0, 5) || '22:00',
        is_active: restaurant.is_active ?? true,
      });
    }
  }, [restaurant]);

  useEffect(() => {
    if (profile) {
      setPersonal({
        full_name: profile.full_name || '',
        phone: profile.phone || '',
        email: profile.email || '',
      });
    }
  }, [profile]);

  const status: 'new' | 'pending' | 'approved' | 'rejected' =
    !restaurant ? 'new' : (restaurant.approval_status as any) || 'pending';
  const isPending = status === 'pending';
  const isApproved = status === 'approved';
  const isRejected = status === 'rejected';
  const locked = isPending; // read-only while admin reviews

  const missing = useMemo(
    () => REQUIRED_FIELDS.filter((f) => !String((form as any)[f.key] || '').trim()),
    [form]
  );
  const personalIncomplete = !personal.full_name.trim() || !personal.phone.trim();
  const canSubmit = missing.length === 0 && !personalIncomplete;

  const save = async (submitForReview = false) => {
    if (locked) return;
    if (submitForReview && !canSubmit) {
      const missingBits = [
        ...(personalIncomplete ? ['Full name & phone (Personal tab)'] : []),
        ...missing.map((m) => m.label),
      ];
      toast({
        title: 'Profile incomplete',
        description: `Please fill: ${missingBits.join(', ')}`,
        variant: 'destructive',
      });
      return;
    }
    setSaving(true);

    // Always sync personal info first if submitting for review
    if (submitForReview && !personalIncomplete) {
      const { error: pErr } = await supabase
        .from('profiles')
        .update({ full_name: personal.full_name, phone: personal.phone })
        .eq('id', user!.id);
      if (pErr) {
        setSaving(false);
        return toast({ title: 'Failed to save personal info', description: pErr.message, variant: 'destructive' });
      }
    }

    if (restaurant) {
      const payload: any = { ...form };
      if (submitForReview && isRejected) {
        payload.approval_status = 'pending';
        payload.rejection_reason = null;
        payload.is_active = false;
      }
      const { error } = await supabase.from('restaurants').update(payload).eq('id', restaurant.id);
      setSaving(false);
      if (error) return toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
      await refetchRestaurant?.();
      toast({
        title: submitForReview ? 'Resubmitted for approval' : 'Saved',
        description: submitForReview ? 'An admin will review your changes shortly.' : undefined,
      });
    } else {
      const { error } = await supabase.from('restaurants').insert({
        ...form,
        owner_id: user!.id,
        city: profile?.city || 'Mansehra',
        approval_status: 'pending',
        is_active: false,
      });
      setSaving(false);
      if (error) return toast({ title: 'Submit failed', description: error.message, variant: 'destructive' });
      await refetchRestaurant?.();
      toast({ title: 'Submitted for approval', description: 'An admin will review your restaurant shortly.' });
    }
  };

  const savePersonal = async () => {
    if (!personal.full_name.trim()) {
      toast({ title: 'Name required', variant: 'destructive' });
      return;
    }
    setSavingPersonal(true);
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: personal.full_name, phone: personal.phone })
      .eq('id', user!.id);
    setSavingPersonal(false);
    if (error) return toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
    toast({ title: 'Personal info updated' });
  };

  const StatusBanner = () => {
    if (status === 'new') {
      return (
        <Card className="border-warning bg-warning/5">
          <CardContent className="p-4 flex gap-3 items-start">
            <AlertCircle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold">Complete your profile</p>
              <p className="text-muted-foreground">Fill in all required details below, then submit for admin approval.</p>
            </div>
          </CardContent>
        </Card>
      );
    }
    if (isPending) {
      return (
        <Card className="border-warning bg-warning/5">
          <CardContent className="p-4 flex gap-3 items-start">
            <Clock className="w-5 h-5 text-warning shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold">Awaiting admin approval</p>
              <p className="text-muted-foreground">Your profile is read-only while under review. You'll be notified once approved.</p>
            </div>
          </CardContent>
        </Card>
      );
    }
    if (isRejected) {
      return (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="p-4 flex gap-3 items-start">
            <XCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold">Application rejected</p>
              <p className="text-muted-foreground">{restaurant?.rejection_reason || 'Please update and resubmit.'}</p>
            </div>
          </CardContent>
        </Card>
      );
    }
    return (
      <Card className="border-success bg-success/5">
        <CardContent className="p-4 flex gap-3 items-start">
          <CheckCircle2 className="w-5 h-5 text-success shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold">Approved & live</p>
            <p className="text-muted-foreground">Your restaurant is visible to customers.</p>
          </div>
        </CardContent>
      </Card>
    );
  };

  const req = (label: string) => (
    <span>{label} <span className="text-destructive">*</span></span>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Restaurant Profile</h2>
          <p className="text-sm text-muted-foreground">Complete and submit for admin approval</p>
        </div>
        {restaurant && (
          <Badge className={
            isApproved ? 'bg-success/10 text-success'
            : isRejected ? 'bg-destructive/10 text-destructive'
            : 'bg-warning/10 text-warning'
          }>{status}</Badge>
        )}
      </div>

      <StatusBanner />

      <Tabs defaultValue="restaurant">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="personal"><User className="w-4 h-4 mr-2" />Personal</TabsTrigger>
          <TabsTrigger value="restaurant"><Store className="w-4 h-4 mr-2" />Restaurant</TabsTrigger>
        </TabsList>

        <TabsContent value="personal" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Owner Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div><Label>{req('Full Name')}</Label><Input value={personal.full_name} onChange={(e) => setPersonal({ ...personal, full_name: e.target.value })} /></div>
              <div><Label>{req('Phone')}</Label><Input value={personal.phone} onChange={(e) => setPersonal({ ...personal, phone: e.target.value })} placeholder="03xx-xxxxxxx" /></div>
              <div><Label>Email</Label><Input value={personal.email} disabled /></div>
              <Button onClick={savePersonal} disabled={savingPersonal} className="w-full gradient-primary">
                {savingPersonal && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Personal Info
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="restaurant" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Restaurant Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <fieldset disabled={locked} className="space-y-4 disabled:opacity-70">
                <div><Label>{req('Name')}</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div><Label>{req('Description')}</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} placeholder="Tell customers about your restaurant..." /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>{req('Cuisine')}</Label><Input value={form.cuisine_type} onChange={(e) => setForm({ ...form, cuisine_type: e.target.value })} placeholder="e.g. Pakistani" /></div>
                  <div><Label>City</Label><Input value="Mansehra" disabled /></div>
                </div>
                <div><Label>{req('Address')}</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
                <div><Label>{req('Cover Image URL')}</Label><Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://..." /></div>
                {form.image_url && (
                  <img src={form.image_url} alt="Preview" className="w-full h-32 object-cover rounded-md border" onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>{req('Opens')}</Label><Input type="time" value={form.opening_time} onChange={(e) => setForm({ ...form, opening_time: e.target.value })} /></div>
                  <div><Label>{req('Closes')}</Label><Input type="time" value={form.closing_time} onChange={(e) => setForm({ ...form, closing_time: e.target.value })} /></div>
                </div>
                {isApproved && (
                  <div className="flex items-center justify-between p-3 rounded bg-muted">
                    <div>
                      <p className="font-medium text-sm">Restaurant Open</p>
                      <p className="text-xs text-muted-foreground">Toggle off to pause new orders</p>
                    </div>
                    <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                  </div>
                )}
              </fieldset>

              {!locked && (status === 'new' || isRejected) && missing.length > 0 && (
                <div className="text-xs text-muted-foreground p-3 rounded bg-muted">
                  Missing: {missing.map((m) => m.label).join(', ')}
                </div>
              )}

              {status === 'new' && (
                <Button onClick={() => save(true)} disabled={saving || !canSubmit} className="w-full gradient-primary">
                  {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Submit for Approval
                </Button>
              )}
              {isRejected && (
                <Button onClick={() => save(true)} disabled={saving || !canSubmit} className="w-full gradient-primary">
                  {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Resubmit for Approval
                </Button>
              )}
              {isApproved && (
                <Button onClick={() => save(false)} disabled={saving} className="w-full gradient-primary">
                  {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Save Changes
                </Button>
              )}
              {isPending && (
                <Button disabled className="w-full">Locked — under admin review</Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
