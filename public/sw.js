// Minimal offline shell: network-first for page loads with cache fallback,
// so deploys land immediately but the app still opens with no connection.
// All user data lives in localStorage, untouched by this cache.
const CACHE = "kahiro-v5";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  // Same-origin images (the athlete backdrop): cache-first so the ambient
  // art works offline after it has been seen once.
  if (e.request.destination === "image" && new URL(e.request.url).origin === self.location.origin) {
    e.respondWith(
      caches.match(e.request).then((hit) =>
        hit || fetch(e.request).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
          return res;
        })
      )
    );
    return;
  }
  // Hashed code-split chunks (/assets/*.js|css) are immutable — cache-first
  // so a lazy module opened once works fully offline forever after. A new
  // deploy ships new hashes, so this can never serve a stale module.
  if ((e.request.destination === "script" || e.request.destination === "style") &&
      new URL(e.request.url).origin === self.location.origin) {
    e.respondWith(
      caches.match(e.request).then((hit) =>
        hit || fetch(e.request).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
          return res;
        })
      )
    );
    return;
  }
  if (e.request.mode !== "navigate" && e.request.destination !== "document") return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request).then((hit) => hit || caches.match("./index.html")))
  );
});

// ── Web Push ─────────────────────────────────────────────────────────
// The server sender (a Supabase Edge Function) posts a JSON payload
// { title, body, url, tag }. Shown even when the app is fully closed.
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data && e.data.text ? e.data.text() : "" }; }
  const title = d.title || "Kahiro";
  const options = {
    body: d.body || "",
    icon: d.icon || "icon-192.png",
    badge: d.badge || "icon-192.png",
    tag: d.tag || title,
    data: { url: d.url || "./" },
    renotify: !!d.tag,
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

// Tapping a notification focuses an open app window or opens a new one.
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || "./";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((cs) => {
      for (const c of cs) { if ("focus" in c) return c.focus(); }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});
