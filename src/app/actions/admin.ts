'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { run, DomainError, type ActionResult } from '@/server/errors';
import { requireRoleAction } from '@/server/auth';
import { notifyUser } from '@/server/notifications';
import { BUSINESS_STATUSES, type BusinessStatus, ROLES, type Role } from '@/lib/constants';
import { slugify } from '@/lib/utils';

async function audit(
  actorId: string,
  action: string,
  entity: string,
  entityId: string,
  meta?: unknown,
): Promise<void> {
  await prisma.auditLog.create({
    data: { actorId, action, entity, entityId, meta: meta ? JSON.stringify(meta) : null },
  });
}

/** İşletme durumunu değiştirir ve denetim izini bırakır. */
export async function setBusinessStatusAction(
  businessId: string,
  status: string,
  reason?: string,
): Promise<ActionResult<undefined>> {
  const result = await run(async () => {
    const admin = await requireRoleAction(['ADMIN']);
    if (!BUSINESS_STATUSES.includes(status as BusinessStatus)) {
      throw new DomainError('Geçersiz durum.', 'BAD_STATUS');
    }
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, name: true, status: true, ownerId: true },
    });
    if (!business) throw new DomainError('İşletme bulunamadı.', 'NOT_FOUND');
    if (business.status === status) return undefined;
    if (status === 'REJECTED' && !reason?.trim()) {
      throw new DomainError('Reddetme gerekçesi zorunludur.', 'REASON_REQUIRED');
    }

    await prisma.$transaction([
      prisma.business.update({
        where: { id: businessId },
        data: { status, rejectionReason: status === 'REJECTED' ? (reason ?? null) : null },
      }),
      prisma.businessStatusHistory.create({
        data: {
          businessId,
          fromStatus: business.status,
          toStatus: status,
          actorId: admin.id,
          reason: reason ?? null,
        },
      }),
    ]);

    const label =
      status === 'APPROVED'
        ? 'İşletmeniz onaylandı ve yayında'
        : status === 'REJECTED'
          ? 'İşletme başvurunuz reddedildi'
          : status === 'SUSPENDED'
            ? 'İşletmeniz askıya alındı'
            : 'İşletme durumunuz güncellendi';

    await notifyUser({
      userId: business.ownerId,
      kind: 'SYSTEM',
      title: label,
      body: reason ?? (status === 'APPROVED' ? 'Artık müşteriler size randevu oluşturabilir.' : ''),
      href: '/panel',
      alsoSend: true,
    });
    await audit(admin.id, 'business.status', 'Business', businessId, {
      from: business.status,
      to: status,
    });
    return undefined;
  });
  if (result.ok) {
    revalidatePath('/yonetim/isletmeler');
    revalidatePath('/kesfet');
  }
  return result;
}

export async function toggleFeaturedAction(
  businessId: string,
  featured: boolean,
): Promise<ActionResult<undefined>> {
  const result = await run(async () => {
    const admin = await requireRoleAction(['ADMIN']);
    await prisma.business.update({ where: { id: businessId }, data: { featured } });
    await audit(admin.id, 'business.featured', 'Business', businessId, { featured });
    return undefined;
  });
  if (result.ok) {
    revalidatePath('/yonetim/isletmeler');
    revalidatePath('/');
  }
  return result;
}

export async function setUserActiveAction(
  userId: string,
  active: boolean,
): Promise<ActionResult<undefined>> {
  const result = await run(async () => {
    const admin = await requireRoleAction(['ADMIN']);
    if (admin.id === userId) throw new DomainError('Kendi hesabınızı kapatamazsınız.', 'SELF');
    await prisma.user.update({ where: { id: userId }, data: { active } });
    await audit(admin.id, 'user.active', 'User', userId, { active });
    return undefined;
  });
  if (result.ok) revalidatePath('/yonetim/kullanicilar');
  return result;
}

export async function setUserRoleAction(
  userId: string,
  role: string,
): Promise<ActionResult<undefined>> {
  const result = await run(async () => {
    const admin = await requireRoleAction(['ADMIN']);
    if (!ROLES.includes(role as Role)) throw new DomainError('Geçersiz rol.', 'BAD_ROLE');
    if (admin.id === userId) throw new DomainError('Kendi rolünüzü değiştiremezsiniz.', 'SELF');
    await prisma.user.update({ where: { id: userId }, data: { role } });
    await audit(admin.id, 'user.role', 'User', userId, { role });
    return undefined;
  });
  if (result.ok) revalidatePath('/yonetim/kullanicilar');
  return result;
}

