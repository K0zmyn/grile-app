// service-worker.js
const CACHE = 'app-shell-v1';
const APP_SHELL = [
  './',
  './index.html',
  './app-boot.js',
  './pdf-viewer.js',
  './storage.js',
  './manifest.webmanifest'
  // adaugă aici css/imagini/scripturi ale tale
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // app shell: cache-first
  if (APP_SHELL.some(p => url.pathname.endsWith(p.replace('./','/')))) {
    e.respondWith(
      caches.match(e.request).then(r => r || fetch(e.request))
    );
    return;
  }
  // rest: network-first cu fallback cache
  e.respondWith(
    fetch(e.request).then(resp => {
      const copy = resp.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return resp;
    }).catch(() => caches.match(e.request))
  );
});
