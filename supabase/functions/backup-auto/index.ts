// Automatic backup runner. Called every minute by pg_cron.
// - Checks platform_settings.auto_backup_enabled and interval
// - Snapshots public tables into a ZIP
// - Uploads to Google Drive and/or GitHub via connector gateway
// - Updates last_run status on platform_settings

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import JSZip from 'https://esm.sh/jszip@3.10.1';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const GATEWAY = 'https://connector-gateway.lovable.dev';

const TABLES = [
  'profiles', 'user_roles', 'restaurants', 'menu_categories', 'menu_items',
  'orders', 'order_items', 'payments', 'riders', 'rider_wallets',
  'rider_earnings', 'rider_withdrawals', 'ratings', 'addresses',
  'favorite_restaurants', 'notifications', 'notification_preferences',
  'platform_settings', 'support_conversations', 'support_messages',
  'app_releases', 'restaurant_location_change_requests',
];

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)) as any);
  }
  return btoa(binary);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  const GOOGLE_DRIVE_API_KEY = Deno.env.get('GOOGLE_DRIVE_API_KEY');
  const GITHUB_API_KEY = Deno.env.get('GITHUB_API_KEY');

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // Load settings
  const { data: settings, error: sErr } = await admin
    .from('platform_settings')
    .select('*')
    .eq('singleton', true)
    .maybeSingle();
  if (sErr || !settings) return json(500, { error: 'settings not found', details: sErr?.message });

  // Manual force via body { force: true } from Admin UI (requires admin JWT); cron sends no force.
  let force = false;
  let callerIsAdmin = false;
  try {
    const body = req.method === 'POST' ? await req.json() : {};
    force = !!body?.force;
  } catch {}

  if (force) {
    // Verify admin JWT
    const authHeader = req.headers.get('Authorization') ?? '';
    if (authHeader.startsWith('Bearer ')) {
      const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: u } = await userClient.auth.getUser();
      if (u?.user) {
        const { data: role } = await admin
          .from('user_roles').select('role').eq('user_id', u.user.id).eq('role', 'admin').maybeSingle();
        callerIsAdmin = !!role;
      }
    }
    if (!callerIsAdmin) return json(403, { error: 'admin only' });
  }

  // Skip if disabled (unless forced)
  if (!force && !settings.auto_backup_enabled) {
    return json(200, { skipped: true, reason: 'auto backup disabled' });
  }

  // Interval check (unless forced)
  const intervalMin = Math.max(5, settings.auto_backup_interval_minutes ?? 60);
  if (!force && settings.auto_backup_last_run_at) {
    const last = new Date(settings.auto_backup_last_run_at).getTime();
    const nextDue = last + intervalMin * 60_000;
    if (Date.now() < nextDue) {
      return json(200, { skipped: true, reason: 'interval not reached', next_due: new Date(nextDue).toISOString() });
    }
  }

  const startedAt = new Date().toISOString();
  const summary: Record<string, number> = {};
  const zip = new JSZip();
  const folder = zip.folder('database')!;

  try {
    for (const t of TABLES) {
      const pageSize = 1000;
      let from = 0;
      let all: any[] = [];
      while (true) {
        const { data, error } = await admin.from(t as any).select('*').range(from, from + pageSize - 1);
        if (error) throw new Error(`${t}: ${error.message}`);
        if (!data || data.length === 0) break;
        all = all.concat(data);
        if (data.length < pageSize) break;
        from += pageSize;
      }
      folder.file(`${t}.json`, JSON.stringify(all, null, 2));
      summary[t] = all.length;
    }

    zip.file('manifest.json', JSON.stringify({
      generated_at: startedAt,
      project: 'Food Express',
      trigger: force ? 'manual' : 'auto',
      tables: summary,
    }, null, 2));

    const zipBytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' }) as Uint8Array;
    const zipBase64 = bytesToBase64(zipBytes);
    const stamp = startedAt.replace(/[:.]/g, '-');
    const filename = `food-express-backup-${stamp}.zip`;

    const results: Record<string, any> = {};

    // Google Drive
    if (settings.auto_backup_drive_enabled) {
      if (!LOVABLE_API_KEY || !GOOGLE_DRIVE_API_KEY) {
        results.drive = { ok: false, error: 'Drive connector not linked' };
      } else {
        const metadata: Record<string, unknown> = { name: filename };
        if (settings.auto_backup_drive_folder_id) metadata.parents = [settings.auto_backup_drive_folder_id];
        const boundary = '----lovable_backup_' + crypto.randomUUID();
        const multipart =
          `--${boundary}\r\n` +
          `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
          `${JSON.stringify(metadata)}\r\n` +
          `--${boundary}\r\n` +
          `Content-Type: application/zip\r\n` +
          `Content-Transfer-Encoding: base64\r\n\r\n` +
          `${zipBase64}\r\n` +
          `--${boundary}--`;
        const resp = await fetch(
          `${GATEWAY}/google_drive/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,parents`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              'X-Connection-Api-Key': GOOGLE_DRIVE_API_KEY,
              'Content-Type': `multipart/related; boundary=${boundary}`,
            },
            body: multipart,
          },
        );
        const text = await resp.text();
        results.drive = resp.ok
          ? { ok: true, file: JSON.parse(text) }
          : { ok: false, status: resp.status, error: text.slice(0, 500) };
      }
    }

    // GitHub
    if (settings.auto_backup_github_enabled) {
      if (!LOVABLE_API_KEY || !GITHUB_API_KEY) {
        results.github = { ok: false, error: 'GitHub connector not linked' };
      } else {
        const owner = settings.auto_backup_github_owner;
        const repo = settings.auto_backup_github_repo;
        const branch = settings.auto_backup_github_branch || 'main';
        const basePath = settings.auto_backup_github_path || 'backups';
        if (!owner || !repo) {
          results.github = { ok: false, error: 'owner and repo required in settings' };
        } else {
          const targetPath = `${basePath}/${filename}`;
          const url = `${GATEWAY}/github/repos/${owner}/${repo}/contents/${targetPath.split('/').map(encodeURIComponent).join('/')}`;
          const resp = await fetch(url, {
            method: 'PUT',
            headers: {
              Accept: 'application/vnd.github+json',
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              'X-Connection-Api-Key': GITHUB_API_KEY,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message: `auto backup ${startedAt}`,
              content: zipBase64,
              branch,
            }),
          });
          const text = await resp.text();
          results.github = resp.ok
            ? { ok: true, file: JSON.parse(text) }
            : { ok: false, status: resp.status, error: text.slice(0, 500) };
        }
      }
    }

    const anyOk = Object.values(results).some((r: any) => r?.ok);
    const status = anyOk ? 'success' : 'failed';

    await admin.from('platform_settings').update({
      auto_backup_last_run_at: startedAt,
      auto_backup_last_status: status,
      auto_backup_last_result: { results, tables: summary, bytes: zipBytes.length },
    }).eq('singleton', true);

    return json(200, { ok: anyOk, status, results, tables: summary });
  } catch (e: any) {
    await admin.from('platform_settings').update({
      auto_backup_last_run_at: startedAt,
      auto_backup_last_status: 'error',
      auto_backup_last_result: { error: String(e?.message || e) },
    }).eq('singleton', true);
    return json(200, { ok: false, error: e?.message || String(e) });
  }
});
