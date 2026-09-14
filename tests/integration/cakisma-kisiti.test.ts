import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '@/lib/db';
import { resetDatabase, createFixture, type Fixture } from './fixture';

/**
 * Aralık çakışması: veritabanı kısıtı.
 *
 * `slotKey` personel + gün + BAŞLANGIÇ dakikasından oluşuyor, yani 10:00-11:00
 * ile 10:30-11:30'u farklı görüyor. Transaction içindeki çakışma sorgusu da
 * READ COMMITTED altında eşzamanlı iki yazmayı ayıramıyor: ikisi de boş
 * görüp ikisi de yazabiliyordu.
 *
 * Gerçek koruma `Reservation_personel_cakisma` dışlama kısıtı. Bu testler
 * doğrudan veritabanına yazıyor — uygulama katmanını atlayarak KISITIN
 * KENDİSİNİ sınamak için. Uygulamadan geçselerdi, transaction içindeki
 * sorgu yakalar ve kısıt hiç devreye girmezdi; yani kısıt kaldırılsa bile
 * test yeşil kalırdı.
 *
 * NOT: test veritabanı `migrate reset` ile kuruluyor (tests/global-setup.ts).
 * `db push` kullanılsaydı bu kısıt test veritabanında hiç olmazdı.
 */

let f: Fixture;

beforeEach(async () => {
  await resetDatabase();
  f = await createFixture();
});

afterAll(async () => {
  await prisma.$disconnect();
});

/** Doğrudan SQL: uygulama katmanındaki kontrolleri atlar. */
async function yaz(
  id: string,
  startMin: number,
  blockEnd: number,
  status = 'CONFIRMED',
  staffId = f.staffA.id,
): Promise<void> {
  await prisma.$executeRawUnsafe(
    `INSERT INTO "Reservation"
       (id,code,"businessId","branchId","serviceId","staffId","customerId",date,
        "startMin","endMin","blockEnd","startsAt","endsAt",status,channel,
        price,discount,"finalPrice","depositAmount","depositStatus","updatedAt")
     VALUES ($1,$1,$2,$3,$4,$5,$6,'2026-10-01',$7,$8,$9,now(),now(),$10,'ONLINE',
        100,0,100,0,'NONE',now())`,
    id,
    f.business.id,
    f.branch.id,
    f.service.id,
    staffId,
    f.customer.id,
    startMin,
    blockEnd - 10,
    blockEnd,
    status,
  );
}

describe('aralık çakışması', () => {
  it('FARKLI başlangıçlı çakışan randevu reddedilir', async () => {
    // Asıl açık buydu: slotKey bu ikisini farklı görüyor.
    await yaz('r1', 600, 670); // 10:00 → 11:10 (tampon dahil)

    await expect(yaz('r2', 630, 700)).rejects.toThrow(/cakisma|exclusion/i);

    expect(await prisma.reservation.count()).toBe(1);
  });

  it('aynı başlangıçlı randevu da reddedilir', async () => {
    await yaz('r1', 600, 670);
    await expect(yaz('r2', 600, 670)).rejects.toThrow(/cakisma|exclusion/i);
  });

  it('bitişik aralık KABUL edilir', async () => {
    // 670'te biten randevunun hemen ardından 670'te başlayan randevu
    // çakışmıyor. Kısıt fazla geniş olsaydı burası da düşerdi ve işletme
    // arka arkaya randevu veremezdi.
    await yaz('r1', 600, 670);
    await yaz('r2', 670, 740);

    expect(await prisma.reservation.count()).toBe(2);
  });

  it('iptal edilmiş randevu saati serbest bırakır', async () => {
    await yaz('r1', 600, 670, 'CANCELLED');
    await yaz('r2', 610, 660);

    expect(await prisma.reservation.count()).toBe(2);
  });

  it('iptal edilmiş randevu tekrar aktife çekilemez', async () => {
    // Durum değişikliği yolu da kısıta tabi: iptal edilen saatin yerine yeni
    // randevu verildikten sonra eskisini geri açmak çakışma yaratırdı.
    await yaz('r1', 600, 670, 'CANCELLED');
    await yaz('r2', 610, 660);

    await expect(
      prisma.reservation.update({ where: { id: 'r1' }, data: { status: 'CONFIRMED' } }),
    ).rejects.toThrow(/cakisma|exclusion/i);
  });

  it('başka personelde aynı saat kabul edilir', async () => {
    await yaz('r1', 600, 670);
    await yaz('r2', 600, 670, 'CONFIRMED', f.staffB.id);

    expect(await prisma.reservation.count()).toBe(2);
  });

  it('TAMAMLANMIŞ randevu saati dolu tutar', async () => {
    // COMPLETED ve NO_SHOW aktif sayılır (bkz. ACTIVE_STATUSES): o saat
    // gerçekten kullanıldı, üzerine randevu yazılmamalı.
    await yaz('r1', 600, 670, 'COMPLETED');
    await expect(yaz('r2', 630, 700)).rejects.toThrow(/cakisma|exclusion/i);
  });
});
