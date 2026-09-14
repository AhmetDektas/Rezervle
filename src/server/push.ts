import 'server-only';
import webpush, { WebPushError } from 'web-push';
import { prisma } from '@/lib/db';
import { logSideEffectFailure } from './log';
import { appUrl } from '@/lib/constants';
import { pushHedefiGuvenli } from '@/lib/push-endpoint';

/**
 * Web Push gönderimi (VAPID).
 *
 * NEDEN VAR: randevu bildirimi bugün yalnızca e-posta ve SMS ile gidiyor.
 * İşletme sahibi için ikisi de yanlış kanal — panel açık, telefonu elinde ve
 * her SMS para. Push onun için hem anlık hem bedava.
 *
 * MÜŞTERİ İÇİN YERİNE GEÇMEZ, YANINA EKLENİR. Üç sebep:
 *   1. iOS'ta web push yalnızca uygulama ana ekrana eklenmişse çalışıyor
 *      (16.4+). Safari'den randevu alan müşteriye hiç ulaşmaz.
 *   2. Müşteri yılda birkaç kez randevu alıyor; uygulamayı kurmaz.
 *   3. Push açık izin istiyor ve çoğu kişi reddediyor.
 * Hatırlatma ulaşmazsa müşteri gelmiyor; "gelmedi" doğrudan işletmenin
 * zararı. Bu yüzden müşteri tarafında SMS/e-posta birincil kalıyor.
 *
 * ANAHTAR YOKSA SESSİZCE KAPALI: VAPID anahtarları tanımlı değilse gönderim
 * hiç denenmez. Uygulama içi bildirim zaten yazıldığı için kimse bildirimsiz
 * kalmaz; kurulum eksikliği çalışmayı durdurmamalı.
 */

const PUBLIC = process.env['VAPID_PUBLIC_KEY'] ?? '';
const PRIVATE = process.env['VAPID_PRIVATE_KEY'] ?? '';
// Push servisleri iletişim adresi istiyor: gönderim sorunlarında bu adrese
// yazıyorlar. mailto: ya da https:// olmak zorunda.
const SUBJECT = process.env['VAPID_SUBJECT'] ?? appUrl();

/** Tek bir push isteğinin üst sınırı (bkz. pushGonder içindeki gerekçe). */
const PUSH_TIMEOUT_MS = 5_000;

/** Kullanıcı başına abone cihaz sayısı üst sınırı (bkz. pushAbone). */
const CIHAZ_SINIRI = 10;

let hazir = false;

export function pushYapilandirildi(): boolean {
  return PUBLIC.length > 0 && PRIVATE.length > 0;
}

/** İstemcinin aboneliği kurarken ihtiyacı olan açık anahtar. */
export function pushAcikAnahtar(): string | null {
  return pushYapilandirildi() ? PUBLIC : null;
}

function hazirla(): void {
  if (hazir) return;
  webpush.setVapidDetails(SUBJECT, PUBLIC, PRIVATE);
  hazir = true;
}

export type PushYuk = {
  title: string;
  body: string;
  /** Bildirime tıklanınca açılacak uygulama içi yol. */
  url?: string;
  /**
   * Aynı etiketli bildirim öncekinin yerine geçer. Randevu kimliğini vermek,
   * bir randevunun peş peşe üç durum değişikliğinde telefonu üç kez
   * doldurmasını engelliyor.
   */
  tag?: string;
};

/**
 * Kullanıcının TÜM cihazlarına gönderir.
 *
 * Hiçbir koşulda fırlatmaz: push, asıl işlemin (randevu oluşturma, iptal)
 * başarı şartı değil. Bir cihaz düşerse diğerleri denenmeye devam eder.
 */
export async function pushGonder(userId: string, yuk: PushYuk): Promise<number> {
  try {
    return await gonder(userId, yuk);
  } catch (err) {
    // HİÇBİR KOŞULDA FIRLATMAZ. `notifyUser` bunu bekliyor ve `notifyUser`
    // randevu oluşturma akışının içinde: abonelik sorgusu ya da VAPID kurulumu
    // patladığında müşteri "Beklenmeyen bir hata oluştu" görüp randevusunun
    // oluşmadığını sanırdı — oysa randevu çoktan yazılmış olurdu.
    //
    // Önceden yalnızca tek tek gönderimler korumalıydı; sorgu ve kurulum
    // try'ın DIŞINDAYDI.
    logSideEffectFailure({ action: 'pushGonder', userId }, err);
    return 0;
  }
}

