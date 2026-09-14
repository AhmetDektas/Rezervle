'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { run, DomainError, type ActionResult } from '@/server/errors';
import { requireUserAction, assertBusinessAccess, hashPassword } from '@/server/auth';
import { auditReservation, type ReservationIssue } from '@/server/audit';
import { subeKotasiniAyir } from '@/server/entitlements';
import { minFiyatiTazele } from '@/server/pricing';
import {
  assertBranchBelongs,
  updateServiceScoped,
  updateStaffScoped,
  updateBranchScoped,
  updatePromotionScoped,
} from '@/server/panel-write';
import {
  createReservation,
  setReservationStatus,
} from '@/server/reservations';
import {
  staffBookingSchema,
  statusSchema,
  serviceSchema,
  staffSchema,
  workingHoursSchema,
  branchSchema,
  promotionSchema,
  businessProfileSchema,
  depositSettingsSchema,
  payoutSchema,
  menuItemSchema,
  fieldErrors,
} from '@/lib/validation';
import { WEEKDAYS, type ReservationStatus } from '@/lib/constants';
import { today, weekdayOf, hhmm } from '@/lib/time';
import { longDate } from '@/lib/format';

type Fields = { fields?: Record<string, string> };

function touch(slug: string): void {
  revalidatePath(`/panel/${slug}`, 'layout');
  revalidatePath(`/isletme/${slug}`);
}


/**
 * Yeni çalışma saatlerinin dışında kalacak ileri tarihli randevuları sayar.
 * Yalnızca bugünden itibaren bakılır: geçmiş kayıtlar zaten yaşandı.
 */
async function countOrphans(
  target: 'branch' | 'staff',
  targetId: string,
  day: { weekday: number; closed: boolean; startMin: number; endMin: number },
): Promise<{ count: number; firstLabel: string }> {
  const upcoming = await prisma.reservation.findMany({
    where: {
      ...(target === 'branch' ? { branchId: targetId } : { staffId: targetId }),
      status: { in: ['PENDING', 'CONFIRMED'] },
      date: { gte: today() },
    },
    select: { date: true, startMin: true, endMin: true },
    orderBy: [{ date: 'asc' }, { startMin: 'asc' }],
  });

  const outside = upcoming.filter(
    (r) =>
      weekdayOf(r.date) === day.weekday &&
      (day.closed || r.startMin < day.startMin || r.endMin > day.endMin),
  );
  const first = outside[0];
  return {
    count: outside.length,
    firstLabel: first ? `${longDate(first.date)} ${hhmm(first.startMin)}` : '',
  };
}

/** Panelden randevu açma. Müşteri yoksa telefon numarasıyla oluşturulur. */
export async function panelCreateReservationAction(
  slug: string,
  input: unknown,
): Promise<ActionResult<{ reservationId: string }> & Fields> {
  const parsed = staffBookingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Formda eksik bilgi var.', fields: fieldErrors(parsed.error) };
  }
  const result = await run(async () => {
    const user = await requireUserAction();
    await assertBusinessAccess(user, parsed.data.businessId);

    // MÜŞTERİ EŞLEŞTİRME KİMLİK KANITI DEĞİLDİR.
    //
    // Önceden panelde girilen telefon BÜTÜN kullanıcılar arasında aranıyordu
    // (rol ayrımı bile yoktu), telefon tutmazsa girilen e-posta mevcut bir
    // hesaba bağlanıyordu. Yani bir işletme, bildiği bir e-posta için randevu
    // oluşturup o hesabı kendi müşteri listesine ekleyebiliyordu; liste de
    // hesabın gerçek adını, telefonunu ve e-postasını gösteriyor. Müşterinin
    // hiçbir onayı olmadan kişisel veri açılması demekti.
    //
    // Artık iki kural var:
    //   1. Telefon eşleşmesi YALNIZCA bu işletmenin mevcut müşterileri
    //      içinde aranıyor. Tezgâhta telefonunu söyleyen düzenli müşteri
    //      bulunuyor; işletmeyle hiç ilişkisi olmayan bir hesap bulunmuyor.
    //   2. Girilen e-posta BAŞKASINA AİTSE hiç bağlanmıyor; o randevu
    //      işletmeye özel bir misafir kaydına yazılıyor.
    //
    // Kalan sınır: müşterinin kendi hesabını işletmeye bağlamak onay
    // gerektirmeli (davet/OTP). O akış henüz yok; buradaki kurallar yalnızca
    // onaysız BAĞLAMAYI engelliyor.
    const phone = parsed.data.customerPhone;
    let customer = await prisma.user.findFirst({
      where: {
        phone,
        role: 'CUSTOMER',
        reservations: { some: { businessId: parsed.data.businessId } },
      },
      select: { id: true },
    });

    if (!customer) {
      const girilen = parsed.data.customerEmail?.trim().toLowerCase() || null;
      const sahipli = girilen
        ? await prisma.user.findUnique({ where: { email: girilen }, select: { id: true } })
        : null;
      // Sahipli e-postaya dokunulmuyor. Serbestse kullanılabilir: kimsenin
      // hesabı değil ve misafir müşteriye e-posta bildirimi gitmesini sağlar.
      const email = girilen && !sahipli
        ? girilen
        : `${phone}.${parsed.data.businessId}@misafir.rezzerv.local`;

      customer = await prisma.user.upsert({
        where: { email },
        update: {},
        create: {
          email,
          name: parsed.data.customerName,
          phone,
          // Misafir kayıt: rastgele parola, kullanıcı sonradan sıfırlar.
          passwordHash: await hashPassword(`gecici-${Math.random().toString(36).slice(2)}9A`),
          role: 'CUSTOMER',
          avatarSeed: String(Math.floor(Math.random() * 24)),
          customerProfile: { create: {} },
        },
        select: { id: true },
      });
    }

    const reservation = await createReservation({
      businessId: parsed.data.businessId,
      branchId: parsed.data.branchId,
      serviceIds: parsed.data.serviceIds,
      staffId: parsed.data.staffId,
      customerId: customer.id,
      date: parsed.data.date,
      startMin: parsed.data.startMin,
      channel: parsed.data.channel,
      note: parsed.data.note,
      internalNote: parsed.data.internalNote,
      promotionCode: parsed.data.promotionCode || undefined,
      paymentMethod: parsed.data.paymentMethod,
      autoConfirm: true,
      actorId: user.id,
    });
    return { reservationId: reservation.id };
  }, { action: 'panelCreateReservationAction' });
  if (result.ok) touch(slug);
  return result;
}

