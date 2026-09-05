import 'server-only';
import { prisma } from '@/lib/db';
import { defineJob } from '../define-job';
import { notifyUser } from '@/server/notifications';

/**
 * Süresi dolan ödemeleri serbest bırakır (T5).
 *
 * 3DS asenkron: müşteri bankanın sayfasına gidiyor ve geri dönmeyebilir —
 * sekmeyi kapatır, SMS gelmez, vazgeçer. O sırada saat ona ayrılmış durumda.
 * Bu iş olmadan terk edilen her ödeme, popüler bir saati sonsuza dek kilitler
 * ve işletme sebebini asla anlayamaz.
 *
 *   randevu (depositStatus=PENDING, paymentDeadline=T)
 *        │
 *        ├── webhook payment.paid gelirse ──▶ PAID, deadline null
 *        └── T geçtiyse ──▶ CANCELLED, slotKey null ──▶ saat yeniden satılır
 *
 * `paymentDeadline` null'a çekilmesi ödemenin sonuçlandığının işareti; bu iş
 * yalnızca dolu olanlara bakıyor. Yarış durumu: webhook ile bu iş aynı anda
 * çalışabilir. Güncelleme koşullu (`depositStatus: 'PENDING'`), yani ikisinden
 * yalnızca biri kaydı değiştirebiliyor.
 */

export type ReleaseExpiredPayload = { now?: string };

export const releaseExpiredJob = defineJob<ReleaseExpiredPayload>({
  name: 'odeme-suresi-doldu',
  async handler(payload, ctx) {
    const now = payload.now ? new Date(payload.now) : new Date();

    const suresiDolanlar = await prisma.reservation.findMany({
      where: {
        depositStatus: 'PENDING',
        paymentDeadline: { lt: now },
        status: { notIn: ['CANCELLED', 'COMPLETED'] },
      },
      select: { id: true, code: true, customerId: true, business: { select: { name: true } } },
      take: 200,
    });

    let serbest = 0;
    for (const r of suresiDolanlar) {
      // Koşullu güncelleme: webhook araya girip PAID yaptıysa updateMany 0
      // satır günceller ve ödenmiş bir randevuyu iptal etmiş olmayız.
      const sonuc = await prisma.reservation.updateMany({
        where: { id: r.id, depositStatus: 'PENDING' },
        data: {
          status: 'CANCELLED',
          slotKey: null,
          depositStatus: 'NONE',
          paymentDeadline: null,
          cancelledAt: now,
          cancelReason: 'Ödeme süresi doldu',
        },
      });
      if (sonuc.count === 0) continue;

      serbest += 1;
      await prisma.payment.updateMany({
        where: { reservationId: r.id, status: 'PENDING' },
        data: { status: 'FAILED', failureReason: 'Ödeme süresi doldu' },
      });

      // Müşteri neden randevusunun olmadığını bilmeli; sessiz iptal en kötüsü.
      await notifyUser({
        userId: r.customerId,
        kind: 'RESERVATION',
        title: 'Randevunuz oluşturulamadı',
        body: `${r.business.name} · ödeme tamamlanmadığı için saat serbest bırakıldı. Yeniden deneyebilirsiniz.`,
        href: '/kesfet',
        alsoSend: true,
      });
    }

    ctx.meta = { ...(ctx.meta ?? {}), bulunan: suresiDolanlar.length, serbest };
  },
});
