import { prisma } from '@/lib/db';
import { today, addDays, weekdayOf } from '@/lib/time';
import { CONSENT_KINDS, CONSENT_VERSION } from '@/lib/constants';

/** Testlerde kullanılan minimum ama gerçekçi işletme kurulumu. */
export type Fixture = Awaited<ReturnType<typeof createFixture>>;

export async function resetDatabase(): Promise<void> {
  await prisma.$transaction([
    prisma.reservationStatusHistory.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.review.deleteMany(),
    prisma.reservation.deleteMany(),
    prisma.customerTagLink.deleteMany(),
    prisma.customerTag.deleteMany(),
    prisma.customerNote.deleteMany(),
    prisma.favorite.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.promotion.deleteMany(),
    prisma.staffService.deleteMany(),
    prisma.staffBreak.deleteMany(),
    prisma.staffHour.deleteMany(),
    prisma.timeOff.deleteMany(),
    prisma.staffMember.deleteMany(),
    prisma.service.deleteMany(),
    prisma.branchHour.deleteMany(),
    prisma.branch.deleteMany(),
    prisma.businessStatusHistory.deleteMany(),
    prisma.businessImage.deleteMany(),
    prisma.business.deleteMany(),
    prisma.businessCategory.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.customerProfile.deleteMany(),
    prisma.consent.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}

/** Her gün 08:00–20:00 açık; böylece testler haftanın gününe bağlı kalmaz. */
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

export async function createFixture(options: { status?: string } = {}) {
  const owner = await prisma.user.create({
    data: { email: `owner-${Date.now()}@test.local`, passwordHash: 'x', name: 'Test Sahibi', role: 'OWNER' },
  });
  const customer = await prisma.user.create({
    data: { email: `musteri-${Date.now()}@test.local`, passwordHash: 'x', name: 'Test Müşteri', role: 'CUSTOMER', phone: '5321112233' },
  });
  const other = await prisma.user.create({
    data: { email: `diger-${Date.now()}@test.local`, passwordHash: 'x', name: 'Diğer Müşteri', role: 'CUSTOMER' },
  });

  // Fixture işletmesi DENTAL: rıza olmadan randevu oluşmaz. Gerçek kayıt akışı
  // rızayı createAccount içinde yazıyor, elle kurulan kullanıcılar o yoldan
  // geçmediği için burada tamamlanıyor.
  await prisma.consent.createMany({
    data: [owner, customer, other].flatMap((u) =>
      CONSENT_KINDS.map((kind) => ({ userId: u.id, kind, version: CONSENT_VERSION })),
    ),
  });

  const category = await prisma.businessCategory.create({
    data: { slug: `kategori-${Date.now()}`, name: 'Test Kategori', sector: 'DENTAL' },
  });

  const business = await prisma.business.create({
    data: {
      slug: `isletme-${Date.now()}`,
      name: 'Test Kliniği',
      categoryId: category.id,
      ownerId: owner.id,
      status: options.status ?? 'APPROVED',
    },
  });

  const branch = await prisma.branch.create({
    data: {
      businessId: business.id,
      name: 'Merkez',
      district: 'Çankaya',
      address: 'Test Cad. 1',
      isPrimary: true,
      hours: { create: ALL_DAYS.map((weekday) => ({ weekday, openMin: 480, closeMin: 1200, closed: false })) },
    },
  });

  const service = await prisma.service.create({
    data: {
      businessId: business.id,
      name: 'Muayene',
      durationMin: 60,
      bufferMin: 15,
      price: 1000,
    },
  });

  const shortService = await prisma.service.create({
    data: { businessId: business.id, name: 'Kısa kontrol', durationMin: 30, bufferMin: 0, price: 500 },
  });

  const staffA = await prisma.staffMember.create({
    data: {
      businessId: business.id,
      branchId: branch.id,
      displayName: 'Hekim A',
      hours: { create: ALL_DAYS.map((weekday) => ({ weekday, startMin: 480, endMin: 1200, closed: false })) },
      services: { create: [{ serviceId: service.id }, { serviceId: shortService.id }] },
    },
  });

  const staffB = await prisma.staffMember.create({
    data: {
      businessId: business.id,
      branchId: branch.id,
      displayName: 'Hekim B',
      hours: { create: ALL_DAYS.map((weekday) => ({ weekday, startMin: 480, endMin: 1200, closed: false })) },
      services: { create: [{ serviceId: service.id }] },
    },
  });

  return {
    owner, customer, other, category, business, branch, service, shortService, staffA, staffB,
    /** Yarın: "geçmiş tarih" ve hazırlık süresi kurallarına takılmaz. */
    date: addDays(today(), 1),
    weekday: weekdayOf(addDays(today(), 1)),
  };
}
