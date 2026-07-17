/* CreativeStore Service Worker — v1
 * Strategy:
 *   - Network First for /api/* (fresh data)
 *   - Cache First for static assets (JS, CSS, images)
 *   - Offline fallback page for HTML navigation
 */
const CACHE_NAME = "cs-cache-v1";
const OFFLINE_URL = "/offline.html";
const STATIC_ASSETS = [
  "/",
  "/manifest.json",
  OFFLINE_URL,
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) => Promise.all(
      names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
    ))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // API — network first, no offline fallback (biar app tahu error)
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(req).catch(() => new Response(JSON.stringify({ offline: true }), { status: 503, headers: { "Content-Type": "application/json" } })));
    return;
  }

  // HTML navigation — network first, fallback ke cached offline page
  if (req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html")) {
    event.respondWith(
      fetch(req).catch(() => caches.match(OFFLINE_URL).then((r) => r || caches.match("/")))
    );
    return;
  }

  // Assets — cache first
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res.ok && (url.origin === self.location.origin)) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, clone)).catch(() => {});
        }
        return res;
      }).catch(() => cached);
    })
  );
});
