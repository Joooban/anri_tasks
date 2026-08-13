// Minimal hand-rolled service worker (no Workbox/next-pwa) — offline
// *viewing* of already-visited pages and static assets only, per the
// project brief. Offline editing is a phase-2 feature.
const CACHE_VERSION = "anri-cache-v2";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll([OFFLINE_URL, "/manifest.json"]))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Fire-and-forget cache write. Some responses (redirects, opaque
// cross-origin, certain streamed RSC payloads) throw when handed to
// cache.put — that must never become an unhandled rejection or block the
// actual response from reaching the page.
function cachePut(request, response) {
  caches
    .open(CACHE_VERSION)
    .then((cache) => cache.put(request, response))
    .catch(() => {});
}

// event.respondWith() throws "Failed to convert value to 'Response'" if the
// promise it's given ever resolves to undefined — which caches.match()
// does whenever there's no cached entry. Every fallback chain below is
// wrapped so it always terminates in a real Response, never undefined.
const FALLBACK_RESPONSE = () => new Response("Offline", { status: 503, statusText: "Offline" });

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Page navigations: network-first, falling back to a cached copy of the
  // same page, then to the generic offline page, then to a bare response
  // so respondWith never receives undefined.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          cachePut(request, response.clone());
          return response;
        })
        .catch(async () => {
          const cachedPage = await caches.match(request);
          if (cachedPage) return cachedPage;
          const offline = await caches.match(OFFLINE_URL);
          return offline || FALLBACK_RESPONSE();
        })
    );
    return;
  }

  // Static assets (_next/static, icons, fonts): cache-first.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request)
            .then((response) => {
              cachePut(request, response.clone());
              return response;
            })
            .catch(FALLBACK_RESPONSE)
      )
    );
    return;
  }

  // Everything else (API/data calls): network-first with a cache fallback
  // so the last-seen data still renders offline.
  event.respondWith(
    fetch(request)
      .then((response) => {
        cachePut(request, response.clone());
        return response;
      })
      .catch(async () => (await caches.match(request)) || FALLBACK_RESPONSE())
  );
});
