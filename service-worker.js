// service-worker.js
const CACHE = 'app-shell-v6'; // bump când faci modificări

// Fișierele aplicației (ajustează numele dacă ai alte fișiere)
const APP_SHELL = [
  './',
  './index.html',
  './app-boot.js',
  './pdf-viewer.js',
  './storage.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png'
];

// Install: precache pentru shell
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(APP_SHELL)));
  self.skipWaiting();
});

// Activate: curăță cache-urile vechi
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: filtrează doar http(s) GET; evită chrome-extension:// etc.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);

  // doar GET
  if (req.method !== 'GET') return;
  // doar http/https (altfel aruncă - fix pentru "Request scheme 'chrome-extension' is unsupported")
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // Cache-first pentru shell (aceeași origine)
  const isShell =
    url.origin === self.location.origin &&
    APP_SHELL.some(p => url.pathname.endsWith(p.replace('./', '/')));

  if (isShell) {
    e.respondWith(
      caches.match(req).then(r =>
        r ||
        fetch(req).then(resp => {
          const copy = resp.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
          return resp;
        })
      )
    );
    return;
  }

  // Pentru restul: doar same-origin cache; nu cache-ui cross-origin
  if (url.origin !== self.location.origin) {
    // pass-through; fallback la cache dacă eșuează rețeaua
    e.respondWith(fetch(req).catch(() => caches.match(req)));
    return;
  }

  // Same-origin network-first cu fallback la cache
  e.respondWith(
    fetch(req).then(resp => {
      const copy = resp.clone();
      caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      return resp;
    }).catch(() => caches.match(req))
  );
});
