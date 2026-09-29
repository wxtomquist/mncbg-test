// sw.js - unified Minnesota Craft Brewers Guild Events PWA
const CACHE_VERSION = 'mncbg-sw-design-preview-1';
const CORE_CACHE = `${CACHE_VERSION}-core`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const DATA_URLS = new Set([
  '/apn/beverages',
  '/abr/beverages',
  '/mbc/data/conference-data.json'
]);

const CORE_ASSETS = [
  '/', '/index.html', '/privacy.html', '/app.css', '/theme.css', '/unified.css', '/theme.js', '/manifest.webmanifest', '/update-banner.js', '/vendor/jquery.min.js',
  '/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon-512-maskable.png', '/icons/logo_small.png', '/favicon.ico',

  '/apn/', '/apn/index.html', '/apn/list.html', '/apn/guide.html', '/apn/map.html', '/apn/sample-list.html', '/apn/print.html',
  '/apn/app.css', '/apn/csv-parser.js', '/apn/beverages', '/apn/favicon.ico',

  '/abr/', '/abr/index.html', '/abr/list.html', '/abr/guide.html', '/abr/map.html', '/abr/sample-list.html', '/abr/print.html',
  '/abr/app.css', '/abr/csv-parser.js', '/abr/beverages', '/abr/favicon.ico',

  '/mbc/', '/mbc/index.html', '/mbc/app.js', '/mbc/styles.css', '/mbc/data/conference-data.json'
];

const MEDIA_ASSETS = [
  '/apn/icons/apn-guide-1.png', '/apn/icons/apn-guide-2.png', '/apn/icons/apn-guide-3.png', '/apn/icons/apn-guide-4.png', '/apn/icons/apn-guide-5.png', '/apn/icons/apn-map-1.png', '/apn/icons/cover.png',
  '/abr/icons/abr-map-1.png', '/abr/icons/abr-map-2.png', '/abr/icons/cover.png',
  '/abr/icons/abr-guide-1.png', '/abr/icons/abr-guide-2.png', '/abr/icons/abr-guide-3.png', '/abr/icons/abr-guide-4.png', '/abr/icons/abr-guide-5.png', '/abr/icons/abr-guide-6.png', '/abr/icons/abr-guide-2026.pdf',
  '/mbc/assets/conference-map.png', '/mbc/assets/exhibitors-sponsors.png', '/mbc/assets/raffle-info.png', '/mbc/assets/husch-blackwell.png', '/mbc/assets/logo-small.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CORE_CACHE);
    await cache.addAll([...CORE_ASSETS, ...MEDIA_ASSETS]);
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => !key.startsWith(CACHE_VERSION)).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin === location.origin && url.pathname === '/version.json') {
    event.respondWith(fetch(request, { cache: 'no-store' }).catch(() => new Response('{}', { headers: { 'Content-Type': 'application/json' } })));
    return;
  }

  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirstHTML(request));
    return;
  }

  if (url.origin === location.origin && DATA_URLS.has(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  if (url.origin === location.origin && (CORE_ASSETS.includes(url.pathname) || MEDIA_ASSETS.includes(url.pathname))) {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(networkFirst(request));
});

async function networkFirstHTML(request) {
  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (response.ok) {
      const cache = await caches.open(CORE_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (_) {
    return (await caches.match(request)) || (await caches.match('/index.html'));
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  const fresh = fetch(request, { cache: 'no-store' }).then((response) => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);
  return cached || fresh || new Response('', { status: 503 });
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CORE_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (_) {
    return new Response('', { status: 503 });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response && (response.ok || response.type === 'opaque')) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (_) {
    return (await caches.match(request)) || new Response('', { status: 503 });
  }
}
