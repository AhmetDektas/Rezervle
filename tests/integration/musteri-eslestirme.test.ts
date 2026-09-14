import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { prisma } from '@/lib/db';
import { resetDatabase, createFixture, type Fixture } from './fixture';

/**
 * Panelde müşteri eşleştirmesi.
 *
 * Açık şuydu: panelde girilen telefon BÜTÜN kullanıcılar arasında aranıyor,
 * telefon tutmazsa girilen e-posta mevcut bir hesaba bağlanıyordu. Bir
 * işletme, bildiği bir e-posta için randevu oluşturarak o hesabı kendi
 * müşteri listesine ekleyebiliyor ve listede hesabın gerçek adını, telefonunu,
 * e-postasını görebiliyordu.
 *
 * Testler eylemin kendisini çağırıyor; oturum ve yetki taklit ediliyor çünkü
 * sınanan şey yetkilendirme değil, YETKİLİ bir işletmenin yapabilecekleri.
 */

let f: Fixture;
let yabanci: { id: string; email: string; phone: string | null };

const oturum = { deger: '' };

vi.mock('@/server/auth', async (asil) => {
  const gercek = await asil<typeof import('@/server/auth')>();
  return {
    ...gercek,
    requireUserAction: async () => ({ id: oturum.deger, role: 'OWNER' }),
    assertBusinessAccess: async () => undefined,
  };
});

const { panelCreateReservationAction } = await import('@/app/actions/panel');

beforeEach(async () => {
  await resetDatabase();
  f = await createFixture();
  oturum.deger = f.owner.id;

  // İşletmeyle HİÇ ilişkisi olmayan bir platform hesabı.
  const u = await prisma.user.create({
    data: {
      email: 'yabanci@ornek.com',
      passwordHash: 'x',
      name: 'Yabancı Kişi',
      phone: '5559998877',
      role: 'CUSTOMER',
      customerProfile: { create: {} },
    },
    select: { id: true, email: true, phone: true },
  });
  yabanci = u;
});

afterAll(async () => {
  await prisma.$disconnect();
});

function girdi(over: Record<string, unknown> = {}) {
  return {
    businessId: f.business.id,
    branchId: f.branch.id,
    serviceIds: [f.service.id],
    staffId: f.staffA.id,
    date: '2026-10-05',
    startMin: 600,
    channel: 'PHONE',
    customerName: 'Tezgah Musterisi',
    customerPhone: '5321110000',
    ...over,
  };
}

describe('yabancı hesaba bağlanamaz', () => {
  it('bilinen e-posta ile mevcut hesap müşteri listesine eklenemez', async () => {
    const sonuc = await panelCreateReservationAction(f.business.slug, girdi({ customerEmail: yabanci.email }));
    expect(sonuc.ok).toBe(true);

    const rez = await prisma.reservation.findFirst({
      where: { businessId: f.business.id },
      select: { customerId: true },
    });
    // Randevu YABANCI hesaba yazılmamalı; işletmeye özel misafir kaydına
    // yazılmalı.
    expect(rez?.customerId).not.toBe(yabanci.id);

    const misafir = await prisma.user.findUniqueOrThrow({
      where: { id: rez!.customerId },
      select: { email: true },
    });
    expect(misafir.email).toContain('misafir.rezzerv.local');
  });

  it('bilinen telefon ile ilişkisiz hesap eşleşmez', async () => {
    const sonuc = await panelCreateReservationAction(f.business.slug, girdi({ customerPhone: yabanci.phone ?? '5559998877' }));
    expect(sonuc.ok).toBe(true);

    const rez = await prisma.reservation.findFirst({
      where: { businessId: f.business.id },
      select: { customerId: true },
    });
    expect(rez?.customerId).not.toBe(yabanci.id);
  });
});

describe('meşru akışlar korunuyor', () => {
  it('işletmenin mevcut müşterisi telefonla eşleşir', async () => {
    // fixture müşterisinin bu işletmede randevusu olsun.
    await prisma.reservation.create({
      data: {
        code: 'ESKI1',
        businessId: f.business.id,
        branchId: f.branch.id,
        serviceId: f.service.id,
        staffId: f.staffA.id,
        customerId: f.customer.id,
        date: '2026-09-01',
        startMin: 540,
        endMin: 570,
        blockEnd: 580,
        startsAt: new Date(),
        endsAt: new Date(),
        status: 'COMPLETED',
        channel: 'ONLINE',
        price: 100,
        finalPrice: 100,
      },
    });

    const sonuc = await panelCreateReservationAction(f.business.slug, girdi({ customerPhone: f.customer.phone ?? '5321112233', startMin: 660 }),
    );
    expect(sonuc.ok).toBe(true);

    const rez = await prisma.reservation.findFirst({
      where: { businessId: f.business.id, startMin: 660 },
      select: { customerId: true },
    });
    expect(rez?.customerId).toBe(f.customer.id);
  });

  it('aynı misafir ikinci kez geldiğinde yeni hesap açılmaz', async () => {
    await panelCreateReservationAction(f.business.slug, girdi());
    await panelCreateReservationAction(f.business.slug, girdi({ startMin: 720 }));

    const misafirler = await prisma.user.count({
      where: { email: { contains: 'misafir.rezzerv.local' } },
    });
    expect(misafirler).toBe(1);
  });

  it('sahipsiz e-posta misafir hesabına yazılır', async () => {
    // Kimsenin olmayan e-posta kullanılabilir: misafir müşteriye bildirim
    // gitmesini sağlıyor ve kimsenin verisini açmıyor.
    await panelCreateReservationAction(f.business.slug, girdi({ customerEmail: 'yeni.musteri@ornek.com' }));

    const rez = await prisma.reservation.findFirstOrThrow({
      where: { businessId: f.business.id },
      select: { customer: { select: { email: true } } },
    });
    expect(rez.customer.email).toBe('yeni.musteri@ornek.com');
  });
});
