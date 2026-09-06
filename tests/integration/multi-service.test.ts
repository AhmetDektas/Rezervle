import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '@/lib/db';
import { createFixture, resetDatabase, type Fixture } from './fixture';
import { createReservation, rescheduleReservation, quoteBooking } from '@/server/reservations';
import { getDayAvailability } from '@/server/schedule';

/**
 * Tek randevuda birden fazla hizmet.
 *
 * Buradaki asıl risk süre: iki hizmet seçilip takvimde tek hizmetlik yer
 * ayrılırsa randevular üst üste biner ve bu ancak müşteri kapıda beklerken
 * fark edilir. Testler tutarın toplandığını değil, takvimin gerçekten toplam
 * süre kadar kapandığını doğruluyor.
 *
 * Fixture: `service` 60 dk / tampon 15 / ₺1000 · `shortService` 30 dk /
 * tampon 0 / ₺500. `staffA` ikisini de veriyor, `staffB` yalnızca `service`.
 */

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
    serviceIds: [f.service.id, f.shortService.id],
    staffId: f.staffA.id,
    customerId: f.customer.id,
    date: f.date,
    startMin: 600, // 10:00
    channel: 'ONLINE',
    ...over,
  });
}

describe('çoklu hizmet — kayıt', () => {
  it('süre toplanır, tampon son hizmetten alınır', async () => {
    const r = await book();
    // 10:00 + (60 + 30) = 11:30; son hizmetin tamponu 0.
    expect(r.startMin).toBe(600);
    expect(r.endMin).toBe(690);
    expect(r.blockEnd).toBe(690);
  });

  it('sıra değişince tampon da değişir', async () => {
    const r = await book({ serviceIds: [f.shortService.id, f.service.id] });
    expect(r.endMin).toBe(690);
    // Bu kez son hizmet 15 dakika tampon istiyor.
    expect(r.blockEnd).toBe(705);
  });

  it('tutar toplanır', async () => {
    const r = await book();
    expect(r.price).toBe(1500);
    expect(r.finalPrice).toBe(1500);
  });

  it('kalemler randevu anındaki hâliyle dondurulur', async () => {
    const r = await book();
    const kalemler = await prisma.reservationService.findMany({
      where: { reservationId: r.id },
      orderBy: { sortOrder: 'asc' },
    });
    expect(kalemler.map((x) => x.name)).toEqual(['Muayene', 'Kısa kontrol']);
    expect(kalemler.map((x) => x.price)).toEqual([1000, 500]);

    // İşletme fiyatı sonradan değiştirse bile geçmiş randevu değişmemeli.
    await prisma.service.update({ where: { id: f.service.id }, data: { price: 4000 } });
    const sonra = await prisma.reservationService.findFirst({
      where: { reservationId: r.id, serviceId: f.service.id },
    });
    expect(sonra?.price).toBe(1000);
  });

  it('serviceId listenin ilkini gösterir', async () => {
    // Bildirim, rapor ve değerlendirme bu alandan besleniyor.
    const r = await book({ serviceIds: [f.shortService.id, f.service.id] });
    expect(r.serviceId).toBe(f.shortService.id);
  });
});