export async function setStatusAction(
  slug: string,
  input: unknown,
): Promise<ActionResult<undefined> & Fields> {
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Geçersiz durum.', fields: fieldErrors(parsed.error) };

  const result = await run(async () => {
    const user = await requireUserAction();
    const reservation = await prisma.reservation.findUnique({
      where: { id: parsed.data.reservationId },
      select: { businessId: true },
    });
    if (!reservation) throw new DomainError('Randevu bulunamadı.', 'NOT_FOUND');
    await assertBusinessAccess(user, reservation.businessId);
    await setReservationStatus({
      id: parsed.data.reservationId,
      to: parsed.data.status as ReservationStatus,
      actorId: user.id,
      note: parsed.data.note,
    });
    return undefined;
  }, { action: 'setStatusAction' });
  if (result.ok) touch(slug);
  return result;
}

export async function saveInternalNoteAction(
  slug: string,
  reservationId: string,
  note: string,
): Promise<ActionResult<undefined>> {
  const result = await run(async () => {
    const user = await requireUserAction();
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      select: { businessId: true },
    });
    if (!reservation) throw new DomainError('Randevu bulunamadı.', 'NOT_FOUND');
    await assertBusinessAccess(user, reservation.businessId);
    await prisma.reservation.update({
      where: { id: reservationId },
      data: { internalNote: note.trim().slice(0, 500) || null },
    });
    return undefined;
  }, { action: 'saveInternalNoteAction' });
  if (result.ok) touch(slug);
  return result;
}

// --- Hizmetler -----------------------------------------------------------

export async function saveServiceAction(
  slug: string,
  businessId: string,
  input: unknown,
): Promise<ActionResult<{ id: string }> & Fields> {
  const parsed = serviceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Formu kontrol edin.', fields: fieldErrors(parsed.error) };

  const result = await run(async () => {
    const user = await requireUserAction();
    await assertBusinessAccess(user, businessId);
    const { id, staffIds, ...data } = parsed.data;

    let serviceId: string;
    if (id) {
      await updateServiceScoped(businessId, id, data);
      serviceId = id;
    } else {
      serviceId = (await prisma.service.create({ data: { ...data, businessId } })).id;
    }

    // Hizmeti verebilecek personel listesini yeniden kur.
    const valid = await prisma.staffMember.findMany({
      where: { id: { in: staffIds }, businessId },
      select: { id: true },
    });
    await prisma.staffService.deleteMany({ where: { serviceId } });
    if (valid.length > 0) {
      await prisma.staffService.createMany({
        data: valid.map((s) => ({ staffId: s.id, serviceId })),
      });
    }
    // Keşfet'teki fiyat sıralaması bu değerden okunuyor; hizmet fiyatı
    // değiştiyse sıralamanın da değişmesi gerekiyor.
    await minFiyatiTazele(businessId);
    return { id: serviceId };
  }, { action: 'saveServiceAction' });
  if (result.ok) touch(slug);
  return result;
}

