import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Download, Database, HardDrive, Loader2, ShieldCheck, Github, Cloud, ExternalLink } from 'lucide-react';
import JSZip from 'jszip';

const TABLES = [
  'profiles', 'user_roles', 'restaurants', 'menu_categories', 'menu_items',
  'orders', 'order_items', 'payments', 'riders', 'rider_wallets',
  'rider_earnings', 'rider_withdrawals', 'ratings', 'addresses',
  'favorite_restaurants', 'notifications', 'notification_preferences',
  'platform_settings', 'support_conversations', 'support_messages',
  'app_releases', 'restaurant_location_change_requests',
] as const;

const LS_KEY = 'fx_backup_settings_v1';

type BackupSettings = {
  driveEnabled: boolean;
  driveFolderId: string;
  githubEnabled: boolean;
  githubOwner: string;
  githubRepo: string;
  githubBranch: string;
  githubPath: string;
  downloadLocal: boolean;
};

const DEFAULTS: BackupSettings = {
  driveEnabled: true,
  driveFolderId: '',
  githubEnabled: true,
  githubOwner: '',
  githubRepo: '',
  githubBranch: 'main',
  githubPath: 'backups',
  downloadLocal: true,
};

// Convert Blob to base64 (chunked to avoid stack overflows on large files)
async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < buf.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, Array.from(buf.subarray(i, i + CHUNK)) as any);
  }
  return btoa(binary);
}

