import 'server-only';
import { prisma } from '@/lib/db';
import { today, addDays, weekdayOf } from '@/lib/time';
import { ACTIVE_STATUSES } from '@/lib/constants';

export type DayStats = {
  total: number;
  completed: number;
  pending: number;
  cancelled: number;
  noShow: number;
  revenue: number;
  expected: number;
  /** Elde tutulan kapora (randevu henüz yaşanmadı). */
  depositHeld: number;
  /** Gelmeme/geç iptal nedeniyle gelir yazılan kapora. */
  depositForfeited: number;
};

/** Bir gün aralığının özeti. Ciro yalnızca tamamlanan randevulardan sayılır. */
export async function rangeStats(businessId: string, from: string, to: string): Promise<DayStats> {
  const rows = await prisma.reservation.findMany({
    where: { businessId, date: { gte: from, lte: to } },
    select: { status: true, finalPrice: true, depositAmount: true, depositStatus: true },
  });
  const stats: DayStats = {
    total: 0, completed: 0, pending: 0, cancelled: 0, noShow: 0, revenue: 0, expected: 0,
    depositHeld: 0, depositForfeited: 0,
  };
  for (const r of rows) {
    stats.total++;
    if (r.depositStatus === 'PAID') stats.depositHeld += r.depositAmount;
    if (r.depositStatus === 'FORFEITED') stats.depositForfeited += r.depositAmount;
    if (r.status === 'COMPLETED') {
      stats.completed++;
      stats.revenue += r.finalPrice;
    } else if (r.status === 'CANCELLED') stats.cancelled++;
    else if (r.status === 'NO_SHOW') stats.noShow++;
    else {
      if (r.status === 'PENDING') stats.pending++;
      stats.expected += r.finalPrice;
    }
  }
  return stats;
}

/** Personel doluluğu: dolu dakika / çalışılabilir dakika. */
export async function utilizationStats(
  businessId: string,
  from: string,
  to: string,
): Promise<{ staffId: string; name: string; bookedMin: number; capacityMin: number; count: number }[]> {
  const staff = await prisma.staffMember.findMany({
    where: { businessId, active: true },
    select: {
      id: true,
      displayName: true,
      hours: true,
      reservations: {
        where: { date: { gte: from, lte: to }, status: { in: [...ACTIVE_STATUSES] } },
        select: { startMin: true, endMin: true },
      },
    },
    orderBy: { sortOrder: 'asc' },
  });

  const days: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);

  return staff.map((s) => {
    let capacityMin = 0;
    for (const day of days) {
      const h = s.hours.find((x) => x.weekday === weekdayOf(day));
      if (h && !h.closed) capacityMin += Math.max(0, h.endMin - h.startMin);
    }
    const bookedMin = s.reservations.reduce((sum, r) => sum + (r.endMin - r.startMin), 0);
    return {
      staffId: s.id,
      name: s.displayName,
      bookedMin,
      capacityMin,
      count: s.reservations.length,
    };
  });
}

