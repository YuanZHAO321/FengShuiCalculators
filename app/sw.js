/* =========================================================================
 * sw.js — service worker for the Feng Shui Calculator PWA.
 *   · precaches the app shell so the whole calculator works fully offline
 *   · cache-first for same-origin shell assets, with a cached index fallback
 *     for navigations
 *   · stale-while-revalidate for the cross-origin Google Fonts
 *   · never touches AI API traffic (chat/completions, /models) — those are
 *     always live network requests
 * Bump CACHE_VERSION whenever a shell asset changes to roll the cache.
 * ========================================================================= */

const CACHE_VERSION = "fsc-v1.1.2";
const SHELL_CACHE = CACHE_VERSION + "-shell";
const FONT_CACHE = CACHE_VERSION + "-fonts";

/* App shell — paths relative to the SW scope (the app/ directory). */
const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/style.css",
  "./js/data.js",
  "./js/astro.js",
  "./js/bazi.js",
  "./js/flyingstars.js",
  "./js/tongshu.js",
  "./js/qimen.js",
  "./js/ai-context.js",
  "./js/ai.js",
  "./js/app.js",
  "./js/store.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-180.png",
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== SHELL_CACHE && k !== FONT_CACHE)
            .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

const isFontReq = url =>
  url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;                 // never cache POSTs (AI calls)

  const url = new URL(req.url);

  // Google Fonts — stale-while-revalidate so they're available offline.
  if (isFontReq(url)) {
    event.respondWith(staleWhileRevalidate(req, FONT_CACHE));
    return;
  }

  // Only handle our own origin; let anything else (AI APIs, CDNs) hit network.
  if (url.origin !== self.location.origin) return;

  // Navigations: serve cached index so the app boots offline.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() =>
        caches.match("./index.html", { ignoreSearch: true })
          .then(r => r || caches.match("./"))
      )
    );
    return;
  }

  // Same-origin shell assets: cache-first, fall back to network + cache.
  event.respondWith(
    caches.match(req).then(cached => cached || fetchAndCache(req, SHELL_CACHE))
  );
});

function fetchAndCache(req, cacheName) {
  return fetch(req).then(res => {
    if (res && res.ok) {
      const copy = res.clone();
      caches.open(cacheName).then(c => c.put(req, copy));
    }
    return res;
  });
}

function staleWhileRevalidate(req, cacheName) {
  return caches.open(cacheName).then(cache =>
    cache.match(req).then(cached => {
      const network = fetch(req).then(res => {
        if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone());
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
}

/* Let the page trigger an immediate activation after an update. */
self.addEventListener("message", event => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
