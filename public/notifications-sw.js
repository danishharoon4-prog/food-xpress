// Minimal service worker for local (foreground-triggered) notifications.
// Required on Android Chrome/Edge/Firefox where `new Notification()` is
// disallowed and notifications must be shown via ServiceWorkerRegistration.
// Intentionally does NOT cache app-shell assets or intercept fetch.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Focus/open the app when a notification is clicked.
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
