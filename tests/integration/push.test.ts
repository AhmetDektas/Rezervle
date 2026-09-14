import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { prisma } from '@/lib/db';
import { resetDatabase, createFixture, type Fixture } from './fixture';

/**
 * Web Push aboneliği ve gönderimi.
 *
 * Üç şeyi sınıyor:
 *   1. Aynı cihaz iki kez abone olduğunda satır ÇOĞALMIYOR — uç nokta tekil.
 *   2. Abonelik yalnızca SAHİBİ tarafından kaldırılabiliyor. İlk yazımda
 *      silme sorgusu yalnızca `endpoint` ile yapılıyordu: uç noktayı ele
 *      geçiren biri başkasının bildirimlerini kapatabilirdi.
 *   3. Push servisi 410 döndüğünde abonelik siliniyor. Silinmezse her
 *      bildirimde ölü uç noktaya istek atarız ve push servisleri ısrarcı
 *      göndericiyi kısıtlar.
 */

const gonderilenler: { endpoint: string; govde: string }[] = [];
const hatalar = new Map<string, number>();

class SahteWebPushError extends Error {
  statusCode: number;
  constructor(statusCode: number) {
    super(`push hatası ${statusCode}`);
    this.name = 'WebPushError';
    this.statusCode = statusCode;
  }
}

vi.mock('web-push', () => {
  const sendNotification = async (
    abone: { endpoint: string },
    govde: string,
  ): Promise<void> => {
    const kod = hatalar.get(abone.endpoint);
    if (kod) throw new SahteWebPushError(kod);
    gonderilenler.push({ endpoint: abone.endpoint, govde });
  };
  return {
    default: { setVapidDetails: () => undefined, sendNotification },
    WebPushError: SahteWebPushError,
  };
});

// Anahtarlar modül yüklenirken okunuyor; mock'tan sonra import şart.
process.env['VAPID_PUBLIC_KEY'] = 'test-acik';
process.env['VAPID_PRIVATE_KEY'] = 'test-gizli';
process.env['VAPID_SUBJECT'] = 'mailto:test@rezzerv.local';

const { pushAbone, pushAbonelikBitir, pushGonder, pushCihazSayisi } = await import('@/server/push');

let a: Fixture;

// İzin listesindeki gerçek bir push servisi; uydurma host artık reddediliyor.
const UC_NOKTA = 'https://fcm.googleapis.com/fcm/send/abone-aaa';

