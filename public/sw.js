/**
 * Rezzerv servis çalışanı.
 *
 * Amaç iddialı bir çevrimdışı deneyim değil, uygulamanın telefona kurulunca
 * yerel hissetmesi: statik varlıklar önbellekten hızlı gelir, ağ yoksa
 * anlamlı bir sayfa gösterilir. Randevu verileri asla önbelleğe alınmaz —
 * eski bir "boş saat" listesi göstermek yanlış bilgi vermek olurdu.
 */
const VERSION = 'rezzerv-v2';
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

// --- Push bildirimleri ----------------------------------------------------
//
// Sunucu tarafı: src/server/push.ts. Yük her zaman JSON:
//   { title, body, url?, tag? }

self.addEventListener('push', (event) => {
  // Yük olmadan da push gelebilir (bazı servisler "uyandırma" gönderiyor).
  // Böyle bir durumda sessiz kalmak yerine genel bir başlık gösteriyoruz:
  // izin verilmiş bir push'u hiç göstermemek, Chrome'un "sessiz push" olarak
  // işaretleyip izni geri almasına yol açıyor.
  let veri = { title: 'Rezzerv', body: 'Yeni bir bildiriminiz var.' };
  if (event.data) {
    try {
      veri = { ...veri, ...event.data.json() };
    } catch {
      veri.body = event.data.text() || veri.body;
    }
  }

  event.waitUntil(
    self.registration.showNotification(veri.title, {
      body: veri.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      // Aynı etiketli bildirim öncekinin yerine geçiyor: bir randevunun peş
      // peşe durum değişikliği telefonu doldurmasın.
      tag: veri.tag || 'rezzerv',
      renotify: Boolean(veri.tag),
      data: { url: veri.url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const hedef = new URL(event.notification.data?.url || '/', self.location.origin).href;

  // Açık bir sekme varsa ONU kullan: her tıklamada yeni sekme açmak,
  // bildirimlere birkaç kez dokunan kullanıcıda aynı uygulamadan beş sekme
  // bırakıyor.
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url === hedef && 'focus' in client) return client.focus();
      }
      for (const client of clients) {
        if ('navigate' in client && 'focus' in client) {
          return client.navigate(hedef).then((c) => c && c.focus());
        }
      }
      return self.clients.openWindow(hedef);
    }),
  );
});
