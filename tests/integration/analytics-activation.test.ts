import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '@/lib/db';
import { resetDatabase, createFixture } from './fixture';
import { funnels, oran } from '@/server/analytics';
import { activationChecklist } from '@/server/activation';

// İki taraflı pazaryerinde yalnızca talebi ölçmek klasik hata: rezervasyon
// sayısı artarken arz tarafı hiç aktifleşmemiş olabilir. Bu testler huninin
// ARZ tarafını gerçekten saydığını doğruluyor.

let fx: Awaited<ReturnType<typeof createFixture>>;

beforeEach(async () => {
  await resetDatabase();
  fx = await createFixture();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('arz hunisi', () => {
  it('onaylı ve kurulumu tamam işletmeyi sayar', async () => {
    // Fixture: onaylı işletme + hizmet + çalışma saati tanımlı.
    const f = await funnels(30);

    expect(f.arz.basvuru).toBe(1);
    expect(f.arz.onaylanan).toBe(1);
    expect(f.arz.kurulumTamam).toBe(1);
  });

  it('hizmeti olmayan işletme KURULUM TAMAM sayılmaz', async () => {
    await prisma.service.deleteMany({ where: { businessId: fx.business.id } });

    const f = await funnels(30);
    expect(f.arz.onaylanan).toBe(1);
    // Onaylanmış ama rezervasyon alamaz durumda: arz tarafındaki asıl kayıp
    // tam olarak bu ara durum.
    expect(f.arz.kurulumTamam).toBe(0);
  });

  it('çalışma saati olmayan işletme KURULUM TAMAM sayılmaz', async () => {
    await prisma.branchHour.deleteMany({ where: { branch: { businessId: fx.business.id } } });

    const f = await funnels(30);
    expect(f.arz.kurulumTamam).toBe(0);
  });

  it('onaylanmamış işletme onaylanan sayısına girmez', async () => {
    await prisma.business.update({
      where: { id: fx.business.id },
      data: { status: 'PENDING' },
    });

    const f = await funnels(30);
    expect(f.arz.basvuru).toBe(1);
    expect(f.arz.onaylanan).toBe(0);
  });
});

describe('oran', () => {
  it('paydası sıfırsa null döner', () => {
    // "%0" ile "veri yok" aynı şey değil; ekranın ikisini ayırması gerekiyor.
    expect(oran(0, 0)).toBeNull();
    expect(oran(1, 2)).toBe(50);
  });
});

describe('kurulum kontrol listesi', () => {
  it('fixture kurulumu için zorunlular tamam', async () => {
    const liste = await activationChecklist(fx.business.id, 'test');

    expect(liste.rezervasyonaHazir).toBe(true);
    expect(liste.maddeler.find((m) => m.id === 'hizmet')?.tamam).toBe(true);
    expect(liste.maddeler.find((m) => m.id === 'saat')?.tamam).toBe(true);
    expect(liste.maddeler.find((m) => m.id === 'personel')?.tamam).toBe(true);
  });

  it('hizmet yoksa REZERVASYONA HAZIR değil', async () => {
    await prisma.service.deleteMany({ where: { businessId: fx.business.id } });

    const liste = await activationChecklist(fx.business.id, 'test');
    expect(liste.rezervasyonaHazir).toBe(false);
    expect(liste.maddeler.find((m) => m.id === 'hizmet')?.tamam).toBe(false);
  });

  it('görsel isteğe bağlı: eksik olması hazırlığı bozmaz', async () => {
    const liste = await activationChecklist(fx.business.id, 'test');

    const gorsel = liste.maddeler.find((m) => m.id === 'gorsel');
    expect(gorsel?.zorunlu).toBe(false);
    expect(gorsel?.tamam).toBe(false);
    // Zorunlular tamamsa görselsiz de randevu alınabilmeli.
    expect(liste.rezervasyonaHazir).toBe(true);
  });

  it('maddeler doğru panel sayfalarına yönlendirir', async () => {
    const liste = await activationChecklist(fx.business.id, 'berber-ali');
    // Kırık bir bağlantı, listeyi işe yaramaz hâle getirirdi.
    expect(liste.maddeler.every((m) => m.href.startsWith('/panel/berber-ali/'))).toBe(true);
  });
});
