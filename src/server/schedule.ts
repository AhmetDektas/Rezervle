import 'server-only';
import { prisma } from '@/lib/db';
import { ACTIVE_STATUSES, SLOT_STEP_MIN } from '@/lib/constants';
import { computeSlots, type Slot, type StaffAvailability, type Interval } from '@/lib/availability';
import { today, nowMinutes, weekdayOf, zonedToUtc, utcToDateStr, utcToMinutes } from '@/lib/time';

/** Online rezervasyonda en erken randevu için gereken hazırlık süresi. */
export const ONLINE_LEAD_MIN = 60;
/** Panelden kayıt açarken işletme "şu an" için de yazabilsin. */
export const STAFF_LEAD_MIN = 0;

/** DateTime aralığını verilen günün dakika aralığına indirger. */
export function timeOffToInterval(date: string, startsAt: Date, endsAt: Date): Interval | null {
  const startDate = utcToDateStr(startsAt);
  const endDate = utcToDateStr(endsAt);
  if (date < startDate || date > endDate) return null;
  const startMin = date === startDate ? utcToMinutes(startsAt) : 0;
  const endMin = date === endDate ? utcToMinutes(endsAt) : 1440;
  return endMin > startMin ? { startMin, endMin } : null;
}

export type DayAvailabilityArgs = {
  branchId: string;
  serviceId: string;
  date: string;
  /** Belirli bir personel veya 'ANY'. */
  staffId?: string | null;
  /** Erteleme sırasında kendi slotunu dolu saymamak için. */
  excludeReservationId?: string | undefined;
  leadMin?: number;
  stepMin?: number;
};

/** Bir günün açık slotlarını hesaplar. Müşteri ve panel aynı yolu kullanır. */
export async function getDayAvailability(args: DayAvailabilityArgs): Promise<Slot[]> {
  const { branchId, serviceId, date } = args;
  const leadMin = args.leadMin ?? ONLINE_LEAD_MIN;
  const stepMin = args.stepMin ?? SLOT_STEP_MIN;
  const weekday = weekdayOf(date);

  const [branch, service] = await Promise.all([
    prisma.branch.findUnique({
      where: { id: branchId },
      select: {
        id: true,
        active: true,
        businessId: true,
        hours: { where: { weekday }, select: { openMin: true, closeMin: true, closed: true } },
        timeOff: {
          where: { startsAt: { lte: zonedToUtc(date, 1440) }, endsAt: { gte: zonedToUtc(date, 0) } },
          select: { startsAt: true, endsAt: true },
        },
      },
    }),
    prisma.service.findUnique({
      where: { id: serviceId },
      select: { id: true, durationMin: true, bufferMin: true, active: true, businessId: true },
    }),
  ]);

  if (!branch?.active || !service?.active || branch.businessId !== service.businessId) return [];

  const bh = branch.hours[0];
  if (!bh || bh.closed || bh.closeMin <= bh.openMin) return [];
  // Şube tatili tüm günü kapatıyorsa slot üretme.
  const branchClosures = branch.timeOff
    .map((t) => timeOffToInterval(date, t.startsAt, t.endsAt))
    .filter((x): x is Interval => x !== null);

  const staffRows = await prisma.staffMember.findMany({
    where: {
      active: true,
      businessId: service.businessId,
      OR: [{ branchId }, { branchId: null }],
      ...(args.staffId && args.staffId !== 'ANY' ? { id: args.staffId } : {}),
      services: { some: { serviceId } },
    },
    select: {
      id: true,
      hours: { where: { weekday }, select: { startMin: true, endMin: true, closed: true } },
      breaks: { where: { weekday }, select: { startMin: true, endMin: true } },
      timeOff: {
        where: { startsAt: { lte: zonedToUtc(date, 1440) }, endsAt: { gte: zonedToUtc(date, 0) } },
        select: { startsAt: true, endsAt: true },
      },
      reservations: {
        where: {
          date,
          status: { in: [...ACTIVE_STATUSES] },
          ...(args.excludeReservationId ? { id: { not: args.excludeReservationId } } : {}),
        },
        select: { startMin: true, blockEnd: true },
      },
    },
    orderBy: { sortOrder: 'asc' },
  });

  const staff: StaffAvailability[] = staffRows.map((s) => {
    const h = s.hours[0];
    const staffTimeOff = s.timeOff
      .map((t) => timeOffToInterval(date, t.startsAt, t.endsAt))
      .filter((x): x is Interval => x !== null);
    return {
      staffId: s.id,
      hours: h && !h.closed && h.endMin > h.startMin ? { startMin: h.startMin, endMin: h.endMin } : null,
      breaks: s.breaks.map((b) => ({ startMin: b.startMin, endMin: b.endMin })),
      // Şube tatili herkesi kapsar.
      timeOff: [...staffTimeOff, ...branchClosures],
      booked: s.reservations.map((r) => ({ startMin: r.startMin, endMin: r.blockEnd })),
    };
  });

  const isToday = date === today();
  return computeSlots({
    branchHours: { startMin: bh.openMin, endMin: bh.closeMin },
    service: { durationMin: service.durationMin, bufferMin: service.bufferMin },
    staff,
    stepMin,
    minLeadMin: leadMin,
    nowMin: isToday ? nowMinutes() : null,
  });
}

/** Birden çok gün için "müsait mi" bilgisi — takvim şeridi ve filtre için. */
export async function getDaysWithAvailability(
  args: Omit<DayAvailabilityArgs, 'date'> & { dates: string[] },
): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const date of args.dates) {
    const slots = await getDayAvailability({ ...args, date });
    out[date] = slots.length;
  }
  return out;
}
