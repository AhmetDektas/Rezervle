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

export type EventOutcome =
  | 'uygulandi'
  | 'zaten-islendi'
  | 'kayit-yok'
  | 'gec-kalmis'
  /** Olay bu ödemeye ait değil ya da tutarı tutmuyor. */
  | 'uyumsuz'
  /** Sonuçlanmış bir ödemeyi geriye almaya çalışan olay. */
  | 'gecersiz-gecis';

/**
 * Olayı bir kez uygular.
 *
 * İdempotens `ProcessedEvent` birincil anahtarıyla: aynı olay kimliği ikinci
 * kez yazılmaya çalışılınca P2002 alınır ve bu "zaten işlendi" demektir.
 * Kaydı işlemin İÇİNDE yazıyoruz — önce yazıp sonra çalışmak, arada süreç
 * ölürse olayı sonsuza dek kaybetmek olurdu.
 */
/** İşlem içinden "bu kayıt artık iptal" sinyali; dışarı sızmaz. */
class GecKalmisOlay extends Error {}

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
      payment: {
        select: {
          providerRef: true,
          status: true,
          settlementStatus: true,
          amount: true,
          currency: true,
        },
      },
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

  // --- OLAY DOĞRULAMA -----------------------------------------------------
  //
  // Önceden yalnızca olay KİMLİĞİNİN tekilliği kontrol ediliyordu. Olayın
  // gerçekten BU ödemeye ait olup olmadığına, tutarın doğruluğuna ve durum
  // geçişinin geçerliliğine bakılmıyordu. Üç senaryo yeniden üretilmişti:
  //   · yanlış providerRef taşıyan olay kabul edilip kaydın referansını
  //     değiştiriyordu,
  //   · payment.paid'den sonra gelen payment.failed ödenmiş randevuyu iptal
  //     ediyordu,
  //   · hak edişi yazılmış (RELEASED) bir ödeme yeni bir payment.paid ile
  //     yeniden HELD oluyordu.
  // Sağlayıcılar olay SIRASINI garanti etmiyor; sıra dışı ve tekrarlı
  // teslimat normaldir. Korumanın olayın kendisinde olması gerekiyor.
  const payment = reservation.payment;

  if (payment?.providerRef && payment.providerRef !== event.providerRef) {
    logError(
      {
        action: 'applyPaymentEvent',
        meta: { olay: event.type, kod: event.reference, durum: 'referans-uyusmuyor' },
      },
      new Error('Olayın ödeme referansı kayıttakiyle uyuşmuyor; uygulanmadı.'),
    );
    await isaretle(event);
    return 'uyumsuz';
  }

  if (
    typeof event.amount === 'number' &&
    payment &&
    (event.amount !== payment.amount ||
      (event.currency !== undefined && event.currency !== payment.currency))
  ) {
    logError(
      {
        action: 'applyPaymentEvent',
        meta: { olay: event.type, kod: event.reference, durum: 'tutar-uyusmuyor' },
      },
      new Error(`Beklenen ${payment.amount} ${payment.currency}, gelen ${event.amount} ${event.currency ?? '-'}`),
    );
    await isaretle(event);
    return 'uyumsuz';
  }

  // NİHAİ DURUMLAR KORUNUR. Hak ediş ya da iade başlamışsa geriye dönüş yok:
  // geç gelen bir olay parayı yeniden bloke edemez, ödenmiş bir randevuyu
  // iptal edemez.
  const nihai = payment && payment.settlementStatus !== 'NONE' && payment.settlementStatus !== 'HELD';
  const odenmisFailed = event.type === 'payment.failed' && reservation.depositStatus === 'PAID';
  if (nihai || odenmisFailed) {
    logError(
      {
        action: 'applyPaymentEvent',
        meta: {
          olay: event.type,
          kod: event.reference,
          durum: 'gecersiz-gecis',
          mevcut: payment?.settlementStatus ?? '-',
        },
      },
      new Error('Olay, sonuçlanmış bir ödemeyi geriye almaya çalıştı; uygulanmadı.'),
    );
    await isaretle(event);
    return 'gecersiz-gecis';
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Aynı işlemde: önce "işlendi" damgası, sonra etki. Damga çakışırsa
      // işlem bütünüyle geri alınır ve etki iki kez uygulanmaz.
      await tx.processedEvent.create({
        data: { id: event.id, type: event.type, reference: event.reference },
      });

      if (event.type === 'payment.paid') {
        // KOŞULLU GÜNCELLEME. Yukarıdaki iptal kontrolü ile bu yazma arasında
        // `release-expired` işi kaydı iptal etmiş olabilir; düz `update` o
        // durumda CANCELLED + PAID gibi tutarsız bir kayıt üretirdi. Sayı
        // sıfırsa işlem geri alınıyor ve olay "geç kalmış" sayılıyor.
        const yazilan = await tx.reservation.updateMany({
          where: { id: reservation.id, status: { not: 'CANCELLED' } },
          data: { depositStatus: 'PAID', paymentDeadline: null },
        });
        if (yazilan.count === 0) throw new GecKalmisOlay();
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
    if (err instanceof GecKalmisOlay) {
      // Kayıt bu arada iptal edildi. Para alınmış ama randevu yok: iade
      // gerektiren bir durum, bu yüzden sessizce geçilmiyor.
      logError(
        {
          action: 'applyPaymentEvent',
          userId: reservation.customerId,
          meta: { olay: event.type, kod: event.reference, durum: 'yaris-iptal' },
        },
        new Error('Ödeme onayı, iptal edilmiş rezervasyona yetişti; iade gerekebilir.'),
      );
      await isaretle(event);
      return 'gec-kalmis';
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
