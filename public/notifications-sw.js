// Service worker for Web Push + local notifications.
// - `push` event: shown even when the app tab is closed.
// - `notificationclick`: focuses/opens the app on the relevant order URL.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "Notification", body: event.data ? event.data.text() : "" };
  }
  const title = payload.title || "Notification";
  const opts = {
    body: payload.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: payload.tag,
    data: { url: payload.url || "/", ...(payload.data || {}) },
    vibrate: [120, 60, 120],
  };
  event.waitUntil(self.registration.showNotification(title, opts));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of allClients) {
        try {
          await client.focus();
          if ("navigate" in client && targetUrl) {
            try { await client.navigate(targetUrl); } catch { /* noop */ }
          }
          return;
        } catch { /* noop */ }
      }
      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }
    })(),
  );
});
