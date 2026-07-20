import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Zap, Loader2, RefreshCw, PlayCircle, Cloud, Github } from 'lucide-react';

type Row = {
  auto_backup_enabled: boolean;
  auto_backup_interval_minutes: number;
  auto_backup_drive_enabled: boolean;
  auto_backup_drive_folder_id: string | null;
  auto_backup_github_enabled: boolean;
  auto_backup_github_owner: string | null;
  auto_backup_github_repo: string | null;
  auto_backup_github_branch: string | null;
  auto_backup_github_path: string | null;
  auto_backup_last_run_at: string | null;
  auto_backup_last_status: string | null;
  auto_backup_last_result: any;
};

const DEFAULTS: Row = {
  auto_backup_enabled: false,
  auto_backup_interval_minutes: 60,
  auto_backup_drive_enabled: true,
  auto_backup_drive_folder_id: '',
  auto_backup_github_enabled: true,
  auto_backup_github_owner: '',
  auto_backup_github_repo: '',
  auto_backup_github_branch: 'main',
  auto_backup_github_path: 'backups',
  auto_backup_last_run_at: null,
  auto_backup_last_status: null,
  auto_backup_last_result: null,
};

export default function AutoBackupPanel() {
  const [row, setRow] = useState<Row>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('platform_settings').select('*').eq('singleton', true).maybeSingle();
    if (data) setRow({ ...DEFAULTS, ...(data as any) });
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel('platform_settings_backup')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'platform_settings' }, (p) => {
        setRow((r) => ({ ...r, ...(p.new as any) }));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const update = <K extends keyof Row>(k: K, v: Row[K]) => setRow((r) => ({ ...r, [k]: v }));

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from('platform_settings').update({
      auto_backup_enabled: row.auto_backup_enabled,
      auto_backup_interval_minutes: Math.max(5, Number(row.auto_backup_interval_minutes) || 60),
      auto_backup_drive_enabled: row.auto_backup_drive_enabled,
      auto_backup_drive_folder_id: row.auto_backup_drive_folder_id || null,
      auto_backup_github_enabled: row.auto_backup_github_enabled,
      auto_backup_github_owner: row.auto_backup_github_owner || null,
      auto_backup_github_repo: row.auto_backup_github_repo || null,
      auto_backup_github_branch: row.auto_backup_github_branch || 'main',
      auto_backup_github_path: row.auto_backup_github_path || 'backups',
    }).eq('singleton', true);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success('Auto-backup settings save ho gaeen');
  };

  const runNow = async () => {
    setRunning(true);
    const { data, error } = await supabase.functions.invoke('backup-auto', { body: { force: true } });
    setRunning(false);
    if (error) return toast.error(error.message);
    if (data?.ok) toast.success('Backup upload complete');
    else toast.error(data?.error || 'Backup failed');
    load();
  };

  const status = row.auto_backup_last_status;
  const statusColor = status === 'success' ? 'default' : status === 'error' || status === 'failed' ? 'destructive' : 'secondary';

  return (
    <Card className="border-primary/40">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" /> Automatic Backup
            </CardTitle>
            <CardDescription>
              Har {row.auto_backup_interval_minutes} minute ke bad automatically Drive + GitHub par backup ho ga.
            </CardDescription>
          </div>
          <Switch
            checked={row.auto_backup_enabled}
            onCheckedChange={(v) => update('auto_backup_enabled', v)}
            disabled={loading}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Interval (minutes)</Label>
            <Input
              type="number"
              min={5}
              value={row.auto_backup_interval_minutes}
              onChange={(e) => update('auto_backup_interval_minutes', Number(e.target.value))}
            />
            <p className="text-[11px] text-muted-foreground mt-1">Minimum 5 minutes.</p>
          </div>
          <div className="flex items-end gap-2">
            {row.auto_backup_last_run_at && (
              <div className="text-xs text-muted-foreground">
                Last run: <span className="text-foreground">{new Date(row.auto_backup_last_run_at).toLocaleString()}</span>{' '}
                {status && <Badge variant={statusColor as any} className="ml-1">{status}</Badge>}
              </div>
            )}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3 pt-2 border-t">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2 text-sm"><Cloud className="h-4 w-4" /> Google Drive</Label>
              <Switch
                checked={row.auto_backup_drive_enabled}
                onCheckedChange={(v) => update('auto_backup_drive_enabled', v)}
              />
            </div>
            <Input
              placeholder="Drive folder ID (khali = My Drive)"
              value={row.auto_backup_drive_folder_id ?? ''}
              onChange={(e) => update('auto_backup_drive_folder_id', e.target.value.trim())}
              disabled={!row.auto_backup_drive_enabled}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2 text-sm"><Github className="h-4 w-4" /> GitHub Repo</Label>
              <Switch
                checked={row.auto_backup_github_enabled}
                onCheckedChange={(v) => update('auto_backup_github_enabled', v)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="owner" value={row.auto_backup_github_owner ?? ''}
                onChange={(e) => update('auto_backup_github_owner', e.target.value.trim())}
                disabled={!row.auto_backup_github_enabled} />
              <Input placeholder="repo" value={row.auto_backup_github_repo ?? ''}
                onChange={(e) => update('auto_backup_github_repo', e.target.value.trim())}
                disabled={!row.auto_backup_github_enabled} />
              <Input placeholder="branch" value={row.auto_backup_github_branch ?? ''}
                onChange={(e) => update('auto_backup_github_branch', e.target.value.trim())}
                disabled={!row.auto_backup_github_enabled} />
              <Input placeholder="path" value={row.auto_backup_github_path ?? ''}
                onChange={(e) => update('auto_backup_github_path', e.target.value.trim())}
                disabled={!row.auto_backup_github_enabled} />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <Button onClick={save} disabled={saving || loading}>
            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : 'Save Settings'}
          </Button>
          <Button variant="secondary" onClick={runNow} disabled={running}>
            {running ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Running...</> : <><PlayCircle className="mr-2 h-4 w-4" /> Run Auto-Backup Now</>}
          </Button>
          <Button variant="ghost" size="sm" onClick={load}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
