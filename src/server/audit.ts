import 'server-only';
import { prisma } from '@/lib/db';
import { ACTIVE_STATUSES } from '@/lib/constants';
import { overlaps, weekdayOf, zonedToUtc, hhmm } from '@/lib/time';
import { timeOffToInterval } from './schedule';
import type { Interval } from '@/lib/availability';

/**
 * Randevu sağlık denetimi.
 *
 * Çakışma oluşturma anında engellenir; iki aktif randevu aynı kaynağı aynı anda
 * tutamaz. Ama bir randevu oluşturulduktan *sonra* geçersizleşebilir: işletme
 * çalışma saatlerini daraltırsa ya da bir mola eklenirse kayıt saat dışında
 * kalır. Bu modül, panelin "onaylamak üzere olduğun randevu hâlâ tutuyor mu?"
 * sorusuna cevap vermesini sağlar.
 *
 * Denetim salt okunurdur: hiçbir kaydı değiştirmez, yalnızca sorunu adlandırır.
 */

export type ReservationIssue = {
  /** Kısa rozet metni: "Saat dışında", "Çakışma" */
  badge: string;
  /** Panelde gösterilen açıklama. */
  detail: string;
  kind: 'OUTSIDE_HOURS' | 'BREAK' | 'TIME_OFF' | 'OVERLAP' | 'BRANCH_CLOSED';
};

type Candidate = {
  id: string;
  branchId: string;
  staffId: string;
  date: string;
  startMin: number;
  endMin: number;
  blockEnd: number;
  status: string;
};

/**
 * Verilen randevuların her biri için sorun varsa döndürür.
 * Tüm yardımcı veriyi toplu çeker; satır başına sorgu atmaz.
 */
export async function auditReservations(
  rows: Candidate[],
): Promise<Map<string, ReservationIssue>> {
  const issues = new Map<string, ReservationIssue>();
  // Yalnızca ileriye dönük, hâlâ değiştirilebilir kayıtlar denetlenir:
  // tamamlanmış veya iptal edilmiş bir randevunun "saat dışında" olması
  // artık kimseyi ilgilendirmez.
  const live = rows.filter((r) => r.status === 'PENDING' || r.status === 'CONFIRMED');
  if (live.length === 0) return issues;

  const branchIds = [...new Set(live.map((r) => r.branchId))];
  const staffIds = [...new Set(live.map((r) => r.staffId))];
  const dates = [...new Set(live.map((r) => r.date))].sort();
  const first = dates[0]!;
  const last = dates[dates.length - 1]!;

  const [branchHours, staffHours, breaks, timeOff, siblings] = await Promise.all([
    prisma.branchHour.findMany({ where: { branchId: { in: branchIds } } }),
    prisma.staffHour.findMany({ where: { staffId: { in: staffIds } } }),
    prisma.staffBreak.findMany({ where: { staffId: { in: staffIds } } }),
    prisma.timeOff.findMany({
      where: {
        OR: [{ staffId: { in: staffIds } }, { branchId: { in: branchIds } }],
        startsAt: { lte: zonedToUtc(last, 1440) },
        endsAt: { gte: zonedToUtc(first, 0) },
      },
    }),
    prisma.reservation.findMany({
      where: {
        staffId: { in: staffIds },
        date: { in: dates },
        status: { in: [...ACTIVE_STATUSES] },
      },
      select: { id: true, staffId: true, date: true, startMin: true, blockEnd: true },
    }),
  ]);

  for (const r of live) {
    const weekday = weekdayOf(r.date);

    const bh = branchHours.find((h) => h.branchId === r.branchId && h.weekday === weekday);
    if (!bh || bh.closed) {
      issues.set(r.id, {
        kind: 'BRANCH_CLOSED',
        badge: 'Şube kapalı',
        detail: 'Şube bu gün kapalı görünüyor. Randevu şube saatleri dışında kaldı.',
      });
      continue;
    }
    if (r.startMin < bh.openMin || r.endMin > bh.closeMin) {
      issues.set(r.id, {
        kind: 'OUTSIDE_HOURS',
        badge: 'Saat dışında',
        detail: `Şube o gün ${hhmm(bh.openMin)}–${hhmm(bh.closeMin)} açık; randevu bu aralığın dışında kaldı.`,
      });
      continue;
    }

    const sh = staffHours.find((h) => h.staffId === r.staffId && h.weekday === weekday);
    if (!sh || sh.closed) {
      issues.set(r.id, {
        kind: 'OUTSIDE_HOURS',
        badge: 'Saat dışında',
        detail: 'Atanan kaynak bu gün çalışmıyor olarak işaretli.',
      });
      continue;
    }
    if (r.startMin < sh.startMin || r.endMin > sh.endMin) {
      issues.set(r.id, {
        kind: 'OUTSIDE_HOURS',
        badge: 'Saat dışında',
        detail: `Çalışma saati ${hhmm(sh.startMin)}–${hhmm(sh.endMin)}; randevu bu aralığın dışında kaldı.`,
      });
      continue;
    }

    const hitBreak = breaks.find(
      (b) =>
        b.staffId === r.staffId &&
        b.weekday === weekday &&
        overlaps(r.startMin, r.blockEnd, b.startMin, b.endMin),
    );
    if (hitBreak) {
      issues.set(r.id, {
        kind: 'BREAK',
        badge: 'Molaya denk geliyor',
        detail: `${hitBreak.label} (${hhmm(hitBreak.startMin)}–${hhmm(hitBreak.endMin)}) sonradan tanımlanmış.`,
      });
      continue;
    }

    const off = timeOff
      .filter((t) => t.staffId === r.staffId || t.branchId === r.branchId)
      .map((t) => timeOffToInterval(r.date, t.startsAt, t.endsAt))
      .filter((x): x is Interval => x !== null)
      .find((iv) => overlaps(r.startMin, r.blockEnd, iv.startMin, iv.endMin));
    if (off) {
      issues.set(r.id, {
        kind: 'TIME_OFF',
        badge: 'İzin aralığında',
        detail: 'Randevu, sonradan tanımlanan bir izin/kapalı aralığa denk geliyor.',
      });
      continue;
    }

    const clash = siblings.find(
      (o) =>
        o.id !== r.id &&
        o.staffId === r.staffId &&
        o.date === r.date &&
        overlaps(r.startMin, r.blockEnd, o.startMin, o.blockEnd),
    );
    if (clash) {
      issues.set(r.id, {
        kind: 'OVERLAP',
        badge: 'Çakışma',
        detail: `Aynı kaynakta ${hhmm(clash.startMin)} randevusuyla çakışıyor.`,
      });
    }
  }

  return issues;
}

/** Tek bir randevu için denetim — onaylama akışında kullanılır. */
export async function auditReservation(id: string): Promise<ReservationIssue | null> {
  const row = await prisma.reservation.findUnique({
    where: { id },
    select: {
      id: true,
      branchId: true,
      staffId: true,
      date: true,
      startMin: true,
      endMin: true,
      blockEnd: true,
      status: true,
    },
  });
  if (!row) return null;
  return (await auditReservations([row])).get(id) ?? null;
}
