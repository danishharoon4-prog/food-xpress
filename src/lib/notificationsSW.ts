// Registers a minimal service worker used ONLY to show local notifications
// on mobile browsers (Android Chrome/Edge/Firefox require SW-scoped
// notifications; `new Notification()` throws there).
//
// Guarded to never register inside Lovable preview / dev / iframe contexts.

const SW_URL = "/notifications-sw.js";

function isLovablePreviewHost(hostname: string) {
  return (
    hostname.startsWith("id-preview--") ||
    hostname.startsWith("preview--") ||
    hostname === "lovableproject.com" ||
    hostname.endsWith(".lovableproject.com") ||
    hostname === "lovableproject-dev.com" ||
    hostname.endsWith(".lovableproject-dev.com") ||
    hostname === "beta.lovable.dev" ||
    hostname.endsWith(".beta.lovable.dev")
  );
}

function shouldSkip(): boolean {
  if (typeof window === "undefined") return true;
  if (!("serviceWorker" in navigator)) return true;
  if (!import.meta.env.PROD) return true;
  try {
    if (window.top !== window.self) return true;
  } catch {
    return true;
  }
  if (new URL(window.location.href).searchParams.get("sw") === "off") return true;
  if (isLovablePreviewHost(window.location.hostname)) return true;
  return false;
}

let cached: Promise<ServiceWorkerRegistration | null> | null = null;

export function ensureNotificationsSW(): Promise<ServiceWorkerRegistration | null> {
  if (cached) return cached;
  if (shouldSkip()) {
    // Best-effort cleanup of any previously registered copy.
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations?.().then((regs) => {
        for (const r of regs) {
          const url = r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL || "";
          if (url.endsWith(SW_URL)) r.unregister().catch(() => {});
        }
      }).catch(() => {});
    }
    cached = Promise.resolve(null);
    return cached;
  }
  cached = navigator.serviceWorker
    .register(SW_URL, { scope: "/" })
    .then(async (reg) => {
      try { await navigator.serviceWorker.ready; } catch { /* noop */ }
      return reg;
    })
    .catch(() => null);
  return cached;
}
