import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { prisma } from '@/lib/db';
import { resetDatabase, createFixture } from './fixture';

// "SMS ile randevu hatırlatması al" kutusu profilde kaydediliyordu ama
// notifyUser bunu hiç okumuyordu: kapatan kullanıcıya SMS gitmeye devam
// ediyordu. Kutunun kendisi bir vaat; gönderim onun tutulduğu tek yer.

const gonderilen: { email: string[]; sms: string[] } = { email: [], sms: [] };

vi.mock('@/server/providers', async (importOriginal) => {
  const gercek = await importOriginal<typeof import('@/server/providers')>();
  return {
    ...gercek,
    notify: async (input: { email: string | null; phone: string | null }) => {
      if (input.email) gonderilen.email.push(input.email);
      if (input.phone) gonderilen.sms.push(input.phone);
    },
  };
});

const { notifyUser } = await import('@/server/notifications');

let fx: Awaited<ReturnType<typeof createFixture>>;

beforeEach(async () => {
  await resetDatabase();
  fx = await createFixture();
  gonderilen.email = [];
  gonderilen.sms = [];
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function tercih(smsOptIn: boolean, emailOptIn: boolean) {
  await prisma.customerProfile.create({
    data: { userId: fx.customer.id, smsOptIn, emailOptIn },
  });
}

function bildir() {
  return notifyUser({
    userId: fx.customer.id,
    kind: 'RESERVATION',
    title: 'Randevunuz oluşturuldu',
    alsoSend: true,
  });
}

describe('iletişim tercihleri', () => {
  it('ikisi de açıkken her iki kanala gönderilir', async () => {
    await tercih(true, true);
    await bildir();

    expect(gonderilen.email).toHaveLength(1);
    expect(gonderilen.sms).toHaveLength(1);
  });

  it('SMS kapalıyken SMS GİTMEZ, e-posta gider', async () => {
    await tercih(false, true);
    await bildir();

    expect(gonderilen.sms).toHaveLength(0);
    expect(gonderilen.email).toHaveLength(1);
  });

  it('e-posta kapalıyken e-posta GİTMEZ, SMS gider', async () => {
    await tercih(true, false);
    await bildir();

    expect(gonderilen.email).toHaveLength(0);
    expect(gonderilen.sms).toHaveLength(1);
  });

  it('ikisi de kapalıyken hiçbir kanala gönderilmez', async () => {
    await tercih(false, false);
    await bildir();

    expect(gonderilen.email).toHaveLength(0);
    expect(gonderilen.sms).toHaveLength(0);
  });

  it('kanal kapalı olsa da uygulama içi bildirim yazılır', async () => {
    await tercih(false, false);
    await bildir();

    // Randevu kaydı kullanıcının kendi kaydı; tercih onu susturmaz.
    const bildirimler = await prisma.notification.count({ where: { userId: fx.customer.id } });
    expect(bildirimler).toBe(1);
  });

  it('profili olmayan hesaba (işletme sahibi) gönderim sürer', async () => {
    // Sahip/personel/yönetici operasyonel bildirim almak zorunda; tercih
    // kaydı yok ve varsayılan açık.
    await notifyUser({
      userId: fx.owner.id,
      kind: 'RESERVATION',
      title: 'Yeni randevu',
      alsoSend: true,
    });

    expect(gonderilen.email).toHaveLength(1);
  });
});