export default function AdminBackup() {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string>('');
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [settings, setSettings] = useState<BackupSettings>(DEFAULTS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setSettings({ ...DEFAULTS, ...JSON.parse(raw) });
    } catch {}
  }, []);

  const updateSetting = <K extends keyof BackupSettings>(key: K, value: BackupSettings[K]) => {
    setSettings((s) => {
      const next = { ...s, [key]: value };
      localStorage.setItem(LS_KEY, JSON.stringify(next));
      return next;
    });
  };

  const runBackup = async () => {
    if (!settings.driveEnabled && !settings.githubEnabled && !settings.downloadLocal) {
      toast.error('Kam se kam ek destination select karein');
      return;
    }
    if (settings.githubEnabled && (!settings.githubOwner || !settings.githubRepo)) {
      toast.error('GitHub owner aur repo zaruri hain');
      return;
    }

    setBusy(true);
    setCounts({});
    const zip = new JSZip();
    const folder = zip.folder('database')!;
    const summary: Record<string, number> = {};

    try {
      for (const t of TABLES) {
        setProgress(`Fetching ${t}...`);
        const pageSize = 1000;
        let from = 0;
        let all: any[] = [];
        while (true) {
          const { data, error } = await supabase.from(t as any).select('*').range(from, from + pageSize - 1);
          if (error) throw new Error(`${t}: ${error.message}`);
          if (!data || data.length === 0) break;
          all = all.concat(data);
          if (data.length < pageSize) break;
          from += pageSize;
        }
        folder.file(`${t}.json`, JSON.stringify(all, null, 2));
        summary[t] = all.length;
        setCounts({ ...summary });
      }

      const manifest = {
        generated_at: new Date().toISOString(),
        project: 'Food Express',
        tables: summary,
      };
      zip.file('manifest.json', JSON.stringify(manifest, null, 2));
      zip.file(
        'RESTORE_INSTRUCTIONS.txt',
        'Food Express Backup — restore order: profiles -> user_roles -> restaurants -> menu_categories -> menu_items -> riders -> rider_wallets -> orders -> order_items -> payments -> baqi.\n'
      );

      setProgress('Compressing ZIP...');
      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `food-express-backup-${stamp}.zip`;

      // 1) Local download
      if (settings.downloadLocal) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }

      // 2) Upload to Drive / GitHub via edge function
      if (settings.driveEnabled || settings.githubEnabled) {
        setProgress('Uploading to cloud...');
        const b64 = await blobToBase64(blob);
        const payload: any = { filename, zipBase64: b64 };
        if (settings.driveEnabled) payload.drive = { folderId: settings.driveFolderId || undefined };
        if (settings.githubEnabled) payload.github = {
          owner: settings.githubOwner,
          repo: settings.githubRepo,
          branch: settings.githubBranch || undefined,
          path: settings.githubPath || 'backups',
        };

        const { data, error } = await supabase.functions.invoke('backup-upload', { body: payload });
        if (error) throw new Error(error.message);
        if (!data?.ok) throw new Error(data?.error || 'Upload failed');

        const r = data.results || {};
        if (r.drive) {
          if (r.drive.ok) {
            toast.success('Google Drive par upload ho gaya', {
              action: r.drive.file?.webViewLink ? { label: 'Open', onClick: () => window.open(r.drive.file.webViewLink, '_blank') } : undefined,
            });
          } else {
            toast.error(`Drive upload failed: ${r.drive.error?.slice?.(0, 200) || 'error'}`);
          }
        }
        if (r.github) {
          if (r.github.ok) {
            toast.success('GitHub par push ho gaya', {
              action: r.github.file?.content?.html_url ? { label: 'Open', onClick: () => window.open(r.github.file.content.html_url, '_blank') } : undefined,
            });
          } else {
            toast.error(`GitHub push failed: ${r.github.error?.slice?.(0, 200) || 'error'}`);
          }
        }
      }

      toast.success('Backup complete');
      setProgress('Done');
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Backup failed');
      setProgress('Failed');
    } finally {
      setBusy(false);
    }
  };

  const totalRows = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Backup Center</h1>
        <p className="text-muted-foreground text-sm">
          Backup seedha Google Drive aur GitHub par upload hoga. Settings save ho jati hain.
        </p>
      </div>

      {/* Destinations */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Google Drive */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Cloud className="h-5 w-5" /> Google Drive
              </CardTitle>
              <Switch
                checked={settings.driveEnabled}
                onCheckedChange={(v) => updateSetting('driveEnabled', v)}
              />
            </div>
            <CardDescription>Connected. Apna folder ID paste karein.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label htmlFor="folderId" className="text-xs">Folder ID</Label>
              <Input
                id="folderId"
                placeholder="1AbC...xyz"
                value={settings.driveFolderId}
                onChange={(e) => updateSetting('driveFolderId', e.target.value.trim())}
                disabled={!settings.driveEnabled}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Drive folder open karein → URL se <code>/folders/</code> ke baad ka hissa copy karein.
                Khali chhorna = root (My Drive) par save.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* GitHub */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Github className="h-5 w-5" /> GitHub Repo
              </CardTitle>
              <Switch
                checked={settings.githubEnabled}
                onCheckedChange={(v) => updateSetting('githubEnabled', v)}
              />
            </div>
            <CardDescription>Har backup ek commit ke tor par push hoga.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Owner</Label>
                <Input
                  placeholder="username or org"
                  value={settings.githubOwner}
                  onChange={(e) => updateSetting('githubOwner', e.target.value.trim())}
                  disabled={!settings.githubEnabled}
                />
              </div>
              <div>
                <Label className="text-xs">Repo</Label>
                <Input
                  placeholder="food-express-backups"
                  value={settings.githubRepo}
                  onChange={(e) => updateSetting('githubRepo', e.target.value.trim())}
                  disabled={!settings.githubEnabled}
                />
              </div>
              <div>
                <Label className="text-xs">Branch</Label>
                <Input
                  placeholder="main"
                  value={settings.githubBranch}
                  onChange={(e) => updateSetting('githubBranch', e.target.value.trim())}
                  disabled={!settings.githubEnabled}
                />
              </div>
              <div>
                <Label className="text-xs">Path</Label>
                <Input
                  placeholder="backups"
                  value={settings.githubPath}
                  onChange={(e) => updateSetting('githubPath', e.target.value.trim())}
                  disabled={!settings.githubEnabled}
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Note: Repo pehle se exist karna chahiye aur connected GitHub account ko us par push access ho.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Extra: local download */}
      <Card>
        <CardContent className="pt-4 flex items-center justify-between">
          <div>
            <div className="font-medium text-sm">Local Download</div>
            <div className="text-xs text-muted-foreground">Backup ZIP browser mein bhi download karein.</div>
          </div>
          <Switch
            checked={settings.downloadLocal}
            onCheckedChange={(v) => updateSetting('downloadLocal', v)}
          />
        </CardContent>
      </Card>

      {/* Database backup card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" /> Run Backup
          </CardTitle>
          <CardDescription>
            {TABLES.length} tables ka JSON export ZIP mein compress ho ke selected destinations par jayega.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {TABLES.map((t) => (
              <Badge key={t} variant="secondary" className="font-mono text-xs">
                {t}
                {counts[t] != null && <span className="ml-1 text-primary">({counts[t]})</span>}
              </Badge>
            ))}
          </div>

          {busy && (
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> {progress}
            </div>
          )}
          {!busy && totalRows > 0 && (
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-green-600" />
              Last export: {totalRows.toLocaleString()} rows
            </div>
          )}

          <Button onClick={runBackup} disabled={busy} size="lg" className="w-full sm:w-auto">
            {busy ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Running...</>
            ) : (
              <><Download className="mr-2 h-4 w-4" /> Run Backup Now</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Storage backup card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" /> Storage / Files Backup
          </CardTitle>
          <CardDescription>
            Uploaded files (avatars, rider documents, APKs) alag se export karein.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Cloud tab → <b>Advanced settings → Export data</b> se database + storage ka full backup lein.
        </CardContent>
      </Card>
    </div>
  );
}
