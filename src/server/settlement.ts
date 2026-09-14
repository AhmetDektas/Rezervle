import 'server-only';
import { prisma } from '@/lib/db';
import { paymentProvider } from './providers';
import { logSideEffectFailure } from './log';

/**
 * Hak ediş / iade durum makinesi.
 *
 * ESKİ DAVRANIŞ VE SORUNU: veritabanı önce `REFUNDED` ya da `RELEASED`
 * yapılıyor, sağlayıcı SONRA çağrılıyordu. Sağlayıcı `{ok:false}` dönerse
 * yalnızca açıklama notu değişiyor, durum sonuçlanmış olarak kalıyordu.
 * Fonksiyon sağlayıcının exception fırlatmasını da yakalamıyordu. Sonuç:
 * para hareket etmediği hâlde sistem "iade edildi" diyordu ve kayıt artık
 * `HELD` olmadığı için normal akışta yeniden denenemiyordu — yani sessizce
 * kaybolan iade.
 *
 * YENİ AKIŞ — son durumu yalnızca sağlayıcı teyidi yazar:
 *
 *   HELD ──▶ REFUND_PENDING ──(sağlayıcı ok)──▶ REFUNDED
 *     │            │
 *     │            └──(hata)──▶ REFUND_PENDING kalır, kuyruk tekrar dener
 *     │
 *     └──▶ RELEASE_PENDING ──(sağlayıcı ok)──▶ RELEASED
 *
 * Bekleyen durum kalıcı: süreç ölse, sağlayıcı düşse, dağıtım araya girse
 * bile kayıt "yapılacak iş" olarak duruyor ve `bekleyenMutabakatlar` onu
 * buluyor. Para hareketi belirsizken hiçbir zaman sonuçlanmış görünmüyor.
 */

export type MutabakatHedefi = 'REFUNDED' | 'RELEASED';

export const BEKLEYEN: Record<MutabakatHedefi, string> = {
  REFUNDED: 'REFUND_PENDING',
  RELEASED: 'RELEASE_PENDING',
};

/** Para sağlayıcıda duruyor mu? Rapor toplamları bunu "bloke" saymalı. */
export const BLOKE_DURUMLAR = ['HELD', 'REFUND_PENDING', 'RELEASE_PENDING'] as const;

function hedefiCoz(bekleyen: string): MutabakatHedefi | null {
  if (bekleyen === 'REFUND_PENDING') return 'REFUNDED';
  if (bekleyen === 'RELEASE_PENDING') return 'RELEASED';
  return null;
}

/**
 * Bekleyen bir mutabakatı sağlayıcıya sorup sonuçlandırır.
 *
 * Hiçbir koşulda fırlatmaz: çağıran akış (randevu durumu değiştirme) bu
 * yüzden kesilmemeli. Başarısızlık, kaydın bekleyen durumda KALMASI demek —
 * kaybolması değil.
 *
 * @returns sonuçlandıysa true
 */
export async function mutabakatiTamamla(reservationId: string): Promise<boolean> {
  const payment = await prisma.payment.findUnique({
    where: { reservationId },
    select: { settlementStatus: true, providerRef: true },
  });
  if (!payment) return false;

  const hedef = hedefiCoz(payment.settlementStatus);
  if (!hedef) return false;

  if (!payment.providerRef) {
    // Referans yoksa sağlayıcıda karşılığı olan bir tahsilat da yok.
    // Bekleyen durumda bırakmak sonsuza kadar denenen bir iş üretirdi.
    await prisma.payment.update({
      where: { reservationId },
      data: { settlementNote: 'Ödeme referansı yok — mutabakat elle yapılmalı.' },
    });
    return false;
  }

  let sonuc: { ok: boolean; reason?: string | undefined };
  try {
    const provider = paymentProvider();
    sonuc =
      hedef === 'REFUNDED'
        ? await provider.refund(payment.providerRef)
        : await provider.release(payment.providerRef);
  } catch (err) {
    // Exception da başarısızlıktır. Eski kod bunu hiç yakalamıyordu ve hata
    // randevu durumu değiştirme akışının ortasından yukarı fırlıyordu.
    logSideEffectFailure({ action: 'mutabakatiTamamla', meta: { reservationId, hedef } }, err);
    sonuc = { ok: false, reason: err instanceof Error ? err.message : 'bilinmiyor' };
  }

  if (!sonuc.ok) {
    await prisma.payment.update({
      where: { reservationId },
      data: {
        settlementNote: `Sağlayıcı hatası: ${sonuc.reason ?? 'bilinmiyor'} — tekrar denenecek`,
      },
    });
    return false;
  }

  // SON DURUM ANCAK BURADA YAZILIYOR: sağlayıcı teyit etti.
  await prisma.payment.update({
    where: { reservationId },
    data: {
      settlementStatus: hedef,
      releasedAt: new Date(),
      ...(hedef === 'REFUNDED'
        ? {
            status: 'REFUNDED',
            refundedAt: new Date(),
            settlementNote: 'Zamanında iptal — komisyon dahil tam iade',
          }
        : { settlementNote: 'Hak ediş tamamlandı' }),
    },
  });
  return true;
}

/**
 * Takılı kalmış mutabakatları bulur (kuyruk işi için).
 *
 * `once` penceresi, az önce başlatılmış ve hâlâ ilk denemesi süren kayıtları
 * dışarıda tutuyor: aynı tahsilat için iki eşzamanlı sağlayıcı çağrısı
 * yapmamak adına.
 */
export async function bekleyenMutabakatlar(once: Date, limit = 50): Promise<string[]> {
  const satirlar = await prisma.payment.findMany({
    where: {
      settlementStatus: { in: ['REFUND_PENDING', 'RELEASE_PENDING'] },
      // Bekleyen duruma GEÇİŞ anı; kaydın oluşturulma anı değil. Aylar önce
      // yapılmış bir tahsilat az önce iadeye girmiş olabilir.
      settlementPendingAt: { lt: once },
    },
    select: { reservationId: true },
    orderBy: { settlementPendingAt: 'asc' },
    take: limit,
  });
  return satirlar.map((s) => s.reservationId);
}