/** En çok tercih edilen hizmetler. */
export async function topServices(businessId: string, from: string, to: string, take = 6) {
  const rows = await prisma.reservation.groupBy({
    by: ['serviceId'],
    where: { businessId, date: { gte: from, lte: to }, status: { in: [...ACTIVE_STATUSES] } },
    _count: { _all: true },
    _sum: { finalPrice: true },
  });
  const services = await prisma.service.findMany({
    where: { id: { in: rows.map((r) => r.serviceId) } },
    select: { id: true, name: true },
  });
  return rows
    .map((r) => ({
      id: r.serviceId,
      name: services.find((s) => s.id === r.serviceId)?.name ?? 'Bilinmeyen hizmet',
      count: r._count._all,
      revenue: r._sum.finalPrice ?? 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, take);
}

/** Günün programı — takvim ve "Bugün" ekranı aynı veriyi kullanır. */
export async function dayAgenda(businessId: string, date: string, branchId?: string) {
  return prisma.reservation.findMany({
    where: { businessId, date, ...(branchId ? { branchId } : {}) },
    orderBy: [{ startMin: 'asc' }],
    include: {
      service: { select: { name: true, durationMin: true, bufferMin: true } },
      // Ek hizmetlerin varlığı günün programında da görünsün.
      _count: { select: { services: true } },
      staff: { select: { id: true, displayName: true, hue: true } },
      customer: { select: { id: true, name: true, phone: true } },
      branch: { select: { id: true, name: true } },
    },
  });
}

export function todayStr(): string {
  return today();
}

export type CustomerSummary = {
  id: string;
  name: string;
  phone: string | null;
  email: string;
  visits: number;
  completed: number;
  noShow: number;
  cancelled: number;
  spend: number;
  lastVisit: string | null;
  nextVisit: string | null;
};

/**
 * İşletmenin müşteri listesi.
 * Randevular tek sorguda çekilip bellekte toplanır; müşteri başına ayrı
 * sorgu atılmaz (N+1 önlenir).
 */
export async function businessCustomers(
  businessId: string,
  search?: string,
): Promise<CustomerSummary[]> {
  const q = search?.trim();
  const rows = await prisma.reservation.findMany({
    where: {
      businessId,
      ...(q
        ? { OR: [{ customer: { name: { contains: q } } }, { customer: { phone: { contains: q } } }] }
        : {}),
    },
    select: {
      date: true,
      status: true,
      finalPrice: true,
      customer: { select: { id: true, name: true, phone: true, email: true } },
    },
    orderBy: { date: 'desc' },
  });

  const t = today();
  const map = new Map<string, CustomerSummary>();
  for (const r of rows) {
    const c = r.customer;
    const entry =
      map.get(c.id) ??
      {
        id: c.id, name: c.name, phone: c.phone, email: c.email,
        visits: 0, completed: 0, noShow: 0, cancelled: 0, spend: 0,
        lastVisit: null, nextVisit: null,
      };
    entry.visits++;
    if (r.status === 'COMPLETED') {
      entry.completed++;
      entry.spend += r.finalPrice;
      if (!entry.lastVisit || r.date > entry.lastVisit) entry.lastVisit = r.date;
    } else if (r.status === 'NO_SHOW') entry.noShow++;
    else if (r.status === 'CANCELLED') entry.cancelled++;
    else if (r.date >= t && (!entry.nextVisit || r.date < entry.nextVisit)) entry.nextVisit = r.date;
    map.set(c.id, entry);
  }

  return [...map.values()].sort((a, b) => b.visits - a.visits);
}

export type SettlementStats = {
  /** Ödeme kuruluşunda bloke bekleyen işletme payı. */
  held: number;
  /** İşletmeye hak ediş olarak yazılan tutar. */
  released: number;
  /** Müşteriye iade edilen tahsilat (kimse kazanmadı). */
  refunded: number;
  /** Platformun kestiği komisyon (yalnızca hak ediş yazılanlardan). */
  commission: number;
  /** Uygulama üzerinden geçen toplam tahsilat. */
  captured: number;
};

/**
 * Kapora tahsilatının taraflara dağılımı.
 * Komisyon yalnızca hak ediş yazılan tahsilatlardan sayılır; iade edilen
 * bir kapora üzerinden platform kazanç yazmaz.
 */
export async function settlementStats(
  businessId: string,
  from: string,
  to: string,
): Promise<SettlementStats> {
  const rows = await prisma.payment.findMany({
    where: {
      capturedAmount: { gt: 0 },
      reservation: { businessId, date: { gte: from, lte: to } },
    },
    select: {
      capturedAmount: true,
      commissionAmount: true,
      netAmount: true,
      settlementStatus: true,
    },
  });

  const stats: SettlementStats = { held: 0, released: 0, refunded: 0, commission: 0, captured: 0 };
  for (const p of rows) {
    stats.captured += p.capturedAmount;
    if (p.settlementStatus === 'HELD') stats.held += p.netAmount;
    else if (p.settlementStatus === 'RELEASED') {
      stats.released += p.netAmount;
      stats.commission += p.commissionAmount;
    } else if (p.settlementStatus === 'REFUNDED') stats.refunded += p.capturedAmount;
  }
  return stats;
}

/** Platform geneli komisyon geliri — yönetim panelinde kullanılır. */
export async function platformCommission(from: string, to: string) {
  const rows = await prisma.payment.findMany({
    where: {
      settlementStatus: 'RELEASED',
      reservation: { date: { gte: from, lte: to } },
    },
    select: {
      commissionAmount: true,
      netAmount: true,
      capturedAmount: true,
      reservation: { select: { business: { select: { id: true, name: true, slug: true } } } },
    },
  });

  const byBusiness = new Map<string, { name: string; slug: string; commission: number; count: number; captured: number }>();
  let total = 0;
  let captured = 0;
  for (const p of rows) {
    const b = p.reservation.business;
    total += p.commissionAmount;
    captured += p.capturedAmount;
    const entry = byBusiness.get(b.id) ?? { name: b.name, slug: b.slug, commission: 0, count: 0, captured: 0 };
    entry.commission += p.commissionAmount;
    entry.captured += p.capturedAmount;
    entry.count++;
    byBusiness.set(b.id, entry);
  }
  return {
    total,
    captured,
    count: rows.length,
    businesses: [...byBusiness.values()].sort((a, b) => b.commission - a.commission),
  };
}
