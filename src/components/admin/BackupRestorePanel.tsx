import { useRef, useState } from 'react';
import JSZip from 'jszip';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Upload, Loader2, RotateCcw, AlertTriangle, CheckCircle2, FileArchive } from 'lucide-react';

// Dependency-safe order (must match the edge function's allow-list)
const RESTORE_ORDER = [
  'profiles', 'user_roles', 'restaurants', 'menu_categories', 'menu_items',
  'riders', 'rider_wallets', 'addresses', 'favorite_restaurants',
  'orders', 'order_items', 'payments', 'rider_earnings', 'rider_withdrawals',
  'ratings', 'notifications', 'notification_preferences', 'platform_settings',
  'support_conversations', 'support_messages', 'app_releases',
  'restaurant_location_change_requests',
] as const;

const CHUNK = 200;

type Parsed = {
  filename: string;
  manifest: any | null;
  tables: Record<string, any[]>;
};

type Result = { table: string; ok: boolean; done: number; error?: string };

export default function BackupRestorePanel() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [dryRun, setDryRun] = useState(true);
  const [confirmText, setConfirmText] = useState('');

  const onPick = async (file: File) => {
    setResults([]);
    setParsed(null);
    setConfirmText('');
    try {
      setProgress('ZIP read ho rahi hai...');
      setBusy(true);
      const zip = await JSZip.loadAsync(file);
      const tables: Record<string, any[]> = {};
      let manifest: any = null;

      const mf = zip.file('manifest.json');
      if (mf) manifest = JSON.parse(await mf.async('string'));

      for (const t of RESTORE_ORDER) {
        const entry = zip.file(`database/${t}.json`) || zip.file(`${t}.json`);
        if (!entry) continue;
        const raw = await entry.async('string');
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) tables[t] = arr;
      }

      if (Object.keys(tables).length === 0) {
        throw new Error('ZIP mein koi valid table JSON nahi mila');
      }
      setParsed({ filename: file.name, manifest, tables });
      toast.success(`${Object.keys(tables).length} tables load ho gaye`);
    } catch (e: any) {
      toast.error(e.message || 'ZIP parse failed');
    } finally {
      setBusy(false);
      setProgress('');
    }
  };

  const run = async () => {
    if (!parsed) return;
    if (!dryRun && confirmText.trim().toUpperCase() !== 'RESTORE') {
      toast.error('Confirm box mein RESTORE likhein');
      return;
    }
    setBusy(true);
    setResults([]);
    const out: Result[] = [];

    try {
      for (const table of RESTORE_ORDER) {
        const rows = parsed.tables[table];
        if (!rows || rows.length === 0) continue;
        let done = 0;
        let failed: string | undefined;

        for (let i = 0; i < rows.length; i += CHUNK) {
          const slice = rows.slice(i, i + CHUNK);
          setProgress(`${dryRun ? 'Validating' : 'Restoring'} ${table} — ${i + slice.length}/${rows.length}`);
          const { data, error } = await supabase.functions.invoke('backup-restore', {
            body: { table, rows: slice, dryRun },
          });
          if (error) { failed = error.message; break; }
          if (!data?.ok) { failed = data?.error || 'Unknown error'; break; }
          done += slice.length;
        }

        out.push({ table, ok: !failed, done, error: failed });
        setResults([...out]);
        if (failed) {
          toast.error(`${table}: ${failed.slice(0, 160)}`);
          break; // stop on first failure so data stays consistent
        }
      }

      const allOk = out.every((r) => r.ok);
      if (allOk) {
        toast.success(dryRun ? 'Dry run pass — data restore ke liye ready hai' : 'Restore mukammal ho gaya');
        setProgress('Done');
      } else {
        setProgress('Rok diya gaya — pehli error par');
      }
    } catch (e: any) {
      toast.error(e.message || 'Restore failed');
    } finally {
      setBusy(false);
    }
  };

  const totalRows = parsed ? Object.values(parsed.tables).reduce((a, b) => a + b.length, 0) : 0;

  return (
    <Card className="border-amber-500/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RotateCcw className="h-5 w-5 text-amber-600" /> Restore Backup
        </CardTitle>
        <CardDescription>
          Backup ZIP upload karein. Data <b>upsert</b> hota hai (same id = update, naya id = insert),
          is liye koi row delete nahi hoti aur kuch miss nahi hota.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".zip"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); e.currentTarget.value = ''; }}
          />
          <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={busy}>
            <Upload className="mr-2 h-4 w-4" /> Backup ZIP choose karein
          </Button>
          {parsed && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <FileArchive className="h-3.5 w-3.5" /> {parsed.filename} — {totalRows.toLocaleString()} rows
            </span>
          )}
        </div>

        {parsed && (
          <>
            {parsed.manifest?.generated_at && (
              <div className="text-xs text-muted-foreground">
                Backup date: {new Date(parsed.manifest.generated_at).toLocaleString()}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {RESTORE_ORDER.filter((t) => parsed.tables[t]?.length).map((t) => {
                const r = results.find((x) => x.table === t);
                return (
                  <Badge key={t} variant={r ? (r.ok ? 'default' : 'destructive') : 'secondary'} className="font-mono text-xs">
                    {t} ({parsed.tables[t].length})
                    {r?.ok && <CheckCircle2 className="ml-1 h-3 w-3" />}
                  </Badge>
                );
              })}
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label className="text-sm">Dry run (safe check)</Label>
                <p className="text-xs text-muted-foreground">
                  Pehle dry run chalayein — data likha nahi jayega, sirf validate hoga.
                </p>
              </div>
              <Switch checked={dryRun} onCheckedChange={setDryRun} disabled={busy} />
            </div>

            {!dryRun && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                  <AlertTriangle className="h-4 w-4" /> Live restore — mojooda rows overwrite hongi (same id par)
                </div>
                <p className="text-xs text-muted-foreground">
                  Chalane se pehle ek fresh backup zaroor lein. Confirm karne ke liye <b>RESTORE</b> likhein.
                </p>
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="RESTORE"
                  className="max-w-[200px]"
                />
              </div>
            )}

            {busy && (
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> {progress}
              </div>
            )}

            {!busy && results.length > 0 && (
              <div className="text-xs space-y-1">
                {results.map((r) => (
                  <div key={r.table} className={r.ok ? 'text-green-600' : 'text-destructive'}>
                    {r.table}: {r.ok ? `${r.done} rows ${dryRun ? 'validated' : 'restored'}` : r.error}
                  </div>
                ))}
              </div>
            )}

            <Button onClick={run} disabled={busy} variant={dryRun ? 'default' : 'destructive'}>
              {busy
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Chal raha hai...</>
                : <><RotateCcw className="mr-2 h-4 w-4" /> {dryRun ? 'Dry Run Chalayein' : 'Restore Ab Karein'}</>}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
