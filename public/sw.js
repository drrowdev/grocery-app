// Lightweight runtime-caching service worker. Its main job is to serve the
// content-hashed Next.js JS/CSS bundle and static assets from the Cache
// Storage on repeat opens, so the PWA shell renders without re-downloading
// hundreds of KB over a mobile connection. Navigations stay network-first so
// the (auth-gated, force-dynamic) HTML is always fresh, with a cached
// fallback for offline.

const VERSION = 'v1';
const CACHE = `grocery-${VERSION}`;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Only handle same-origin requests — never touch Supabase or Anthropic.
  if (url.origin !== self.location.origin) return;

  const isStatic =
    url.pathname.startsWith('/_next/static/') ||
    /\.(?:js|css|woff2?|png|svg|ico|webmanifest)$/.test(url.pathname);

  if (isStatic) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
  }
});

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((res) => {
      if (res && res.status === 200) cache.put(request, res.clone());
      return res;
    })
    .catch(() => cached);
  return cached || network;
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(request);
    if (res && res.status === 200) cache.put(request, res.clone());
    return res;
  } catch {
    const cached = await cache.match(request);
    return cached || (await cache.match('/'));
  }
}