/** Hizmet silinmez, pasife alınır: geçmiş randevular referansını korur. */
export async function toggleServiceAction(
  slug: string,
  serviceId: string,
  active: boolean,
): Promise<ActionResult<undefined>> {
  const result = await run(async () => {
    const user = await requireUserAction();
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      select: { businessId: true },
    });
    if (!service) throw new DomainError('Hizmet bulunamadı.', 'NOT_FOUND');
    await assertBusinessAccess(user, service.businessId);
    await prisma.service.update({ where: { id: serviceId }, data: { active } });
    // Pasife alınan hizmet en ucuzuysa işletmenin başlangıç fiyatı değişir.
    await minFiyatiTazele(service.businessId);
    return undefined;
  }, { action: 'toggleServiceAction' });
  if (result.ok) touch(slug);
  return result;
}

// --- Personel ------------------------------------------------------------

export async function saveStaffAction(
  slug: string,
  businessId: string,
  input: unknown,
): Promise<ActionResult<{ id: string }> & Fields> {
  const parsed = staffSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Formu kontrol edin.', fields: fieldErrors(parsed.error) };

  const result = await run(async () => {
    const user = await requireUserAction();
    await assertBusinessAccess(user, businessId);
    const { id, serviceIds, branchId, ...data } = parsed.data;
    // Şube de doğrulanmalı: yalnızca personel kimliğini sınırlamak, personeli
    // başka bir işletmenin şubesine bağlamayı engellemezdi.
    if (branchId) await assertBranchBelongs(businessId, branchId);

    let member: { id: string };
    if (id) {
      await updateStaffScoped(businessId, id, { ...data, branchId: branchId || null });
      member = { id };
    } else {
      member = await prisma.staffMember.create({
          data: {
            ...data,
            businessId,
            branchId: branchId || null,
            hue: Math.floor(Math.random() * 360),
            // Yeni personel varsayılan olarak şube saatlerini devralır.
            hours: {
              create: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
                weekday,
                closed: weekday === 0,
                startMin: weekday === 6 ? 600 : 540,
                endMin: weekday === 6 ? 1020 : 1140,
              })),
            },
          },
        });
    }

    const valid = await prisma.service.findMany({
      where: { id: { in: serviceIds }, businessId },
      select: { id: true },
    });
    await prisma.staffService.deleteMany({ where: { staffId: member.id } });
    if (valid.length > 0) {
      await prisma.staffService.createMany({
        data: valid.map((s) => ({ staffId: member.id, serviceId: s.id })),
      });
    }
    return { id: member.id };
  }, { action: 'saveStaffAction' });
  if (result.ok) touch(slug);
  return result;
}

export async function toggleStaffAction(
  slug: string,
  staffId: string,
  active: boolean,
): Promise<ActionResult<undefined>> {
  const result = await run(async () => {
    const user = await requireUserAction();
    const member = await prisma.staffMember.findUnique({
      where: { id: staffId },
      select: { businessId: true },
    });
    if (!member) throw new DomainError('Personel bulunamadı.', 'NOT_FOUND');
    await assertBusinessAccess(user, member.businessId);

    if (!active) {
      // Pasife almadan önce ileri tarihli randevusu var mı kontrol et.
      const upcoming = await prisma.reservation.count({
        where: { staffId, status: { in: ['PENDING', 'CONFIRMED'] }, startsAt: { gte: new Date() } },
      });
      if (upcoming > 0) {
        throw new DomainError(
          `Bu personelin ${upcoming} yaklaşan randevusu var. Önce randevuları başka personele taşıyın.`,
          'HAS_UPCOMING',
        );
      }
    }
    await prisma.staffMember.update({ where: { id: staffId }, data: { active } });
    return undefined;
  }, { action: 'toggleStaffAction' });
  if (result.ok) touch(slug);
  return result;
}

// --- Çalışma saatleri, izinler ------------------------------------------

