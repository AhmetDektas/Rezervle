import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '@/lib/db';
import { createFixture, resetDatabase, type Fixture } from './fixture';
import { applyPaymentEvent } from '@/server/payment-events';
import {
  createReservation,
  setReservationStatus,
  rescheduleReservation,
  canTransition,
  customerCanModify,
} from '@/server/reservations';
import { getDayAvailability } from '@/server/schedule';
import { DomainError } from '@/server/errors';
import { today, addDays } from '@/lib/time';

let f: Fixture;

beforeEach(async () => {
  await resetDatabase();
  f = await createFixture();
});

afterAll(async () => {
  await prisma.$disconnect();
});

function book(over: Partial<Parameters<typeof createReservation>[0]> = {}) {
  return createReservation({
    businessId: f.business.id,
    branchId: f.branch.id,
    serviceId: f.service.id,
    staffId: f.staffA.id,
    customerId: f.customer.id,
    date: f.date,
    startMin: 600, // 10:00
    channel: 'ONLINE',
    ...over,
  });
}

/**
 * Ödemesi tamamlanmış randevu.
 *
 * Kapora artık asenkron (T2): `book()` 3DS bekleyen bir kayıt döndürüyor ve
 * "ödendi" ancak webhook geldiğinde oluyor. Kapora sonrası davranışı sınayan
 * testler bu iki adımı birden yapmak zorunda — tek adım varsaymak, üretimde
 * hiç yaşanmayacak bir durumu test etmek olurdu.
 */
async function bookPaid(over: Partial<Parameters<typeof createReservation>[0]> = {}) {
  const r = await book(over);
  if (r.depositStatus !== 'PENDING') return r;
  const payment = await prisma.payment.findUniqueOrThrow({ where: { reservationId: r.id } });
  await applyPaymentEvent({
    id: `evt_${r.code}`,
    type: 'payment.paid',
    providerRef: payment.providerRef ?? 'mock_ref',
    reference: r.code,
  });
  const guncel = await prisma.reservation.findUniqueOrThrow({ where: { id: r.id } });
  return { ...r, depositStatus: guncel.depositStatus };
}

describe('rezervasyon oluşturma', () => {
  it('geçerli bir slotu kaydeder ve tutarları veritabanından alır', async () => {
    const reservation = await book();
    expect(reservation.status).toBe('PENDING');
    expect(reservation.startMin).toBe(600);
    expect(reservation.endMin).toBe(660);
    expect(reservation.blockEnd).toBe(675); // 15 dk tampon
    expect(reservation.price).toBe(1000);
    expect(reservation.finalPrice).toBe(1000);
    expect(reservation.slotKey).toBe(`${f.staffA.id}:${f.date}:600`);

    const payment = await prisma.payment.findUnique({ where: { reservationId: reservation.id } });
    expect(payment?.status).toBe('PENDING');

    const history = await prisma.reservationStatusHistory.findMany({
      where: { reservationId: reservation.id },
    });
    expect(history).toHaveLength(1);
  });

  it('panelden açılan kayıt doğrudan onaylı başlar', async () => {
    const reservation = await book({ channel: 'PHONE', autoConfirm: true });
    expect(reservation.status).toBe('CONFIRMED');
  });

  it('müşteriye ve işletmeye bildirim yazar', async () => {
    await book();
    const forCustomer = await prisma.notification.count({ where: { userId: f.customer.id } });
    const forOwner = await prisma.notification.count({ where: { userId: f.owner.id } });
    expect(forCustomer).toBeGreaterThan(0);
    expect(forOwner).toBeGreaterThan(0);
  });

  it('"ANY" seçiminde uygun personeli kendisi atar', async () => {
    await book(); // Hekim A 10:00 dolu
    const second = await book({ staffId: 'ANY' });
    expect(second.staffId).toBe(f.staffB.id);
  });
});

