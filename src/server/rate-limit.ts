import 'server-only';
import IORedis from 'ioredis';
import { headers } from 'next/headers';
import { DomainError } from './errors';
import { logSideEffectFailure } from './log';

/**
 * Hız sınırı.
 *
 * Kaba kuvvet parola denemesi, otomatik hesap açma ve rezervasyon spam'i için
 * tek yüzey. Sayaç Redis'te; kuyruk zaten Redis istiyor, ikinci bir altyapı
 * gerekmiyor.
 *
 *   eylem ──▶ enforceRateLimit(kural, anahtar)
 *                    │
 *                    ├─ sayaç < sınır ──▶ devam
 *                    └─ sayaç ≥ sınır ──▶ DomainError (kullanıcı süreyi görür)
 *
 * **Katılım isteğe bağlı.** Bu modül bir middleware değil; her eylem kendisi
 * çağırıyor. Sebebi E4: ödeme sağlayıcısının webhook'u tekrar teslim ettiğinde
 * hız sınırına takılmamalı, yoksa sağlayıcı denemekten vazgeçer ve ödeme
 * durumu sonsuza dek yarım kalır. Genel bir middleware olsaydı webhook'u
 * *muaf tutmayı unutmak* mümkün olurdu; katılımcı tasarımda unutmak zaten
 * varsayılan. Webhook'un koruması hız sınırı değil, imza doğrulaması.
 *
 * **Arıza duruşu: açık.** Redis erişilemezse istek geçer ve uyarı loglanır.
 * Ters kurgu (Redis yokken herkesi reddetmek) bir Redis kesintisini tam site
 * kesintisine çevirirdi; hız sınırının önlediği kötüye kullanım bundan daha
 * ucuz. Bedeli açık: kesinti sırasında koruma yok.
 */

export type RateLimitRule = {
  /** Log ve Redis anahtarında görünen ad. */
  action: string;
  limit: number;
  windowSec: number;
};

/**
 * Kurallar tek yerde: sınırları eylemlerin içine dağıtmak, "acaba giriş kaç
 * denemeye izin veriyordu" sorusunu her seferinde kod okumaya çevirirdi.
 *
 * Sayılar bilinçli olarak cömert. Amaç insan trafiğini değil otomatik
 * trafiği kesmek: hesap açan bir betik yüzlerce istek yapar, gerçek bir
 * kullanıcı saatte üç işletme başvurusu yapmaz.
 */
export const RATE_LIMITS = {
  /**
   * Yalnızca BAŞARISIZ giriş sayılır (bkz. clearRateLimit). Kaba kuvvet
   * tekrarlı başarısızlıktır; başarılı girişi saymak, gün boyu çalışan
   * gerçek kullanıcıyı cezalandırmaktan başka işe yaramaz.
   */
  giris: { action: 'giris', limit: 10, windowSec: 900 },
  kayit: { action: 'kayit', limit: 20, windowSec: 3600 },
  isletmeBasvurusu: { action: 'isletme-basvurusu', limit: 10, windowSec: 3600 },
  randevu: { action: 'randevu', limit: 15, windowSec: 3600 },
  degerlendirme: { action: 'degerlendirme', limit: 10, windowSec: 3600 },
} as const satisfies Record<string, RateLimitRule>;

let client: IORedis | null = null;
let uyarildi = false;

/**
 * Sayaç için ayrı bağlantı.
 *
 * Kuyruğun bağlantısı `maxRetriesPerRequest: null` ile açılıyor: BullMQ'nun
 * bloklayan komutları bunu istiyor. Aynı bağlantıyı burada kullanmak, Redis
 * düştüğünde sayaç komutunun sonsuza dek kuyrukta beklemesi ve isteğin
 * asılması demekti. Burada tersi gerekiyor — hızlı başarısızlık.
 */
function redis(): IORedis | null {
  const url = process.env['REDIS_URL'];
  if (!url) {
    if (!uyarildi) {
      uyarildi = true;
      const mesaj = 'REDIS_URL tanımlı değil: hız sınırı devre dışı.';
      if (process.env.NODE_ENV === 'production') console.error(mesaj);
      else console.warn(mesaj);
    }
    return null;
  }
  if (!client) {
    // enableOfflineQueue kapatmak + lazyConnect cazip görünüyor ama ikisi
    // birlikte İLK komutu her zaman düşürüyor: bağlantı daha kurulmadan komut
    // geliyor ve kuyruk kapalı olduğu için anında hata alıyor. Arıza duruşu
    // açık olduğundan bu sessizce "sınır yok" demek olurdu — sayan hiçbir şey
    // olmadan yeşil görünen bir koruma. Bunun yerine kuyruk açık, gecikme
    // zaman aşımlarıyla sınırlanıyor.
    client = new IORedis(url, {
      maxRetriesPerRequest: 1,
      connectTimeout: 1000,
      commandTimeout: 1000,
    });
    // Bağlantı hatası yakalanmazsa ioredis süreci düşürür.
    client.on('error', () => {});
  }
  return client;
}

/** Testlerin bağlantıyı sıfırlaması için. */
export function resetRateLimitClient(): void {
  client = null;
  uyarildi = false;
}

function key(rule: RateLimitRule, identifier: string, now: number): string {
  // Sabit pencere: pencere numarası anahtarın parçası, TTL ile kendiliğinden
  // temizleniyor. Kayan pencereye göre kusuru, pencere sınırında iki katı
  // isteğe izin verebilmesi (sonun 10'u + başın 10'u). Kaba kuvvet için
  // önemsiz; karşılığında tek INCR ile hallolan bir sayaç.
  const pencere = Math.floor(now / (rule.windowSec * 1000));
  return `rl:${rule.action}:${identifier}:${pencere}`;
}