describe('çoklu hizmet — takvim', () => {
  it('takvimde toplam süre kadar yer kapanır', async () => {
    await book(); // 10:00–11:30
    const slots = await getDayAvailability({
      branchId: f.branch.id,
      serviceIds: [f.service.id],
      date: f.date,
      staffId: f.staffA.id,
      stepMin: 15,
      leadMin: 0,
    });
    const acik = slots.map((s) => s.startMin);
    // Tek hizmetlik yer ayrılsaydı 11:00 açık kalır ve randevular çakışırdı.
    expect(acik).not.toContain(600);
    expect(acik).not.toContain(660); // 11:00
    expect(acik).not.toContain(675); // 11:15
    expect(acik).toContain(690); // 11:30 — biten randevunun hemen ardı
  });

  it('iki hizmete yer olmayan saatler listelenmez', async () => {
    // Şube 20:00'de kapanıyor; 90 dakikalık randevunun en geç başlangıcı 18:30.
    const slots = await getDayAvailability({
      branchId: f.branch.id,
      serviceIds: [f.service.id, f.shortService.id],
      date: f.date,
      staffId: f.staffA.id,
      stepMin: 15,
      leadMin: 0,
    });
    const enGec = Math.max(...slots.map((s) => s.startMin));
    expect(enGec).toBe(1110); // 18:30
  });

  it('hizmetlerin hepsini vermeyen personel listelenmez', async () => {
    // staffB yalnızca `service` veriyor; randevunun ortasında yapamayacağı
    // bir işle karşılaşmamalı.
    const slots = await getDayAvailability({
      branchId: f.branch.id,
      serviceIds: [f.service.id, f.shortService.id],
      date: f.date,
      stepMin: 15,
      leadMin: 0,
    });
    const personeller = new Set(slots.flatMap((s) => s.staffIds));
    expect(personeller.has(f.staffA.id)).toBe(true);
    expect(personeller.has(f.staffB.id)).toBe(false);
  });

  it("'ANY' seçiminde hepsini veren personele atanır", async () => {
    const r = await book({ staffId: 'ANY' });
    expect(r.staffId).toBe(f.staffA.id);
  });

  it('hizmetlerin hepsini vermeyen personel doğrudan seçilemez', async () => {
    await expect(book({ staffId: f.staffB.id })).rejects.toThrow();
  });
});

describe('çoklu hizmet — sınırlar', () => {
  it('boş liste reddedilir', async () => {
    await expect(book({ serviceIds: [] })).rejects.toThrow(/en az bir hizmet/i);
  });

  it('aynı hizmet iki kez seçilemez', async () => {
    // Korunmasaydı süre ve tutar iki katına çıkar, kalem tablosunun
    // benzersizlik kısıtı P2002 fırlatır ve müşteriye "Bu saat az önce doldu"
    // yazardı — gerçekte saatin dolmadığı bir durumda.
    await expect(book({ serviceIds: [f.service.id, f.service.id] })).rejects.toThrow(
      /birden fazla kez/i,
    );
  });

  it('sınırın üstü reddedilir', async () => {
    // Sınır kontrolü tekrar kontrolünden ÖNCE çalışmalı; farklı kimlikler.
    const cok = Array.from({ length: 7 }, (_, i) => `hizmet-${i}`);
    await expect(book({ serviceIds: cok })).rejects.toThrow(/en fazla/i);
  });

  it('başka işletmenin hizmeti reddedilir', async () => {
    const yabanci = await createFixture();
    await expect(book({ serviceIds: [f.service.id, yabanci.service.id] })).rejects.toThrow(
      /hizmet bulunamadı/i,
    );
  });
});

describe('çoklu hizmet — tutar önizlemesi', () => {
  it('quoteBooking toplam üzerinden hesaplar', async () => {
    const q = await quoteBooking({
      businessId: f.business.id,
      serviceIds: [f.service.id, f.shortService.id],
    });
    expect(q.price).toBe(1500);
    expect(q.finalPrice).toBe(1500);
  });
});

describe('çoklu hizmet — erteleme', () => {
  it('hizmetin süresi sonradan değişse bile randevu aynı uzunlukta taşınır', async () => {
    const r = await book(); // 90 dakika
    // İşletme randevu alındıktan sonra hizmeti uzatıyor.
    await prisma.service.update({ where: { id: f.service.id }, data: { durationMin: 120 } });

    const tasindi = await rescheduleReservation({
      id: r.id,
      date: f.date,
      startMin: 780, // 13:00
      actorId: f.customer.id,
      byStaff: true,
    });

    // Erteleme taşır, yeniden fiyatlandırmaz: 90 dakika 90 dakika kalmalı.
    expect(tasindi.endMin - tasindi.startMin).toBe(90);
    expect(tasindi.blockEnd - tasindi.endMin).toBe(0);
  });
});