export async function saveHoursAction(
  slug: string,
  target: 'branch' | 'staff',
  input: unknown,
): Promise<ActionResult<undefined> & Fields> {
  const parsed = workingHoursSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Saatleri kontrol edin.', fields: fieldErrors(parsed.error) };

  const result = await run(async () => {
    const user = await requireUserAction();
    const businessId =
      target === 'branch'
        ? (await prisma.branch.findUnique({ where: { id: parsed.data.targetId }, select: { businessId: true } }))?.businessId
        : (await prisma.staffMember.findUnique({ where: { id: parsed.data.targetId }, select: { businessId: true } }))?.businessId;
    if (!businessId) throw new DomainError('Kayıt bulunamadı.', 'NOT_FOUND');
    await assertBusinessAccess(user, businessId);

    // ÖNCE BÜTÜN GÜNLER DOĞRULANIR, SONRA YAZILIR.
    //
    // Eskiden döngü gün gün doğrulayıp gün gün yazıyordu: dördüncü günde
    // "bu saatlerin dışında randevu var" hatası alındığında ilk üç gün ZATEN
    // KAYDEDİLMİŞ oluyordu. İşletme hata mesajını görüp hiçbir şey olmadığını
    // sanıyor, oysa haftanın yarısı değişmiş oluyordu.
    if (new Set(parsed.data.days.map((d) => d.weekday)).size !== parsed.data.days.length) {
      throw new DomainError('Aynı gün birden fazla kez gönderilemez.', 'BAD_RANGE');
    }

    for (const day of parsed.data.days) {
      if (!day.closed && day.endMin <= day.startMin) {
        throw new DomainError('Kapanış saati açılıştan sonra olmalı.', 'BAD_RANGE');
      }

      // Yeni saatlerin dışında kalacak ileri tarihli randevu varsa değişikliği
      // reddediyoruz. Aksi hâlde kayıt sessizce "saat dışında" kalır ve sorunu
      // ancak müşteri kapıya geldiğinde fark edersiniz.
      const orphans = await countOrphans(target, parsed.data.targetId, day);
      if (orphans.count > 0) {
        throw new DomainError(
          `${WEEKDAYS[day.weekday]} için yeni saatlerin dışında kalacak ${orphans.count} randevu var (ilki ${orphans.firstLabel}). Önce onları taşıyın veya iptal edin.`,
          'HAS_RESERVATIONS',
        );
      }
    }

    // Yazma tek transaction: ya haftanın tamamı geçerli olur ya da hiçbiri.
    await prisma.$transaction(
      parsed.data.days.map((day) =>
        target === 'branch'
          ? prisma.branchHour.upsert({
              where: { branchId_weekday: { branchId: parsed.data.targetId, weekday: day.weekday } },
              update: { openMin: day.startMin, closeMin: day.endMin, closed: day.closed },
              create: {
                branchId: parsed.data.targetId,
                weekday: day.weekday,
                openMin: day.startMin,
                closeMin: day.endMin,
                closed: day.closed,
              },
            })
          : prisma.staffHour.upsert({
              where: { staffId_weekday: { staffId: parsed.data.targetId, weekday: day.weekday } },
              update: { startMin: day.startMin, endMin: day.endMin, closed: day.closed },
              create: {
                staffId: parsed.data.targetId,
                weekday: day.weekday,
                startMin: day.startMin,
                endMin: day.endMin,
                closed: day.closed,
              },
            }),
      ),
    );
    return undefined;
  }, { action: 'saveHoursAction' });
  if (result.ok) touch(slug);
  return result;
}

export async function saveTimeOffAction(
  slug: string,
  input: { staffId: string; startsAt: string; endsAt: string; reason: string; type: string },
): Promise<ActionResult<undefined>> {
  const result = await run(async () => {
    const user = await requireUserAction();
    const member = await prisma.staffMember.findUnique({
      where: { id: input.staffId },
      select: { businessId: true },
    });
    if (!member) throw new DomainError('Personel bulunamadı.', 'NOT_FOUND');
    await assertBusinessAccess(user, member.businessId);

    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      throw new DomainError('Tarih biçimi geçersiz.', 'BAD_DATE');
    }
    if (endsAt <= startsAt) throw new DomainError('Bitiş, başlangıçtan sonra olmalı.', 'BAD_RANGE');

    const clash = await prisma.reservation.count({
      where: {
        staffId: input.staffId,
        status: { in: ['PENDING', 'CONFIRMED', 'ARRIVED'] },
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
    });
    if (clash > 0) {
      throw new DomainError(
        `Bu aralıkta ${clash} randevu var. Önce randevuları taşıyın veya iptal edin.`,
        'HAS_RESERVATIONS',
      );
    }

    await prisma.timeOff.create({
      data: {
        staffId: input.staffId,
        startsAt,
        endsAt,
        reason: input.reason.slice(0, 200),
        type: ['LEAVE', 'BLOCK', 'HOLIDAY'].includes(input.type) ? input.type : 'LEAVE',
      },
    });
    return undefined;
  }, { action: 'saveTimeOffAction' });
  if (result.ok) touch(slug);
  return result;
}

