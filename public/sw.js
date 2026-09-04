/**
 * Rezzerv servis çalışanı.
 *
 * Amaç iddialı bir çevrimdışı deneyim değil, uygulamanın telefona kurulunca
 * yerel hissetmesi: statik varlıklar önbellekten hızlı gelir, ağ yoksa
 * anlamlı bir sayfa gösterilir. Randevu verileri asla önbelleğe alınmaz —
 * eski bir "boş saat" listesi göstermek yanlış bilgi vermek olurdu.
 */
const VERSION = 'rezzerv-v1';
const OFFLINE_URL = '/cevrimdisi.html';
const PRECACHE = [OFFLINE_URL, '/icon.svg', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Sayfalar: önce ağ. Ağ yoksa çevrimdışı sayfası.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  // Statik varlıklar: önbellekten ver, arka planda tazele.
  if (url.pathname.startsWith('/_next/static/') || PRECACHE.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(VERSION).then((cache) => cache.put(request, copy));
            }
            return response;
          })
          .catch(() => cached);
        return cached ?? network;
      }),
    );
  }
});
