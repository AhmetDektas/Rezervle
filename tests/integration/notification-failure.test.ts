import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { prisma } from '@/lib/db';
import { createFixture, resetDatabase, type Fixture } from './fixture';

// Kanal gönderimi (e-posta/SMS) sağlayıcı arızasını taklit eder.
// Gerçek hayatta bu SMTP kesintisi ya da Netgsm 429 olur.
const sendFails = vi.hoisted(() => ({ value: false }));

vi.mock('@/server/providers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/server/providers')>();
  return {
    ...actual,
    notify: async (...args: Parameters<typeof actual.notify>) => {
      if (sendFails.value) throw new Error('SMTP bağlantısı reddedildi');
      return actual.notify(...args);
    },
  };
});

const { createReservation } = await import('@/server/reservations');
const { notifyUser } = await import('@/server/notifications');

let f: Fixture;

beforeEach(async () => {
  await resetDatabase();
  f = await createFixture();
  sendFails.value = false;
});

afterAll(async () => {
  sendFails.value = false;
  await prisma.$disconnect();
});

describe('bildirim kanalı arızası asıl işlemi düşürmez', () => {
  it('kanal patlasa da uygulama içi bildirim yazılır ve hata yükselmez', async () => {
    sendFails.value = true;

    await expect(
      notifyUser({
        userId: f.customer.id,
        kind: 'RESERVATION',
        title: 'Test bildirimi',
        body: 'gövde',
        alsoSend: true,
      }),
    ).resolves.toBeUndefined();

    const rows = await prisma.notification.findMany({ where: { userId: f.customer.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.title).toBe('Test bildirimi');
  });

  it('SMTP arızasında randevu yine de oluşur (GAP-1 regresyonu)', async () => {
    sendFails.value = true;

    const created = await createReservation({
      businessId: f.business.id,
      branchId: f.branch.id,
      serviceId: f.service.id,
      staffId: f.staffA.id,
      customerId: f.customer.id,
      date: f.date,
      startMin: 9 * 60,
      channel: 'ONLINE',
    });

    // Rezervasyon gerçekten yazıldı: kullanıcı hata görmemeli.
    expect(created.id).toBeTruthy();
    const row = await prisma.reservation.findUnique({ where: { id: created.id } });
    expect(row).not.toBeNull();
    expect(row?.slotKey).toBeTruthy();

    // Uygulama içi bildirim de duruyor; müşteri randevusunu panelden görebilir.
    const notes = await prisma.notification.findMany({ where: { userId: f.customer.id } });
    expect(notes.length).toBeGreaterThan(0);
  });

  it('kanal çalışırken davranış değişmez', async () => {
    sendFails.value = false;

    await notifyUser({
      userId: f.customer.id,
      kind: 'INFO',
      title: 'Çalışan kanal',
      alsoSend: true,
    });

    const rows = await prisma.notification.findMany({ where: { userId: f.customer.id } });
    expect(rows).toHaveLength(1);
  });
});
