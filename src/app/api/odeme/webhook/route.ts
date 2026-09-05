import { NextResponse } from 'next/server';
import { paymentProvider } from '@/server/providers';
import { applyPaymentEvent } from '@/server/payment-events';
import { logError } from '@/server/log';

/**
 * Ödeme sağlayıcısı webhook'u (T3).
 *
 * **Hız sınırı YOK ve bu bilinçli (E4).** Sağlayıcı başarısız teslimatı
 * tekrar dener; art arda gelen tekrarlar sınıra takılsaydı sağlayıcı
 * denemekten vazgeçer ve ödeme durumu kalıcı olarak yarım kalırdı — müşteri
 * parayı ödemiş ama randevusu onaylanmamış olurdu. Buranın koruması sınır
 * değil, HMAC imzası: imzasız istek hiçbir şeye dokunamaz.
 *
 * Ham gövde okunuyor: JSON'a çevirip yeniden dizmek anahtar sırasını ve
 * boşlukları değiştirir, imza tutmaz.
 *
 * Yanıt sözleşmesi:
 *   200 — işlendi ya da zaten işlenmişti (sağlayıcı tekrar denemesin)
 *   400 — imza geçersiz ya da gövde okunamadı
 *   500 — bizim tarafta arıza (sağlayıcı TEKRAR DENESİN)
 */
export async function POST(request: Request): Promise<NextResponse> {
  const rawBody = await request.text();
  const signature = request.headers.get('x-rezzerv-signature');

  const event = paymentProvider().verifyWebhook(rawBody, signature);
  if (!event) {
    // Gövde loglanmıyor: imzasız bir istek kart/kişi verisi taşıyor olabilir
    // ve log sözleşmesi içerik yasaklıyor.
    logError(
      { action: 'paymentWebhook', meta: { imza: signature ? 'gecersiz' : 'yok' } },
      new Error('Webhook imzası doğrulanamadı.'),
    );
    return NextResponse.json({ hata: 'imza' }, { status: 400 });
  }

  try {
    const sonuc = await applyPaymentEvent(event);
    // "kayit-yok" da 200: bilinmeyen referans tekrar denemekle bulunmaz,
    // sağlayıcıyı sonsuz döngüye sokmanın anlamı yok.
    return NextResponse.json({ sonuc }, { status: 200 });
  } catch (err) {
    // 500 kasıtlı: geçici bir veritabanı arızasında sağlayıcının tekrar
    // denemesini istiyoruz, yoksa ödeme sessizce yarım kalır.
    logError(
      { action: 'paymentWebhook', meta: { olay: event.type, olayId: event.id } },
      err,
    );
    return NextResponse.json({ hata: 'islenemedi' }, { status: 500 });
  }
}
