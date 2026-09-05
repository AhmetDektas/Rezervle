import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '@/lib/db';
import { resetDatabase } from './fixture';
import { submitBusinessApplication } from '@/server/business-application';

// Rezzerv iki taraflı bir pazaryeri olarak tasarlandı ama uzun süre yalnızca
// talep tarafı sisteme girebiliyordu: kayıt her zaman CUSTOMER rolü yaratıyor,
// Business kaydı yalnızca tohumdan doğuyordu. Bu testler arz kapısının
// gerçekten açıldığını ve yarım kayıt bırakmadığını doğruluyor.

const basvuru = {
  ownerName: 'Ali Veli',
  email: 'ali@berberali.com',
  phone: '5321112233',
  password: 'Rezzerv123',
  businessName: 'Berber Ali',
  categorySlug: 'guzellik-salonlari',
  district: 'Keçiören',
  address: 'Kalaba Mah. Şehit Sok. No:5',
};

async function kategoriKur(slug = 'guzellik-salonlari', active = true) {
  return prisma.businessCategory.create({
    data: { slug, name: 'Güzellik salonları', sector: 'BEAUTY', active },
  });
}

beforeEach(async () => {
  await resetDatabase();
  await kategoriKur();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('işletme başvurusu', () => {
  it('sahibi, işletmeyi, şubeyi ve denetim izini tek işlemde yazar', async () => {
    const r = await submitBusinessApplication(basvuru);

    const owner = await prisma.user.findUniqueOrThrow({ where: { id: r.userId } });
    expect(owner.role).toBe('OWNER');
    // İşletme sahibinin müşteri profili olmaz; randevu alırsa o zaman oluşur.
    const profile = await prisma.customerProfile.findFirst({ where: { userId: owner.id } });
    expect(profile).toBeNull();

    const biz = await prisma.business.findUniqueOrThrow({
      where: { id: r.businessId },
      include: { branches: true, statusHistory: true },
    });
    // Onaya kadar müşteri tarafında görünmez ve rezervasyon alamaz.
    expect(biz.status).toBe('PENDING');
    expect(biz.ownerId).toBe(owner.id);

    expect(biz.branches).toHaveLength(1);
    expect(biz.branches[0]?.isPrimary).toBe(true);
    expect(biz.branches[0]?.district).toBe('Keçiören');

    expect(biz.statusHistory).toHaveLength(1);
    expect(biz.statusHistory[0]?.toStatus).toBe('PENDING');
  });

  it('slug adı ve semti birleştirir', async () => {
    const r = await submitBusinessApplication(basvuru);
    expect(r.slug).toBe('berber-ali-kecioren');
  });

  it('aynı isim aynı semtte ikinci kez gelirse sayı ekler', async () => {
    const ilk = await submitBusinessApplication(basvuru);
    const ikinci = await submitBusinessApplication({
      ...basvuru,
      email: 'ikinci@berberali.com',
    });

    expect(ilk.slug).toBe('berber-ali-kecioren');
    expect(ikinci.slug).toBe('berber-ali-kecioren-2');
  });

  it('aynı isim farklı semtte çakışmaz', async () => {
    const kecioren = await submitBusinessApplication(basvuru);
    const cankaya = await submitBusinessApplication({
      ...basvuru,
      email: 'cankaya@berberali.com',
      district: 'Çankaya',
    });

    expect(kecioren.slug).toBe('berber-ali-kecioren');
    expect(cankaya.slug).toBe('berber-ali-cankaya');
  });

  it('kayıtlı e-posta reddedilir ve YARIM KAYIT bırakmaz', async () => {
    await submitBusinessApplication(basvuru);
    const oncekiIsletmeSayisi = await prisma.business.count();

    await expect(submitBusinessApplication(basvuru)).rejects.toThrow(/e-posta/i);

    // İşlem geri alınmalı: sahipsiz işletme ya da işletmesiz OWNER kalmamalı.
    expect(await prisma.business.count()).toBe(oncekiIsletmeSayisi);
    expect(await prisma.user.count({ where: { email: basvuru.email } })).toBe(1);
  });

  it('pasif kategori reddedilir ve hiçbir kayıt oluşmaz', async () => {
    await kategoriKur('spor-salonlari', false);

    await expect(
      submitBusinessApplication({ ...basvuru, categorySlug: 'spor-salonlari' }),
    ).rejects.toThrow(/kategori/i);

    expect(await prisma.business.count()).toBe(0);
    expect(await prisma.user.count()).toBe(0);
  });

  it('olmayan kategori reddedilir', async () => {
    await expect(
      submitBusinessApplication({ ...basvuru, categorySlug: 'yok-boyle-kategori' }),
    ).rejects.toThrow(/kategori/i);
  });
});
