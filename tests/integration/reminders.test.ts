import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '@/lib/db';
import { resetDatabase, createFixture } from './fixture';
import { reminderJob } from '@/worker/jobs/reminders';

// Hatırlatma işletmeye anlatılan somut fayda: gelmeme oranını düşürüyor.
// Çift gönderim ise doğrudan zarar — müşteri rahatsız olur, işletme SMS
// parası öder. Bu yüzden idempotens burada süs değil, gereklilik.

let fx: Awaited<ReturnType<typeof createFixture>>;

const SIMDI = new Date('2026-09-05T09:00:00.000Z');
/** 24 saat sonrası: hatırlatma penceresinin tam ortası. */
const HEDEF = new Date(SIMDI.getTime() + 24 * 60 * 60_000);

beforeEach(async () => {
  await resetDatabase();
  fx = await createFixture();
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function randevuYaz(over: Record<string, unknown> = {}) {
  return prisma.reservation.create({
    data: {
      code: `R${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
      businessId: fx.business.id,
      branchId: fx.branch.id,
      serviceId: fx.service.id,
      services: {
        create: [
          { serviceId: fx.service.id, sortOrder: 0, name: 'Test', durationMin: 60, bufferMin: 15, price: 1000 },
        ],
      },
      staffId: fx.staffA.id,
      customerId: fx.customer.id,
      date: '2026-09-06',
      startMin: 720,
      endMin: 780,
      blockEnd: 795,
      startsAt: HEDEF,
      endsAt: new Date(HEDEF.getTime() + 60 * 60_000),
      price: 1000,
      finalPrice: 1000,
      status: 'CONFIRMED',
      ...over,
    },
  });
}

function calistir(now: Date = SIMDI) {
  return reminderJob.run({ now: now.toISOString() });
}

async function hatirlatmaSayisi() {
  return prisma.notification.count({
    where: { userId: fx.customer.id, title: 'Yarınki randevunuz' },
  });
}

describe('randevu hatırlatması', () => {
  it('24 saat sonraki randevu için hatırlatma gönderilir', async () => {
    const r = await randevuYaz();
    await calistir();

    expect(await hatirlatmaSayisi()).toBe(1);
    const kayit = await prisma.reservation.findUniqueOrThrow({ where: { id: r.id } });
    expect(kayit.reminderSentAt).not.toBeNull();
  });

  it('İŞ İKİ KEZ ÇALIŞIRSA ikinci SMS gitmez', async () => {
    await randevuYaz();

    await calistir();
    // BullMQ başarısız işi yeniden dener; ikinci deneme aynı randevuyu
    // yeniden göndermemeli.
    await calistir();

    expect(await hatirlatmaSayisi()).toBe(1);
  });

  it('penceresi gelmemiş randevuya hatırlatma gitmez', async () => {
    await randevuYaz();
    // Randevuya 3 gün var: henüz sırası değil.
    await calistir(new Date(SIMDI.getTime() - 2 * 24 * 60 * 60_000));

    expect(await hatirlatmaSayisi()).toBe(0);
  });

  it('iptal edilmiş randevuya hatırlatma gitmez', async () => {
    await randevuYaz({ status: 'CANCELLED' });
    await calistir();

    expect(await hatirlatmaSayisi()).toBe(0);
  });

  it('ödemesi bekleyen randevuya hatırlatma gitmez', async () => {
    // Birazdan iptal edilecek bir randevuyu duyurmanın anlamı yok.
    await randevuYaz({ depositStatus: 'PENDING' });
    await calistir();

    expect(await hatirlatmaSayisi()).toBe(0);
  });

  it('tamamlanmış randevuya hatırlatma gitmez', async () => {
    await randevuYaz({ status: 'COMPLETED' });
    await calistir();

    expect(await hatirlatmaSayisi()).toBe(0);
  });
});
