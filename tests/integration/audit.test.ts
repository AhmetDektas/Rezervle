import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '@/lib/db';
import { createFixture, resetDatabase, type Fixture } from './fixture';
import { createReservation, setReservationStatus } from '@/server/reservations';
import { auditReservation } from '@/server/audit';

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

describe('randevu sağlık denetimi', () => {
  it('sorunsuz bekleyen randevuda uyarı üretmez', async () => {
    const r = await book();
    expect(await auditReservation(r.id)).toBeNull();
  });

  it('personel saatleri daraltılınca "saat dışında" der', async () => {
    const r = await book(); // 10:00–11:00
    await prisma.staffHour.updateMany({
      where: { staffId: f.staffA.id, weekday: f.weekday },
      data: { startMin: 720, endMin: 1200 }, // 12:00'den önce çalışmıyor
    });
    const issue = await auditReservation(r.id);
    expect(issue?.kind).toBe('OUTSIDE_HOURS');
    expect(issue?.detail).toContain('12:00');
  });

  it('personel o gün kapalıya çekilirse uyarır', async () => {
    const r = await book();
    await prisma.staffHour.updateMany({
      where: { staffId: f.staffA.id, weekday: f.weekday },
      data: { closed: true },
    });
    expect((await auditReservation(r.id))?.kind).toBe('OUTSIDE_HOURS');
  });

  it('şube kapatılırsa uyarır', async () => {
    const r = await book();
    await prisma.branchHour.updateMany({
      where: { branchId: f.branch.id, weekday: f.weekday },
      data: { closed: true },
    });
    expect((await auditReservation(r.id))?.kind).toBe('BRANCH_CLOSED');
  });

  it('sonradan eklenen mola randevuya denk gelirse uyarır', async () => {
    const r = await book();
    await prisma.staffBreak.create({
      data: { staffId: f.staffA.id, weekday: f.weekday, startMin: 630, endMin: 690, label: 'Toplantı' },
    });
    const issue = await auditReservation(r.id);
    expect(issue?.kind).toBe('BREAK');
    expect(issue?.detail).toContain('Toplantı');
  });

  it('sonradan eklenen izin randevuya denk gelirse uyarır', async () => {
    const r = await book();
    await prisma.timeOff.create({
      data: {
        staffId: f.staffA.id,
        startsAt: new Date(`${f.date}T00:00:00.000Z`),
        endsAt: new Date(`${f.date}T23:59:00.000Z`),
        type: 'BLOCK',
      },
    });
    expect((await auditReservation(r.id))?.kind).toBe('TIME_OFF');
  });

  it('doğrudan veritabanına yazılan çakışmayı yakalar', async () => {
    const r = await book(); // 10:00–11:00 (+15 dk tampon)
    // Uygulama böyle bir kaydı asla üretmez; motoru atlayan bir içe aktarma
    // veya elle müdahale senaryosunu taklit ediyoruz.
    await prisma.reservation.create({
      data: {
        code: 'RZ-TEST1',
        businessId: f.business.id,
        branchId: f.branch.id,
        serviceId: f.service.id,
        staffId: f.staffA.id,
        customerId: f.other.id,
        date: f.date,
        startMin: 630,
        endMin: 690,
        blockEnd: 705,
        startsAt: new Date(),
        endsAt: new Date(),
        status: 'CONFIRMED',
        channel: 'PHONE',
        price: 1000,
        finalPrice: 1000,
      },
    });
    const issue = await auditReservation(r.id);
    expect(issue?.kind).toBe('OVERLAP');
    expect(issue?.detail).toContain('10:30');
  });

  it('iptal edilmiş randevu denetlenmez', async () => {
    const r = await book();
    await prisma.branchHour.updateMany({
      where: { branchId: f.branch.id, weekday: f.weekday },
      data: { closed: true },
    });
    await setReservationStatus({ id: r.id, to: 'CANCELLED', actorId: f.customer.id });
    expect(await auditReservation(r.id)).toBeNull();
  });
});