/** Şikayet edilen değerlendirmeyi yayınlar veya gizler. */
export async function moderateReviewAction(
  reviewId: string,
  status: 'PUBLISHED' | 'HIDDEN',
): Promise<ActionResult<undefined>> {
  const result = await run(async () => {
    const admin = await requireRoleAction(['ADMIN']);
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      select: { businessId: true },
    });
    if (!review) throw new DomainError('Değerlendirme bulunamadı.', 'NOT_FOUND');

    await prisma.review.update({
      where: { id: reviewId },
      data: { status, ...(status === 'PUBLISHED' ? { reportReason: null } : {}) },
    });
    // Puan ortalaması yalnızca yayındaki yorumlardan hesaplanır.
    const agg = await prisma.review.aggregate({
      where: { businessId: review.businessId, status: 'PUBLISHED' },
      _avg: { rating: true },
      _count: true,
    });
    await prisma.business.update({
      where: { id: review.businessId },
      data: { ratingAvg: Math.round((agg._avg.rating ?? 0) * 10) / 10, ratingCount: agg._count },
    });
    await audit(admin.id, 'review.moderate', 'Review', reviewId, { status });
    return undefined;
  });
  if (result.ok) revalidatePath('/yonetim/degerlendirmeler');
  return result;
}

export async function saveCategoryAction(input: {
  id?: string;
  name: string;
  sector: string;
  blurb: string;
  active: boolean;
}): Promise<ActionResult<undefined>> {
  const result = await run(async () => {
    const admin = await requireRoleAction(['ADMIN']);
    const name = input.name.trim();
    if (name.length < 2) throw new DomainError('Kategori adı en az 2 karakter olmalı.', 'TOO_SHORT');

    if (input.id) {
      await prisma.businessCategory.update({
        where: { id: input.id },
        data: { name, blurb: input.blurb.trim().slice(0, 160), active: input.active },
      });
      await audit(admin.id, 'category.update', 'BusinessCategory', input.id);
      return undefined;
    }

    const slug = slugify(name);
    const exists = await prisma.businessCategory.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (exists) throw new DomainError('Bu isimde bir kategori zaten var.', 'DUPLICATE');
    const created = await prisma.businessCategory.create({
      data: {
        slug,
        name,
        sector: input.sector,
        blurb: input.blurb.trim().slice(0, 160),
        active: input.active,
        sortOrder: 99,
      },
    });
    await audit(admin.id, 'category.create', 'BusinessCategory', created.id);
    return undefined;
  });
  if (result.ok) {
    revalidatePath('/yonetim/kategoriler');
    revalidatePath('/');
  }
  return result;
}

/**
 * Kapora paketini bir işletme için açar/kapatır.
 * Paket kapatılırsa işletmenin kendi tercihi de düşer; aksi hâlde paket geri
 * açıldığında kapora habersizce yeniden istenmeye başlardı.
 */
export async function toggleDepositAddonAction(
  businessId: string,
  active: boolean,
): Promise<ActionResult<undefined>> {
  const result = await run(async () => {
    const admin = await requireRoleAction(['ADMIN']);
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { ownerId: true, name: true },
    });
    if (!business) throw new DomainError('İşletme bulunamadı.', 'NOT_FOUND');

    await prisma.business.update({
      where: { id: businessId },
      data: { depositAddon: active, ...(active ? {} : { depositEnabled: false }) },
    });
    await notifyUser({
      userId: business.ownerId,
      kind: 'SYSTEM',
      title: active ? 'Kapora paketi etkinleştirildi' : 'Kapora paketi kapatıldı',
      body: active
        ? 'Ayarlar sayfasından kapora oranını belirleyip özelliği açabilirsiniz.'
        : 'Kapora artık istenmeyecek. Alınmış kaporalar etkilenmez.',
      href: '/panel',
    });
    await audit(admin.id, 'business.depositAddon', 'Business', businessId, { active });
    return undefined;
  });
  if (result.ok) revalidatePath('/yonetim/isletmeler');
  return result;
}