export async function deleteTimeOffAction(slug: string, id: string): Promise<ActionResult<undefined>> {
  const result = await run(async () => {
    const user = await requireUserAction();
    const row = await prisma.timeOff.findUnique({
      where: { id },
      select: { staff: { select: { businessId: true } } },
    });
    if (!row?.staff) throw new DomainError('Kayıt bulunamadı.', 'NOT_FOUND');
    await assertBusinessAccess(user, row.staff.businessId);
    await prisma.timeOff.delete({ where: { id } });
    return undefined;
  }, { action: 'deleteTimeOffAction' });
  if (result.ok) touch(slug);
  return result;
}

// --- Şubeler, kampanyalar, CRM, profil ----------------------------------

export async function saveBranchAction(
  slug: string,
  businessId: string,
  input: unknown,
): Promise<ActionResult<{ id: string }> & Fields> {
  const parsed = branchSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Formu kontrol edin.', fields: fieldErrors(parsed.error) };

  const result = await run(async () => {
    const user = await requireUserAction();
    await assertBusinessAccess(user, businessId);
    const { id, phone, ...data } = parsed.data;

    if (id) {
      await updateBranchScoped(businessId, id, { ...data, phone: phone || null });
      return { id };
    }
    // Kota kontrolü ve yazma AYNI transaction'da: ayrı yapılsaydı iki
    // eşzamanlı istek sınırı birlikte aşabilirdi (bkz. entitlements.ts).
    const branch = await prisma.$transaction(async (tx) => {
      await subeKotasiniAyir(tx, businessId);
      return tx.branch.create({
        data: {
          ...data,
          phone: phone || null,
          businessId,
          hours: {
            create: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
              weekday,
              closed: weekday === 0,
              openMin: weekday === 6 ? 600 : 540,
              closeMin: weekday === 6 ? 1020 : 1140,
            })),
          },
        },
      });
    });
    return { id: branch.id };
  }, { action: 'saveBranchAction' });
  if (result.ok) touch(slug);
  return result;
}

export async function savePromotionAction(
  slug: string,
  businessId: string,
  input: unknown,
): Promise<ActionResult<{ id: string }> & Fields> {
  const parsed = promotionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Formu kontrol edin.', fields: fieldErrors(parsed.error) };

  const result = await run(async () => {
    const user = await requireUserAction();
    await assertBusinessAccess(user, businessId);
    const { id, startsAt, endsAt, kind, value, ...rest } = parsed.data;

    if (kind === 'PERCENT' && value > 90) {
      throw new DomainError('Yüzde indirim en fazla %90 olabilir.', 'BAD_VALUE');
    }
    const starts = new Date(`${startsAt}T00:00:00`);
    const ends = new Date(`${endsAt}T23:59:59`);
    if (ends <= starts) throw new DomainError('Bitiş tarihi başlangıçtan sonra olmalı.', 'BAD_RANGE');

    const data = { ...rest, kind, value, startsAt: starts, endsAt: ends };
    if (id) {
      await updatePromotionScoped(businessId, id, data);
      return { id };
    }
    const exists = await prisma.promotion.findUnique({ where: { code: rest.code }, select: { id: true } });
    if (exists) throw new DomainError('Bu kod başka bir kampanyada kullanılıyor.', 'CODE_TAKEN');
    const promo = await prisma.promotion.create({ data: { ...data, businessId } });
    return { id: promo.id };
  }, { action: 'savePromotionAction' });
  if (result.ok) touch(slug);
  return result;
}

export async function togglePromotionAction(
  slug: string,
  id: string,
  active: boolean,
): Promise<ActionResult<undefined>> {
  const result = await run(async () => {
    const user = await requireUserAction();
    const promo = await prisma.promotion.findUnique({ where: { id }, select: { businessId: true } });
    if (!promo?.businessId) throw new DomainError('Kampanya bulunamadı.', 'NOT_FOUND');
    await assertBusinessAccess(user, promo.businessId);
    await prisma.promotion.update({ where: { id }, data: { active } });
    return undefined;
  }, { action: 'togglePromotionAction' });
  if (result.ok) touch(slug);
  return result;
}

export async function addCustomerNoteAction(
  slug: string,
  businessId: string,
  customerId: string,
  body: string,
): Promise<ActionResult<undefined>> {
  const result = await run(async () => {
    const user = await requireUserAction();
    await assertBusinessAccess(user, businessId);
    const text = body.trim();
    if (text.length < 2) throw new DomainError('Not en az 2 karakter olmalı.', 'TOO_SHORT');
    await prisma.customerNote.create({
      data: { businessId, customerId, authorId: user.id, body: text.slice(0, 1000) },
    });
    return undefined;
  }, { action: 'addCustomerNoteAction' });
  if (result.ok) touch(slug);
  return result;
}

