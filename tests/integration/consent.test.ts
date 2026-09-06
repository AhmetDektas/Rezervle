import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '@/lib/db';
import { resetDatabase, createFixture } from './fixture';
import { createReservation } from '@/server/reservations';
import { revokeConsent, grantConsent, hasActiveConsent } from '@/server/consent';
import { submitBusinessApplication } from '@/server/business-application';
import { today, addDays } from '@/lib/time';

// Aydınlatma metni iki söz veriyor: rıza kaydediliyor ve geri alınabiliyor.
// Geri alma yalnızca satırı kapatsaydı, hiçbir şeyi değiştirmeyen bir düğme
// olurdu; bu testler sözün sunucuda tutulduğunu doğruluyor.

let fx: Awaited<ReturnType<typeof createFixture>>;

beforeEach(async () => {
  await resetDatabase();
  fx = await createFixture();
});

afterAll(async () => {
  await prisma.$disconnect();
});

function randevu(customerId: string, channel: 'ONLINE' | 'PHONE' = 'ONLINE', startMin = 600) {
  return createReservation({
    businessId: fx.business.id,
    branchId: fx.branch.id,
    serviceIds: [fx.service.id],
    staffId: fx.staffA.id,
    customerId,
    date: addDays(today(), 1),
    startMin,
    channel,
  });
}

describe('açık rıza', () => {
  it('kayıt akışı hem aydınlatma hem açık rıza kaydı yazar', async () => {
    await prisma.businessCategory.create({
      data: { slug: 'kuafor-basvuru', name: 'Kuaförler', sector: 'BEAUTY', active: true },
    });
    const r = await submitBusinessApplication({
      ownerName: 'Rıza Test',
      email: 'riza@ornek.com',
      phone: '5321119977',
      password: 'Rezzerv123',
      businessName: 'Rıza Kuaför',
      categorySlug: 'kuafor-basvuru',
      district: 'Çankaya',
      address: 'Test Mah. Test Sok. No:1',
    });

    const kayitlar = await prisma.consent.findMany({ where: { userId: r.userId } });
    expect(kayitlar.map((k) => k.kind).sort()).toEqual(['ACIK_RIZA', 'AYDINLATMA']);
    // Sürüm damgası olmadan "hangi metne onay verildi" sorusu cevapsız kalır.
    expect(kayitlar.every((k) => k.version.length > 0)).toBe(true);
    expect(kayitlar.every((k) => k.revokedAt === null)).toBe(true);
  });

  it('rıza varken hassas sektörde randevu oluşur', async () => {
    const res = await randevu(fx.customer.id);
    expect(res.id).toBeTruthy();
  });

  it('rıza geri alınınca hassas sektörde randevu REDDEDİLİR', async () => {
    await revokeConsent(fx.customer.id);

    await expect(randevu(fx.customer.id)).rejects.toThrow(/açık rıza/i);
    // Reddedilen randevu hiç yazılmamalı; yarım kayıt kalmamalı.
    expect(await prisma.reservation.count({ where: { customerId: fx.customer.id } })).toBe(0);
  });

  it('panelden açılan telefon randevusu rıza aranmadan oluşur', async () => {
    await revokeConsent(fx.customer.id);

    // Müşteri klavyenin başında değil; rızayı telefonda alan taraf işletme.
    // Burada da engellemek, rıza veremeyecek durumdaki insanın randevusunu
    // kesmekten başka işe yaramazdı.
    const res = await randevu(fx.customer.id, 'PHONE');
    expect(res.id).toBeTruthy();
  });

  it('rıza gerektirmeyen sektör etkilenmez', async () => {
    await revokeConsent(fx.customer.id);
    // Halı saha randevusu sağlığa dair çıkarım taşımaz; rıza şart değil.
    await prisma.businessCategory.update({
      where: { id: fx.category.id },
      data: { sector: 'PITCH' },
    });

    const res = await randevu(fx.customer.id);
    expect(res.id).toBeTruthy();
  });

  it('geri alma kaydı silmez, kapatır', async () => {
    await revokeConsent(fx.customer.id);

    const kapali = await prisma.consent.findFirst({
      where: { userId: fx.customer.id, kind: 'ACIK_RIZA' },
    });
    // "Ne zaman verildi, ne zaman geri alındı" ikisi de kanıt.
    expect(kapali?.grantedAt).toBeInstanceOf(Date);
    expect(kapali?.revokedAt).toBeInstanceOf(Date);
  });

  it('yeniden rıza verilebilir ve randevu yeniden açılır', async () => {
    await revokeConsent(fx.customer.id);
    expect(await hasActiveConsent(fx.customer.id, 'ACIK_RIZA')).toBe(false);

    await grantConsent(fx.customer.id);
    expect(await hasActiveConsent(fx.customer.id, 'ACIK_RIZA')).toBe(true);

    const res = await randevu(fx.customer.id);
    expect(res.id).toBeTruthy();
  });

  it('yeniden verme eski satırın üzerine yazmaz', async () => {
    await revokeConsent(fx.customer.id);
    await grantConsent(fx.customer.id);

    const hepsi = await prisma.consent.findMany({
      where: { userId: fx.customer.id, kind: 'ACIK_RIZA' },
    });
    expect(hepsi).toHaveLength(2);
    expect(hepsi.filter((k) => k.revokedAt !== null)).toHaveLength(1);
    expect(hepsi.filter((k) => k.revokedAt === null)).toHaveLength(1);
  });

  it('rıza zaten varken tekrar verilmesi kopya satır açmaz', async () => {
    await grantConsent(fx.customer.id);
    const hepsi = await prisma.consent.findMany({
      where: { userId: fx.customer.id, kind: 'ACIK_RIZA' },
    });
    expect(hepsi).toHaveLength(1);
  });
});
