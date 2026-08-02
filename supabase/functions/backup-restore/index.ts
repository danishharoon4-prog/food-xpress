// Restore a Food Express backup (JSON per table) into the database.
// Admin-only. Called table-by-table from the Admin Backup Center.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

// Tables allowed for restore, in dependency-safe order.
export const RESTORE_ORDER = [
  'profiles',
  'user_roles',
  'restaurants',
  'menu_categories',
  'menu_items',
  'riders',
  'rider_wallets',
  'addresses',
  'favorite_restaurants',
  'orders',
  'order_items',
  'payments',
  'rider_earnings',
  'rider_withdrawals',
  'ratings',
  'notifications',
  'notification_preferences',
  'platform_settings',
  'support_conversations',
  'support_messages',
  'app_releases',
  'restaurant_location_change_requests',
] as const;

const CONFLICT_KEYS: Record<string, string> = {
  notification_preferences: 'user_id',
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) return json(401, { ok: false, error: 'Unauthorized' });

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return json(401, { ok: false, error: 'Not authenticated' });

    const { data: adminRole } = await userClient
      .from('user_roles')
      .select('role')
      .eq('user_id', userData.user.id)
      .eq('role', 'admin')
      .maybeSingle();
    if (!adminRole) return json(403, { ok: false, error: 'Admin only' });

    const body = await req.json().catch(() => null);
    const table = String(body?.table ?? '');
    const rows = Array.isArray(body?.rows) ? body.rows : null;
    const dryRun = body?.dryRun === true;

    if (!RESTORE_ORDER.includes(table as any)) {
      return json(400, { ok: false, error: `Table "${table}" restore ke liye allowed nahi` });
    }
    if (!rows) return json(400, { ok: false, error: 'rows array required' });
    if (rows.length > 500) return json(400, { ok: false, error: 'Max 500 rows per request' });

    if (dryRun) return json(200, { ok: true, table, validated: rows.length, dryRun: true });

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const onConflict = CONFLICT_KEYS[table] ?? 'id';
    const { error, count } = await admin
      .from(table)
      .upsert(rows, { onConflict, ignoreDuplicates: false, count: 'exact' });

    if (error) {
      return json(200, { ok: false, table, error: error.message, details: (error as any).details ?? null });
    }

    // Audit trail
    await admin.from('admin_audit_logs').insert({
      actor_id: userData.user.id,
      actor_email: userData.user.email ?? null,
      action: 'backup_restore',
      target_type: 'table',
      target_id: table,
      details: { rows: rows.length },
    });

    return json(200, { ok: true, table, restored: count ?? rows.length });
  } catch (e) {
    return json(200, { ok: false, error: (e as Error).message });
  }
});