describe('çifte rezervasyon engeli', () => {
  it('aynı personel ve saate ikinci kaydı reddeder', async () => {
    await book();
    await expect(book({ customerId: f.other.id })).rejects.toThrow(DomainError);
    expect(await prisma.reservation.count()).toBe(1);
  });

  it('tampon süresine denk gelen kaydı reddeder', async () => {
    await book(); // 10:00–11:00 + 15 dk tampon → 11:15'e kadar bloklu
    await expect(book({ startMin: 670, customerId: f.other.id })).rejects.toThrow(DomainError);
  });

  it('tampon bittikten sonraki saati kabul eder', async () => {
    await book();
    const next = await book({ startMin: 675, customerId: f.other.id });
    expect(next.startMin).toBe(675);
  });

  it('eşzamanlı iki istekte yalnızca biri başarılı olur', async () => {
    const results = await Promise.allSettled([
      book(),
      book({ customerId: f.other.id }),
    ]);
    const ok = results.filter((r) => r.status === 'fulfilled');
    expect(ok).toHaveLength(1);
    expect(await prisma.reservation.count()).toBe(1);
  });

  it('farklı personelde aynı saat serbesttir', async () => {
    await book();
    const other = await book({ staffId: f.staffB.id, customerId: f.other.id });
    expect(other.staffId).toBe(f.staffB.id);
  });
});

describe('oluşturma doğrulamaları', () => {
  it('geçmiş tarihi reddeder', async () => {
    await expect(book({ date: addDays(today(), -1) })).rejects.toThrow(/Geçmiş/);
  });

  it('60 günden uzak tarihi reddeder', async () => {
    await expect(book({ date: addDays(today(), 61) })).rejects.toThrow(/60 gün/);
  });

  it('çalışma saatleri dışını reddeder', async () => {
    await expect(book({ startMin: 300 })).rejects.toThrow(/uygun değil/);
  });

  it('personelin vermediği hizmeti reddeder', async () => {
    // Hekim B kısa kontrol hizmetini vermiyor.
    await expect(book({ staffId: f.staffB.id, serviceId: f.shortService.id })).rejects.toThrow();
  });

  it('onaylanmamış işletmeye randevu vermez', async () => {
    await prisma.business.update({ where: { id: f.business.id }, data: { status: 'SUSPENDED' } });
    await expect(book()).rejects.toThrow(/randevu kabul etmiyor/);
  });

  it('başka işletmenin hizmetini kabul etmez', async () => {
    const foreign = await createFixture();
    await expect(book({ serviceId: foreign.service.id })).rejects.toThrow(/hizmet bulunamadı/i);
  });
});

describe('izin ve mola', () => {
  it('izinli aralıkta randevu verilmez', async () => {
    await prisma.timeOff.create({
      data: {
        staffId: f.staffA.id,
        startsAt: new Date(`${f.date}T00:00:00.000Z`),
        endsAt: new Date(`${f.date}T23:59:00.000Z`),
        type: 'LEAVE',
      },
    });
    await expect(book()).rejects.toThrow(/uygun değil/);
  });

  it('mola saatinde randevu verilmez', async () => {
    await prisma.staffBreak.create({
      data: { staffId: f.staffA.id, weekday: f.weekday, startMin: 600, endMin: 660 },
    });
    await expect(book()).rejects.toThrow(/uygun değil/);
  });
});

describe('iptal', () => {
  it('iptal slotu serbest bırakır', async () => {
    const reservation = await book();
    await setReservationStatus({ id: reservation.id, to: 'CANCELLED', actorId: f.customer.id, note: 'Vazgeçti' });

    const updated = await prisma.reservation.findUnique({ where: { id: reservation.id } });
    expect(updated?.status).toBe('CANCELLED');
    expect(updated?.slotKey).toBeNull();
    expect(updated?.cancelledAt).not.toBeNull();

    // Aynı slot yeniden satılabilmeli.
    const again = await book({ customerId: f.other.id });
    expect(again.startMin).toBe(600);
  });

  it('tamamlanmış randevu iptal edilemez', async () => {
    const reservation = await book();
    await setReservationStatus({ id: reservation.id, to: 'COMPLETED', actorId: f.owner.id });
    await expect(
      setReservationStatus({ id: reservation.id, to: 'CANCELLED', actorId: f.owner.id }),
    ).rejects.toThrow(/geçilemez/);
  });

  it('tamamlandığında yerinde ödeme tahsil edilmiş sayılır', async () => {
    const reservation = await book({ channel: 'PHONE', paymentMethod: 'AT_VENUE' });
    await setReservationStatus({ id: reservation.id, to: 'COMPLETED', actorId: f.owner.id });
    const payment = await prisma.payment.findUnique({ where: { reservationId: reservation.id } });
    expect(payment?.status).toBe('PAID');
    expect(payment?.paidAt).not.toBeNull();
  });
});

