import 'server-only';
import { prisma } from '@/lib/db';
import { ACTIVE_STATUSES, SLOT_STEP_MIN } from '@/lib/constants';
import { computeSlots, type Slot, type StaffAvailability, type Interval } from '@/lib/availability';
import { bookingTotals, orderServices } from '@/lib/services';
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
  /**
   * Randevudaki hizmetler, müşterinin seçtiği sırayla. Süreler toplanır,
   * tampon sonuncudan alınır (bkz. bookingTotals). Personel süzgeci de buna
   * bağlı: hizmetlerin HEPSİNİ veren personel aranır.
   */
  serviceIds: string[];
  date: string;
  /** Belirli bir personel veya 'ANY'. */
  staffId?: string | null;
  /** Erteleme sırasında kendi slotunu dolu saymamak için. */
  excludeReservationId?: string | undefined;
  leadMin?: number;
  stepMin?: number;
  /**
   * "Şu an" — yalnızca istenen gün bugünse anlamlı: o günün geçmiş saatleri
   * elenirken kullanılır. Verilmezse duvar saati okunur.
   *
   * Enjekte edilebilir olması test içindir. Müsaitlik, günün saatine göre
   * farklı sonuç veren tek yer; duvar saatine bağlı kalırsa "cuma 18:37'de
   * saat kalmıyor" gibi davranışlar ancak o saatte koşan testlerle
   * yakalanabilir. Nitekim bir E2E testi tam bu yüzden düşmüştü.
   */
  now?: Date;
  /**
   * Slot geometrisini hizmetlerin bugünkü süresi yerine bu değerlerle kurar.
   *
   * Yalnızca erteleme kullanır. Randevu alındıktan sonra işletme hizmetin
   * süresini değiştirmiş olabilir; erteleme mevcut randevuyu TAŞIR, yeniden
   * fiyatlandırmaz. Kaydın kendi süresi kullanılmazsa 30 dakikalık bir randevu
   * ertelendiğinde sessizce 45 dakikaya dönerdi.
   */
  span?: { durationMin: number; bufferMin: number } | undefined;
};

/** Bir günün açık slotlarını hesaplar. Müşteri ve panel aynı yolu kullanır. */
export async function getDayAvailability(args: DayAvailabilityArgs): Promise<Slot[]> {
  const { branchId, serviceIds, date } = args;
  if (serviceIds.length === 0) return [];
  const leadMin = args.leadMin ?? ONLINE_LEAD_MIN;
  const stepMin = args.stepMin ?? SLOT_STEP_MIN;
  const weekday = weekdayOf(date);

  const [branch, serviceRows] = await Promise.all([
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
    prisma.service.findMany({
      where: { id: { in: serviceIds } },
      select: { id: true, durationMin: true, bufferMin: true, price: true, active: true, businessId: true },
    }),
  ]);

  // Sıra korunur: hangi hizmetin tamponunun uygulanacağını o belirliyor.
  // Biri bulunamadıysa (silinmiş, başka işletmenin) hiç slot üretilmez —
  // eksik bir listeyle hesaplanan süre gerçek randevudan kısa olurdu.
  const services = orderServices(serviceIds, serviceRows);
  if (!branch?.active || !services) return [];
  if (services.some((s) => !s.active || s.businessId !== branch.businessId)) return [];
  const totals = bookingTotals(services);

  const bh = branch.hours[0];
  if (!bh || bh.closed || bh.closeMin <= bh.openMin) return [];
  // Şube tatili tüm günü kapatıyorsa slot üretme.
  const branchClosures = branch.timeOff
    .map((t) => timeOffToInterval(date, t.startsAt, t.endsAt))
    .filter((x): x is Interval => x !== null);

  const staffRows = await prisma.staffMember.findMany({
    where: {
      active: true,
      businessId: branch.businessId,
      OR: [{ branchId }, { branchId: null }],
      ...(args.staffId && args.staffId !== 'ANY' ? { id: args.staffId } : {}),
      // Hizmetlerin HEPSİNİ veren personel. `some` ile aranırsa yalnızca
      // birini veren personel de listeye girer ve randevunun ortasında
      // yapamayacağı bir işle karşılaşırdı.
      AND: serviceIds.map((id) => ({ services: { some: { serviceId: id } } })),
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

  const clock = args.now ?? new Date();
  const isToday = date === today(clock);
  return computeSlots({
    branchHours: { startMin: bh.openMin, endMin: bh.closeMin },
    service: args.span ?? { durationMin: totals.durationMin, bufferMin: totals.bufferMin },
    staff,
    stepMin,
    minLeadMin: leadMin,
    nowMin: isToday ? nowMinutes(clock) : null,
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
