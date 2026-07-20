import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Download, Database, HardDrive, Loader2, ShieldCheck, Github } from 'lucide-react';
import JSZip from 'jszip';

// Tables safe/useful to back up. Admin RLS allows reads on these.
const TABLES = [
  'profiles',
  'user_roles',
  'restaurants',
  'menu_categories',
  'menu_items',
  'orders',
  'order_items',
  'payments',
  'riders',
  'rider_wallets',
  'rider_earnings',
  'rider_withdrawals',
  'ratings',
  'addresses',
  'favorite_restaurants',
  'notifications',
  'notification_preferences',
  'platform_settings',
  'support_conversations',
  'support_messages',
  'app_releases',
  'restaurant_location_change_requests',
] as const;

export default function AdminBackup() {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string>('');
  const [counts, setCounts] = useState<Record<string, number>>({});

  const runBackup = async () => {
    setBusy(true);
    setCounts({});
    const zip = new JSZip();
    const folder = zip.folder('database')!;
    const summary: Record<string, number> = {};

    try {
      for (const t of TABLES) {
        setProgress(`Fetching ${t}...`);
        // Page through to bypass 1000-row default limit
        const pageSize = 1000;
        let from = 0;
        let all: any[] = [];
        while (true) {
          const { data, error } = await supabase
            .from(t as any)
            .select('*')
            .range(from, from + pageSize - 1);
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
        note: 'Full JSON export of admin-readable tables. Storage buckets not included.',
      };
      zip.file('manifest.json', JSON.stringify(manifest, null, 2));
      zip.file(
        'RESTORE_INSTRUCTIONS.txt',
        `Food Express — Restore Instructions\n\n` +
          `1. Har table ka JSON file "database/" folder me hai.\n` +
          `2. Restore ke liye admin se contact karen — data ko dobara insert karne ke liye migration/script chahiye hoti hai (RLS aur foreign key order zaruri hai).\n` +
          `3. Recommended order: profiles -> user_roles -> restaurants -> menu_categories -> menu_items -> riders -> rider_wallets -> orders -> order_items -> payments -> baqi.\n` +
          `4. Storage files (avatars, rider-documents, app-releases) alag se Cloud tab se export karen.\n`
      );

      setProgress('Compressing ZIP...');
      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      a.href = url;
      a.download = `food-express-backup-${stamp}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      toast.success('Backup ready — download started');
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
          Apni website aur database ka backup lein taake kisi bhi crash ki soorat mein data safe rahe.
        </p>
      </div>

      {/* Code backup card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Github className="h-5 w-5" /> Code Backup (GitHub)
          </CardTitle>
          <CardDescription>
            Apna project code GitHub par sync karein — har change automatically push hoti hai.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
            <li>Lovable editor mein niche left par <b>Plus (+)</b> button dabayen.</li>
            <li><b>GitHub → Connect project</b> select karein.</li>
            <li>GitHub authorize karein aur account/organization choose karein.</li>
            <li><b>Create Repository</b> par click karein.</li>
          </ol>
          <p className="text-xs text-muted-foreground">
            Iske baad Lovable mein ki gayi har change automatically GitHub par sync ho jayegi. Agar kabhi bhi kuch hoga to code wapas restore ho sakta hai.
          </p>
        </CardContent>
      </Card>

      {/* Database backup card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" /> Database Backup
          </CardTitle>
          <CardDescription>
            Tamam tables ka JSON export ek ZIP file mein download karein.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {TABLES.map((t) => (
              <Badge key={t} variant="secondary" className="font-mono text-xs">
                {t}
                {counts[t] != null && (
                  <span className="ml-1 text-primary">({counts[t]})</span>
                )}
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
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Backing up...</>
            ) : (
              <><Download className="mr-2 h-4 w-4" /> Download Full Database Backup (.zip)</>
            )}
          </Button>

          <p className="text-xs text-muted-foreground">
            Recommendation: har hafte ek backup lein aur apne computer ya cloud drive (Google Drive / OneDrive) par save karlein.
          </p>
        </CardContent>
      </Card>

      {/* Storage backup card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" /> Storage / Files Backup
          </CardTitle>
          <CardDescription>
            Uploaded files (avatars, rider documents, APKs) alag se backup hoti hain.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Lovable Cloud tab kholein → <b>Advanced settings → Export data</b>. Yahan se database + storage
            ka full backup request kar sakte hain jo Lovable taiyar kar ke aap ko de deta hai.
          </p>
          <p className="text-xs">
            Additional: bade instance plans mein daily automatic backups + 7-day point-in-time recovery available hoti hai.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