describe('erteleme', () => {
  it('boş bir saate taşır ve geçmişe kayıt düşer', async () => {
    const reservation = await book();
    const moved = await rescheduleReservation({
      id: reservation.id,
      date: f.date,
      startMin: 780,
      actorId: f.customer.id,
      byStaff: false,
    });
    expect(moved.startMin).toBe(780);
    expect(moved.slotKey).toBe(`${f.staffA.id}:${f.date}:780`);

    const history = await prisma.reservationStatusHistory.findMany({
      where: { reservationId: reservation.id },
    });
    expect(history.length).toBe(2);
  });

  it('kendi slotunu dolu saymaz (aynı saate taşıma çalışır)', async () => {
    const reservation = await book();
    const moved = await rescheduleReservation({
      id: reservation.id,
      date: f.date,
      startMin: 600,
      actorId: f.customer.id,
      byStaff: true,
    });
    expect(moved.startMin).toBe(600);
  });

  it('dolu bir saate taşımayı reddeder', async () => {
    const first = await book();
    await book({ startMin: 780, customerId: f.other.id });
    await expect(
      rescheduleReservation({ id: first.id, date: f.date, startMin: 780, actorId: f.customer.id, byStaff: true }),
    ).rejects.toThrow(/uygun değil|doldu/);
  });

  it('başka personele taşıyabilir', async () => {
    const reservation = await book();
    const moved = await rescheduleReservation({
      id: reservation.id,
      date: f.date,
      startMin: 600,
      staffId: f.staffB.id,
      actorId: f.owner.id,
      byStaff: true,
    });
    expect(moved.staffId).toBe(f.staffB.id);
  });

  it('iptal edilmiş randevu ertelenemez', async () => {
    const reservation = await book();
    await setReservationStatus({ id: reservation.id, to: 'CANCELLED', actorId: f.customer.id });
    await expect(
      rescheduleReservation({ id: reservation.id, date: f.date, startMin: 780, actorId: f.customer.id, byStaff: true }),
    ).rejects.toThrow(/ertelenemez/);
  });
});

describe('uygunluk sorgusu', () => {
  it('dolu saati listelemez', async () => {
    const before = await getDayAvailability({
      branchId: f.branch.id, serviceId: f.service.id, date: f.date, stepMin: 15, leadMin: 0,
    });
    expect(before.some((s) => s.startMin === 600)).toBe(true);

    await book();
    await book({ staffId: f.staffB.id, customerId: f.other.id });

    const after = await getDayAvailability({
      branchId: f.branch.id, serviceId: f.service.id, date: f.date, stepMin: 15, leadMin: 0,
    });
    expect(after.some((s) => s.startMin === 600)).toBe(false);
  });

  it('erteleme sorgusunda kendi kaydını hariç tutar', async () => {
    const reservation = await book();
    const slots = await getDayAvailability({
      branchId: f.branch.id,
      serviceId: f.service.id,
      date: f.date,
      staffId: f.staffA.id,
      excludeReservationId: reservation.id,
      stepMin: 15,
      leadMin: 0,
    });
    expect(slots.some((s) => s.startMin === 600)).toBe(true);
  });
});

describe('durum geçişleri', () => {
  it('izin verilen geçişleri tanır', () => {
    expect(canTransition('PENDING', 'CONFIRMED')).toBe(true);
    expect(canTransition('CONFIRMED', 'COMPLETED')).toBe(true);
    expect(canTransition('COMPLETED', 'CANCELLED')).toBe(false);
    expect(canTransition('CANCELLED', 'CONFIRMED')).toBe(false);
  });

  it('randevuya 2 saatten az kalmışsa müşteri değiştiremez', () => {
    const soon = new Date();
    const date = today(soon);
    const startMin = soon.getHours() * 60 + soon.getMinutes() + 30;
    expect(customerCanModify({ date, startMin, status: 'CONFIRMED' }, soon)).toBe(false);
    expect(customerCanModify({ date, startMin: startMin + 240, status: 'CONFIRMED' }, soon)).toBe(true);
  });
});