export async function toggleCustomerTagAction(
  slug: string,
  businessId: string,
  customerId: string,
  tagId: string,
): Promise<ActionResult<{ attached: boolean }>> {
  const result = await run(async () => {
    const user = await requireUserAction();
    await assertBusinessAccess(user, businessId);
    const tag = await prisma.customerTag.findFirst({ where: { id: tagId, businessId } });
    if (!tag) throw new DomainError('Etiket bulunamadı.', 'NOT_FOUND');
    const link = await prisma.customerTagLink.findUnique({
      where: { tagId_customerId: { tagId, customerId } },
    });
    if (link) {
      await prisma.customerTagLink.delete({ where: { tagId_customerId: { tagId, customerId } } });
      return { attached: false };
    }
    await prisma.customerTagLink.create({ data: { tagId, customerId } });
    return { attached: true };
  }, { action: 'toggleCustomerTagAction' });
  if (result.ok) touch(slug);
  return result;
}

export async function updateBusinessProfileAction(
  slug: string,
  businessId: string,
  input: unknown,
): Promise<ActionResult<undefined> & Fields> {
  const parsed = businessProfileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Formu kontrol edin.', fields: fieldErrors(parsed.error) };

  const result = await run(async () => {
    const user = await requireUserAction();
    await assertBusinessAccess(user, businessId);
    const { amenities, phone, email, website, ...rest } = parsed.data;
    await prisma.business.update({
      where: { id: businessId },
      data: {
        ...rest,
        phone: phone || null,
        email: email || null,
        website: website || null,
        amenities: JSON.stringify(amenities.filter(Boolean)),
      },
    });
    return undefined;
  }, { action: 'updateBusinessProfileAction' });
  if (result.ok) touch(slug);
  return result;
}

export async function replyToReviewAction(
  slug: string,
  reviewId: string,
  reply: string,
): Promise<ActionResult<undefined>> {
  const result = await run(async () => {
    const user = await requireUserAction();
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      select: { businessId: true },
    });
    if (!review) throw new DomainError('Değerlendirme bulunamadı.', 'NOT_FOUND');
    await assertBusinessAccess(user, review.businessId);
    const text = reply.trim();
    if (text.length < 2) throw new DomainError('Yanıt en az 2 karakter olmalı.', 'TOO_SHORT');
    await prisma.review.update({
      where: { id: reviewId },
      data: { reply: text.slice(0, 600), repliedAt: new Date() },
    });
    return undefined;
  }, { action: 'replyToReviewAction' });
  if (result.ok) touch(slug);
  return result;
}

// --- Galeri --------------------------------------------------------------
// Dosya yükleme için depolama sağlayıcısı gerektiğinden MVP'de görseller
// adresle eklenir. Yükleme eklendiğinde yalnızca bu üç eylem değişir.

export async function addBusinessImageAction(
  slug: string,
  businessId: string,
  url: string,
  caption: string,
): Promise<ActionResult<undefined>> {
  const result = await run(async () => {
    const user = await requireUserAction();
    await assertBusinessAccess(user, businessId);

    const trimmed = url.trim();
    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      throw new DomainError('Geçerli bir görsel adresi girin.', 'BAD_URL');
    }
    if (parsed.protocol !== 'https:') {
      throw new DomainError('Görsel adresi https ile başlamalı.', 'INSECURE_URL');
    }
    const count = await prisma.businessImage.count({ where: { businessId } });
    if (count >= 12) throw new DomainError('En fazla 12 görsel ekleyebilirsiniz.', 'LIMIT');

    await prisma.businessImage.create({
      data: {
        businessId,
        url: trimmed,
        caption: caption.trim().slice(0, 120),
        sortOrder: count,
      },
    });
    return undefined;
  }, { action: 'addBusinessImageAction' });
  if (result.ok) touch(slug);
  return result;
}

export async function deleteBusinessImageAction(
  slug: string,
  imageId: string,
): Promise<ActionResult<undefined>> {
  const result = await run(async () => {
    const user = await requireUserAction();
    const image = await prisma.businessImage.findUnique({
      where: { id: imageId },
      select: { businessId: true, url: true },
    });
    if (!image) throw new DomainError('Görsel bulunamadı.', 'NOT_FOUND');
    await assertBusinessAccess(user, image.businessId);

    await prisma.businessImage.delete({ where: { id: imageId } });
    // Kapak bu görselse kapağı da temizle; kırık kapak kalmasın.
    await prisma.business.updateMany({
      where: { id: image.businessId, coverUrl: image.url },
      data: { coverUrl: null },
    });
    return undefined;
  }, { action: 'deleteBusinessImageAction' });
  if (result.ok) touch(slug);
  return result;
}

