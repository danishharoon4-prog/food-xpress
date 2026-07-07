// Sends Web Push notifications via VAPID.
// Invoked by a DB trigger (pg_net) whenever a row is inserted into
// public.notifications. Looks up all push subscriptions for the target
// user and delivers a native Web Push to each.

// deno-lint-ignore-file no-explicit-any
import webpush from "https://esm.sh/web-push@3.6.7?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:support@example.com";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { user_id, title, message, type, data } = body ?? {};
    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Check user preferences (per-event + master push) and global platform toggles.
    const status: string | undefined = data?.status;
    const STATUS_MAP: Record<string, string> = {
      order_placed: "event_order_placed",
      pending: "event_order_placed",
      confirmed: "event_confirmed",
      preparing: "event_preparing",
      ready_for_pickup: "event_ready_for_pickup",
      picked_up: "event_picked_up",
      on_the_way: "event_on_the_way",
      awaiting_confirmation: "event_awaiting_confirmation",
      delivered: "event_delivered",
      cancelled: "event_cancelled",
    };

    const [prefsRes, globalRes] = await Promise.all([
      admin.from("notification_preferences").select("*").eq("user_id", user_id).maybeSingle(),
      admin.from("platform_settings").select("notifications_push_enabled").limit(1).maybeSingle(),
    ]);

    if (globalRes.data && (globalRes.data as any).notifications_push_enabled === false) {
      return new Response(JSON.stringify({ sent: 0, reason: "globally_disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prefs = prefsRes.data as any;
    if (prefs) {
      if (prefs.push_enabled === false) {
        return new Response(JSON.stringify({ sent: 0, reason: "user_disabled" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const col = status ? STATUS_MAP[status] : null;
      if (col && prefs[col] === false) {
        return new Response(JSON.stringify({ sent: 0, reason: "event_muted" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { data: subs, error } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", user_id);

    if (error) throw error;
    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = JSON.stringify({
      title: title || "Notification",
      body: message || "",
      type: type || "info",
      url: data?.order_id ? `/order/${data.order_id}` : "/",
      tag: data?.order_id ? `order-${data.order_id}` : undefined,
      data: data || null,
    });

    let sent = 0;
    const stale: string[] = [];
    await Promise.all(
      subs.map(async (s: any) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload,
          );
          sent++;
        } catch (err: any) {
          const code = err?.statusCode;
          // 404/410 = gone, remove
          if (code === 404 || code === 410) stale.push(s.id);
        }
      }),
    );

    if (stale.length > 0) {
      await admin.from("push_subscriptions").delete().in("id", stale);
    }

    return new Response(JSON.stringify({ sent, removed: stale.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-push error", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
