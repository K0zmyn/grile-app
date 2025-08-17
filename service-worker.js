const CACHE = 'app-shell-v5'; // bump version

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);

  // Only handle http(s) GET requests
  if (req.method !== 'GET') return;
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // App shell: cache-first for same-origin shell files
  const isShell = (
    url.origin === self.location.origin &&
    APP_SHELL.some(p => url.pathname.endsWith(p.replace('./','/')))
  );
  if (isShell) {
    e.respondWith(
      caches.match(req).then(r => r || fetch(req).then(resp => {
        const copy = resp.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(()=>{});
        return resp;
      }))
    );
    return;
  }

  // For everything else:
  // - same-origin: network-first, then cache fallback, cache the response
  // - cross-origin: just pass-through (no caching)
  if (url.origin !== self.location.origin) {
    e.respondWith(fetch(req).catch(() => caches.match(req)));
    return;
  }

  e.respondWith(
    fetch(req).then(resp => {
      const copy = resp.clone();
      caches.open(CACHE).then(c => c.put(req, copy)).catch(()=>{});
      return resp;
    }).catch(() => caches.match(req))
  );
});