beforeEach(async () => {
  await resetDatabase();
  a = await createFixture();
  gonderilenler.length = 0;
  hatalar.clear();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('abonelik', () => {
  it('aynı cihaz iki kez abone olursa tek satır kalır', async () => {
    await pushAbone(a.owner.id, { endpoint: UC_NOKTA, p256dh: 'k1', auth: 's1' });
    await pushAbone(a.owner.id, { endpoint: UC_NOKTA, p256dh: 'k2', auth: 's2' });

    const satirlar = await prisma.pushSubscription.findMany({ where: { endpoint: UC_NOKTA } });
    expect(satirlar).toHaveLength(1);
    // Tarayıcı anahtarları döndürebiliyor; güncel olan kazanmalı.
    expect(satirlar[0]?.p256dh).toBe('k2');
  });

  it('ortak cihazda hesap değişince abonelik yeni kullanıcıya geçer', async () => {
    await pushAbone(a.owner.id, { endpoint: UC_NOKTA, p256dh: 'k1', auth: 's1' });
    await pushAbone(a.customer.id, { endpoint: UC_NOKTA, p256dh: 'k1', auth: 's1' });

    expect(await pushCihazSayisi(a.owner.id)).toBe(0);
    expect(await pushCihazSayisi(a.customer.id)).toBe(1);
  });

  it('başkasının aboneliği kaldırılamaz', async () => {
    await pushAbone(a.owner.id, { endpoint: UC_NOKTA, p256dh: 'k1', auth: 's1' });

    // Uç noktayı bilen ama sahibi olmayan kullanıcı.
    await pushAbonelikBitir(a.customer.id, UC_NOKTA);

    expect(await pushCihazSayisi(a.owner.id)).toBe(1);
  });

  it('kendi aboneliği kaldırılabilir', async () => {
    await pushAbone(a.owner.id, { endpoint: UC_NOKTA, p256dh: 'k1', auth: 's1' });
    await pushAbonelikBitir(a.owner.id, UC_NOKTA);

    expect(await pushCihazSayisi(a.owner.id)).toBe(0);
  });

  it('kullanıcı silinince abonelikleri de silinir', async () => {
    await pushAbone(a.owner.id, { endpoint: UC_NOKTA, p256dh: 'k1', auth: 's1' });
    await prisma.$transaction([
      prisma.business.deleteMany({ where: { ownerId: a.owner.id } }),
      prisma.user.delete({ where: { id: a.owner.id } }),
    ]);

    expect(await prisma.pushSubscription.count({ where: { endpoint: UC_NOKTA } })).toBe(0);
  });
});

describe('gönderim', () => {
  it('kullanıcının tüm cihazlarına gider', async () => {
    await pushAbone(a.owner.id, { endpoint: `${UC_NOKTA}-1`, p256dh: 'k', auth: 's' });
    await pushAbone(a.owner.id, { endpoint: `${UC_NOKTA}-2`, p256dh: 'k', auth: 's' });

    const sayi = await pushGonder(a.owner.id, { title: 'Yeni randevu', body: '10:00' });

    expect(sayi).toBe(2);
    expect(gonderilenler).toHaveLength(2);
    expect(JSON.parse(gonderilenler[0]?.govde ?? '{}')).toMatchObject({
      title: 'Yeni randevu',
      body: '10:00',
    });
  });

  it('aboneliği olmayan kullanıcı için sessizce 0 döner', async () => {
    expect(await pushGonder(a.customer.id, { title: 'x', body: 'y' })).toBe(0);
    expect(gonderilenler).toHaveLength(0);
  });

  it('410 dönen abonelik silinir, diğerleri etkilenmez', async () => {
    await pushAbone(a.owner.id, { endpoint: `${UC_NOKTA}-olu`, p256dh: 'k', auth: 's' });
    await pushAbone(a.owner.id, { endpoint: `${UC_NOKTA}-canli`, p256dh: 'k', auth: 's' });
    hatalar.set(`${UC_NOKTA}-olu`, 410);

    const sayi = await pushGonder(a.owner.id, { title: 'x', body: 'y' });

    expect(sayi).toBe(1);
    const kalan = await prisma.pushSubscription.findMany({ where: { userId: a.owner.id } });
    expect(kalan.map((k) => k.endpoint)).toEqual([`${UC_NOKTA}-canli`]);
  });

  it('geçici hata aboneliği SİLMEZ', async () => {
    // 500 sunucu arızası; aboneliğin kendisi hâlâ geçerli. Silmek, geçici bir
    // aksaklık yüzünden kullanıcıyı kalıcı olarak bildirimsiz bırakırdı.
    await pushAbone(a.owner.id, { endpoint: UC_NOKTA, p256dh: 'k', auth: 's' });
    hatalar.set(UC_NOKTA, 500);

    await expect(pushGonder(a.owner.id, { title: 'x', body: 'y' })).resolves.toBe(0);
    expect(await pushCihazSayisi(a.owner.id)).toBe(1);
  });
});

describe('güvenlik', () => {
  it('izin listesi dışındaki kayıtlı uç noktaya GÖNDERİM YAPILMAZ', async () => {
    // Doğrulama eklenmeden önce yazılmış ya da liste daraltıldığında geçersiz
    // kalan satırlar: sunucu yine de o adrese istek atmamalı. Bu yüzden
    // doğrudan veritabanına yazıyoruz — pushAbone bunu zaten reddederdi.
    await prisma.pushSubscription.create({
      data: {
        userId: a.owner.id,
        endpoint: 'https://127.0.0.1:8443/private',
        p256dh: 'k',
        auth: 's',
      },
    });

    const sayi = await pushGonder(a.owner.id, { title: 'x', body: 'y' });

    expect(sayi).toBe(0);
    expect(gonderilenler).toHaveLength(0);
  });

  it('cihaz sayısı sınırlanıyor, en eskiler düşüyor', async () => {
    for (let i = 0; i < 12; i += 1) {
      await pushAbone(a.owner.id, {
        endpoint: `https://fcm.googleapis.com/fcm/send/cihaz-${i}`,
        p256dh: 'k',
        auth: 's',
      });
    }

    expect(await pushCihazSayisi(a.owner.id)).toBe(10);

    // Düşenler EN ESKİ görülenler olmalı; son eklenen mutlaka durmalı.
    const kalan = await prisma.pushSubscription.findMany({
      where: { userId: a.owner.id },
      select: { endpoint: true },
    });
    expect(kalan.map((k) => k.endpoint)).toContain(
      'https://fcm.googleapis.com/fcm/send/cihaz-11',
    );
  });
});
