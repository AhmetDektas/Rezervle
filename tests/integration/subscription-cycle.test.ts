import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '@/lib/db';
import { createFixture, resetDatabase, type Fixture } from './fixture';
import { runSubscriptionCycle, markInvoicePaid, voidInvoice } from '@/server/subscription';

/**
 * Abonelik döngüsü.
 *
 * Buradaki asıl riskler para riskleri: aynı dönem için ikinci fatura kesmek,
 * geç ödemede dönemin kayması ve ödenmiş faturaya rağmen işletmenin borçlu
 * görünmesi. Testler durumun faturaların TÜREVİ olduğunu doğruluyor.
 */

let f: Fixture;

const G = 24 * 60 * 60 * 1000;

beforeEach(async () => {
  await resetDatabase();
  f = await createFixture();
});

afterAll(async () => {
  await prisma.$disconnect();
});

/** İşletmeyi belirli bir abonelik durumuna getirir. */
async function abonelikKur(over: {
  planPrice?: number;
  planStatus?: string;
  trialEndsAt?: Date | null;
  currentPeriodEnd?: Date | null;
  trialWarnedAt?: Date | null;
}) {
  await prisma.business.update({
    where: { id: f.business.id },
    data: {
      planKey: 'profesyonel',
      planPrice: over.planPrice ?? 2000,
      planStatus: over.planStatus ?? 'TRIAL',
      trialEndsAt: over.trialEndsAt === undefined ? new Date(Date.now() - 1 * G) : over.trialEndsAt,
      currentPeriodEnd: over.currentPeriodEnd ?? null,
      trialWarnedAt: over.trialWarnedAt ?? null,
    },
  });
}

function faturalar() {
  return prisma.subscriptionInvoice.findMany({
    where: { businessId: f.business.id },
    orderBy: { periodStart: 'asc' },
  });
}

function isletme() {
  return prisma.business.findUniqueOrThrow({
    where: { id: f.business.id },
    select: { planStatus: true, currentPeriodEnd: true, trialWarnedAt: true },
  });
}

describe('döngü — fatura üretimi', () => {
  it('deneme sürerken fatura kesilmez', async () => {
    await abonelikKur({ trialEndsAt: new Date(Date.now() + 30 * G) });
    const s = await runSubscriptionCycle();
    expect(s.fatura).toBe(0);
    expect(await faturalar()).toHaveLength(0);
  });

  it('deneme bitince fatura kesilir ve durum PAST_DUE olur', async () => {
    await abonelikKur({ trialEndsAt: new Date(Date.now() - 1 * G) });
    const s = await runSubscriptionCycle();
    expect(s.fatura).toBe(1);

    const [fatura] = await faturalar();
    expect(fatura?.amount).toBe(2000);
    expect(fatura?.planKey).toBe('profesyonel');
    expect(fatura?.status).toBe('DUE');
    expect((await isletme()).planStatus).toBe('PAST_DUE');
  });

  it('iş ikinci kez koşunca İKİNCİ fatura kesilmez', async () => {
    // Kuyruk işleri en az bir kez çalışır. Dönem anahtarı olmasaydı her
    // yeniden deneme işletmeye bir fatura daha yazardı.
    await abonelikKur({ trialEndsAt: new Date(Date.now() - 1 * G) });
    await runSubscriptionCycle();
    const ikinci = await runSubscriptionCycle();

    expect(ikinci.fatura).toBe(0);
    expect(await faturalar()).toHaveLength(1);
  });

  it('paket seçilmemişse fatura kesilmez ama sayılır', async () => {
    // İşletmenin seçmediği bir tutarı borç yazmak, tersinden düzeltmesi
    // pahalı bir hata olurdu.
    await abonelikKur({ planPrice: 0, trialEndsAt: new Date(Date.now() - 1 * G) });
    const s = await runSubscriptionCycle();

    expect(s.fatura).toBe(0);
    expect(s.paketsiz).toBe(1);
    expect(await faturalar()).toHaveLength(0);
    expect((await isletme()).planStatus).toBe('TRIAL');
  });

  it('iptal edilmiş abonelikte fatura kesilmez', async () => {
    await abonelikKur({ planStatus: 'CANCELLED', trialEndsAt: new Date(Date.now() - 1 * G) });
    const s = await runSubscriptionCycle();
    expect(s.fatura).toBe(0);
    expect((await isletme()).planStatus).toBe('CANCELLED');
  });
});

describe('döngü — deneme uyarısı', () => {
  it('son 7 günde bir kez uyarır', async () => {
    await abonelikKur({ planStatus: 'TRIAL', trialEndsAt: new Date(Date.now() + 3 * G) });

    const ilk = await runSubscriptionCycle();
    expect(ilk.uyari).toBe(1);
    expect((await isletme()).trialWarnedAt).not.toBeNull();

    // Damga olmasaydı günlük iş her gün aynı mesajı gönderirdi.
    const ikinci = await runSubscriptionCycle();
    expect(ikinci.uyari).toBe(0);
  });

  it('uyarı işletme sahibine bildirim olarak düşer', async () => {
    await abonelikKur({ planStatus: 'TRIAL', trialEndsAt: new Date(Date.now() + 3 * G) });
    await runSubscriptionCycle();

    const bildirim = await prisma.notification.findFirst({
      where: { userId: f.owner.id, title: { contains: 'Deneme' } },
    });
    expect(bildirim).not.toBeNull();
  });

  it('deneme uzaksa uyarmaz', async () => {
    await abonelikKur({ planStatus: 'TRIAL', trialEndsAt: new Date(Date.now() + 40 * G) });
    const s = await runSubscriptionCycle();
    expect(s.uyari).toBe(0);
  });
});

