import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '@/lib/db';
import { createFixture, resetDatabase, type Fixture } from './fixture';
import {
  assertBranchBelongs,
  updateServiceScoped,
  updateStaffScoped,
  updateBranchScoped,
  updatePromotionScoped,
} from '@/server/panel-write';

/**
 * İşletmeler arası yazma sınırı.
 *
 * Panel eylemleri yetkiyi `businessId` için doğrulayıp kaydı yalnızca `id` ile
 * güncelliyordu. A işletmesinin sahibi, kendi işletme kimliğini ve B'nin
 * hizmet/personel/şube/kampanya kimliğini göndererek B'nin kaydını
 * değiştirebiliyordu.
 *
 * Testler iki şeyi birden doğruluyor: yabancı kayda yazma REDDEDİLİYOR ve o
 * kayıt gerçekten DEĞİŞMEDEN kalıyor. Yalnızca hata fırlatıldığını sınamak
 * yetmez — yazma hatadan önce gerçekleşmiş olabilirdi.
 */

let a: Fixture;
let b: Fixture;

beforeEach(async () => {
  await resetDatabase();
  a = await createFixture();
  b = await createFixture();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('hizmet', () => {
  it('yabancı hizmet güncellenemez ve değişmez', async () => {
    const once = await prisma.service.findUniqueOrThrow({ where: { id: b.service.id } });

    await expect(
      updateServiceScoped(a.business.id, b.service.id, { name: 'ELE GEÇİRİLDİ', price: 1 }),
    ).rejects.toThrow(/bulunamadı/i);

    const sonra = await prisma.service.findUniqueOrThrow({ where: { id: b.service.id } });
    expect(sonra.name).toBe(once.name);
    expect(sonra.price).toBe(once.price);
  });

  it('kendi hizmeti güncellenebilir', async () => {
    await updateServiceScoped(a.business.id, a.service.id, { name: 'Yeni ad' });
    const sonra = await prisma.service.findUniqueOrThrow({ where: { id: a.service.id } });
    expect(sonra.name).toBe('Yeni ad');
  });
});

describe('personel', () => {
  it('yabancı personel güncellenemez ve değişmez', async () => {
    const once = await prisma.staffMember.findUniqueOrThrow({ where: { id: b.staffA.id } });

    await expect(
      updateStaffScoped(a.business.id, b.staffA.id, { displayName: 'ELE GEÇİRİLDİ' }),
    ).rejects.toThrow(/bulunamadı/i);

    const sonra = await prisma.staffMember.findUniqueOrThrow({ where: { id: b.staffA.id } });
    expect(sonra.displayName).toBe(once.displayName);
  });

  it('personel başka işletmenin şubesine bağlanamaz', async () => {
    // Kimliği sınırlamak tek başına yetmez: kendi personelini yabancı bir
    // şubeye bağlamak da işletme sınırını deler.
    await expect(assertBranchBelongs(a.business.id, b.branch.id)).rejects.toThrow(
      /bu işletmeye ait değil/i,
    );
  });

  it('kendi şubesi kabul edilir', async () => {
    await expect(assertBranchBelongs(a.business.id, a.branch.id)).resolves.toBeUndefined();
  });
});

describe('şube', () => {
  it('yabancı şube güncellenemez ve değişmez', async () => {
    const once = await prisma.branch.findUniqueOrThrow({ where: { id: b.branch.id } });

    await expect(
      updateBranchScoped(a.business.id, b.branch.id, { name: 'ELE GEÇİRİLDİ' }),
    ).rejects.toThrow(/bulunamadı/i);

    const sonra = await prisma.branch.findUniqueOrThrow({ where: { id: b.branch.id } });
    expect(sonra.name).toBe(once.name);
  });
});

describe('kampanya', () => {
  it('yabancı kampanya güncellenemez ve değişmez', async () => {
    const promo = await prisma.promotion.create({
      data: {
        businessId: b.business.id,
        code: `KOD${Date.now()}`,
        title: 'Test kampanyası',
        kind: 'PERCENT',
        value: 10,
        startsAt: new Date(Date.now() - 86_400_000),
        endsAt: new Date(Date.now() + 86_400_000),
      },
    });

    await expect(
      updatePromotionScoped(a.business.id, promo.id, { value: 90 }),
    ).rejects.toThrow(/bulunamadı/i);

    const sonra = await prisma.promotion.findUniqueOrThrow({ where: { id: promo.id } });
    expect(sonra.value).toBe(10);
  });
});
