import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { prisma } from '@/lib/db';
import { createFixture, resetDatabase, type Fixture } from './fixture';
import { createReservation, quoteBooking } from '@/server/reservations';
import { depositsEnabledPlatformWide, depositPolicyFor } from '@/server/deposit-policy';
import { depositActive, depositFor } from '@/lib/deposit';

// Ana şalter (S9-2): gerçek para akarken bir sorun çıkarsa kodu geri alıp
// yeniden dağıtmak dakikalar sürer. Şalter aynı işi saniyeler içinde yapar ve
// sistem "işletmede öde" moduna düşer — rezervasyon almaya devam edilir,
// yalnızca tahsilat durur.

let f: Fixture;

/** Kaporası açık, %20 oranlı bir işletme kurar. */
async function depositliIsletme(): Promise<Fixture> {
  const fx = await createFixture();
  await prisma.business.update({
    where: { id: fx.business.id },
    data: {
      depositAddon: true,
      depositEnabled: true,
      depositKind: 'PERCENT',
      depositValue: 20,
      depositMinPrice: 0,
    },
  });
  return fx;
}

async function isletmeSatiri(id: string) {
  const row = await prisma.business.findUniqueOrThrow({
    where: { id },
    select: {
      depositAddon: true,
      depositEnabled: true,
      depositKind: true,
      depositValue: true,
      depositMinPrice: true,
      depositRefundHours: true,
    },
  });
  return row;
}

beforeEach(async () => {
  await resetDatabase();
  delete process.env['DEPOSITS_ENABLED'];
  f = await depositliIsletme();
});

afterEach(() => {
  delete process.env['DEPOSITS_ENABLED'];
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('kapora ana şalteri', () => {
  it('varsayılan AÇIK — değişken tanımsızsa kapora çalışır', async () => {
    // Ters kurgu (varsayılan kapalı) bir dağıtımda değişken unutulduğunda
    // geliri sessizce durdururdu. Kapatmak açık bir eylem olmalı.
    expect(depositsEnabledPlatformWide()).toBe(true);

    const quote = await quoteBooking({ businessId: f.business.id, serviceIds: [f.service.id] });
    expect(quote.deposit).toBeGreaterThan(0);
  });

  it('DEPOSITS_ENABLED=false iken kapora istenmez', async () => {
    process.env['DEPOSITS_ENABLED'] = 'false';

    expect(depositsEnabledPlatformWide()).toBe(false);
    const quote = await quoteBooking({ businessId: f.business.id, serviceIds: [f.service.id] });
    expect(quote.deposit).toBe(0);
  });

  it('şalter kapalıyken rezervasyon yine oluşur, sadece tahsilat durur', async () => {
    process.env['DEPOSITS_ENABLED'] = 'false';

    const created = await createReservation({
      businessId: f.business.id,
      branchId: f.branch.id,
      serviceIds: [f.service.id],
      staffId: f.staffA.id,
      customerId: f.customer.id,
      date: f.date,
      startMin: 9 * 60,
      channel: 'ONLINE',
    });

    // Ürün çalışmaya devam ediyor: saat tutuluyor, randevu geçerli.
    const row = await prisma.reservation.findUniqueOrThrow({ where: { id: created.id } });
    expect(row.slotKey).toBeTruthy();
    expect(row.depositAmount).toBe(0);
    expect(row.depositStatus).toBe('NONE');

    // Ödeme kaydı oluşuyor ama BORCU kaydediyor, tahsilatı değil:
    // müşteri ₺1000'i işletmede ödeyecek, uygulamadan hiç para geçmiyor.
    const payment = await prisma.payment.findFirstOrThrow({ where: { reservationId: created.id } });
    expect(payment.method).toBe('AT_VENUE');
    expect(payment.amount).toBe(1000); // borç
    expect(payment.capturedAmount).toBe(0); // fiilen tahsil edilen
    expect(payment.commissionAmount).toBe(0);
    expect(payment.settlementStatus).toBe('NONE');
  });

  it('şalter yalnızca kapora yolunu keser, işletme ayarları korunur', async () => {
    process.env['DEPOSITS_ENABLED'] = 'false';
    const row = await isletmeSatiri(f.business.id);
    const policy = depositPolicyFor(row);

    // İşletmenin kendi tercihleri olduğu gibi duruyor...
    expect(policy.addon).toBe(true);
    expect(policy.enabled).toBe(true);
    expect(policy.value).toBe(20);
    // ...ama fiilen kapora istenmiyor.
    expect(policy.platformEnabled).toBe(false);
    expect(depositActive(policy)).toBe(false);
    expect(depositFor(policy, 1000)).toBe(0);
  });

  it('şalter geri açılınca ayarlar kaldığı yerden geçerli olur', async () => {
    process.env['DEPOSITS_ENABLED'] = 'false';
    const row = await isletmeSatiri(f.business.id);
    expect(depositFor(depositPolicyFor(row), 1000)).toBe(0);

    delete process.env['DEPOSITS_ENABLED'];
    expect(depositFor(depositPolicyFor(row), 1000)).toBe(200); // %20
  });
});
