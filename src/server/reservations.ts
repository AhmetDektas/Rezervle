import 'server-only';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { DomainError } from './errors';
import { hasActiveConsent, sectorNeedsConsent } from './consent';
import { reservationCode } from '@/lib/utils';
import { zonedToUtc, today, hhmm, diffDays } from '@/lib/time';
import { longDate } from '@/lib/format';
import {
  ACTIVE_STATUSES,
  BOOKING_HORIZON_DAYS,
  type Channel,
  type ReservationStatus,
  CUSTOMER_CHANGE_CUTOFF_MIN,
  RESERVATION_STATUS_LABEL,
  PAYMENT_DEADLINE_MIN,
  appUrl,
} from '@/lib/constants';
import { getDayAvailability, ONLINE_LEAD_MIN, STAFF_LEAD_MIN } from './schedule';
import { depositPolicyFor } from './deposit-policy';
import { notifyBusiness, notifyUser } from './notifications';
import { paymentProvider } from './providers';
import { depositFor, refundOnCancel, type DepositPolicy } from '@/lib/deposit';
import { splitPayment } from '@/lib/commission';
import { bookingTotals, orderServices, serviceLabel } from '@/lib/services';
import { MAX_SERVICES_PER_BOOKING, termsFor } from '@/lib/constants';

export type CreateReservationInput = {
  businessId: string;
  branchId: string;
  /** Randevudaki hizmetler, müşterinin seçtiği sırayla. En az bir tane. */
  serviceIds: string[];
  /** 'ANY' → uygun personellerden ilki atanır. */
  staffId: string;
  customerId: string;
  date: string;
  startMin: number;
  channel: Channel;
  note?: string | undefined;
  internalNote?: string | undefined;
  promotionCode?: string | undefined;
  paymentMethod?: 'AT_VENUE' | 'ONLINE';
  extra?: Record<string, unknown> | undefined;
  /** Panelden açılan kayıtlar doğrudan onaylı başlar. */
  autoConfirm?: boolean;
  actorId?: string | null;
  /** Saat dişi (S6-2). Ödeme son tarihi ve geçmiş tarih kontrolü buna bakar. */
  now?: Date;
  /**
   * 3DS sonrası dönülecek kaynak. İstek bağlamını bilen çağıran veriyor;
   * sabit `appUrl()` farklı portta çalışırken yanlış sunucuya yönlendirirdi.
   */
  returnUrl?: string;
};

export function slotKeyOf(staffId: string, date: string, startMin: number): string {
  return `${staffId}:${date}:${startMin}`;
}

/** Kampanya kodunu doğrular ve indirimi hesaplar. */
async function resolvePromotion(
  code: string | undefined,
  businessId: string,
  price: number,
): Promise<{ id: string; discount: number } | null> {
  if (!code) return null;
  const promo = await prisma.promotion.findUnique({ where: { code: code.trim().toUpperCase() } });
  if (!promo || !promo.active) throw new DomainError('Kampanya kodu geçersiz.', 'PROMO_INVALID');
  if (promo.businessId && promo.businessId !== businessId) {
    throw new DomainError('Bu kod bu işletmede geçerli değil.', 'PROMO_SCOPE');
  }
  const now = new Date();
  if (promo.startsAt > now || promo.endsAt < now) {
    throw new DomainError('Kampanyanın süresi dolmuş.', 'PROMO_EXPIRED');
  }
  if (promo.maxUses > 0 && promo.usedCount >= promo.maxUses) {
    throw new DomainError('Kampanya kullanım limitine ulaşmış.', 'PROMO_LIMIT');
  }
  if (price < promo.minAmount) {
    throw new DomainError(
      `Bu kampanya en az ${promo.minAmount} TL tutarındaki randevularda geçerli.`,
      'PROMO_MIN',
    );
  }
  const raw = promo.kind === 'PERCENT' ? Math.round((price * promo.value) / 100) : promo.value;
  return { id: promo.id, discount: Math.min(raw, price) };
}

export type BookingQuote = {
  price: number;
  discount: number;
  finalPrice: number;
  deposit: number;
};

