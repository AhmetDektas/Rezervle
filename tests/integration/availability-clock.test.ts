import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '@/lib/db';
import { createFixture, resetDatabase, type Fixture } from './fixture';
import { getDayAvailability } from '@/server/schedule';
import { today } from '@/lib/time';

// Bugünkü E2E arızasının (F-013) deterministik karşılığı.
//
// "panelden telefon randevusu açılır" testi akşam 18:37'de düştü: işletme
// 19:00'da kapanıyor, hizmet 30 dakika, yani o saatte bugün için başlatılabilir
// slot kalmamıştı. Uygulama doğru davranıyordu; test duvar saatine bağlıydı.
//
// Saat dişi enjekte edilebilir olunca aynı senaryo saatten bağımsız
// kurulabiliyor: aşağıdaki iki test her zaman aynı sonucu verir.

let f: Fixture;

/** Fixture 08:00-20:00 açık; yerel saati UTC anına çevirir. */
function at(date: string, hour: number, minute = 0): Date {
  // Europe/Istanbul UTC+3, yaz saati uygulaması yok.
  return new Date(`${date}T${String(hour - 3).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00Z`);
}

beforeEach(async () => {
  await resetDatabase();
  f = await createFixture();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('müsaitlik saat dişi', () => {
  it('gün ortasında slot vardır', async () => {
    const gun = today();
    const slots = await getDayAvailability({
      branchId: f.branch.id,
      serviceIds: [f.service.id],
      date: gun,
      staffId: null,
      now: at(gun, 10),
    });

    // computeSlots yalnızca açık slotları döndürür; sayının kendisi ölçüt.
    expect(slots.length).toBeGreaterThan(0);
  });

  it('kapanışa çok az kala bugün için slot kalmaz (F-013 senaryosu)', async () => {
    const gun = today();
    const slots = await getDayAvailability({
      branchId: f.branch.id,
      serviceIds: [f.service.id],
      date: gun,
      staffId: null,
      now: at(gun, 19, 55), // fixture 20:00'da kapanıyor
    });

    expect(slots).toHaveLength(0);
  });

  it('yarın için saatin kaç olduğu fark etmez', async () => {
    const gun = today();
    const yarin = new Date(`${gun}T00:00:00Z`);
    yarin.setUTCDate(yarin.getUTCDate() + 1);
    const yarinStr = yarin.toISOString().slice(0, 10);

    const geceYarisi = await getDayAvailability({
      branchId: f.branch.id,
      serviceIds: [f.service.id],
      date: yarinStr,
      staffId: null,
      now: at(gun, 23, 30),
    });
    const sabah = await getDayAvailability({
      branchId: f.branch.id,
      serviceIds: [f.service.id],
      date: yarinStr,
      staffId: null,
      now: at(gun, 6),
    });

    // Gelecek gün için "şu an" filtresi hiç uygulanmaz; iki sonuç aynı olmalı.
    expect(geceYarisi.length).toBe(sabah.length);
    expect(sabah.length).toBeGreaterThan(0);
  });
});
