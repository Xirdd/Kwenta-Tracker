import {
  precacheAndRoute,
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
} from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";
import { CacheFirst, StaleWhileRevalidate } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";

// ── Lifecycle: registerType "autoUpdate" ────────────────────────────────
// A new worker activates immediately and takes control of open tabs, so a
// deploy is picked up without a "refresh to update" prompt.
self.skipWaiting();
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
cleanupOutdatedCaches();

// ── App shell (precache) ────────────────────────────────────────────────
// self.__WB_MANIFEST is replaced at build time with every built HTML/JS/CSS/
// icon file (see injectManifest.globPatterns in vite.config.js). These are
// served cache-first, so the whole app boots with no network at all.
precacheAndRoute(self.__WB_MANIFEST);

// Any page navigation (including the magic-link landing URL) gets the
// precached index.html — this is a single-page app, so offline reloads on any
// URL still open the app instead of the browser's "no internet" page.
registerRoute(new NavigationRoute(createHandlerBoundToURL("/index.html")));

// ── Runtime caching ─────────────────────────────────────────────────────
// Cross-origin font requests made from a plain <link> come back as opaque
// (status 0) responses. Workbox only caches status 200 by default, so
// without this the Google Fonts rules below would never store anything.
const cacheOkOrOpaque = {
  cacheWillUpdate: async ({ response }) =>
    response && (response.status === 200 || response.status === 0)
      ? response
      : null,
};

const ONE_DAY = 60 * 60 * 24;

// Google Fonts CSS: small and occasionally changes, so serve the cached copy
// instantly and refresh it in the background.
registerRoute(
  ({ url }) => url.origin === "https://fonts.googleapis.com",
  new StaleWhileRevalidate({
    cacheName: "google-fonts-styles",
    plugins: [
      cacheOkOrOpaque,
      new ExpirationPlugin({
        maxEntries: 10,
        maxAgeSeconds: ONE_DAY * 365,
        purgeOnQuotaError: true,
      }),
    ],
  }),
);

// Google Fonts files: versioned, immutable URLs — cache-first is safe.
registerRoute(
  ({ url }) => url.origin === "https://fonts.gstatic.com",
  new CacheFirst({
    cacheName: "google-fonts-files",
    plugins: [
      cacheOkOrOpaque,
      new ExpirationPlugin({
        maxEntries: 30,
        maxAgeSeconds: ONE_DAY * 365,
        purgeOnQuotaError: true,
      }),
    ],
  }),
);

// Same-origin JS/CSS/workers/fonts that somehow aren't in the precache list
// (lazy chunks, self-hosted fonts added later). Precached files never reach
// this route — they match precacheAndRoute above first.
registerRoute(
  ({ request, url }) =>
    url.origin === self.location.origin &&
    ["script", "style", "worker", "font"].includes(request.destination),
  new StaleWhileRevalidate({
    cacheName: "static-assets",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: ONE_DAY * 30,
        purgeOnQuotaError: true,
      }),
    ],
  }),
);

// Same-origin images.
registerRoute(
  ({ request, url }) =>
    url.origin === self.location.origin && request.destination === "image",
  new CacheFirst({
    cacheName: "images",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: ONE_DAY * 30,
        purgeOnQuotaError: true,
      }),
    ],
  }),
);

// Deliberately NOT cached: anything on *.supabase.co. API calls always go
// live so cloud data is never served stale from a cache — offline data comes
// from the localStorage copy the app already keeps (storage.js).

// ── Push notifications ──────────────────────────────────────────────────
// Fires when a push arrives — whether or not the app is actually open. The
// payload shape (title/body/url) matches exactly what the send-push Edge
// Function sends.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    /* malformed payload, fall back to defaults below */
  }

  const title = data.title || "Kwenta";
  const options = {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: { url: data.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Tapping the notification focuses an already-open Kwenta tab if one
// exists, rather than always opening a new one.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) return client.focus();
        }
        if (clients.openWindow) return clients.openWindow(targetUrl);
      }),
  );
});