async function gonder(userId: string, yuk: PushYuk): Promise<number> {
  if (!pushYapilandirildi()) return 0;

  const kayitlilar = await prisma.pushSubscription.findMany({
    where: { userId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });
  if (kayitlilar.length === 0) return 0;

  // Kayıt anındaki doğrulamaya ek olarak GÖNDERİM anında da süzülüyor: izin
  // listesi daraltıldığında ya da doğrulama öncesinde yazılmış satırlar
  // kaldığında sunucu yine de yanlış hedefe istek atmasın.
  const abonelikler = kayitlilar.filter((a) => pushHedefiGuvenli(a.endpoint));
  if (abonelikler.length === 0) return 0;

  hazirla();
  const govde = JSON.stringify(yuk);
  const olenler: string[] = [];
  let gonderilen = 0;

  await Promise.all(
    abonelikler.map(async (a) => {
      try {
        await webpush.sendNotification(
          { endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } },
          govde,
          // TIMEOUT ZORUNLU. `notifyUser` bu çağrıyı bekliyor ve `notifyUser`
          // randevu oluşturma akışının içinde. web-push varsayılan olarak
          // hiçbir süre sınırı koymuyor (https.request'in kendi varsayılanı
          // yok): yanıt vermeyen bir push servisi randevu isteğini süresiz
          // askıda bırakırdı. Müşteri "randevu oluşturuluyor"da kalır.
          //
          // 5 sn cömert: sağlıklı push servisleri 200-400 ms'de dönüyor.
          // Süre aşımı hata olarak yukarı çıkıyor, 404/410 olmadığı için
          // abonelik silinmiyor ve bildirim bir sonraki olayda tekrar deneniyor.
          { TTL: 60 * 60 * 12, timeout: PUSH_TIMEOUT_MS },
        );
        gonderilen += 1;
      } catch (err) {
        // 404/410: abonelik artık yok (izin kaldırıldı, uygulama silindi,
        // tarayıcı verisi temizlendi). Bunlar hata değil, temizlik sinyali —
        // silinmezlerse her bildirimde boşuna ağ turu atarız ve push servisi
        // ısrarcı göndericiyi kısıtlar.
        if (err instanceof WebPushError && (err.statusCode === 404 || err.statusCode === 410)) {
          olenler.push(a.id);
          return;
        }
        logSideEffectFailure(
          { action: 'pushGonder', userId, meta: { endpoint: a.endpoint.slice(0, 60) } },
          err,
        );
      }
    }),
  );

  if (olenler.length > 0) {
    await prisma.pushSubscription.deleteMany({ where: { id: { in: olenler } } });
  }
  return gonderilen;
}

/**
 * Aboneliği kaydeder ya da tazeler.
 *
 * `endpoint` tekil: aynı cihaz yeniden abone olduğunda (tarayıcı anahtarları
 * döndürebiliyor) yeni satır değil güncelleme oluyor. Sahibi de güncelleniyor
 * — ortak kullanılan bir cihazda başka bir hesaba geçildiğinde bildirimlerin
 * önceki kullanıcıya gitmesi gerekiyordu, artık gitmiyor.
 */
export async function pushAbone(
  userId: string,
  abone: { endpoint: string; p256dh: string; auth: string; userAgent?: string },
): Promise<void> {
  const veri = {
    userId,
    p256dh: abone.p256dh,
    auth: abone.auth,
    userAgent: (abone.userAgent ?? '').slice(0, 255),
    lastSeenAt: new Date(),
  };
  await prisma.pushSubscription.upsert({
    where: { endpoint: abone.endpoint },
    create: { endpoint: abone.endpoint, ...veri },
    update: veri,
  });

  // CİHAZ SINIRI. Abonelik sayısı sınırsızdı: her tarayıcı profili, her gizli
  // pencere yeni bir uç nokta üretiyor ve hiçbiri kendiliğinden silinmiyor.
  // Sınırsız satır hem her bildirimde artan gönderim maliyeti hem de kolay
  // şişirilebilen bir tablo demekti. En eski görülen kayıt düşüyor.
  const fazlasi = await prisma.pushSubscription.findMany({
    where: { userId },
    orderBy: { lastSeenAt: 'desc' },
    select: { id: true },
    skip: CIHAZ_SINIRI,
  });
  if (fazlasi.length > 0) {
    await prisma.pushSubscription.deleteMany({
      where: { id: { in: fazlasi.map((f) => f.id) } },
    });
  }
}

/**
 * Aboneliği kaldırır — YALNIZCA sahibinin kaydını.
 *
 * `endpoint` tekil olduğu için sorguya userId eklemeden de "doğru" satırı
 * bulurdu; ama o zaman uç noktayı ele geçiren biri başkasının bildirimlerini
 * kapatabilirdi. Yetki sorgunun içinde olmalı, çağıranın nezaketinde değil.
 */
export async function pushAbonelikBitir(userId: string, endpoint: string): Promise<void> {
  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId } });
}

/** Kullanıcının kaç cihazı abone — panelde durumu göstermek için. */
export async function pushCihazSayisi(userId: string): Promise<number> {
  if (!pushYapilandirildi()) return 0;
  return prisma.pushSubscription.count({ where: { userId } });
}