/** Galeriden bir görseli kapak yapar; null gönderilirse gradient kapağa döner. */
export async function setCoverImageAction(
  slug: string,
  businessId: string,
  url: string | null,
): Promise<ActionResult<undefined>> {
  const result = await run(async () => {
    const user = await requireUserAction();
    await assertBusinessAccess(user, businessId);
    if (url !== null) {
      const owned = await prisma.businessImage.findFirst({
        where: { businessId, url },
        select: { id: true },
      });
      if (!owned) throw new DomainError('Görsel bu işletmeye ait değil.', 'FOREIGN_IMAGE');
    }
    await prisma.business.update({ where: { id: businessId }, data: { coverUrl: url } });
    return undefined;
  }, { action: 'setCoverImageAction' });
  if (result.ok) touch(slug);
  return result;
}

// --- Kapora paketi -------------------------------------------------------

/**
 * İşletmenin kapora ayarları. Paket (addon) kapalıysa hiçbir şey değişmez:
 * özelliği platform açar, işletme yalnızca kendi tercihini yönetir.
 */
export async function updateDepositSettingsAction(
  slug: string,
  businessId: string,
  input: unknown,
): Promise<ActionResult<undefined> & Fields> {
  const parsed = depositSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Kapora ayarlarını kontrol edin.', fields: fieldErrors(parsed.error) };
  }
  const result = await run(async () => {
    const user = await requireUserAction();
    await assertBusinessAccess(user, businessId);

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { depositAddon: true },
    });
    if (!business?.depositAddon) {
      throw new DomainError(
        'Kapora paketi işletmeniz için etkin değil. Platform yöneticisiyle görüşün.',
        'ADDON_OFF',
      );
    }

    await prisma.business.update({
      where: { id: businessId },
      data: {
        depositEnabled: parsed.data.enabled,
        depositKind: parsed.data.kind,
        depositValue: parsed.data.value,
        depositMinPrice: parsed.data.minPrice,
        depositRefundHours: parsed.data.refundHours,
      },
    });
    return undefined;
  }, { action: 'updateDepositSettingsAction' });
  if (result.ok) touch(slug);
  return result;
}

// --- Onay öncesi takvim bakışı -------------------------------------------

export type DayContextItem = {
  id: string;
  startMin: number;
  endMin: number;
  blockEnd: number;
  status: string;
  customerName: string;
  serviceName: string;
  isTarget: boolean;
};

export type DayContext = {
  date: string;
  staffName: string;
  branchName: string;
  serviceName: string;
  customerName: string;
  customerPhone: string | null;
  price: number;
  depositAmount: number;
  depositStatus: string;
  openMin: number;
  closeMin: number;
  items: DayContextItem[];
  issue: ReservationIssue | null;
};

/**
 * Onaylanacak randevunun o günkü bağlamı.
 *
 * İşletme "onayla" demeden önce günün programını görmek ister: öncesinde ne
 * var, sonrasında ne var, araya sıkışıyor mu. Çakışma zaten engellenmiştir ama
 * karar bilgiyle verilir.
 */
export async function dayContextAction(reservationId: string): Promise<ActionResult<DayContext>> {
  return run(async () => {
    const user = await requireUserAction();
    const target = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        staff: { select: { id: true, displayName: true } },
        branch: { select: { id: true, name: true, hours: true } },
        service: { select: { name: true } },
        customer: { select: { name: true, phone: true } },
      },
    });
    if (!target) throw new DomainError('Randevu bulunamadı.', 'NOT_FOUND');
    await assertBusinessAccess(user, target.businessId);

    const sameDay = await prisma.reservation.findMany({
      where: {
        staffId: target.staffId,
        date: target.date,
        status: { in: ['PENDING', 'CONFIRMED', 'ARRIVED', 'COMPLETED', 'NO_SHOW'] },
      },
      orderBy: { startMin: 'asc' },
      select: {
        id: true,
        startMin: true,
        endMin: true,
        blockEnd: true,
        status: true,
        customer: { select: { name: true } },
        service: { select: { name: true } },
      },
    });

    const bh = target.branch.hours.find((h) => h.weekday === weekdayOf(target.date));

    return {
      date: target.date,
      staffName: target.staff.displayName,
      branchName: target.branch.name,
      serviceName: target.service.name,
      customerName: target.customer.name,
      customerPhone: target.customer.phone,
      price: target.finalPrice,
      depositAmount: target.depositAmount,
      depositStatus: target.depositStatus,
      openMin: bh && !bh.closed ? bh.openMin : 540,
      closeMin: bh && !bh.closed ? bh.closeMin : 1140,
      items: sameDay.map((r) => ({
        id: r.id,
        startMin: r.startMin,
        endMin: r.endMin,
        blockEnd: r.blockEnd,
        status: r.status,
        customerName: r.customer.name,
        serviceName: r.service.name,
        isTarget: r.id === target.id,
      })),
      issue: await auditReservation(target.id),
    };
  }, { action: 'dayContextAction' });
}

