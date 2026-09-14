/**
 * Push uç noktası doğrulaması (SSRF koruması).
 *
 * NEDEN VAR: abonelik uç noktasını TARAYICI veriyor ve sunucu o adrese kendisi
 * istek atıyor. Doğrulama yalnızca `z.string().url()` idi; bu "geçerli bir URL
 * mü" sorusunu cevaplıyor, "bu adrese istek atmak güvenli mi" sorusunu değil.
 * Saldırgan `https://127.0.0.1:8443/admin` ya da bulut sağlayıcılarının
 * `169.254.169.254` metadata adresini abonelik olarak kaydettirip sunucuyu
 * kendi iç ağına istek atmaya zorlayabilirdi — klasik SSRF.
 *
 * İKİ KATMAN:
 *   1. İZİN LİSTESİ (asıl koruma). Dünyada bir avuç push servisi var; hepsi
 *      bilinen alan adları. Listede olmayan hiçbir hedefe gidilmiyor.
 *   2. IP VE ÖZEL AĞ REDDİ (derinlik). Liste bir gün genişletilirse ya da
 *      ortam değişkeniyle yeni host eklenirse, IP hedefleri yine reddedilsin.
 *
 * Biçim doğrulaması tek başına SSRF koruması DEĞİLDİR:
 * https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html
 *
 * Saf modül: DB yok, ağ yok, `server-only` yok — böylece testlerde doğrudan
 * çağrılabiliyor ve hem eylem hem gönderim katmanı aynı kuralı kullanıyor.
 */

/**
 * Tarayıcıların kullandığı push servisleri.
 *
 * Eşleşme TAM HOST ya da NOKTA ÖNEKİ ile: "fcm.googleapis.com" tam eşleşir,
 * ".notify.windows.com" yalnızca alt alan adlarını kabul eder. Düz `endsWith`
 * kullansaydık `evil-notify.windows.com` gibi bir host da geçerdi.
 */
const VARSAYILAN_HOSTLAR = [
  'fcm.googleapis.com', // Chrome, Edge, Opera, Samsung Internet
  'android.googleapis.com', // eski GCM uç noktaları
  'updates.push.services.mozilla.com', // Firefox
  'web.push.apple.com', // Safari / iOS 16.4+
  '.notify.windows.com', // Edge (WNS)
  '.push.services.mozilla.com', // Mozilla bölgesel uç noktaları
] as const;

/**
 * Kendi push servisini çalıştıranlar için ek host listesi (virgülle ayrık).
 * Boş bırakılırsa yalnızca yukarıdaki liste geçerli.
 */
function ekHostlar(): string[] {
  return (process.env['PUSH_ALLOWED_HOSTS'] ?? '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

/** Host bir IP adresi mi? Push servisleri her zaman alan adı kullanır. */
function ipMi(host: string): boolean {
  // URL ayrıştırıcısı IPv6'yı köşeli parantezle veriyor.
  if (host.startsWith('[')) return true;
  // IPv4: dört sayı. "1.2.3.4" gibi. Alan adları rakamla bitmez.
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
}

export type PushHedefSonuc = { ok: true } | { ok: false; sebep: string };

export function pushHedefiDogrula(endpoint: string): PushHedefSonuc {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return { ok: false, sebep: 'Adres çözümlenemedi.' };
  }

  // HTTPS zorunlu: Web Push standardı zaten şifreli taşıma istiyor ve http
  // hedefi, araya girme ile yönlendirme için açık kapı olurdu.
  if (url.protocol !== 'https:') return { ok: false, sebep: 'Yalnızca https adresleri kabul edilir.' };

  // Kimlik bilgisi taşıyan URL'ler ("https://user:pass@host") vekil
  // ayrıştırıcılarını şaşırtmakta kullanılıyor; hiçbir push servisi kullanmaz.
  if (url.username || url.password) return { ok: false, sebep: 'Adres kimlik bilgisi içeremez.' };

  const host = url.hostname.toLowerCase();
  if (ipMi(host)) return { ok: false, sebep: 'IP adresi hedef olarak kabul edilmez.' };

  // Standart dışı port, bilinen bir push servisinde görülmez; iç ağ
  // taramasının en sık aracı olduğu için kapatılıyor.
  if (url.port && url.port !== '443') return { ok: false, sebep: 'Yalnızca 443 portu kabul edilir.' };

  const izinli = [...VARSAYILAN_HOSTLAR, ...ekHostlar()];
  const uyuyor = izinli.some((h) =>
    h.startsWith('.') ? host.endsWith(h) : host === h,
  );
  if (!uyuyor) return { ok: false, sebep: 'Bu push servisi desteklenmiyor.' };

  return { ok: true };
}

/** Kısa yol — koşul içinde okunabilirlik için. */
export function pushHedefiGuvenli(endpoint: string): boolean {
  return pushHedefiDogrula(endpoint).ok;
}