export type RateLimitResult = { allowed: boolean; retryAfterSec: number };

/** Sayacı artırır ve sınırı aşıp aşmadığını söyler. Reddetmez. */
export async function checkRateLimit(
  rule: RateLimitRule,
  identifier: string,
  now: number = Date.now(),
): Promise<RateLimitResult> {
  const r = redis();
  if (!r) return { allowed: true, retryAfterSec: 0 };

  try {
    const k = key(rule, identifier, now);
    const sayac = await r.incr(k);
    if (sayac === 1) await r.expire(k, rule.windowSec);
    if (sayac <= rule.limit) return { allowed: true, retryAfterSec: 0 };

    const ttl = await r.ttl(k);
    return { allowed: false, retryAfterSec: ttl > 0 ? ttl : rule.windowSec };
  } catch (err) {
    // Arıza duruşu açık: sayaç okunamıyorsa istek geçer. Kimlik loglanmıyor
    // (log sözleşmesi: kimlik evet, içerik hayır — IP ikisinin arasında ve
    // kötüye kullanım sayacının dışında bir yerde durmasına gerek yok).
    logSideEffectFailure({ action: 'rateLimit', meta: { kural: rule.action } }, err);
    return { allowed: true, retryAfterSec: 0 };
  }
}

/**
 * Sayacı ARTIRMADAN yalnızca durumu okur.
 *
 * Girişte kapı bu: her deneme sayılacak olsaydı, sınırı aşan istek parolayı
 * denemeden reddedilirken sayacı bir kez daha artırır ve pencere hiç
 * boşalmazdı. Başarısızlığı ayrıca `recordRateLimitFailure` sayıyor.
 */
export async function peekRateLimit(
  rule: RateLimitRule,
  identifier: string,
  now: number = Date.now(),
): Promise<RateLimitResult> {
  const r = redis();
  if (!r) return { allowed: true, retryAfterSec: 0 };

  try {
    const k = key(rule, identifier, now);
    const ham = await r.get(k);
    const sayac = ham ? Number(ham) : 0;
    if (sayac < rule.limit) return { allowed: true, retryAfterSec: 0 };
    const ttl = await r.ttl(k);
    return { allowed: false, retryAfterSec: ttl > 0 ? ttl : rule.windowSec };
  } catch (err) {
    logSideEffectFailure({ action: 'rateLimitPeek', meta: { kural: rule.action } }, err);
    return { allowed: true, retryAfterSec: 0 };
  }
}

/** Sınır zaten aşılmışsa reddeder; sayacı artırmaz. */
export async function assertNotRateLimited(
  rule: RateLimitRule,
  identifier: string,
  now: number = Date.now(),
): Promise<void> {
  const sonuc = await peekRateLimit(rule, identifier, now);
  if (sonuc.allowed) return;
  throw new DomainError(rateLimitMessage(sonuc.retryAfterSec), 'RATE_LIMITED');
}

/** Bir başarısız denemeyi sayar. Sonucu önemsizdir; kapı bir sonraki istekte. */
export async function recordRateLimitFailure(
  rule: RateLimitRule,
  identifier: string,
  now: number = Date.now(),
): Promise<void> {
  await checkRateLimit(rule, identifier, now);
}

function rateLimitMessage(retryAfterSec: number): string {
  return `Çok fazla deneme yaptınız. ${sureMetni(retryAfterSec)} sonra tekrar deneyin.`;
}

/** Bu isteği sayar ve sınırı aşıyorsa reddeder. */
export async function enforceRateLimit(
  rule: RateLimitRule,
  identifier: string,
  now: number = Date.now(),
): Promise<void> {
  const sonuc = await checkRateLimit(rule, identifier, now);
  if (sonuc.allowed) return;
  throw new DomainError(rateLimitMessage(sonuc.retryAfterSec), 'RATE_LIMITED');
}

/**
 * Sayacı sıfırlar. Başarılı girişten sonra çağrılıyor: parolasını hatırlayan
 * kullanıcı, önceki hatalı denemeleri yüzünden kilitlenmemeli.
 */
export async function clearRateLimit(
  rule: RateLimitRule,
  identifier: string,
  now: number = Date.now(),
): Promise<void> {
  const r = redis();
  if (!r) return;
  try {
    await r.del(key(rule, identifier, now));
  } catch (err) {
    logSideEffectFailure({ action: 'rateLimitClear', meta: { kural: rule.action } }, err);
  }
}

function sureMetni(saniye: number): string {
  if (saniye < 60) return `${saniye} saniye`;
  return `${Math.ceil(saniye / 60)} dakika`;
}

/**
 * İstemci kimliği.
 *
 * Ters vekil arkasında `x-forwarded-for` ilk sıradaki gerçek istemcidir.
 * Başlık yoksa (yerel geliştirme) herkes aynı kovaya düşer; sınırlar bu
 * yüzden cömert seçildi.
 *
 * IP kalıcı olarak saklanmıyor: yalnızca pencere boyunca yaşayan bir Redis
 * anahtarının parçası ve hiçbir log satırına girmiyor.
 */
export async function clientIdentifier(): Promise<string> {
  const h = await headers();
  const forwarded = h.get('x-forwarded-for');
  const ilk = forwarded?.split(',')[0]?.trim();
  return ilk || h.get('x-real-ip') || 'yerel';
}