describe('kampanya kodu', () => {
  it('yüzde indirimi uygular ve kullanım sayısını artırır', async () => {
    await prisma.promotion.create({
      data: {
        businessId: f.business.id,
        code: 'TEST20',
        title: 'Test',
        kind: 'PERCENT',
        value: 20,
        startsAt: new Date(Date.now() - 86400000),
        endsAt: new Date(Date.now() + 86400000),
      },
    });
    const reservation = await book({ promotionCode: 'TEST20' });
    expect(reservation.discount).toBe(200);
    expect(reservation.finalPrice).toBe(800);

    const promo = await prisma.promotion.findUnique({ where: { code: 'TEST20' } });
    expect(promo?.usedCount).toBe(1);
  });

  it('süresi dolmuş kodu reddeder', async () => {
    await prisma.promotion.create({
      data: {
        businessId: f.business.id,
        code: 'ESKI',
        title: 'Eski',
        kind: 'AMOUNT',
        value: 100,
        startsAt: new Date(Date.now() - 2 * 86400000),
        endsAt: new Date(Date.now() - 86400000),
      },
    });
    await expect(book({ promotionCode: 'ESKI' })).rejects.toThrow(/süresi dolmuş/i);
  });

  it('başka işletmenin kodunu kabul etmez', async () => {
    const foreign = await createFixture();
    await prisma.promotion.create({
      data: {
        businessId: foreign.business.id,
        code: 'BASKA',
        title: 'Başka',
        kind: 'AMOUNT',
        value: 50,
        startsAt: new Date(Date.now() - 86400000),
        endsAt: new Date(Date.now() + 86400000),
      },
    });
    await expect(book({ promotionCode: 'BASKA' })).rejects.toThrow(/geçerli değil/);
  });
});

describe('kapora', () => {
  async function enableDeposit(over: Record<string, unknown> = {}) {
    await prisma.business.update({
      where: { id: f.business.id },
      data: {
        depositAddon: true,
        depositEnabled: true,
        depositKind: 'PERCENT',
        depositValue: 20,
        depositRefundHours: 24,
        ...over,
      },
    });
  }

  it('paket kapalıyken kapora alınmaz', async () => {
    const r = await book();
    expect(r.depositAmount).toBe(0);
    expect(r.depositStatus).toBe('NONE');
  });

  it('paket açıkken kapora hesaplanır ve 3DS beklemeye alınır', async () => {
    await enableDeposit();
    const r = await book();
    expect(r.depositAmount).toBe(200); // 1000 TL'nin %20'si
    // Ödeme asenkron: banka onayı gelmeden "ödendi" demiyoruz.
    expect(r.depositStatus).toBe('PENDING');
    expect(r.redirectUrl).toBeTruthy();

    const payment = await prisma.payment.findUnique({ where: { reservationId: r.id } });
    expect(payment?.providerRef).toContain('mock_');
    expect(payment?.status).toBe('PENDING');
  });

  it('webhook geldikten sonra kapora ÖDENDİ olur', async () => {
    await enableDeposit();
    const r = await bookPaid();
    expect(r.depositStatus).toBe('PAID');
  });

  it('kapora oranı sonradan değişse bile alınmış tutar sabit kalır', async () => {
    await enableDeposit();
    const r = await bookPaid();
    await prisma.business.update({
      where: { id: f.business.id },
      data: { depositValue: 50 },
    });
    const again = await prisma.reservation.findUnique({ where: { id: r.id } });
    expect(again?.depositAmount).toBe(200);
  });

  it('erken iptalde kapora iade edilir', async () => {
    await enableDeposit({ depositRefundHours: 1 });
    const r = await bookPaid();
    await setReservationStatus({ id: r.id, to: 'CANCELLED', actorId: f.customer.id });

    const after = await prisma.reservation.findUnique({ where: { id: r.id } });
    expect(after?.depositStatus).toBe('REFUNDED');
    const payment = await prisma.payment.findUnique({ where: { reservationId: r.id } });
    expect(payment?.status).toBe('REFUNDED');
    expect(payment?.refundedAt).not.toBeNull();
  });

  it('geç iptalde kapora gelir yazılır', async () => {
    // İade penceresi çok geniş: yarınki randevu her hâlükârda "geç" sayılır.
    await enableDeposit({ depositRefundHours: 500 });
    const r = await bookPaid();
    await setReservationStatus({ id: r.id, to: 'CANCELLED', actorId: f.customer.id });
    const after = await prisma.reservation.findUnique({ where: { id: r.id } });
    expect(after?.depositStatus).toBe('FORFEITED');
  });

  it('gelmedi işaretlenince kapora gelir yazılır', async () => {
    await enableDeposit();
    const r = await bookPaid();
    await setReservationStatus({ id: r.id, to: 'NO_SHOW', actorId: f.owner.id });
    const after = await prisma.reservation.findUnique({ where: { id: r.id } });
    expect(after?.depositStatus).toBe('FORFEITED');
  });

  it('kapora alt limitinin altındaki randevuda kapora istenmez', async () => {
    await enableDeposit({ depositMinPrice: 5000 });
    const r = await bookPaid();
    expect(r.depositAmount).toBe(0);
  });
});

