// Offline működéshez: az app fájljait a telefon eltárolja.
// Hálózat elsőként, hogy a frissítések azonnal megjelenjenek.
const CACHE = 'koltsegek-v1';
const FAJLOK = ['./', 'index.html', 'style.css', 'config.js', 'app.js', 'manifest.webmanifest', 'icon-192.png', 'apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FAJLOK)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((kulcsok) => Promise.all(kulcsok.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((valasz) => {
        const masolat = valasz.clone();
        caches.open(CACHE).then((c) => c.put(e.request, masolat));
        return valasz;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