/**
 * Rezervasyon tutarlarının ön hesabı.
 *
 * Onay ekranı kaporayı kendi başına hesaplayamaz: kampanya kodunun geçerliliği
 * ve indirim tutarı yalnızca sunucuda bilinir. Müşteriye "şu kadar ödeyeceksin"
 * derken tahsil edilecek tutarın aynısını göstermek zorundayız, bu yüzden
 * ekran bu hesabı sunucuya sorar. Salt okunurdur: kampanya kullanım sayacını
 * artırmaz, kayıt oluşturmaz.
 */
export async function quoteBooking(args: {
  businessId: string;
  serviceIds: string[];
  promotionCode?: string | undefined;
}): Promise<BookingQuote> {
  const [business, serviceRows] = await Promise.all([
    prisma.business.findUnique({
      where: { id: args.businessId },
      select: {
        id: true,
        depositAddon: true,
        depositEnabled: true,
        depositKind: true,
        depositValue: true,
        depositMinPrice: true,
        depositRefundHours: true,
      },
    }),
    prisma.service.findMany({
      where: { id: { in: args.serviceIds } },
      select: { id: true, durationMin: true, bufferMin: true, price: true, active: true, businessId: true },
    }),
  ]);
  if (!business) throw new DomainError('İşletme bulunamadı.', 'NOT_FOUND');
  const services = orderServices(args.serviceIds, serviceRows);
  if (!services || services.length === 0) {
    throw new DomainError('Seçilen hizmet bulunamadı.', 'SERVICE_INVALID');
  }
  if (services.some((x) => !x.active || x.businessId !== business.id)) {
    throw new DomainError('Seçilen hizmet bulunamadı.', 'SERVICE_INVALID');
  }

  // İndirim ve kapora kalem kalem değil, toplam üzerinden hesaplanır.
  const price = bookingTotals(services).price;
  const promo = await resolvePromotion(args.promotionCode, business.id, price);
  const discount = promo?.discount ?? 0;
  const finalPrice = Math.max(0, price - discount);
  const deposit = depositFor(depositPolicyFor(business), finalPrice);
  return { price, discount, finalPrice, deposit };
}

/**
 * Rezervasyon oluşturur.
 *
 * Fiyat, süre ve personel yetkinliği istemciden değil veritabanından okunur.
 * Slot uygunluğu yazma anında yeniden hesaplanır; son savunma hattı olarak
 * `slotKey` benzersiz kısıtı çifte kaydı veritabanı düzeyinde engeller.
 */
