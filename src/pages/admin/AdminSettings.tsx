import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AvatarUploader from '@/components/AvatarUploader';
import { NotificationSettings } from '@/components/NotificationSettings';
import { MotionSettings } from '@/components/MotionSettings';
import { NavigationSettings } from '@/components/NavigationSettings';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Loader2, Save, RotateCcw, Truck, Bike, Wallet, Building2, Bell,
  Calculator, Phone, Mail, MapPin, Clock, CheckCircle2, XCircle,
} from 'lucide-react';

type Settings = {
  id: string;
  base_fare: number;
  base_distance_km: number;
  per_km_rate: number;
  max_delivery_radius_km: number;
  rider_tier1_amount: number;
  rider_tier1_max_km: number;
  rider_tier2_amount: number;
  cod_enabled: boolean;
  easypaisa_enabled: boolean;
  jazzcash_enabled: boolean;
  stripe_enabled: boolean;
  platform_name: string;
  support_phone: string | null;
  support_email: string | null;
  operating_city: string;
  opening_time: string;
  closing_time: string;
  notifications_sound_enabled: boolean;
  notifications_toast_enabled: boolean;
  notifications_push_enabled: boolean;
};

export default function AdminSettings() {
  const { user, profile, refreshProfile } = useAuth();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [original, setOriginal] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewDistance, setPreviewDistance] = useState(6);

  const load = async () => {
    const { data, error } = await supabase
      .from('platform_settings').select('*').limit(1).maybeSingle();
    if (error) toast.error('Failed to load settings');
    else {
      setSettings(data as Settings);
      setOriginal(data as Settings);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((s) => (s ? { ...s, [key]: value } : s));
  };

  const dirty = useMemo(() => {
    if (!settings || !original) return false;
    return JSON.stringify(settings) !== JSON.stringify(original);
  }, [settings, original]);

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    const { id, ...payload } = settings;
    const { error } = await supabase.from('platform_settings').update(payload).eq('id', id);
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success('Settings saved');
      setOriginal(settings);
    }
  };

  const reset = () => {
    if (original) setSettings(original);
    toast.info('Changes discarded');
  };

  const deliveryPreview = useMemo(() => {
    if (!settings) return 0;
    const { base_fare, base_distance_km, per_km_rate } = settings;
    if (previewDistance <= base_distance_km) return base_fare;
    return base_fare + Math.ceil(previewDistance - base_distance_km) * per_km_rate;
  }, [settings, previewDistance]);

  const riderEarningPreview = useMemo(() => {
    if (!settings) return 0;
    return previewDistance <= settings.rider_tier1_max_km
      ? settings.rider_tier1_amount
      : settings.rider_tier2_amount;
  }, [settings, previewDistance]);

  const enabledPayments = useMemo(() => {
    if (!settings) return 0;
    return [settings.cod_enabled, settings.easypaisa_enabled, settings.jazzcash_enabled, settings.stripe_enabled]
      .filter(Boolean).length;
  }, [settings]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!settings) return <p className="text-muted-foreground">No settings found.</p>;

  const num = (v: string) => (v === '' ? 0 : Number(v));

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold">Platform Settings</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Configure delivery pricing, rider earnings, payments, branding, and notifications.
          </p>
        </div>
        {dirty && (
          <Badge variant="outline" className="border-warning/40 text-warning">
            Unsaved changes
          </Badge>
        )}
      </div>

      {/* Admin profile photo */}
      {user && (
        <Card>
          <CardHeader>
            <CardTitle>Your Profile Photo</CardTitle>
            <CardDescription>Visible to customers, riders, and restaurants you interact with.</CardDescription>
          </CardHeader>
          <CardContent>
            <AvatarUploader
              userId={user.id}
              fullName={profile?.full_name}
              email={profile?.email}
              onChanged={() => refreshProfile()}
            />
          </CardContent>
        </Card>
      )}

      {/* Quick summary */}
      <div className="grid gap-3 md:grid-cols-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><Truck className="w-4 h-4 text-primary" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Base Fare</p>
              <p className="font-semibold">PKR {settings.base_fare}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-info/10"><Bike className="w-4 h-4 text-info" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Rider Tier 1</p>
              <p className="font-semibold">PKR {settings.rider_tier1_amount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/10"><Wallet className="w-4 h-4 text-success" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Payment Methods</p>
              <p className="font-semibold">{enabledPayments} enabled</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning/10"><Clock className="w-4 h-4 text-warning" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Hours</p>
              <p className="font-semibold">{settings.opening_time?.slice(0,5)} – {settings.closing_time?.slice(0,5)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="delivery">
        <TabsList className="grid grid-cols-3 md:grid-cols-5 w-full md:w-auto">
          <TabsTrigger value="delivery"><Truck className="w-4 h-4 mr-1.5" />Delivery</TabsTrigger>
          <TabsTrigger value="rider"><Bike className="w-4 h-4 mr-1.5" />Rider</TabsTrigger>
          <TabsTrigger value="payments"><Wallet className="w-4 h-4 mr-1.5" />Payments</TabsTrigger>
          <TabsTrigger value="platform"><Building2 className="w-4 h-4 mr-1.5" />Platform</TabsTrigger>
          <TabsTrigger value="notifications"><Bell className="w-4 h-4 mr-1.5" />Notify</TabsTrigger>
        </TabsList>

        {/* DELIVERY */}
        <TabsContent value="delivery" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Delivery Pricing</CardTitle>
              <CardDescription>
                Customers pay <b>Base fare</b> for the first <b>Included distance</b>, then <b>Per extra km rate</b> for each additional km (rounded up).
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Base fare (PKR)</Label>
                <Input type="number" min={0} value={settings.base_fare} onChange={(e) => update('base_fare', num(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>Included distance (km)</Label>
                <Input type="number" min={0} value={settings.base_distance_km} onChange={(e) => update('base_distance_km', num(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>Per extra km rate (PKR)</Label>
                <Input type="number" min={0} value={settings.per_km_rate} onChange={(e) => update('per_km_rate', num(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>Max delivery radius (km)</Label>
                <Input type="number" min={0} value={settings.max_delivery_radius_km} onChange={(e) => update('max_delivery_radius_km', num(e.target.value))} />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-muted/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Calculator className="w-4 h-4" /> Fee Preview
              </CardTitle>
              <CardDescription>Try a distance to preview the customer fare and rider earning.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <Label className="w-24">Distance</Label>
                <Input
                  type="number" min={0} step={0.5}
                  value={previewDistance}
                  onChange={(e) => setPreviewDistance(Number(e.target.value) || 0)}
                  className="max-w-[140px]"
                />
                <span className="text-sm text-muted-foreground">km</span>
              </div>
              <Separator />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="p-3 rounded-lg bg-background border">
                  <p className="text-xs text-muted-foreground">Customer pays</p>
                  <p className="text-xl font-bold text-primary">PKR {deliveryPreview.toLocaleString()}</p>
                </div>
                <div className="p-3 rounded-lg bg-background border">
                  <p className="text-xs text-muted-foreground">Rider earns</p>
                  <p className="text-xl font-bold text-success">PKR {riderEarningPreview.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* RIDER */}
        <TabsContent value="rider">
          <Card>
            <CardHeader>
              <CardTitle>Rider Earnings Tiers</CardTitle>
              <CardDescription>
                Riders earn <b>Tier 1</b> amount for deliveries up to <b>Tier 1 max km</b>, otherwise <b>Tier 2</b>.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Tier 1 amount (PKR)</Label>
                <Input type="number" min={0} value={settings.rider_tier1_amount} onChange={(e) => update('rider_tier1_amount', num(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>Tier 1 up to (km)</Label>
                <Input type="number" min={0} value={settings.rider_tier1_max_km} onChange={(e) => update('rider_tier1_max_km', num(e.target.value))} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Tier 2 amount — beyond tier 1 distance (PKR)</Label>
                <Input type="number" min={0} value={settings.rider_tier2_amount} onChange={(e) => update('rider_tier2_amount', num(e.target.value))} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PAYMENTS */}
        <TabsContent value="payments">
          <Card>
            <CardHeader>
              <CardTitle>Payment Methods</CardTitle>
              <CardDescription>Enable or disable customer payment options at checkout.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              {[
                { key: 'cod_enabled', label: 'Cash on Delivery', desc: 'Pay the rider in cash on delivery.' },
                { key: 'easypaisa_enabled', label: 'EasyPaisa', desc: 'Mobile wallet transfer.' },
                { key: 'jazzcash_enabled', label: 'JazzCash', desc: 'Mobile wallet transfer.' },
                { key: 'stripe_enabled', label: 'Stripe (Card)', desc: 'Debit/Credit card via Stripe.' },
              ].map((m) => {
                const enabled = settings[m.key as keyof Settings] as boolean;
                return (
                  <div key={m.key} className={`flex items-start justify-between border rounded-lg p-4 gap-4 ${enabled ? 'bg-success/5 border-success/30' : ''}`}>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Label className="text-base">{m.label}</Label>
                        {enabled ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{m.desc}</p>
                    </div>
                    <Switch
                      checked={enabled}
                      onCheckedChange={(v) => update(m.key as keyof Settings, v as never)}
                    />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        {/* PLATFORM */}
        <TabsContent value="platform">
          <Card>
            <CardHeader>
              <CardTitle>Platform Info & Hours</CardTitle>
              <CardDescription>Branding, support contact, and operating hours.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> Platform name</Label>
                <Input value={settings.platform_name} onChange={(e) => update('platform_name', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> Operating city</Label>
                <Input value={settings.operating_city} onChange={(e) => update('operating_city', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> Support phone</Label>
                <Input value={settings.support_phone ?? ''} onChange={(e) => update('support_phone', e.target.value)} placeholder="+92 3XX XXXXXXX" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> Support email</Label>
                <Input type="email" value={settings.support_email ?? ''} onChange={(e) => update('support_email', e.target.value)} placeholder="support@example.com" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Opening time</Label>
                <Input type="time" value={settings.opening_time?.slice(0, 5)} onChange={(e) => update('opening_time', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Closing time</Label>
                <Input type="time" value={settings.closing_time?.slice(0, 5)} onChange={(e) => update('closing_time', e.target.value)} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* NOTIFICATIONS */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Global Notification Controls</CardTitle>
              <CardDescription>
                Platform-wide notification channels. Individual users can further customize their own preferences.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { key: 'notifications_push_enabled', label: 'Browser push notifications', desc: 'Master switch for background/native push notifications across the app.' },
                { key: 'notifications_toast_enabled', label: 'In-app toast popups', desc: 'Show toast popups inside the app when events happen.' },
                { key: 'notifications_sound_enabled', label: 'Notification sound', desc: 'Play a subtle sound with in-app notifications.' },
              ].map((m) => (
                <div key={m.key} className="flex items-start justify-between border rounded-lg p-4 gap-4">
                  <div>
                    <Label className="text-base">{m.label}</Label>
                    <p className="text-sm text-muted-foreground mt-1">{m.desc}</p>
                  </div>
                  <Switch
                    checked={settings[m.key as keyof Settings] as boolean}
                    onCheckedChange={(v) => update(m.key as keyof Settings, v as never)}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Sticky save bar */}
      <div className="fixed bottom-0 left-0 lg:left-64 right-0 bg-card/95 backdrop-blur border-t p-3 flex items-center justify-end gap-2 z-30">
        <span className="text-xs text-muted-foreground mr-auto pl-2">
          {dirty ? 'You have unsaved changes' : 'All changes saved'}
        </span>
        <Button variant="outline" size="sm" onClick={reset} disabled={!dirty || saving}>
          <RotateCcw className="w-4 h-4 mr-1.5" /> Discard
        </Button>
        <Button onClick={save} disabled={!dirty || saving} size="sm">
          {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
          Save changes
        </Button>
      </div>
    </div>
  );
}
