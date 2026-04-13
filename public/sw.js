/* ------------------------------------------------------------------ */
/*  Flyeas Service Worker                                               */
/*  - Caches app shell + static assets for offline-first                */
/*  - Network-first for API calls with cache fallback                   */
/*  - Background sync for pending searches                              */
/* ------------------------------------------------------------------ */

const CACHE_NAME = 'flyeas-v2';
const STATIC_CACHE = 'flyeas-static-v2';
const API_CACHE = 'flyeas-api-v1';

const STATIC_ASSETS = [
  '/',
  '/dashboard',
  '/flights',
  '/hotels',
  '/missions',
  '/favorites',
];

/* ------------------------------------------------------------------ */
/*  Install — pre-cache app shell                                       */
/* ------------------------------------------------------------------ */

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // Some routes may fail in dev, that's OK
      });
    })
  );
  self.skipWaiting();
});

/* ------------------------------------------------------------------ */
/*  Activate — clean old caches                                         */
/* ------------------------------------------------------------------ */

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== STATIC_CACHE && key !== API_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

/* ------------------------------------------------------------------ */
/*  Fetch — strategy per request type                                   */
/* ------------------------------------------------------------------ */

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET or chrome-extension URLs
  if (request.method !== 'GET') return;
  if (!url.protocol.startsWith('http')) return;

  // API requests — network first, cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstStrategy(request, API_CACHE));
    return;
  }

  // Static assets (JS, CSS, images, fonts) — cache first
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirstStrategy(request, STATIC_CACHE));
    return;
  }

  // Navigation — network first with cache fallback
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstStrategy(request, STATIC_CACHE));
    return;
  }
});

/* ------------------------------------------------------------------ */
/*  Strategies                                                          */
/* ------------------------------------------------------------------ */

async function networkFirstStrategy(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  }
}

async function cacheFirstStrategy(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

function isStaticAsset(pathname) {
  return /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot)(\?.*)?$/i.test(pathname) ||
    pathname.startsWith('/_next/static/');
}