describe('komisyon ve hak ediş', () => {
  async function enableDeposit(over: Record<string, unknown> = {}) {
    await prisma.business.update({
      where: { id: f.business.id },
      data: {
        depositAddon: true,
        depositEnabled: true,
        depositKind: 'AMOUNT',
        depositValue: 300,
        depositRefundHours: 24,
        commissionRate: 30,
        subMerchantKey: 'sub_test',
        ...over,
      },
    });
  }

  const payment = (id: string) => prisma.payment.findUnique({ where: { reservationId: id } });

  it('tahsilat anında bölünür ve işletme payı bloke başlar', async () => {
    await enableDeposit();
    const r = await bookPaid();
    const p = await payment(r.id);
    expect(p?.amount).toBe(1000); // toplam borç
    expect(p?.capturedAmount).toBe(300); // uygulamadan tahsil edilen kapora
    expect(p?.commissionRate).toBe(30);
    expect(p?.commissionAmount).toBe(90);
    expect(p?.netAmount).toBe(210);
    expect(p!.commissionAmount + p!.netAmount).toBe(p!.capturedAmount);
    expect(p?.settlementStatus).toBe('HELD');
    expect(p?.releasedAt).toBeNull();
  });

  it('gelmedi işaretlenince hak ediş yazılır, komisyon platformda kalır', async () => {
    await enableDeposit();
    const r = await bookPaid();
    await setReservationStatus({ id: r.id, to: 'NO_SHOW', actorId: f.owner.id });
    const p = await payment(r.id);
    expect(p?.settlementStatus).toBe('RELEASED');
    expect(p?.releasedAt).not.toBeNull();
    expect(p?.commissionAmount).toBe(90);
    expect(p?.netAmount).toBe(210);
  });

  it('tamamlanınca da hak ediş yazılır', async () => {
    await enableDeposit();
    const r = await bookPaid();
    await setReservationStatus({ id: r.id, to: 'COMPLETED', actorId: f.owner.id });
    expect((await payment(r.id))?.settlementStatus).toBe('RELEASED');
  });

  it('zamanında iptalde komisyon da geri alınır', async () => {
    await enableDeposit({ depositRefundHours: 1 });
    const r = await bookPaid();
    await setReservationStatus({ id: r.id, to: 'CANCELLED', actorId: f.customer.id });
    const p = await payment(r.id);
    expect(p?.settlementStatus).toBe('REFUNDED');
    expect(p?.status).toBe('REFUNDED');
    // Tutarlar kayıtta durur ama platform kazanmaz: hak ediş yazılmadı.
    expect(p?.settlementNote).toContain('tam iade');
  });

  it('geç iptalde kapora işletmede kalır ve komisyon alınır', async () => {
    await enableDeposit({ depositRefundHours: 500 });
    const r = await bookPaid();
    await setReservationStatus({ id: r.id, to: 'CANCELLED', actorId: f.customer.id });
    const p = await payment(r.id);
    expect(p?.settlementStatus).toBe('RELEASED');
    expect(p?.commissionAmount).toBe(90);
  });

  it('komisyon oranı sonradan değişse bile geçmiş tahsilat bölünmesi sabit kalır', async () => {
    await enableDeposit();
    const r = await bookPaid();
    await prisma.business.update({ where: { id: f.business.id }, data: { commissionRate: 50 } });
    const p = await payment(r.id);
    expect(p?.commissionRate).toBe(30);
    expect(p?.commissionAmount).toBe(90);
  });

  it('kapora yoksa komisyon da yoktur', async () => {
    const r = await bookPaid();
    const p = await payment(r.id);
    expect(p?.commissionAmount).toBe(0);
    expect(p?.settlementStatus).toBe('NONE');
  });

  it('sonuçlanmış tahsilat ikinci kez hareket etmez', async () => {
    await enableDeposit();
    const r = await bookPaid();
    await setReservationStatus({ id: r.id, to: 'NO_SHOW', actorId: f.owner.id });
    const first = await payment(r.id);
    await setReservationStatus({ id: r.id, to: 'COMPLETED', actorId: f.owner.id });
    const second = await payment(r.id);
    expect(second?.releasedAt?.getTime()).toBe(first?.releasedAt?.getTime());
    expect(second?.settlementStatus).toBe('RELEASED');
  });
});
