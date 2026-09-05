'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { run, DomainError, type ActionResult } from '@/server/errors';
import { requireUserAction } from '@/server/auth';
import { profileSchema, reviewSchema, fieldErrors } from '@/lib/validation';
import { notifyBusiness } from '@/server/notifications';
import { grantConsent, revokeConsent } from '@/server/consent';

export async function toggleFavoriteAction(businessId: string): Promise<ActionResult<{ favorite: boolean }>> {
  const result = await run(async () => {
    const user = await requireUserAction();
    const existing = await prisma.favorite.findUnique({
      where: { userId_businessId: { userId: user.id, businessId } },
    });
    if (existing) {
      await prisma.favorite.delete({ where: { userId_businessId: { userId: user.id, businessId } } });
      return { favorite: false };
    }
    await prisma.favorite.create({ data: { userId: user.id, businessId } });
    return { favorite: true };
  }, { action: 'toggleFavoriteAction' });
  if (result.ok) revalidatePath('/favorilerim');
  return result;
}

export async function markNotificationsReadAction(): Promise<ActionResult<undefined>> {
  const result = await run(async () => {
    const user = await requireUserAction();
    await prisma.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return undefined;
  }, { action: 'markNotificationsReadAction' });
  if (result.ok) revalidatePath('/bildirimler');
  return result;
}

export async function updateProfileAction(
  formData: FormData,
): Promise<ActionResult<undefined> & { fields?: Record<string, string> }> {
  const parsed = profileSchema.safeParse({
    name: formData.get('name'),
    phone: formData.get('phone') || '',
    city: formData.get('city') || '',
    district: formData.get('district') || '',
    smsOptIn: formData.get('smsOptIn') === 'on',
    emailOptIn: formData.get('emailOptIn') === 'on',
  });
  if (!parsed.success) {
    return { ok: false, error: 'Formu kontrol edin.', fields: fieldErrors(parsed.error) };
  }
  const result = await run(async () => {
    const user = await requireUserAction();
    await prisma.user.update({
      where: { id: user.id },
      data: { name: parsed.data.name, phone: parsed.data.phone || null },
    });
    await prisma.customerProfile.upsert({
      where: { userId: user.id },
      update: {
        city: parsed.data.city || 'Ankara',
        district: parsed.data.district || null,
        smsOptIn: parsed.data.smsOptIn,
        emailOptIn: parsed.data.emailOptIn,
      },
      create: {
        userId: user.id,
        city: parsed.data.city || 'Ankara',
        district: parsed.data.district || null,
        smsOptIn: parsed.data.smsOptIn,
        emailOptIn: parsed.data.emailOptIn,
      },
    });
    return undefined;
  }, { action: 'updateProfileAction' });
  if (result.ok) revalidatePath('/profil');
  return result;
}

/** Değerlendirme yalnızca tamamlanmış kendi randevusu için yazılabilir. */
export async function submitReviewAction(
  input: unknown,
): Promise<ActionResult<undefined> & { fields?: Record<string, string> }> {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Değerlendirmeyi kontrol edin.', fields: fieldErrors(parsed.error) };
  }
  const result = await run(async () => {
    const user = await requireUserAction();
    const reservation = await prisma.reservation.findUnique({
      where: { id: parsed.data.reservationId },
      select: { id: true, customerId: true, businessId: true, status: true, staffId: true, review: { select: { id: true } } },
    });
    if (!reservation || reservation.customerId !== user.id) {
      throw new DomainError('Bu randevuyu değerlendiremezsiniz.', 'FORBIDDEN');
    }
    if (reservation.status !== 'COMPLETED') {
      throw new DomainError('Yalnızca tamamlanmış randevular değerlendirilebilir.', 'BAD_STATE');
    }
    if (reservation.review) throw new DomainError('Bu randevuyu zaten değerlendirdiniz.', 'DUPLICATE');

    await prisma.review.create({
      data: {
        businessId: reservation.businessId,
        userId: user.id,
        reservationId: reservation.id,
        rating: parsed.data.rating,
        comment: parsed.data.comment,
      },
    });
    const agg = await prisma.review.aggregate({
      where: { businessId: reservation.businessId, status: 'PUBLISHED' },
      _avg: { rating: true },
      _count: true,
    });
    await prisma.business.update({
      where: { id: reservation.businessId },
      data: {
        ratingAvg: Math.round((agg._avg.rating ?? 0) * 10) / 10,
        ratingCount: agg._count,
      },
    });
    await notifyBusiness(reservation.businessId, reservation.staffId, {
      kind: 'REVIEW',
      title: 'Yeni değerlendirme',
      body: `${parsed.data.rating} yıldız · ${parsed.data.comment.slice(0, 80) || 'Yorum yok'}`,
    });
    return undefined;
  }, { action: 'submitReviewAction' });
  if (result.ok) revalidatePath('/randevularim');
  return result;
}

/**
 * Açık rızayı verir veya geri alır.
 *
 * KVKK m.7 rızanın geri alınabilmesini zorunlu kılıyor ve aydınlatma metni bunu
 * profil sayfası üzerinden vaat ediyor. Geri alma yalnızca kaydı kapatmıyor;
 * `createReservation` hassas sektörlerde bu kaydı kontrol ediyor.
 */
export async function setConsentAction(granted: boolean): Promise<ActionResult<undefined>> {
  const result = await run(async (ctx) => {
    const user = await requireUserAction();
    ctx.userId = user.id;
    ctx.meta = { granted };
    if (granted) await grantConsent(user.id);
    else await revokeConsent(user.id);
    return undefined;
  }, { action: 'setConsentAction' });
  if (result.ok) revalidatePath('/profil');
  return result;
}