describe('ödeme işaretleme', () => {
  it('ödendi işaretlenince ACTIVE olur ve dönem ilerler', async () => {
    await abonelikKur({ trialEndsAt: new Date(Date.now() - 1 * G) });
    await runSubscriptionCycle();
    const [fatura] = await faturalar();

    await markInvoicePaid({ invoiceId: fatura!.id, note: 'Dekont 123' });

    const b = await isletme();
    expect(b.planStatus).toBe('ACTIVE');
    expect(b.currentPeriodEnd?.toISOString()).toBe(fatura!.periodEnd.toISOString());

    const [sonra] = await faturalar();
    expect(sonra?.status).toBe('PAID');
    expect(sonra?.paidMethod).toBe('MANUAL');
    expect(sonra?.paidNote).toBe('Dekont 123');
  });

  it('dönem bitince sonraki fatura kesilir', async () => {
    const donemSonu = new Date(Date.now() - 1 * G);
    await abonelikKur({
      planStatus: 'ACTIVE',
      trialEndsAt: new Date(Date.now() - 40 * G),
      currentPeriodEnd: donemSonu,
    });

    const s = await runSubscriptionCycle();
    expect(s.fatura).toBe(1);

    const [fatura] = await faturalar();
    // Yeni dönem, biten dönemin bittiği yerden başlar — "bugün"den değil.
    expect(fatura?.periodStart.toISOString()).toBe(donemSonu.toISOString());
    expect((await isletme()).planStatus).toBe('PAST_DUE');
  });

  it('geç ödemede dönem kaymaz', async () => {
    // Dönem sonu "bugün + 1 ay" olsaydı, her geç ödeme işletmeye birkaç gün
    // bedava kullanım verir ve dönemler kalıcı olarak kayardı.
    const denemeSonu = new Date(Date.now() - 20 * G);
    await abonelikKur({ trialEndsAt: denemeSonu });
    await runSubscriptionCycle();
    const [fatura] = await faturalar();

    await markInvoicePaid({ invoiceId: fatura!.id });

    const b = await isletme();
    expect(b.currentPeriodEnd?.getTime()).toBe(fatura!.periodEnd.getTime());
    // Ödeme 20 gün geç yapıldı ama dönem sonu denemenin bitişine bağlı kaldı.
    expect(b.currentPeriodEnd!.getTime()).toBeLessThan(Date.now() + 12 * G);
  });

  it('aynı fatura iki kez ödenmiş işaretlenemez', async () => {
    await abonelikKur({ trialEndsAt: new Date(Date.now() - 1 * G) });
    await runSubscriptionCycle();
    const [fatura] = await faturalar();

    await markInvoicePaid({ invoiceId: fatura!.id });
    await expect(markInvoicePaid({ invoiceId: fatura!.id })).rejects.toThrow(/zaten ödenmiş/i);
  });

  it('ödeme bildirimi işletmeye düşer', async () => {
    await abonelikKur({ trialEndsAt: new Date(Date.now() - 1 * G) });
    await runSubscriptionCycle();
    const [fatura] = await faturalar();
    await markInvoicePaid({ invoiceId: fatura!.id });

    const bildirim = await prisma.notification.findFirst({
      where: { userId: f.owner.id, title: { contains: 'ödemeniz alındı' } },
    });
    expect(bildirim).not.toBeNull();
  });
});

describe('fatura iptali', () => {
  it('iptal edilen fatura borç saymaz', async () => {
    await abonelikKur({ trialEndsAt: new Date(Date.now() - 1 * G) });
    await runSubscriptionCycle();
    const [fatura] = await faturalar();
    expect((await isletme()).planStatus).toBe('PAST_DUE');

    await voidInvoice({ invoiceId: fatura!.id, reason: 'Yanlış kesildi' });

    const [sonra] = await faturalar();
    expect(sonra?.status).toBe('VOID');
    // Açık fatura kalmadı: durum borçluluktan çıkmalı.
    expect((await isletme()).planStatus).toBe('ACTIVE');
  });

  it('ödenmiş fatura iptal edilemez', async () => {
    await abonelikKur({ trialEndsAt: new Date(Date.now() - 1 * G) });
    await runSubscriptionCycle();
    const [fatura] = await faturalar();
    await markInvoicePaid({ invoiceId: fatura!.id });

    await expect(voidInvoice({ invoiceId: fatura!.id, reason: 'x' })).rejects.toThrow(
      /iptal edilemez/i,
    );
  });

  it('gerekçesiz iptal reddedilir', async () => {
    await abonelikKur({ trialEndsAt: new Date(Date.now() - 1 * G) });
    await runSubscriptionCycle();
    const [fatura] = await faturalar();

    await expect(voidInvoice({ invoiceId: fatura!.id, reason: '   ' })).rejects.toThrow(
      /gerekçe/i,
    );
  });
});
