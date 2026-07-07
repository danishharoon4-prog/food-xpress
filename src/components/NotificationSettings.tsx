import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Bell, Loader2, Volume2 } from 'lucide-react';
import { DEFAULT_PREFS, EVENT_LABELS, NotifPrefs } from '@/lib/notificationPrefs';
import { ensurePushSubscription } from '@/lib/pushSubscription';
import { fireBrowserNotification, requestNotificationPermission } from '@/lib/browserNotify';
import { isLovablePreviewNotificationContext, openNotificationPermissionTab } from '@/lib/notificationPermission';

export function NotificationSettings() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<NotifPrefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEmbeddedPreview, setIsEmbeddedPreview] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      setPrefs(data ? (data as NotifPrefs) : { user_id: user.id, ...DEFAULT_PREFS });
      setLoading(false);
    })();
  }, [user]);

  useEffect(() => {
    setIsEmbeddedPreview(isLovablePreviewNotificationContext());
    const syncPermission = () => {
      if (typeof Notification !== 'undefined') setPermission(Notification.permission);
    };
    window.addEventListener('focus', syncPermission);
    document.addEventListener('visibilitychange', syncPermission);
    return () => {
      window.removeEventListener('focus', syncPermission);
      document.removeEventListener('visibilitychange', syncPermission);
    };
  }, []);

  const set = <K extends keyof NotifPrefs>(key: K, v: NotifPrefs[K]) => {
    setPrefs((p) => (p ? { ...p, [key]: v } : p));
  };

  const save = async () => {
    if (!prefs || !user) return;
    setSaving(true);
    const { error } = await supabase
      .from('notification_preferences')
      .upsert({ ...prefs, user_id: user.id }, { onConflict: 'user_id' });
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success('Notification settings saved');
  };

  const enableBrowserPush = async () => {
    if (isEmbeddedPreview) {
      openNotificationPermissionTab();
      toast.info('Browser blocks notification permission inside preview. Use the new tab and tap Enable there.');
      return;
    }
    if (typeof window === 'undefined' || typeof Notification === 'undefined') {
      toast.error('This browser does not support notifications');
      return;
    }
    if (Notification.permission === 'denied') {
      toast.error('Notifications are blocked. Enable them in your browser site settings, then reload.');
      return;
    }
    try {
      // Must be called synchronously from the click (no awaits before this line).
      const p = await requestNotificationPermission();
      setPermission(p);
      if (p !== 'granted') {
        toast.error('Notification permission was not granted');
        return;
      }
      toast.success('Browser notifications enabled');
      // Try to also register background push (only works in production/live app).
      try {
        const ok = await ensurePushSubscription();
        if (ok) toast.success('Background push enabled on this device');
      } catch {
        /* silent — background push only works on the published app */
      }
    } catch (e: any) {
      toast.error(e?.message || 'Could not enable notifications');
    }
  };

  const sendTest = async () => {
    if (Notification.permission !== 'granted') {
      toast.error('Enable notifications first');
      return;
    }
    try {
      await fireBrowserNotification('Test Notification', 'Your notifications are working ✅');
      toast.success('Test notification sent');
    } catch {
      toast.error('Could not fire test notification');
    }
  };

  if (loading || !prefs) {
    return (
      <Card>
        <CardContent className="flex justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Bell className="w-5 h-5 text-primary" />
          Notification Settings
        </CardTitle>
        <CardDescription>Control which alerts you want to receive.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Permission block */}
        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-medium">Browser permission</p>
              <p className="text-sm text-muted-foreground">
                Status:{' '}
                <span className={
                  isEmbeddedPreview
                    ? 'text-[hsl(var(--warning))] font-medium'
                    : permission === 'granted'
                    ? 'text-[hsl(var(--success))] font-medium'
                    : permission === 'denied'
                    ? 'text-destructive font-medium'
                    : 'text-[hsl(var(--warning))] font-medium'
                }>
                  {isEmbeddedPreview ? 'open app tab required' : permission}
                </span>
              </p>
              {isEmbeddedPreview && (
                <p className="text-xs text-muted-foreground mt-1">
                  Browser permission prompts are blocked inside preview. Open this app in a browser tab, then tap Enable there.
                </p>
              )}
              {permission === 'denied' && (
                <p className="text-xs text-muted-foreground mt-1">
                  Notifications are blocked for this site. Click the lock icon in the address bar → Site settings → allow Notifications, then reload.
                </p>
              )}
            </div>
            {isEmbeddedPreview ? (
              <Button size="sm" onClick={enableBrowserPush}>Open app</Button>
            ) : permission === 'granted' ? (
              <Button size="sm" variant="outline" onClick={sendTest}>Send test</Button>
            ) : permission === 'denied' ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => toast.info('Open browser site settings, allow Notifications for this app, then return here.')}
              >
                How to allow
              </Button>
            ) : (
              <Button size="sm" onClick={enableBrowserPush}>Enable</Button>
            )}
          </div>
        </div>


        {/* Master toggles */}
        <div className="space-y-3">
          <ToggleRow
            label="Push notifications"
            desc="Receive notifications on this device, even when the app is closed."
            checked={prefs.push_enabled}
            onChange={(v) => set('push_enabled', v)}
          />
          <ToggleRow
            label="In-app toast popups"
            desc="Show a small popup inside the app for updates."
            checked={prefs.toast_enabled}
            onChange={(v) => set('toast_enabled', v)}
          />
          <ToggleRow
            label={<span className="flex items-center gap-2"><Volume2 className="w-4 h-4" /> Sound</span>}
            desc="Play a subtle sound with in-app notifications."
            checked={prefs.sound_enabled}
            onChange={(v) => set('sound_enabled', v)}
          />
        </div>

        <Separator />

        <div>
          <p className="font-medium mb-3">Order events</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {EVENT_LABELS.map(({ key, label }) => (
              <label
                key={key}
                className="flex items-center justify-between rounded-lg border px-3 py-2"
              >
                <span className="text-sm">{label}</span>
                <Switch
                  checked={prefs[key] as boolean}
                  onCheckedChange={(v) => set(key, v as never)}
                />
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save preferences
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ToggleRow({
  label,
  desc,
  checked,
  onChange,
}: {
  label: React.ReactNode;
  desc?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-4">
      <div className="pr-4">
        <Label className="text-base">{label}</Label>
        {desc && <p className="text-sm text-muted-foreground mt-1">{desc}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