export async function createReservation(input: CreateReservationInput) {
  const clock = input.now ?? new Date();
  if (input.serviceIds.length === 0) {
    throw new DomainError('En az bir hizmet seçilmeli.', 'SERVICE_INVALID');
  }
  // Tekrarlı kimlik burada durmalı. Aksi halde süre ve tutar iki katına
  // çıkar, kalem tablosundaki benzersizlik kısıtı P2002 fırlatır ve aşağıdaki
  // yakalayıcı bunu "Bu saat az önce doldu" diye raporlardı — hatanın kendisi
  // kadar yanıltıcı bir mesaj.
  if (new Set(input.serviceIds).size !== input.serviceIds.length) {
    throw new DomainError('Aynı hizmet birden fazla kez seçilemez.', 'SERVICE_INVALID');
  }
  if (input.serviceIds.length > MAX_SERVICES_PER_BOOKING) {
    throw new DomainError(
      `Bir randevuda en fazla ${MAX_SERVICES_PER_BOOKING} hizmet seçilebilir.`,
      'SERVICE_INVALID',
    );
  }
  const [business, serviceRows, branch] = await Promise.all([
    prisma.business.findUnique({
      where: { id: input.businessId },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        depositAddon: true,
        depositEnabled: true,
        depositKind: true,
        depositValue: true,
        depositMinPrice: true,
        depositRefundHours: true,
        commissionRate: true,
        subMerchantKey: true,
        category: { select: { sector: true } },
      },
    }),
    prisma.service.findMany({ where: { id: { in: input.serviceIds } } }),
    prisma.branch.findUnique({ where: { id: input.branchId } }),
  ]);

  if (!business) throw new DomainError('İşletme bulunamadı.', 'NOT_FOUND');
  if (business.status !== 'APPROVED') {
    throw new DomainError('Bu işletme şu anda randevu kabul etmiyor.', 'BUSINESS_INACTIVE');
  }
  // Sıra korunur: ekranda o sırayla listelenir ve tampon sonuncudan alınır.
  const services = orderServices(input.serviceIds, serviceRows);
  if (!services || services.some((x) => !x.active || x.businessId !== business.id)) {
    throw new DomainError('Seçilen hizmet bulunamadı.', 'SERVICE_INVALID');
  }
  // Sektör çoklu hizmete kapalıysa burada durur. Arayüz zaten tek seçime
  // izin veriyor ama tek savunma arayüz olamaz: doğrudan gönderilen bir istek
  // restorana "2 kişilik masa + 4 kişilik masa" diye bir kayıt yazdırırdı.
  if (services.length > 1 && !termsFor(business.category.sector).multiService) {
    throw new DomainError(
      'Bu işletmede tek randevuda yalnızca bir seçenek alınabilir.',
      'SERVICE_INVALID',
    );
  }
  const totals = bookingTotals(services);
  if (!branch || !branch.active || branch.businessId !== business.id) {
    throw new DomainError('Seçilen şube bulunamadı.', 'BRANCH_INVALID');
  }

  // Diş, veteriner ve estetik randevusu sağlığa dair çıkarım taşır: açık rıza
  // olmadan işlenemez (KVKK m.6). Rıza kayıtta yoksa ya da geri alınmışsa
  // randevu burada durur — aydınlatma metninin verdiği söz bu.
  //
  // Yalnızca ONLINE kanalda aranıyor. Panelden açılan telefon/kapı randevusunda
  // müşteri klavyenin başında değil; rızayı yüz yüze ya da telefonda alan taraf
  // işletmenin kendisi. Orada da şart koşmak, rıza veremeyecek durumdaki bir
  // insanın randevusunu engellemekten başka bir işe yaramaz — üstelik hata
  // mesajı personele "profil sayfanızdan verin" derdi ki rıza personelin değil.
  if (
    input.channel === 'ONLINE' &&
    sectorNeedsConsent(business.category.sector) &&
    !(await hasActiveConsent(input.customerId, 'ACIK_RIZA'))
  ) {
    throw new DomainError(
      'Bu kategoride randevu oluşturmak için açık rıza gerekiyor. Profil sayfanızdan verebilirsiniz.',
      'CONSENT_REQUIRED',
    );
  }

  const horizon = diffDays(input.date, today(clock));
  if (horizon < 0) throw new DomainError('Geçmiş bir tarihe randevu oluşturulamaz.', 'PAST_DATE');
  if (horizon > BOOKING_HORIZON_DAYS) {
    throw new DomainError(
      `En fazla ${BOOKING_HORIZON_DAYS} gün sonrası için randevu alınabilir.`,
      'HORIZON',
    );
  }

  const lead = input.channel === 'ONLINE' ? ONLINE_LEAD_MIN : STAFF_LEAD_MIN;
  const slots = await getDayAvailability({
    branchId: branch.id,
    serviceIds: services.map((x) => x.id),
    date: input.date,
    staffId: input.staffId === 'ANY' ? null : input.staffId,
    leadMin: lead,
    stepMin: 5, // panelden 5 dakikalık başlangıçlar da kabul edilir
  });

  const slot = slots.find((s) => s.startMin === input.startMin);
  if (!slot) {
    throw new DomainError(
      'Seçtiğiniz saat artık uygun değil. Lütfen başka bir saat seçin.',
      'SLOT_TAKEN',
    );
  }

  const staffId = input.staffId === 'ANY' ? slot.staffIds[0] : input.staffId;
  if (!staffId || !slot.staffIds.includes(staffId)) {
    throw new DomainError('Seçilen personel bu saatte uygun değil.', 'STAFF_BUSY');
  }

  const price = totals.price;
  const promo = await resolvePromotion(input.promotionCode, business.id, price);
  const discount = promo?.discount ?? 0;
  const finalPrice = Math.max(0, price - discount);
  const endMin = input.startMin + totals.durationMin;
  const blockEnd = endMin + totals.bufferMin;
  const method = input.paymentMethod ?? 'AT_VENUE';

  // Kapora, randevu anındaki politikayla hesaplanır ve kayda dondurulur.
  const policy: DepositPolicy = depositPolicyFor(business);
  const deposit = depositFor(policy, finalPrice);

  const created = await prisma
    .$transaction(async (tx) => {
      // Yazma anındaki son kontrol: aynı personelde çakışan aktif kayıt var mı?
      const clash = await tx.reservation.findFirst({
        where: {
          staffId,
          date: input.date,
          status: { in: [...ACTIVE_STATUSES] },
          startMin: { lt: blockEnd },
          blockEnd: { gt: input.startMin },
        },
        select: { id: true },
      });
      if (clash) throw new DomainError('Bu saat az önce doldu.', 'SLOT_TAKEN');

      const reservation = await tx.reservation.create({
        data: {
          code: reservationCode(),
          businessId: business.id,
          branchId: branch.id,
          // Liste `services` alanında; bu alan ilkini gösteriyor ve bildirim,
          // rapor, değerlendirme gibi tek hizmet adı bekleyen yolları besliyor.
          serviceId: services[0]!.id,
          staffId,
          customerId: input.customerId,
          createdById: input.actorId ?? input.customerId,
          date: input.date,
          startMin: input.startMin,
          endMin,
          blockEnd,
          startsAt: zonedToUtc(input.date, input.startMin),
          endsAt: zonedToUtc(input.date, endMin),
          status: input.autoConfirm ? 'CONFIRMED' : 'PENDING',
          channel: input.channel,
          price,
          discount,
          finalPrice,
          note: input.note ?? null,
          internalNote: input.internalNote ?? null,
          promotionId: promo?.id ?? null,
          extra: input.extra ? JSON.stringify(input.extra) : null,
          depositAmount: deposit,
          depositStatus: 'NONE',
          slotKey: slotKeyOf(staffId, input.date, input.startMin),
          // Kalemler randevuyla AYNI işlemde yazılır: hizmet listesi olmayan
          // bir randevu kaydı hiçbir an var olmamalı.
          services: {
            create: services.map((x, i) => ({
              serviceId: x.id,
              sortOrder: i,
              name: x.name,
              durationMin: x.durationMin,
              bufferMin: x.bufferMin,
              price: x.price,
            })),
          },
        },
        include: { service: true, staff: true, branch: true, business: true },
      });

      await tx.reservationStatusHistory.create({
        data: {
          reservationId: reservation.id,
          toStatus: reservation.status,
          actorId: input.actorId ?? input.customerId,
          note: 'Rezervasyon oluşturuldu',
        },
      });

      await tx.payment.create({
        data: {
          reservationId: reservation.id,
          method,
          amount: finalPrice,
          status: 'PENDING',
          provider: method === 'ONLINE' ? 'mock' : 'none',
        },
      });

      if (promo) {
        await tx.promotion.update({ where: { id: promo.id }, data: { usedCount: { increment: 1 } } });
      }

      return reservation;
    })
    .catch((err: unknown) => {
      // slotKey benzersiz kısıtı: aynı anda gelen ikinci istek buraya düşer.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new DomainError('Bu saat az önce doldu.', 'SLOT_TAKEN');
      }
      throw err;
    });

  // Kapora slot ayrıldıktan sonra tahsil edilir: önce yeri tutuyoruz ki ödeme
  // sırasında saat başkasına gitmesin.
  //
  // Tahsilat artık ASENKRON: gerçek kart ödemesi 3DS'ten geçiyor, müşteri
  // bankanın sayfasına gidiyor ve sonucu webhook getiriyor. Bu yüzden burada
  // "ödendi" diyemiyoruz; yalnızca "başlatıldı" diyebiliyoruz.
  //
  //   charge() ──▶ PENDING + redirectUrl ──▶ müşteri bankaya gider
  //                     │                              │
  //                     │                       webhook payment.paid
  //                     ▼                              ▼
  //            paymentDeadline kuruldu          depositStatus = PAID
  //                     │
  //                     └── süre dolarsa (T5) ──▶ iptal, saat yeniden açılır
  let redirectUrl: string | null = null;
  if (created.depositAmount > 0) {
    // Pazaryeri bölüşümü: platform payı ödeme anında ayrılır, işletme payı
    // ödeme kuruluşunda bloke başlar. Oran kayda dondurulur.
    const split = splitPayment(created.depositAmount, business.commissionRate);
    const charge = await paymentProvider().charge({
      amount: created.depositAmount,
      currency: 'TRY',
      reference: created.code,
      returnUrl: input.returnUrl ?? appUrl(),
      split: { commission: split.commission, subMerchantKey: business.subMerchantKey },
    });

    if (charge.status === 'FAILED') {
      await prisma.reservation.update({
        where: { id: created.id },
        data: {
          status: 'CANCELLED',
          slotKey: null,
          cancelledAt: new Date(),
          cancelReason: 'Kapora tahsil edilemedi',
        },
      });
      throw new DomainError(
        `Kapora tahsil edilemedi: ${charge.reason} Randevu oluşturulmadı.`,
        'DEPOSIT_FAILED',
      );
    }

    const komisyon = {
      capturedAmount: split.total,
      commissionRate: split.rate,
      commissionAmount: split.commission,
      netAmount: split.net,
    };

    if (charge.status === 'PAID') {
      // 3DS'siz tahsilat: sonuç zaten elimizde.
      await prisma.$transaction([
        prisma.reservation.update({
          where: { id: created.id },
          data: { depositStatus: 'PAID', paymentDeadline: null },
        }),
        prisma.payment.update({
          where: { reservationId: created.id },
          data: {
            providerRef: charge.providerRef,
            status: 'PAID',
            paidAt: new Date(),
            settlementStatus: 'HELD',
            ...komisyon,
          },
        }),
      ]);
      created.depositStatus = 'PAID';
    } else {
      // 3DS bekleniyor. Saat şimdilik ayrılmış durumda ama süresiz değil.
      const deadline = new Date(clock.getTime() + PAYMENT_DEADLINE_MIN * 60_000);
      await prisma.$transaction([
        prisma.reservation.update({
          where: { id: created.id },
          data: { depositStatus: 'PENDING', paymentDeadline: deadline },
        }),
        prisma.payment.update({
          where: { reservationId: created.id },
          data: { providerRef: charge.providerRef, status: 'PENDING', ...komisyon },
        }),
      ]);
      created.depositStatus = 'PENDING';
      redirectUrl = charge.redirectUrl;
    }
  }

  // Ödeme beklenirken bildirim gönderilmiyor: "randevunuz oluşturuldu" demek,
  // 15 dakika sonra iptal edilecek bir kayıt için yanlış olurdu. Bildirimi
  // webhook, ödeme onaylandığında gönderiyor.
  if (created.depositStatus === 'PENDING') {
    return { ...created, redirectUrl };
  }

  const when = `${longDate(created.date)} ${hhmm(created.startMin)}`;
  const hizmetler = serviceLabel(created.service.name, services.length);
  await notifyUser({
    userId: created.customerId,
    kind: 'RESERVATION',
    title: `Randevunuz oluşturuldu — ${created.business.name}`,
    body: `${hizmetler} · ${when} · ${created.staff.displayName}`,
    href: `/randevularim/${created.id}`,
    alsoSend: true,
  });
  await notifyBusiness(created.businessId, created.staffId, {
    kind: 'RESERVATION',
    title: 'Yeni randevu',
    body: `${hizmetler} · ${when}`,
    href: `/panel/${created.business.slug}/takvim?tarih=${created.date}`,
  });

  return { ...created, redirectUrl };
}

