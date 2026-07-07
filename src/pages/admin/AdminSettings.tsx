import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Loader2, Save } from 'lucide-react';

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
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('*')
        .limit(1)
        .maybeSingle();
      if (error) toast.error('Failed to load settings');
      else setSettings(data as Settings);
      setLoading(false);
    })();
  }, []);

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((s) => (s ? { ...s, [key]: value } : s));
  };

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    const { id, ...payload } = settings;
    const { error } = await supabase
      .from('platform_settings')
      .update(payload)
      .eq('id', id);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success('Settings saved');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!settings) {
    return <p className="text-muted-foreground">No settings found.</p>;
  }

  const num = (v: string) => (v === '' ? 0 : Number(v));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Platform Settings</h2>
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save changes
        </Button>
      </div>

      <Tabs defaultValue="delivery">
        <TabsList className="grid grid-cols-3 md:grid-cols-5 w-full md:w-auto">
          <TabsTrigger value="delivery">Delivery</TabsTrigger>
          <TabsTrigger value="rider">Rider</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="platform">Platform</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="delivery">
          <Card>
            <CardHeader>
              <CardTitle>Delivery Pricing</CardTitle>
              <CardDescription>Customer-facing delivery fee rules.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Base fare (PKR)</Label>
                <Input type="number" value={settings.base_fare} onChange={(e) => update('base_fare', num(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>Included distance (km)</Label>
                <Input type="number" value={settings.base_distance_km} onChange={(e) => update('base_distance_km', num(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>Per extra km rate (PKR)</Label>
                <Input type="number" value={settings.per_km_rate} onChange={(e) => update('per_km_rate', num(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>Max delivery radius (km)</Label>
                <Input type="number" value={settings.max_delivery_radius_km} onChange={(e) => update('max_delivery_radius_km', num(e.target.value))} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rider">
          <Card>
            <CardHeader>
              <CardTitle>Rider Earnings Tiers</CardTitle>
              <CardDescription>How much riders earn per delivery.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Tier 1 amount (PKR)</Label>
                <Input type="number" value={settings.rider_tier1_amount} onChange={(e) => update('rider_tier1_amount', num(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>Tier 1 up to (km)</Label>
                <Input type="number" value={settings.rider_tier1_max_km} onChange={(e) => update('rider_tier1_max_km', num(e.target.value))} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Tier 2 amount — beyond tier 1 distance (PKR)</Label>
                <Input type="number" value={settings.rider_tier2_amount} onChange={(e) => update('rider_tier2_amount', num(e.target.value))} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card>
            <CardHeader>
              <CardTitle>Payment Methods</CardTitle>
              <CardDescription>Enable or disable customer payment options.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { key: 'cod_enabled', label: 'Cash on Delivery' },
                { key: 'easypaisa_enabled', label: 'EasyPaisa' },
                { key: 'jazzcash_enabled', label: 'JazzCash' },
                { key: 'stripe_enabled', label: 'Stripe (Card)' },
              ].map((m) => (
                <div key={m.key} className="flex items-center justify-between border rounded-lg p-4">
                  <Label className="text-base">{m.label}</Label>
                  <Switch
                    checked={settings[m.key as keyof Settings] as boolean}
                    onCheckedChange={(v) => update(m.key as keyof Settings, v as never)}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="platform">
          <Card>
            <CardHeader>
              <CardTitle>Platform Info & Hours</CardTitle>
              <CardDescription>Branding, support contact, and operating hours.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Platform name</Label>
                <Input value={settings.platform_name} onChange={(e) => update('platform_name', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Operating city</Label>
                <Input value={settings.operating_city} onChange={(e) => update('operating_city', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Support phone</Label>
                <Input value={settings.support_phone ?? ''} onChange={(e) => update('support_phone', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Support email</Label>
                <Input type="email" value={settings.support_email ?? ''} onChange={(e) => update('support_email', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Opening time</Label>
                <Input type="time" value={settings.opening_time?.slice(0, 5)} onChange={(e) => update('opening_time', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Closing time</Label>
                <Input type="time" value={settings.closing_time?.slice(0, 5)} onChange={(e) => update('closing_time', e.target.value)} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Global Notification Controls</CardTitle>
              <CardDescription>
                Turn platform-wide notification channels on/off. Individual users can further customize their own preferences from their profile.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
    </div>
  );
}
