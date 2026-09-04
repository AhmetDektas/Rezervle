/**
 * Uygunluk çekirdeği.
 *
 * Saf fonksiyon: veritabanı bilmez, bu yüzden birim testlerde doğrudan
 * çalıştırılabilir ve hem müşteri tarafı hem işletme paneli aynı kuralları
 * kullanır. Tek bir yerde toplanmasının sebebi budur — kural ikiye ayrılırsa
 * er geç ikisi birbirinden ayrışır ve çifte rezervasyon doğar.
 *
 * Bir slotun açık sayılması için:
 *   1) şube o gün açık ve slot şube saatleri içinde,
 *   2) personel o gün çalışıyor ve slot personel saatleri içinde,
 *   3) hizmet süresi kapanıştan önce bitiyor,
 *   4) slot + tampon süresi başka bir randevu, mola veya izinle çakışmıyor,
 *   5) slot geçmişte değil ve en az `minLeadMin` sonrasında.
 */

import { overlaps } from './time';

export type Interval = { startMin: number; endMin: number };

export type StaffAvailability = {
  staffId: string;
  /** O gün için çalışma penceresi; null ise personel o gün çalışmıyor. */
  hours: Interval | null;
  /** Haftalık tekrar eden molalar. */
  breaks: Interval[];
  /** İzin/blok — gün içi dakikaya indirgenmiş hâli. */
  timeOff: Interval[];
  /** Mevcut randevular; endMin tampon dahil bitiştir (blockEnd). */
  booked: Interval[];
};

export type AvailabilityInput = {
  /** Şubenin o günkü açılış penceresi; null ise şube kapalı. */
  branchHours: Interval | null;
  service: { durationMin: number; bufferMin: number };
  staff: StaffAvailability[];
  /** Slot ızgarası adımı (dakika). */
  stepMin: number;
  /** Bugüne göre kaç dakika sonrasından itibaren randevu verilebilir. */
  minLeadMin: number;
  /** Sorgulanan gün bugünse şu anki dakika; değilse null. */
  nowMin: number | null;
};

export type Slot = {
  startMin: number;
  endMin: number;
  /** Bu saatte müsait olan personeller (ANY seçimi için). */
  staffIds: string[];
};

function intersect(a: Interval, b: Interval): Interval | null {
  const startMin = Math.max(a.startMin, b.startMin);
  const endMin = Math.min(a.endMin, b.endMin);
  return startMin < endMin ? { startMin, endMin } : null;
}

/** Tek bir personel için belirli bir başlangıcın uygun olup olmadığı. */
export function isStaffFree(
  staff: StaffAvailability,
  startMin: number,
  durationMin: number,
  bufferMin: number,
  window: Interval,
): boolean {
  if (!staff.hours) return false;
  const work = intersect(staff.hours, window);
  if (!work) return false;

  const serviceEnd = startMin + durationMin;
  const blockEnd = serviceEnd + bufferMin;
  // Hizmetin kendisi çalışma penceresi içinde bitmeli; tampon kapanışı aşabilir.
  if (startMin < work.startMin || serviceEnd > work.endMin) return false;

  for (const b of staff.breaks) if (overlaps(startMin, blockEnd, b.startMin, b.endMin)) return false;
  for (const t of staff.timeOff) if (overlaps(startMin, blockEnd, t.startMin, t.endMin)) return false;
  for (const r of staff.booked) if (overlaps(startMin, blockEnd, r.startMin, r.endMin)) return false;
  return true;
}

export function computeSlots(input: AvailabilityInput): Slot[] {
  const { branchHours, service, staff, stepMin, minLeadMin, nowMin } = input;
  if (!branchHours || service.durationMin <= 0 || staff.length === 0) return [];

  const earliest = nowMin === null ? -Infinity : nowMin + minLeadMin;
  const slots: Slot[] = [];

  // Izgara şube açılışına hizalanır: 09:00 açılışta 09:00, 09:15, 09:30…
  for (
    let start = branchHours.startMin;
    start + service.durationMin <= branchHours.endMin;
    start += stepMin
  ) {
    if (start < earliest) continue;
    const free = staff
      .filter((s) => isStaffFree(s, start, service.durationMin, service.bufferMin, branchHours))
      .map((s) => s.staffId);
    if (free.length > 0) {
      slots.push({ startMin: start, endMin: start + service.durationMin, staffIds: free });
    }
  }
  return slots;
}

/** Bir günün doluluk oranı — panel raporlarında kullanılır. */
export function utilization(staff: StaffAvailability[]): { bookedMin: number; capacityMin: number } {
  let bookedMin = 0;
  let capacityMin = 0;
  for (const s of staff) {
    if (!s.hours) continue;
    capacityMin += s.hours.endMin - s.hours.startMin;
    for (const b of s.booked) {
      const cut = intersect(b, s.hours);
      if (cut) bookedMin += cut.endMin - cut.startMin;
    }
  }
  return { bookedMin, capacityMin };
}