// --- Durum geçişleri -----------------------------------------------------

/** Hangi durumdan hangisine geçilebilir. Panelde buton görünürlüğü de buradan türer. */
export const ALLOWED_TRANSITIONS: Record<ReservationStatus, ReservationStatus[]> = {
  PENDING: ['CONFIRMED', 'ARRIVED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'],
  CONFIRMED: ['ARRIVED', 'COMPLETED', 'NO_SHOW', 'CANCELLED'],
  ARRIVED: ['COMPLETED', 'NO_SHOW', 'CANCELLED'],
  COMPLETED: [],
  NO_SHOW: ['COMPLETED'],
  CANCELLED: [],
};

export function canTransition(from: ReservationStatus, to: ReservationStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export async function loadReservation(id: string) {
  return prisma.reservation.findUnique({
    where: { id },
    include: {
      business: { select: { id: true, name: true, slug: true, ownerId: true, phone: true } },
      branch: true,
      service: true,
      staff: true,
      customer: { select: { id: true, name: true, email: true, phone: true } },
      payment: true,
    },
  });
}

/** Müşteri kendi randevusunu değiştirebilir mi? (Randevuya çok az kaldıysa hayır.) */
export function customerCanModify(
  reservation: { date: string; startMin: number; status: string },
  now = new Date(),
): boolean {
  if (!['PENDING', 'CONFIRMED'].includes(reservation.status)) return false;
  const start = zonedToUtc(reservation.date, reservation.startMin).getTime();
  return start - now.getTime() > CUSTOMER_CHANGE_CUTOFF_MIN * 60_000;
}

export async function setReservationStatus(args: {
  id: string;
  to: ReservationStatus;
  actorId: string;
  note?: string | undefined;
}) {
  const current = await prisma.reservation.findUnique({
    where: { id: args.id },
    select: { id: true, status: true, businessId: true, staffId: true, customerId: true, code: true },
  });
  if (!current) throw new DomainError('Randevu bulunamadı.', 'NOT_FOUND');
  const from = current.status as ReservationStatus;
  if (from === args.to) return current;
  if (!canTransition(from, args.to)) {
    throw new DomainError(
      `"${RESERVATION_STATUS_LABEL[from]}" durumundan "${RESERVATION_STATUS_LABEL[args.to]}" durumuna geçilemez.`,
      'BAD_TRANSITION',
    );
  }

  const releasesSlot = args.to === 'CANCELLED';

  // Kaporanın ve hak edişin akıbeti tek yerde belirlenir.
  //
  // Para ödeme kuruluşunda bloke duruyor. Randevu sonuçlanınca ya blokeyi
  // çözüp işletmeye hak ediş yazıyoruz (komisyon platformda kalır) ya da
  // tümünü müşteriye iade ediyoruz (komisyon da geri gider). Tahsil
  // edilmemiş bir hizmetten pay almak savunulamaz.
  const full = await prisma.reservation.findUnique({
    where: { id: args.id },
    select: {
      depositAmount: true,
      depositStatus: true,
      startsAt: true,
      business: { select: { depositRefundHours: true } },
      payment: { select: { providerRef: true, settlementStatus: true, netAmount: true, commissionAmount: true } },
    },
  });

  let depositStatus: string | undefined;
  let depositNote = '';
  let settlement: 'RELEASED' | 'REFUNDED' | undefined;

  if (full && full.depositAmount > 0 && full.depositStatus === 'PAID') {
    if (args.to === 'NO_SHOW') {
      depositStatus = 'FORFEITED';
      settlement = 'RELEASED';
      depositNote = ' Kapora gelir olarak kaydedildi.';
    } else if (args.to === 'COMPLETED') {
      // Kapora hizmet bedelinden düşülür; işletmenin hak edişi doğar.
      settlement = 'RELEASED';
    } else if (args.to === 'CANCELLED') {
      const refund = refundOnCancel(
        { refundHours: full.business.depositRefundHours },
        full.startsAt,
      );
      depositStatus = refund ? 'REFUNDED' : 'FORFEITED';
      settlement = refund ? 'REFUNDED' : 'RELEASED';
      depositNote = refund
        ? ' Kaporanız iade edilecek.'
        : ' İptal süresi geçtiği için kapora iade edilmiyor.';
    }
  }
  // Zaten sonuçlanmış bir tahsilatı ikinci kez hareket ettirme.
  if (full?.payment && full.payment.settlementStatus !== 'HELD') settlement = undefined;

  const updated = await prisma.$transaction(async (tx) => {
    const res = await tx.reservation.update({
      where: { id: args.id },
      data: {
        status: args.to,
        ...(releasesSlot ? { slotKey: null, cancelledAt: new Date() } : {}),
        ...(args.note !== undefined && releasesSlot ? { cancelReason: args.note } : {}),
        ...(depositStatus ? { depositStatus } : {}),
      },
      include: {
        business: { select: { name: true, slug: true } },
        service: true,
        _count: { select: { services: true } },
      },
    });
    await tx.reservationStatusHistory.create({
      data: {
        reservationId: res.id,
        fromStatus: from,
        toStatus: args.to,
        actorId: args.actorId,
        note: args.note ?? null,
      },
    });
    if (args.to === 'COMPLETED') {
      await tx.payment.updateMany({
        where: { reservationId: res.id, status: 'PENDING', method: 'AT_VENUE' },
        data: { status: 'PAID', paidAt: new Date() },
      });
    }
    if (settlement) {
      await tx.payment.update({
        where: { reservationId: res.id },
        data: {
          settlementStatus: settlement,
          releasedAt: new Date(),
          ...(settlement === 'REFUNDED'
            ? { status: 'REFUNDED', refundedAt: new Date(), settlementNote: 'Zamanında iptal — komisyon dahil tam iade' }
            : { settlementNote: `Hak ediş: ${RESERVATION_STATUS_LABEL[args.to]}` }),
        },
      });
    }
    return res;
  });

  // Karar ödeme kuruluşuna bildirilir. Kayıt zaten güncellendi; sağlayıcı
  // hatası müşterinin durumunu değiştirmemeli, bu yüzden loglanıp geçilir ve
  // mutabakat için nota yazılır.
  if (settlement && full?.payment?.providerRef) {
    const ref = full.payment.providerRef;
    const provider = paymentProvider();
    const result =
      settlement === 'REFUNDED' ? await provider.refund(ref) : await provider.release(ref);
    if (!result.ok) {
      console.error(`[rezzerv] hak ediş işlemi başarısız (${settlement}):`, args.id, result.reason);
      await prisma.payment.update({
        where: { reservationId: args.id },
        data: { settlementNote: `Sağlayıcı hatası: ${result.reason ?? 'bilinmiyor'} — mutabakat gerekiyor` },
      });
    }
  }

  const label = RESERVATION_STATUS_LABEL[args.to];
  await notifyUser({
    userId: current.customerId,
    kind: 'RESERVATION',
    title: `Randevunuz: ${label.toLocaleLowerCase('tr-TR')}`,
    body: `${updated.business.name} · ${serviceLabel(updated.service.name, updated._count.services)} · ${longDate(updated.date)} ${hhmm(updated.startMin)}${depositNote}`,
    href: `/randevularim/${updated.id}`,
    alsoSend: args.to === 'CANCELLED' || args.to === 'CONFIRMED',
  });

  return updated;
}

/**
 * Randevuyu başka bir saate/personele taşır.
 * Uygunluk kendi kaydı hariç tutularak yeniden hesaplanır; böylece randevu
 * kendi slotunu "dolu" görüp erteleme yapılamaz duruma düşmez.
 */
export async function rescheduleReservation(args: {
  id: string;
  date: string;
  startMin: number;
  staffId?: string | undefined;
  actorId: string;
  /** Panelden yapılan taşımalar hazırlık süresine takılmaz. */
  byStaff: boolean;
}) {
  const current = await prisma.reservation.findUnique({
    where: { id: args.id },
    include: {
      service: true,
      services: { orderBy: { sortOrder: 'asc' }, select: { serviceId: true } },
      business: { select: { name: true, slug: true } },
    },
  });
  if (!current) throw new DomainError('Randevu bulunamadı.', 'NOT_FOUND');
  if (['CANCELLED', 'COMPLETED'].includes(current.status)) {
    throw new DomainError('Tamamlanmış veya iptal edilmiş randevu ertelenemez.', 'BAD_STATE');
  }

  const horizon = diffDays(args.date, today());
  if (horizon < 0) throw new DomainError('Geçmiş bir tarihe erteleme yapılamaz.', 'PAST_DATE');
  if (horizon > BOOKING_HORIZON_DAYS) {
    throw new DomainError(`En fazla ${BOOKING_HORIZON_DAYS} gün sonrasına ertelenebilir.`, 'HORIZON');
  }

  const staffId = args.staffId ?? current.staffId;
  // Erteleme randevuyu TAŞIR, yeniden fiyatlandırmaz. Süre kaydın kendi
  // değerlerinden okunuyor; hizmetin süresi randevu alındıktan sonra
  // değiştirilmişse 30 dakikalık randevu sessizce 45 dakikaya dönerdi.
  const span = {
    durationMin: current.endMin - current.startMin,
    bufferMin: current.blockEnd - current.endMin,
  };
  const serviceIds =
    current.services.length > 0 ? current.services.map((x) => x.serviceId) : [current.serviceId];
  const slots = await getDayAvailability({
    branchId: current.branchId,
    serviceIds,
    span,
    date: args.date,
    staffId,
    excludeReservationId: current.id,
    leadMin: args.byStaff ? STAFF_LEAD_MIN : ONLINE_LEAD_MIN,
    stepMin: 5,
  });
  const slot = slots.find((s) => s.startMin === args.startMin && s.staffIds.includes(staffId));
  if (!slot) throw new DomainError('Seçilen saat uygun değil.', 'SLOT_TAKEN');

  const endMin = args.startMin + span.durationMin;
  const blockEnd = endMin + span.bufferMin;

  const updated = await prisma
    .$transaction(async (tx) => {
      const clash = await tx.reservation.findFirst({
        where: {
          staffId,
          date: args.date,
          id: { not: current.id },
          status: { in: [...ACTIVE_STATUSES] },
          startMin: { lt: blockEnd },
          blockEnd: { gt: args.startMin },
        },
        select: { id: true },
      });
      if (clash) throw new DomainError('Bu saat az önce doldu.', 'SLOT_TAKEN');

      const res = await tx.reservation.update({
        where: { id: current.id },
        data: {
          date: args.date,
          startMin: args.startMin,
          endMin,
          blockEnd,
          staffId,
          startsAt: zonedToUtc(args.date, args.startMin),
          endsAt: zonedToUtc(args.date, endMin),
          slotKey: slotKeyOf(staffId, args.date, args.startMin),
        },
        include: {
          staff: true,
          service: true,
          _count: { select: { services: true } },
          business: { select: { name: true, slug: true } },
        },
      });
      await tx.reservationStatusHistory.create({
        data: {
          reservationId: res.id,
          fromStatus: current.status,
          toStatus: res.status,
          actorId: args.actorId,
          note: `Ertelendi: ${longDate(current.date)} ${hhmm(current.startMin)} → ${longDate(args.date)} ${hhmm(args.startMin)}`,
        },
      });
      return res;
    })
    .catch((err: unknown) => {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new DomainError('Bu saat az önce doldu.', 'SLOT_TAKEN');
      }
      throw err;
    });

  await notifyUser({
    userId: updated.customerId,
    kind: 'RESERVATION',
    title: 'Randevunuz ertelendi',
    body: `${updated.business.name} · ${longDate(updated.date)} ${hhmm(updated.startMin)}`,
    href: `/randevularim/${updated.id}`,
    alsoSend: true,
  });
  await notifyBusiness(updated.businessId, updated.staffId, {
    kind: 'RESERVATION',
    title: 'Randevu ertelendi',
    body: `${serviceLabel(updated.service.name, updated._count.services)} · ${longDate(updated.date)} ${hhmm(updated.startMin)}`,
    href: `/panel/${updated.business.slug}/takvim?tarih=${updated.date}`,
  });

  return updated;
}
