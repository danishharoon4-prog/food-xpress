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
import { Loader2, User, Store, CheckCircle2, Clock, XCircle, AlertCircle, MapPin, Lock, Send, Bell, Camera, Eye, ImageIcon } from 'lucide-react';
import { LocationPicker } from '@/components/LocationPicker';
import ImageCropInput from '@/components/ImageCropInput';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { NotificationSettings } from '@/components/NotificationSettings';

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
    name: '', description: '', cuisine_type: '', address: '', image_url: '', logo_url: '',
    opening_time: '09:00', closing_time: '22:00', is_active: true,
    latitude: null as number | null, longitude: null as number | null,
  });
  const [personal, setPersonal] = useState({ full_name: '', phone: '', email: '' });

  // Location change request state
  const [changeOpen, setChangeOpen] = useState(false);
  const [changeAddress, setChangeAddress] = useState('');
  const [changeCoords, setChangeCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [changeReason, setChangeReason] = useState('');
  const [submittingChange, setSubmittingChange] = useState(false);
  const [pendingRequest, setPendingRequest] = useState<any>(null);
  const [viewImage, setViewImage] = useState<string | null>(null);

  useEffect(() => {
    if (restaurant) {
      setForm({
        name: restaurant.name || '',
        description: restaurant.description || '',
        cuisine_type: restaurant.cuisine_type || '',
        address: restaurant.address || '',
        image_url: restaurant.image_url || '',
        logo_url: restaurant.logo_url || '',
        opening_time: restaurant.opening_time?.slice(0, 5) || '09:00',
        closing_time: restaurant.closing_time?.slice(0, 5) || '22:00',
        is_active: restaurant.is_active ?? true,
        latitude: restaurant.latitude ?? null,
        longitude: restaurant.longitude ?? null,
      });
    }
  }, [restaurant]);

  useEffect(() => {
    if (!restaurant?.id) return;
    (async () => {
      const { data } = await supabase
        .from('restaurant_location_change_requests' as any)
        .select('*')
        .eq('restaurant_id', restaurant.id)
        .eq('status', 'pending')
        .maybeSingle();
      setPendingRequest(data || null);
    })();
  }, [restaurant?.id]);

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
      // Address fields are locked after approval (changed via admin request)
      if (isApproved) {
        delete payload.address;
        delete payload.latitude;
        delete payload.longitude;
      }
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
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="personal"><User className="w-4 h-4 mr-2" />Personal</TabsTrigger>
          <TabsTrigger value="restaurant"><Store className="w-4 h-4 mr-2" />Restaurant</TabsTrigger>
          <TabsTrigger value="notifications"><Bell className="w-4 h-4 mr-2" />Notifications</TabsTrigger>
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
                <div className="flex items-center gap-4 p-4 rounded-xl border bg-gradient-to-br from-primary/5 to-transparent">
                  <button
                    type="button"
                    onClick={() => form.logo_url && setViewImage(form.logo_url)}
                    className="relative shrink-0 group"
                    title={form.logo_url ? 'View logo' : 'No logo yet'}
                  >
                    <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-primary/20 bg-background flex items-center justify-center shadow-md">
                      {form.logo_url ? (
                        <img src={form.logo_url} alt="Restaurant logo" className="w-full h-full object-cover" />
                      ) : (
                        <Store className="w-10 h-10 text-muted-foreground" />
                      )}
                    </div>
                    {form.logo_url && (
                      <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Eye className="w-6 h-6 text-white" />
                      </div>
                    )}
                    <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg border-2 border-background">
                      <Camera className="w-4 h-4" />
                    </div>
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">Restaurant Logo</p>
                    <p className="text-xs text-muted-foreground mb-2">Square image shown as your profile avatar {form.logo_url && '· click avatar to view'}</p>
                    <ImageCropInput
                      label=""
                      value={form.logo_url}
                      onChange={(v) => setForm({ ...form, logo_url: v })}
                      aspect={1}
                      previewClassName="hidden"
                    />
                  </div>
                </div>
                <div><Label>{req('Restaurant Name')}</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Karachi Biryani House" /></div>
                <div><Label>{req('Description')}</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} placeholder="Tell customers about your restaurant..." /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>{req('Cuisine')}</Label><Input value={form.cuisine_type} onChange={(e) => setForm({ ...form, cuisine_type: e.target.value })} placeholder="e.g. Pakistani" /></div>
                  <div><Label>City</Label><Input value="Mansehra" disabled /></div>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    {req('Restaurant Location')}
                    {isApproved && <Lock className="w-3.5 h-3.5 text-muted-foreground" />}
                  </Label>
                  {isApproved ? (
                    <div className="space-y-2">
                      <div className="p-3 rounded-md border bg-muted/40">
                        <div className="flex items-start gap-2 text-sm">
                          <MapPin className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                          <div className="flex-1">
                            <p className="font-medium">{form.address || 'No address set'}</p>
                            {form.latitude && form.longitude && (
                              <p className="text-xs text-muted-foreground mt-1">
                                📍 {Number(form.latitude).toFixed(6)}, {Number(form.longitude).toFixed(6)}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      {pendingRequest ? (
                        <div className="p-3 rounded-md border border-warning bg-warning/5 text-xs">
                          <p className="font-semibold flex items-center gap-1 text-warning">
                            <Clock className="w-3.5 h-3.5" /> Change request pending admin review
                          </p>
                          <p className="text-muted-foreground mt-1">Requested: {pendingRequest.requested_address}</p>
                        </div>
                      ) : (
                        <Button type="button" variant="outline" size="sm" onClick={() => {
                          setChangeAddress(form.address || '');
                          setChangeCoords(form.latitude && form.longitude ? { latitude: Number(form.latitude), longitude: Number(form.longitude) } : null);
                          setChangeReason('');
                          setChangeOpen(true);
                        }}>
                          <Send className="w-3.5 h-3.5 mr-1.5" /> Request Address Change
                        </Button>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Your address is locked. To change it, submit a request — an admin will review and apply it.
                      </p>
                    </div>
                  ) : (
                    <>
                      <LocationPicker
                        value={form.address}
                        onChange={(addr, coords) => setForm({
                          ...form,
                          address: addr,
                          latitude: coords?.latitude ?? form.latitude,
                          longitude: coords?.longitude ?? form.longitude,
                        })}
                        placeholder="Pin your restaurant location on the map..."
                      />
                      <p className="text-xs text-muted-foreground">
                        Drag the pin or tap the map to set your exact restaurant location. Once approved, the address can only be changed by admin.
                      </p>
                    </>
                  )}
                </div>
                <div>
                  <Label className="flex items-center justify-between">
                    {req('Cover Image')}
                    {form.image_url && (
                      <button type="button" onClick={() => setViewImage(form.image_url)} className="text-xs text-primary hover:underline flex items-center gap-1">
                        <Eye className="w-3 h-3" /> View
                      </button>
                    )}
                  </Label>
                  <ImageCropInput label="" value={form.image_url} onChange={(v) => setForm({ ...form, image_url: v })} aspect={16/9} previewClassName="w-full h-32 object-cover rounded-md border cursor-pointer hover:opacity-90 transition-opacity" />
                </div>
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

              {!locked && (status === 'new' || isRejected) && (missing.length > 0 || personalIncomplete) && (
                <div className="text-xs text-warning p-3 rounded bg-warning/10 border border-warning/30">
                  <p className="font-semibold mb-1">Complete the following to submit:</p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    {personalIncomplete && <li>Personal tab: Full name &amp; phone</li>}
                    {missing.map((m) => <li key={m.key}>{m.label}</li>)}
                  </ul>
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

        <TabsContent value="notifications" className="mt-4">
          <NotificationSettings />
        </TabsContent>
      </Tabs>

      <Dialog open={changeOpen} onOpenChange={setChangeOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Request Address Change</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Pin the new location on the map. Your request will be sent to admin for approval.
            </p>
            <LocationPicker
              value={changeAddress}
              onChange={(addr, coords) => {
                setChangeAddress(addr);
                if (coords) setChangeCoords(coords);
              }}
              placeholder="Pin new restaurant location..."
            />
            <div>
              <Label>Reason (optional)</Label>
              <Textarea
                value={changeReason}
                onChange={(e) => setChangeReason(e.target.value)}
                rows={2}
                placeholder="Why are you changing the location?"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangeOpen(false)}>Cancel</Button>
            <Button
              disabled={submittingChange || !changeAddress.trim() || !changeCoords}
              onClick={async () => {
                if (!restaurant?.id || !user?.id || !changeCoords) return;
                setSubmittingChange(true);
                const { data, error } = await supabase
                  .from('restaurant_location_change_requests' as any)
                  .insert({
                    restaurant_id: restaurant.id,
                    requested_by: user.id,
                    requested_address: changeAddress,
                    requested_latitude: changeCoords.latitude,
                    requested_longitude: changeCoords.longitude,
                    reason: changeReason || null,
                  })
                  .select()
                  .single();
                setSubmittingChange(false);
                if (error) {
                  toast({ title: 'Failed to submit', description: error.message, variant: 'destructive' });
                  return;
                }
                setPendingRequest(data);
                setChangeOpen(false);
                toast({ title: 'Request submitted', description: 'Admin will review your location change shortly.' });
              }}
            >
              {submittingChange && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
