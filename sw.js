// Офлайн: всё приложение лежит в кэше. При изменении файлов поднять VERSION.
const VERSION = 'v12';
const CACHE = `trenirovki-${VERSION}`;
const FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/app.js',
  './js/cycle.js',
  './js/data.js',
  './js/db.js',
  './js/progression.js',
  './js/sound.js',
  './js/state.js',
  './js/plan.js',
  './js/stats.js',
  './js/ui.js',
  './js/views.js',
  './js/programs.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  // cache: 'reload' — мимо HTTP-кэша браузера, чтобы не смешать старые и новые модули
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('trenirovki-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(
      caches.match(req, { ignoreSearch: true })
        .then((r) => r || fetch(req))
        .catch(() => caches.match('./index.html')),
    );
    return;
  }
  // из кэша сразу, свежую версию — в фоне на следующий запуск
  e.respondWith(caches.open(CACHE).then(async (cache) => {
    const cached = await cache.match(req, { ignoreSearch: true });
    const fresh = fetch(req, { cache: 'no-cache' }).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => cached);
    return cached || fresh;
  }));
});
