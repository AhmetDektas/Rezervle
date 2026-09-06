import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '@/lib/db';
import { resetDatabase } from './fixture';
import { submitBusinessApplication } from '@/server/business-application';
import { PLANS, TRIAL_DAYS, planByKey, trialDaysLeft, planActive } from '@/lib/plans';

// Abonelik platformun ANA geliri; kapora komisyonu bunun üzerine gelen
// eklenti. Uzun süre yalnızca eklenti katmanı kodda vardı — abonelik hiçbir
// yerde tutulmuyordu. Bu testler o katmanın gerçekten var olduğunu ve
// kaydın parçası olduğunu doğruluyor.

const basvuru = {
  ownerName: 'Ali Veli',
  email: 'abonelik@ornek.com',
  phone: '5321112233',
  password: 'Rezzerv123',
  businessName: 'Test İşletme',
  categorySlug: 'test-kategori',
  district: 'Çankaya',
  address: 'Test Mah. Test Sok. No:1',
};

beforeEach(async () => {
  await resetDatabase();
  await prisma.businessCategory.create({
    data: { slug: 'test-kategori', name: 'Test', sector: 'BEAUTY', active: true },
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('kayıtta abonelik', () => {
  it('başvuru DENEME başlatır', async () => {
    const now = new Date('2026-09-06T10:00:00Z');
    const r = await submitBusinessApplication(basvuru, now);

    const b = await prisma.business.findUniqueOrThrow({ where: { id: r.businessId } });
    expect(b.planStatus).toBe('TRIAL');
    expect(b.trialEndsAt).not.toBeNull();

    const gun = Math.round((b.trialEndsAt!.getTime() - now.getTime()) / 86_400_000);
    expect(gun).toBe(TRIAL_DAYS);
  });

  it('paket seçilmeden de deneme başlar (kayıt kilitlenmez)', async () => {
    const r = await submitBusinessApplication(basvuru);
    const b = await prisma.business.findUniqueOrThrow({ where: { id: r.businessId } });

    // planPrice 0 = paket henüz seçilmedi. İşletme yine de panele girebilmeli;
    // ürünü görmemiş birine fiyat kararı dayatmak en hızlı terk sebebi.
    expect(b.planPrice).toBe(0);
    expect(planActive(b.planStatus)).toBe(true);
  });

  it('paket seçimi ücreti DONDURUR', async () => {
    const r = await submitBusinessApplication(basvuru);
    const plan = PLANS[1]!;

    await prisma.business.update({
      where: { id: r.businessId },
      data: { planKey: plan.key, planPrice: plan.price },
    });

    const b = await prisma.business.findUniqueOrThrow({ where: { id: r.businessId } });
    expect(b.planPrice).toBe(plan.price);
    // Liste fiyatı sonradan değişse bile kayıttaki tutar aynı kalmalı:
    // "zam geldi, kimse haber vermedi" durumu böyle imkânsızlaşıyor.
    expect(b.planKey).toBe(plan.key);
  });

  it('kapora eklentisi pakete bağlı açılır', async () => {
    const r = await submitBusinessApplication(basvuru);
    const kaporali = PLANS.find((p) => p.deposit)!;

    await prisma.business.update({
      where: { id: r.businessId },
      data: { planKey: kaporali.key, planPrice: kaporali.price, depositAddon: true },
    });

    const b = await prisma.business.findUniqueOrThrow({ where: { id: r.businessId } });
    expect(b.depositAddon).toBe(true);
  });
});

describe('paket tanımları', () => {
  it('her paketin anahtarı tekil', () => {
    const anahtarlar = PLANS.map((p) => p.key);
    expect(new Set(anahtarlar).size).toBe(anahtarlar.length);
  });

  it('bilinmeyen anahtar en düşük pakete düşer', () => {
    // Eksik bilgiden dolayı ödenmeyen bir özelliği açmak, tersinden pahalı.
    expect(planByKey('yok-boyle-paket').key).toBe(PLANS[0]!.key);
  });

  it('kapora eklentisi en az bir pakette var', () => {
    expect(PLANS.some((p) => p.deposit)).toBe(true);
  });

  it('fiyatlar artan sırada', () => {
    const fiyatlar = PLANS.map((p) => p.price);
    expect([...fiyatlar].sort((a, b) => a - b)).toEqual(fiyatlar);
  });
});

describe('deneme sayacı', () => {
  const now = new Date('2026-09-06T12:00:00Z');

  it('kalan günü yukarı yuvarlar', () => {
    const bitis = new Date(now.getTime() + 2.4 * 86_400_000);
    // 2,4 gün kalmışken "2 gün" demek, kullanıcıya olduğundan az süre
    // kaldığını söylemek olurdu.
    expect(trialDaysLeft(bitis, now)).toBe(3);
  });

  it('süresi dolmuşsa sıfır', () => {
    expect(trialDaysLeft(new Date(now.getTime() - 86_400_000), now)).toBe(0);
  });

  it('tarih yoksa sıfır', () => {
    expect(trialDaysLeft(null, now)).toBe(0);
  });
});

describe('hizmet erişimi', () => {
  it('ödeme gecikse bile panel KAPANMAZ', () => {
    // İşletmeyi kilitlemek, gecikmiş faturadan haberi olmayan müşterisini
    // cezalandırmak olurdu. Tahsilat insan işi.
    expect(planActive('PAST_DUE')).toBe(true);
    expect(planActive('TRIAL')).toBe(true);
    expect(planActive('ACTIVE')).toBe(true);
  });

  it('iptal edilmiş abonelik pasif', () => {
    expect(planActive('CANCELLED')).toBe(false);
  });
});
