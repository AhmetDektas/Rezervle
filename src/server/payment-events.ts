import 'server-only';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import type { WebhookEvent } from './providers';
import { notifyUser, notifyBusiness } from './notifications';
import { logError } from './log';
import { longDate } from '@/lib/format';
import { hhmm } from '@/lib/time';

/**
 * Ödeme olaylarının işlenmesi (T3).
 *
 * Webhook rotası yalnızca imzayı doğrulayıp burayı çağırıyor; karar burada.
 * Ayrı dosya olmasının sebebi test edilebilirlik: olay işleme HTTP olmadan
 * doğrudan çağrılabiliyor.
 *
 *   webhook ──▶ imza ──▶ applyPaymentEvent
 *                              │
 *                              ├─ zaten işlendi mi? ──▶ evet: hiçbir şey yapma
 *                              ├─ payment.paid  ──▶ PAID + HELD + bildirim
 *                              └─ payment.failed ──▶ iptal, saat serbest
 */

export type EventOutcome = 'uygulandi' | 'zaten-islendi' | 'kayit-yok' | 'gec-kalmis';

/**
 * Olayı bir kez uygular.
 *
 * İdempotens `ProcessedEvent` birincil anahtarıyla: aynı olay kimliği ikinci
 * kez yazılmaya çalışılınca P2002 alınır ve bu "zaten işlendi" demektir.
 * Kaydı işlemin İÇİNDE yazıyoruz — önce yazıp sonra çalışmak, arada süreç
 * ölürse olayı sonsuza dek kaybetmek olurdu.
 */
export async function applyPaymentEvent(event: WebhookEvent): Promise<EventOutcome> {
  const reservation = await prisma.reservation.findUnique({
    where: { code: event.reference },
    select: {
      id: true,
      businessId: true,
      customerId: true,
      staffId: true,
      status: true,
      date: true,
      startMin: true,
      depositStatus: true,
      business: { select: { name: true, slug: true } },
      service: { select: { name: true } },
      staff: { select: { displayName: true } },
    },
  });
  if (!reservation) return 'kayit-yok';

  // Süresi dolduğu için iptal edilmiş bir kayda geç gelen "ödendi" olayı:
  // saat çoktan başkasına satılmış olabilir. Sessizce yutmak yerine
  // loglanıyor — para alınmış ama randevu yok demek, iade gerektirir.
  if (reservation.status === 'CANCELLED') {
    logError(
      {
        action: 'applyPaymentEvent',
        userId: reservation.customerId,
        meta: { olay: event.type, kod: event.reference, durum: 'iptal-edilmis-kayda-odeme' },
      },
      new Error('Ödeme olayı iptal edilmiş rezervasyona ulaştı; iade gerekebilir.'),
    );
    await isaretle(event);
    return 'gec-kalmis';
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Aynı işlemde: önce "işlendi" damgası, sonra etki. Damga çakışırsa
      // işlem bütünüyle geri alınır ve etki iki kez uygulanmaz.
      await tx.processedEvent.create({
        data: { id: event.id, type: event.type, reference: event.reference },
      });

      if (event.type === 'payment.paid') {
        await tx.reservation.update({
          where: { id: reservation.id },
          data: { depositStatus: 'PAID', paymentDeadline: null },
        });
        await tx.payment.update({
          where: { reservationId: reservation.id },
          data: {
            status: 'PAID',
            paidAt: new Date(),
            providerRef: event.providerRef,
            settlementStatus: 'HELD',
          },
        });
      } else {
        // Ödeme başarısız: saat hemen serbest bırakılıyor. Beklemek, ödemesi
        // alınamamış bir kayıt için popüler bir saati boşa tutmak olurdu.
        await tx.reservation.update({
          where: { id: reservation.id },
          data: {
            status: 'CANCELLED',
            slotKey: null,
            cancelledAt: new Date(),
            cancelReason: 'Kapora tahsil edilemedi',
            depositStatus: 'NONE',
            paymentDeadline: null,
          },
        });
        await tx.payment.update({
          where: { reservationId: reservation.id },
          data: {
            status: 'FAILED',
            providerRef: event.providerRef,
            failureReason: event.reason ?? 'Ödeme tamamlanmadı',
          },
        });
      }
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return 'zaten-islendi';
    }
    throw err;
  }

  await bildir(event, reservation);
  return 'uygulandi';
}

/** Etkisi olmayan olayı da damgalıyoruz ki tekrar teslimatta yeniden inceleme olmasın. */
async function isaretle(event: WebhookEvent): Promise<void> {
  try {
    await prisma.processedEvent.create({
      data: { id: event.id, type: event.type, reference: event.reference },
    });
  } catch {
    // Zaten damgalıysa yapılacak bir şey yok.
  }
}

type ReservationOzet = {
  id: string;
  businessId: string;
  customerId: string;
  staffId: string;
  date: string;
  startMin: number;
  business: { name: string; slug: string };
  service: { name: string };
  staff: { displayName: string };
};

/**
 * Bildirim işlemin DIŞINDA: sağlayıcı arızası ödeme kaydını geri almamalı.
 * Aynı sözleşme `notifyUser` içinde de var (GAP-1).
 */
async function bildir(event: WebhookEvent, r: ReservationOzet): Promise<void> {
  const ne = `${longDate(r.date)} ${hhmm(r.startMin)}`;
  if (event.type === 'payment.paid') {
    await notifyUser({
      userId: r.customerId,
      kind: 'RESERVATION',
      title: `Randevunuz onaylandı — ${r.business.name}`,
      body: `${r.service.name} · ${ne} · ${r.staff.displayName}`,
      href: `/randevularim/${r.id}`,
      alsoSend: true,
    });
    await notifyBusiness(r.businessId, r.staffId, {
      kind: 'RESERVATION',
      title: 'Yeni randevu',
      body: `${r.service.name} · ${ne}`,
      href: `/panel/${r.business.slug}/takvim?tarih=${r.date}`,
    });
    return;
  }
  await notifyUser({
    userId: r.customerId,
    kind: 'RESERVATION',
    title: 'Ödeme tamamlanamadı',
    body: `${r.business.name} · ${ne} randevunuz oluşturulamadı. Kapora tahsil edilemedi.`,
    href: '/randevularim',
    alsoSend: true,
  });
}
