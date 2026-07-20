// Backup upload to Google Drive and/or GitHub via connector gateway.
// Admin-only. Called from the Admin Backup Center.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const GATEWAY = 'https://connector-gateway.lovable.dev';

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const GOOGLE_DRIVE_API_KEY = Deno.env.get('GOOGLE_DRIVE_API_KEY');
    const GITHUB_API_KEY = Deno.env.get('GITHUB_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

    if (!LOVABLE_API_KEY) return json(500, { error: 'LOVABLE_API_KEY missing' });

    const authHeader = req.headers.get('Authorization') ?? '';
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return json(401, { error: 'Not authenticated' });

    // Verify admin role
    const { data: role } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userData.user.id)
      .eq('role', 'admin')
      .maybeSingle();
    if (!role) return json(403, { error: 'Admin only' });

    const body = await req.json();
    const { filename, zipBase64, drive, github } = body ?? {};
    if (!filename || !zipBase64) return json(400, { error: 'filename and zipBase64 required' });

    const results: Record<string, any> = {};

    // ---- Google Drive ----
    if (drive) {
      if (!GOOGLE_DRIVE_API_KEY) {
        results.drive = { ok: false, error: 'GOOGLE_DRIVE_API_KEY missing (connector not linked)' };
      } else {
        const metadata: Record<string, unknown> = { name: filename };
        if (drive.folderId) metadata.parents = [drive.folderId];

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
        if (!resp.ok) {
          results.drive = { ok: false, status: resp.status, error: text };
        } else {
          results.drive = { ok: true, file: JSON.parse(text) };
        }
      }
    }

    // ---- GitHub ----
    if (github) {
      if (!GITHUB_API_KEY) {
        results.github = { ok: false, error: 'GITHUB_API_KEY missing (connector not linked)' };
      } else {
        const { owner, repo, branch, path } = github;
        if (!owner || !repo) {
          results.github = { ok: false, error: 'owner and repo required' };
        } else {
          const targetPath = (path || 'backups') + '/' + filename;
          const url = `${GATEWAY}/github/repos/${owner}/${repo}/contents/${encodeURIComponent(targetPath).replace(/%2F/g, '/')}`;
          const payload: Record<string, unknown> = {
            message: `chore(backup): ${filename}`,
            content: zipBase64,
          };
          if (branch) payload.branch = branch;

          const resp = await fetch(url, {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              'X-Connection-Api-Key': GITHUB_API_KEY,
              Accept: 'application/vnd.github+json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          });
          const text = await resp.text();
          if (!resp.ok) {
            results.github = { ok: false, status: resp.status, error: text };
          } else {
            results.github = { ok: true, file: JSON.parse(text) };
          }
        }
      }
    }

    return json(200, { ok: true, results });
  } catch (e) {
    return json(200, { ok: false, error: (e as Error).message });
  }
});
