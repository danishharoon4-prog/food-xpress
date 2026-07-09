// Sends push notifications:
//   - Web Push (VAPID) to public.push_subscriptions rows
//   - Firebase Cloud Messaging (FCM HTTP v1) to public.device_push_tokens rows (Android/iOS)
// Invoked by DB trigger on public.notifications insert.

// deno-lint-ignore-file no-explicit-any
import webpush from "https://esm.sh/web-push@3.6.7?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:support@example.com";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const FIREBASE_SERVICE_ACCOUNT = Deno.env.get("FIREBASE_SERVICE_ACCOUNT") ?? "";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ---------- FCM HTTP v1 helpers ----------
let cachedFcmToken: { token: string; exp: number } | null = null;
let cachedProjectId = "";

function b64url(bytes: Uint8Array | string): string {
  const b =
    typeof bytes === "string"
      ? btoa(bytes)
      : btoa(String.fromCharCode(...bytes));
  return b.replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN [^-]+-----/, "")
    .replace(/-----END [^-]+-----/, "")
    .replace(/\s+/g, "");
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

async function getFcmAccessToken(): Promise<{ token: string; projectId: string } | null> {
  if (!FIREBASE_SERVICE_ACCOUNT) return null;
  const now = Math.floor(Date.now() / 1000);
  if (cachedFcmToken && cachedFcmToken.exp - 60 > now && cachedProjectId) {
    return { token: cachedFcmToken.token, projectId: cachedProjectId };
  }

  let sa: any;
  try {
    sa = JSON.parse(FIREBASE_SERVICE_ACCOUNT);
  } catch (_e) {
    console.error("FIREBASE_SERVICE_ACCOUNT is not valid JSON");
    return null;
  }
  const projectId = sa.project_id;
  const clientEmail = sa.client_email;
  const privateKey = String(sa.private_key || "").replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) return null;

  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claim))}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(privateKey),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned)),
  );
  const jwt = `${unsigned}.${b64url(sig)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  if (!res.ok) {
    console.error("FCM token exchange failed", await res.text());
    return null;
  }
  const j = await res.json();
  cachedFcmToken = { token: j.access_token, exp: now + (j.expires_in || 3600) };
  cachedProjectId = projectId;
  return { token: j.access_token, projectId };
}

async function sendFcm(
  targets: { id: string; token: string }[],
  payload: { title: string; body: string; data: Record<string, string> },
  admin: any,
): Promise<number> {
  if (targets.length === 0) return 0;
  const auth = await getFcmAccessToken();
  if (!auth) return 0;

  let sent = 0;
  const stale: string[] = [];
  await Promise.all(
    targets.map(async (t) => {
      try {
        const res = await fetch(
          `https://fcm.googleapis.com/v1/projects/${auth.projectId}/messages:send`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${auth.token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              message: {
                token: t.token,
                notification: {
                  title: payload.title,
                  body: payload.body,
                  image: "https://food-xpress.lovable.app/__l5e/assets-v1/98cff877-3e57-45a6-ae8e-040ad7a6599b/notification-icon.png",
                },
                data: payload.data,
                android: {
                  priority: "HIGH",
                  notification: {
                    sound: "default",
                    icon: "ic_stat_notification",
                    color: "#FF6F00",
                    image: "https://food-xpress.lovable.app/__l5e/assets-v1/98cff877-3e57-45a6-ae8e-040ad7a6599b/notification-icon.png",
                  },
                },
              },
            }),
          },
        );
        if (res.ok) {
          sent++;
        } else {
          const errText = await res.text();
          if (res.status === 404 || /UNREGISTERED|INVALID_ARGUMENT/i.test(errText)) {
            stale.push(t.id);
          } else {
            console.error("FCM send failed", res.status, errText);
          }
        }
      } catch (e) {
        console.error("FCM send exception", e);
      }
    }),
  );
  if (stale.length > 0) {
    await admin.from("device_push_tokens").delete().in("id", stale);
  }
  return sent;
}

// ---------- Main handler ----------
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

    // Fetch subscribers for both channels in parallel
    const [webSubsRes, fcmSubsRes] = await Promise.all([
      admin
        .from("push_subscriptions")
        .select("id, endpoint, p256dh, auth")
        .eq("user_id", user_id),
      admin
        .from("device_push_tokens")
        .select("id, token")
        .eq("user_id", user_id),
    ]);

    if (webSubsRes.error) throw webSubsRes.error;
    if (fcmSubsRes.error) throw fcmSubsRes.error;

    const subs = webSubsRes.data ?? [];
    const fcmTargets = fcmSubsRes.data ?? [];

    // ----- Web Push -----
    const payload = JSON.stringify({
      title: title || "Notification",
      body: message || "",
      type: type || "info",
      url: data?.order_id ? `/order/${data.order_id}` : "/",
      tag: data?.order_id ? `order-${data.order_id}` : undefined,
      data: data || null,
    });

    let webSent = 0;
    const stale: string[] = [];
    await Promise.all(
      subs.map(async (s: any) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload,
          );
          webSent++;
        } catch (err: any) {
          const code = err?.statusCode;
          if (code === 404 || code === 410) stale.push(s.id);
        }
      }),
    );
    if (stale.length > 0) {
      await admin.from("push_subscriptions").delete().in("id", stale);
    }

    // ----- FCM (Android/iOS) -----
    const fcmData: Record<string, string> = {
      type: String(type || "info"),
    };
    if (data?.order_id) fcmData.order_id = String(data.order_id);
    if (data?.status) fcmData.status = String(data.status);
    if (data?.restaurant_id) fcmData.restaurant_id = String(data.restaurant_id);

    const fcmSent = await sendFcm(
      fcmTargets as { id: string; token: string }[],
      { title: title || "Notification", body: message || "", data: fcmData },
      admin,
    );

    return new Response(
      JSON.stringify({
        sent: webSent + fcmSent,
        web_sent: webSent,
        fcm_sent: fcmSent,
        removed: stale.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("send-push error", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
