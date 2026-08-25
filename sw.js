// Minimal offline shell: network-first for page loads with cache fallback,
// so deploys land immediately but the app still opens with no connection.
// All user data lives in localStorage, untouched by this cache.
const CACHE = "kahiro-v6";

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
  // Stale-while-revalidate: serve the cached shell immediately (instant launch
  // for returning users — no network round-trip blocks first paint), then
  // refresh the cache in the background. Deploys still land promptly because
  // the shell references hashed, immutable chunks and this SW skipWaiting()s;
  // worst case one launch shows the prior shell, which updates for the next.
  e.respondWith(
    caches.match(e.request).then((hit) => {
      const network = fetch(e.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
          return res;
        })
        .catch(() => hit || caches.match("./index.html"));
      return hit || network;
    })
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

// Tapping a notification focuses an open app window or opens a new one — and
// takes it to the screen the notification is about. Focusing alone dropped
// the destination whenever the app happened to be open, which is most of the
// time, so the reminder landed you wherever you had left off.
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || "./";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((cs) => {
      for (const c of cs) {
        if (!("focus" in c)) continue;
        // The message, not navigate(): changing the hash on an already-loaded
        // page does not re-run the app's router, so navigate() would move the
        // URL and leave the screen exactly where it was.
        try { c.postMessage({ type: "notification-click", url: target }); } catch { /* focus still works */ }
        return c.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});