/**
 * Hak ediş hesabı bilgileri. Bu bilgiler ödeme kuruluşundaki alt üye işyeri
 * kaydını oluşturmak için kullanılır; platform parayı kendi hesabında
 * tutmadığı için ödeme doğrudan buraya yapılır.
 */
export async function updatePayoutAction(
  slug: string,
  businessId: string,
  input: unknown,
): Promise<ActionResult<undefined> & Fields> {
  const parsed = payoutSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Hesap bilgilerini kontrol edin.', fields: fieldErrors(parsed.error) };
  }
  const result = await run(async () => {
    const user = await requireUserAction();
    await assertBusinessAccess(user, businessId);
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { depositAddon: true },
    });
    if (!business?.depositAddon) {
      throw new DomainError('Kapora paketi etkin değilken hak ediş hesabı gerekmez.', 'ADDON_OFF');
    }
    await prisma.business.update({
      where: { id: businessId },
      data: {
        payoutTitle: parsed.data.payoutTitle,
        payoutIban: parsed.data.payoutIban,
        taxNumber: parsed.data.taxNumber,
      },
    });
    return undefined;
  }, { action: 'updatePayoutAction' });
  if (result.ok) touch(slug);
  return result;
}

// --- Restoran menüsü ------------------------------------------------------

/**
 * Menü kalemi ekler/günceller.
 *
 * Menü rezervasyon tutarına girmiyor, bu yüzden para yolunda değil — ama yine
 * de `run()` ve yetki kontrolünden geçiyor: işletme sınırı her yazma için
 * aynı şekilde korunmalı, "önemsiz" veri diye bir istisna açılmamalı.
 */
export async function saveMenuItemAction(
  input: unknown,
): Promise<ActionResult<undefined> & { fields?: Record<string, string> }> {
  const parsed = menuItemSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Formu kontrol edin.', fields: fieldErrors(parsed.error) };
  }
  const d = parsed.data;

  const result = await run(async (ctx) => {
    const user = await requireUserAction();
    await assertBusinessAccess(user, d.businessId);
    ctx.userId = user.id;
    ctx.meta = { businessId: d.businessId };

    const veri = {
      category: d.category,
      name: d.name,
      description: d.description || null,
      price: d.price,
      sortOrder: d.sortOrder,
    };

    if (d.id) {
      // where'e businessId de giriyor: başka işletmenin kalemini id tahmin
      // ederek güncellemek mümkün olmasın.
      const sonuc = await prisma.menuItem.updateMany({
        where: { id: d.id, businessId: d.businessId },
        data: veri,
      });
      if (sonuc.count === 0) throw new DomainError('Menü kalemi bulunamadı.', 'NOT_FOUND');
    } else {
      await prisma.menuItem.create({ data: { ...veri, businessId: d.businessId } });
    }
    return undefined;
  }, { action: 'saveMenuItemAction' });

  if (result.ok) revalidatePath('/panel');
  return result;
}

/** Menü kalemini yayından kaldırır ya da geri alır. */
export async function toggleMenuItemAction(
  businessId: string,
  id: string,
  active: boolean,
): Promise<ActionResult<undefined>> {
  const result = await run(async (ctx) => {
    const user = await requireUserAction();
    await assertBusinessAccess(user, businessId);
    ctx.userId = user.id;
    const sonuc = await prisma.menuItem.updateMany({ where: { id, businessId }, data: { active } });
    if (sonuc.count === 0) throw new DomainError('Menü kalemi bulunamadı.', 'NOT_FOUND');
    return undefined;
  }, { action: 'toggleMenuItemAction' });
  if (result.ok) revalidatePath('/panel');
  return result;
}

/** Menü kalemini kalıcı siler. */
export async function deleteMenuItemAction(
  businessId: string,
  id: string,
): Promise<ActionResult<undefined>> {
  const result = await run(async (ctx) => {
    const user = await requireUserAction();
    await assertBusinessAccess(user, businessId);
    ctx.userId = user.id;
    const sonuc = await prisma.menuItem.deleteMany({ where: { id, businessId } });
    if (sonuc.count === 0) throw new DomainError('Menü kalemi bulunamadı.', 'NOT_FOUND');
    return undefined;
  }, { action: 'deleteMenuItemAction' });
  if (result.ok) revalidatePath('/panel');
  return result;
}
