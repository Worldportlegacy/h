/* World Port Legacy · service worker
   - La página y sus archivos se guardan en el teléfono: la app abre aunque no haya internet.
   - Con internet siempre se pide la versión nueva primero (si tarda más de 4 s, se usa la guardada).
   - NO toca el servidor de conversión ni la biblioteca (otros dominios): eso siempre va directo a la red.
   Cada vez que subas una versión nueva de la página, cambia VERSION para que los teléfonos se actualicen. */
const VERSION = 'wpl-2026-11-b1';
const CORE = ['index.html', '404.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => Promise.allSettled(CORE.map((u) => c.add(u)))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION && k.startsWith('wpl-')).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

function conTiempo(req, ms) {
  const ac = new AbortController(), t = setTimeout(() => ac.abort(), ms);
  return fetch(req, {signal: ac.signal}).finally(() => clearTimeout(t));
}

self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;      // servidor, Supabase, fuentes: directo a la red
  const esPagina = req.mode === 'navigate' || req.destination === 'document';
  if (esPagina) {
    e.respondWith((async () => {
      const cache = await caches.open(VERSION);
      try {
        const r = await conTiempo(req, 4000);
        if (r && r.ok) cache.put('index.html', r.clone());
        return r;
      } catch (err) {
        return (await cache.match('index.html')) || (await cache.match('./')) || (await cache.match('404.html')) ||
          new Response('Sin conexión', {status: 503, headers: {'Content-Type': 'text/plain; charset=utf-8'}});
      }
    })());
    return;
  }
  e.respondWith((async () => {
    const cache = await caches.open(VERSION), hit = await cache.match(req);
    const red = fetch(req).then((r) => { if (r && r.ok) cache.put(req, r.clone()); return r; }).catch(() => null);
    return hit || (await red) || new Response('', {status: 504});
  })());
});
