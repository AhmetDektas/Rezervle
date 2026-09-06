import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '@/lib/db';
import { resetDatabase, createFixture } from './fixture';
import { createReservation } from '@/server/reservations';
import { applyPaymentEvent } from '@/server/payment-events';
import { paymentProvider, mockSignature, type WebhookEvent } from '@/server/providers';
import { releaseExpiredJob } from '@/worker/jobs/release-expired';
import { today, addDays } from '@/lib/time';
import { PAYMENT_DEADLINE_MIN } from '@/lib/constants';

// Ödeme artık asenkron: charge() "ödendi" demiyor, "başlattım" diyor. Bu
// dosya S2'deki dört kararı koruyor — 3DS bekleme, webhook idempotensi, terk
// edilen ödemenin saati serbest bırakması ve imza doğrulaması. Hiçbiri
// senkron sahte sağlayıcıyla test edilemiyordu.

let fx: Awaited<ReturnType<typeof createFixture>>;

beforeEach(async () => {
  await resetDatabase();
  await prisma.processedEvent.deleteMany();
  fx = await createFixture();
  // Kapora açık bir işletme: 3DS yolu ancak kapora varsa çalışır.
  await prisma.business.update({
    where: { id: fx.business.id },
    data: { depositAddon: true, depositEnabled: true, depositKind: 'FIXED', depositValue: 200 },
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

function randevu(now = new Date()) {
  return createReservation({
    businessId: fx.business.id,
    branchId: fx.branch.id,
    serviceIds: [fx.service.id],
    staffId: fx.staffA.id,
    customerId: fx.customer.id,
    date: addDays(today(), 1),
    startMin: 600,
    channel: 'ONLINE',
    paymentMethod: 'ONLINE',
    now,
  });
}

function olay(code: string, providerRef: string, type: WebhookEvent['type'], id?: string): WebhookEvent {
  return { id: id ?? `evt_${code}_${type}`, type, providerRef, reference: code };
}

describe('3DS ödeme akışı', () => {
  it('kapora varken randevu ÖDENDİ değil BEKLİYOR durumunda başlar', async () => {
    const r = await randevu();

    // Eski davranış burada "PAID" diyordu: ödemenin sonucunu bilmeden
    // bildiğimizi varsaymak.
    expect(r.depositStatus).toBe('PENDING');
    expect(r.redirectUrl).toBeTruthy();
    expect(r.redirectUrl).toContain('/odeme/3ds');

    const payment = await prisma.payment.findUniqueOrThrow({ where: { reservationId: r.id } });
    expect(payment.status).toBe('PENDING');
    expect(payment.paidAt).toBeNull();
    // Komisyon oranı ödeme başlarken donduruluyor.
    expect(payment.commissionAmount).toBeGreaterThan(0);
  });

  it('bekleyen ödemenin son tarihi kuruluyor', async () => {
    const now = new Date('2026-09-05T10:00:00Z');
    const r = await randevu(now);

    const kayit = await prisma.reservation.findUniqueOrThrow({ where: { id: r.id } });
    expect(kayit.paymentDeadline).not.toBeNull();
    const fark = (kayit.paymentDeadline!.getTime() - now.getTime()) / 60_000;
    expect(fark).toBeCloseTo(PAYMENT_DEADLINE_MIN, 0);
  });

  it('payment.paid olayı randevuyu onaylar ve son tarihi kaldırır', async () => {
    const r = await randevu();
    const payment = await prisma.payment.findUniqueOrThrow({ where: { reservationId: r.id } });

    const sonuc = await applyPaymentEvent(olay(r.code, payment.providerRef!, 'payment.paid'));
    expect(sonuc).toBe('uygulandi');

    const kayit = await prisma.reservation.findUniqueOrThrow({ where: { id: r.id } });
    expect(kayit.depositStatus).toBe('PAID');
    // Dolu bir son tarih "hâlâ bekliyor" demek; temizlenmezse T5 işi
    // ödenmiş randevuyu iptal etmeye çalışırdı.
    expect(kayit.paymentDeadline).toBeNull();

    const guncel = await prisma.payment.findUniqueOrThrow({ where: { reservationId: r.id } });
    expect(guncel.status).toBe('PAID');
    expect(guncel.settlementStatus).toBe('HELD');
  });

  it('AYNI olay iki kez gelirse ikinci kez İŞLENMEZ', async () => {
    const r = await randevu();
    const payment = await prisma.payment.findUniqueOrThrow({ where: { reservationId: r.id } });
    const e = olay(r.code, payment.providerRef!, 'payment.paid');

    expect(await applyPaymentEvent(e)).toBe('uygulandi');
    // Teslimat garantisi "en az bir kez": tekrar gelen olay kaporayı iki kez
    // işlerse müşteri bir kez ödediği hâlde sistemde iki tahsilat görünür.
    expect(await applyPaymentEvent(e)).toBe('zaten-islendi');

    expect(await prisma.processedEvent.count()).toBe(1);
    const bildirimler = await prisma.notification.count({
      where: { userId: fx.customer.id, title: { contains: 'onaylandı' } },
    });
    expect(bildirimler).toBe(1);
  });

  it('payment.failed olayı saati serbest bırakır', async () => {
    const r = await randevu();
    const payment = await prisma.payment.findUniqueOrThrow({ where: { reservationId: r.id } });

    await applyPaymentEvent(olay(r.code, payment.providerRef!, 'payment.failed'));

    const kayit = await prisma.reservation.findUniqueOrThrow({ where: { id: r.id } });
    expect(kayit.status).toBe('CANCELLED');
    // slotKey null olmazsa saat sonsuza dek satılamaz.
    expect(kayit.slotKey).toBeNull();
    expect(kayit.paymentDeadline).toBeNull();
  });

  it('bilinmeyen referans sessizce yutulmaz ama hata da fırlatmaz', async () => {
    const sonuc = await applyPaymentEvent(olay('YOKBOYLE', 'ref', 'payment.paid'));
    expect(sonuc).toBe('kayit-yok');
  });

  it('TERK EDİLEN ödeme: süre dolunca saat yeniden satılabilir', async () => {
    const now = new Date('2026-09-05T10:00:00Z');
    const r = await randevu(now);
    // Müşteri bankaya gitti ve hiç dönmedi: webhook yok, saat kilitli.

    const sonra = new Date(now.getTime() + (PAYMENT_DEADLINE_MIN + 1) * 60_000);
    await releaseExpiredJob.run({ now: sonra.toISOString() });

    const kayit = await prisma.reservation.findUniqueOrThrow({ where: { id: r.id } });
    expect(kayit.status).toBe('CANCELLED');
    expect(kayit.slotKey).toBeNull();
    expect(kayit.cancelReason).toMatch(/süre/i);
  });

  it('süresi dolmamış ödeme serbest BIRAKILMAZ', async () => {
    const now = new Date('2026-09-05T10:00:00Z');
    const r = await randevu(now);

    // Son tarihten önce: müşteri hâlâ bankada olabilir.
    const erken = new Date(now.getTime() + (PAYMENT_DEADLINE_MIN - 5) * 60_000);
    await releaseExpiredJob.run({ now: erken.toISOString() });

    const kayit = await prisma.reservation.findUniqueOrThrow({ where: { id: r.id } });
    expect(kayit.status).not.toBe('CANCELLED');
    expect(kayit.slotKey).not.toBeNull();
  });

  it('ödenmiş randevu süre taramasından ETKİLENMEZ', async () => {
    const now = new Date('2026-09-05T10:00:00Z');
    const r = await randevu(now);
    const payment = await prisma.payment.findUniqueOrThrow({ where: { reservationId: r.id } });
    await applyPaymentEvent(olay(r.code, payment.providerRef!, 'payment.paid'));

    const sonra = new Date(now.getTime() + (PAYMENT_DEADLINE_MIN + 60) * 60_000);
    await releaseExpiredJob.run({ now: sonra.toISOString() });

    const kayit = await prisma.reservation.findUniqueOrThrow({ where: { id: r.id } });
    expect(kayit.status).not.toBe('CANCELLED');
    expect(kayit.depositStatus).toBe('PAID');
  });
});

describe('webhook imzası', () => {
  const provider = paymentProvider();

  it('doğru imzalı gövde çözümlenir', () => {
    const body = JSON.stringify(olay('ABC', 'ref_1', 'payment.paid'));
    const e = provider.verifyWebhook(body, mockSignature(body));
    expect(e?.reference).toBe('ABC');
  });

  it('imza YOKSA reddedilir', () => {
    const body = JSON.stringify(olay('ABC', 'ref_1', 'payment.paid'));
    expect(provider.verifyWebhook(body, null)).toBeNull();
  });

  it('imza yanlışsa reddedilir', () => {
    const body = JSON.stringify(olay('ABC', 'ref_1', 'payment.paid'));
    expect(provider.verifyWebhook(body, 'a'.repeat(64))).toBeNull();
  });

  it('gövde imzadan SONRA değiştirilirse reddedilir', () => {
    const body = JSON.stringify(olay('ABC', 'ref_1', 'payment.paid'));
    const imza = mockSignature(body);
    // Tutarı ya da referansı değiştiren bir saldırgan geçememeli.
    const bozuk = JSON.stringify(olay('BASKAKOD', 'ref_1', 'payment.paid'));
    expect(provider.verifyWebhook(bozuk, imza)).toBeNull();
  });

  it('tanınmayan olay türü reddedilir', () => {
    const body = JSON.stringify({
      id: 'x',
      type: 'payment.something',
      providerRef: 'r',
      reference: 'C',
    });
    expect(provider.verifyWebhook(body, mockSignature(body))).toBeNull();
  });
});
