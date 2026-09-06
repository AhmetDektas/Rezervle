import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '@/lib/db';
import { resetDatabase, createFixture } from './fixture';
import { menuItemSchema, branchSchema } from '@/lib/validation';

// Menü işletmenin kendi yazdığı içerik: yetki sınırı burada da geçerli.
// "Önemsiz veri" diye istisna açmak, sınırı tek yerde delmek demek.

let fx: Awaited<ReturnType<typeof createFixture>>;

beforeEach(async () => {
  await resetDatabase();
  fx = await createFixture();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('menü kalemi doğrulaması', () => {
  const gecerli = {
    businessId: 'x',
    category: 'Ana yemekler',
    name: 'Adana kebap',
    price: 420,
    sortOrder: 0,
  };

  it('geçerli kalem kabul edilir', () => {
    expect(menuItemSchema.safeParse(gecerli).success).toBe(true);
  });

  it('negatif fiyat reddedilir', () => {
    const r = menuItemSchema.safeParse({ ...gecerli, price: -5 });
    expect(r.success).toBe(false);
  });

  it('bölüm adı boş olamaz', () => {
    const r = menuItemSchema.safeParse({ ...gecerli, category: '' });
    expect(r.success).toBe(false);
  });

  it('fiyat metin olarak gelse de sayıya çevrilir', () => {
    // Form alanları her zaman metin gönderir.
    const r = menuItemSchema.safeParse({ ...gecerli, price: '420' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.price).toBe(420);
  });
});

describe('menü verisi', () => {
  it('bölümlere göre gruplanabilir sırada okunur', async () => {
    await prisma.menuItem.createMany({
      data: [
        { businessId: fx.business.id, category: 'Tatlılar', name: 'Künefe', price: 180, sortOrder: 2 },
        { businessId: fx.business.id, category: 'Başlangıçlar', name: 'Çorba', price: 95, sortOrder: 0 },
        { businessId: fx.business.id, category: 'Ana yemekler', name: 'Kebap', price: 420, sortOrder: 1 },
      ],
    });

    const kalemler = await prisma.menuItem.findMany({
      where: { businessId: fx.business.id, active: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    // Sıra işletmenin verdiği sıra: mutfağın mantığı alfabeden doğru.
    expect(kalemler.map((k) => k.name)).toEqual(['Çorba', 'Kebap', 'Künefe']);
  });

  it('yayından kaldırılan kalem müşteri sorgusuna girmez', async () => {
    await prisma.menuItem.create({
      data: { businessId: fx.business.id, category: 'Tatlılar', name: 'Gizli', price: 10, active: false },
    });

    const gorunen = await prisma.menuItem.count({
      where: { businessId: fx.business.id, active: true },
    });
    expect(gorunen).toBe(0);
  });

  it('işletme silinince menüsü de silinir', async () => {
    await prisma.menuItem.create({
      data: { businessId: fx.business.id, category: 'X', name: 'Y', price: 1 },
    });
    await prisma.business.delete({ where: { id: fx.business.id } });

    // Sahipsiz menü kalemi hiçbir ekranda görünmez ama tabloda birikir.
    expect(await prisma.menuItem.count()).toBe(0);
  });
});

describe('şube koordinatı', () => {
  const temel = {
    name: 'Merkez',
    city: 'Ankara',
    district: 'Çankaya',
    address: 'Cinnah Cad. No:42',
    phone: '',
    active: true,
  };

  it('koordinat boş bırakılabilir', () => {
    // Zorunlu olsaydı her şube kaydı harita bilgisi aramaya zorlardı.
    const r = branchSchema.safeParse({ ...temel, lat: '', lng: '' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.lat).toBeUndefined();
  });

  it('geçerli koordinat sayıya çevrilir', () => {
    const r = branchSchema.safeParse({ ...temel, lat: '39.9036', lng: '32.8622' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.lat).toBeCloseTo(39.9036, 4);
  });

  it('aralık dışı koordinat reddedilir', () => {
    // Enlem/boylamı ters yazmak yaygın hata; harita bambaşka bir yeri gösterirdi.
    expect(branchSchema.safeParse({ ...temel, lat: '200', lng: '32' }).success).toBe(false);
  });
});
