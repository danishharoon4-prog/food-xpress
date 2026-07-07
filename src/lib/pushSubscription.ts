// Web Push (VAPID) subscription helper.
// Subscribes the current browser and stores the endpoint in `push_subscriptions`
// so the send-push edge function can deliver background notifications.

import { supabase } from "@/integrations/supabase/client";
import { ensureNotificationsSW } from "./notificationsSW";

// Public VAPID key — safe to embed client-side.
export const VAPID_PUBLIC_KEY =
  "BMP5Fl7R4U2gNXfeDci6arUo8A-SdZ4x4KmhWKe5QBrDa0geS7Onm8SRMAA243gETHMV7XIiwsqJfGp6esCgzTc";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function bufToB64(buf: ArrayBuffer | null): string {
  if (!buf) return "";
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function ensurePushSubscription(): Promise<boolean> {
  try {
    if (typeof window === "undefined") return false;
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      return false;
    }
    if (Notification.permission !== "granted") return false;

    const reg = await ensureNotificationsSW();
    if (!reg) return false;

    const { data: sess } = await supabase.auth.getSession();
    const userId = sess?.session?.user?.id;
    if (!userId) return false;

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
      });
    }

    const json = sub.toJSON();
    const endpoint = json.endpoint || sub.endpoint;
    const p256dh = json.keys?.p256dh || bufToB64(sub.getKey("p256dh"));
    const auth = json.keys?.auth || bufToB64(sub.getKey("auth"));
    if (!endpoint || !p256dh || !auth) return false;

    await supabase.from("push_subscriptions").upsert(
      {
        user_id: userId,
        endpoint,
        p256dh,
        auth,
        user_agent: navigator.userAgent,
      },
      { onConflict: "endpoint" },
    );
    return true;
  } catch (err) {
    console.warn("ensurePushSubscription failed", err);
    return false;
  }
}
