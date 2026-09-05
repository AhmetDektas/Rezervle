import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '@/lib/db';
import { resetDatabase, createFixture } from './fixture';
import { activePlatformPromotion, welcomeBody } from '@/server/promotions';

const DAY = 24 * 60 * 60 * 1000;

async function makePromo(over: Partial<Parameters<typeof prisma.promotion.create>[0]['data']> = {}) {
  const now = Date.now();
  return prisma.promotion.create({
    data: {
      code: 'PLATFORM100',
      title: 'Karşılama',
      kind: 'AMOUNT',
      value: 100,
      minAmount: 750,
      startsAt: new Date(now - DAY),
      endsAt: new Date(now + DAY),
      maxUses: 0,
      active: true,
      ...over,
    },
  });
}

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('karşılama bildirimi kampanya tablosundan üretilir', () => {
  it('aktif platform kampanyasını bulur ve koşulu da yazar', async () => {
    await makePromo();
    const promo = await activePlatformPromotion();

    expect(promo).toMatchObject({ code: 'PLATFORM100', value: 100, minAmount: 750 });
    // Sabit metin alt limiti hiç söylemiyordu; artık söz eksiksiz.
    expect(welcomeBody(promo)).toBe(
      'İlk randevunuzda PLATFORM100 kodu ile ₺100 indirim kazanın. ₺750 ve üzeri randevularda geçerli.',
    );
  });

  it('kampanya kapatılınca bildirim ondan hiç bahsetmez', async () => {
    await makePromo({ active: false });
    const promo = await activePlatformPromotion();

    expect(promo).toBeNull();
    expect(welcomeBody(promo)).not.toContain('kod');
  });

  it('süresi dolmuş kampanya seçilmez', async () => {
    const now = Date.now();
    await makePromo({ startsAt: new Date(now - 10 * DAY), endsAt: new Date(now - DAY) });

    expect(await activePlatformPromotion()).toBeNull();
  });

  it('kullanım limiti dolmuş kampanya seçilmez', async () => {
    await makePromo({ maxUses: 5, usedCount: 5 });

    expect(await activePlatformPromotion()).toBeNull();
  });

  it('işletmeye bağlı kampanya platform geneli sayılmaz', async () => {
    // Şema bilgisini burada tekrarlamamak için mevcut fixture kullanılıyor.
    const f = await createFixture();
    await makePromo({ businessId: f.business.id, code: 'SADECEBU' });

    expect(await activePlatformPromotion()).toBeNull();
  });

  it('yüzde tipli kampanyada tutar değil oran yazılır', async () => {
    await makePromo({ kind: 'PERCENT', value: 15, minAmount: 0, code: 'YUZDE15' });
    const promo = await activePlatformPromotion();

    expect(welcomeBody(promo)).toBe('İlk randevunuzda YUZDE15 kodu ile %15 indirim kazanın.');
  });
});
