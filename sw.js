/* RIVALS service worker — offline app shell + runtime asset cache */
const VERSION = "rivals-v2";
const CORE = [
  "./",
  "./index.html",
  "./styles.css",
  "./js/app.js",
  "./js/data.js",
  "./js/profile.js",
  "./js/net.js",
  "./js/config.js",
  "./manifest.webmanifest",
  "./img/icon-192.png",
  "./img/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;

  // HTML: network-first so updates land; fall back to cached shell offline
  if (req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html")) {
    e.respondWith(
      fetch(req).then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); return res; })
        .catch(() => caches.match(req).then((m) => m || caches.match("./index.html")))
    );
    return;
  }

  // Everything else same-origin: cache-first, then network (and cache it)
  e.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((res) => {
      if (res && res.status === 200) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => cached))
  );
});
