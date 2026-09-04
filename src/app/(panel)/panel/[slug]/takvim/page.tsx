import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireRole, requireBusinessAccess } from '@/server/auth';
import { auditReservations } from '@/server/audit';
import { CalendarView, type CalReservation } from '@/components/panel/calendar-view';
import type { CalStaff } from '@/components/panel/calendar-day';
import { today, addDays, weekdayOf } from '@/lib/time';
import type { Channel, ReservationStatus } from '@/lib/constants';

export const metadata: Metadata = { title: 'Takvim' };
export const dynamic = 'force-dynamic';

type Params = Promise<{ slug: string }>;
type Search = Promise<{ tarih?: string; gorunum?: string; sube?: string }>;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function CalendarPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const [{ slug }, search, user] = await Promise.all([
    params,
    searchParams,
    requireRole(['OWNER', 'STAFF', 'ADMIN']),
  ]);

  const business = await prisma.business.findUnique({
    where: { slug },
    select: {
      id: true,
      category: { select: { sector: true } },
      branches: { where: { active: true }, orderBy: { isPrimary: 'desc' }, select: { id: true, name: true, hours: true } },
    },
  });
  if (!business) notFound();
  await requireBusinessAccess(user, business.id);

  const date = search.tarih && DATE_RE.test(search.tarih) ? search.tarih : today();
  const view = search.gorunum === 'hafta' ? 'hafta' : search.gorunum === 'ajanda' ? 'ajanda' : 'gun';
  const branch =
    business.branches.find((b) => b.id === search.sube) ?? business.branches[0] ?? null;
  if (!branch) notFound();

  const weekday = weekdayOf(date);
  const bh = branch.hours.find((h) => h.weekday === weekday);
  const openMin = bh && !bh.closed ? bh.openMin : 540;
  const closeMin = bh && !bh.closed ? bh.closeMin : 1140;

  const wd = new Date(`${date}T00:00:00Z`).getUTCDay();
  const weekStart = addDays(date, wd === 0 ? -6 : 1 - wd);
  const weekEnd = addDays(weekStart, 6);

  const [staffRows, reservations] = await Promise.all([
    prisma.staffMember.findMany({
      where: { businessId: business.id, active: true, OR: [{ branchId: branch.id }, { branchId: null }] },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, displayName: true, hue: true, hours: { where: { weekday } } },
    }),
    prisma.reservation.findMany({
      where: { businessId: business.id, branchId: branch.id, date: { gte: weekStart, lte: weekEnd } },
      orderBy: [{ date: 'asc' }, { startMin: 'asc' }],
      include: {
        service: { select: { name: true } },
        staff: { select: { id: true, displayName: true, hue: true } },
        customer: { select: { id: true, name: true, phone: true } },
        branch: { select: { name: true } },
      },
    }),
  ]);

  const staff: CalStaff[] = staffRows.map((s) => {
    const h = s.hours[0];
    return {
      id: s.id,
      name: s.displayName,
      hue: s.hue,
      startMin: h?.startMin ?? openMin,
      endMin: h?.endMin ?? closeMin,
      closed: h?.closed ?? false,
    };
  });

  const issues = await auditReservations(reservations);

  const mapped: CalReservation[] = reservations.map((r) => ({
    id: r.id,
    staffId: r.staffId,
    startMin: r.startMin,
    endMin: r.endMin,
    blockEnd: r.blockEnd,
    status: r.status as ReservationStatus,
    customerName: r.customer.name,
    serviceName: r.service.name,
    price: r.finalPrice,
    date: r.date,
    staffName: r.staff.displayName,
    staffHue: r.staff.hue,
    branchName: r.branch.name,
    customerPhone: r.customer.phone,
    customerId: r.customer.id,
    channel: r.channel as Channel,
    note: r.note,
    internalNote: r.internalNote,
    code: r.code,
    issue: issues.get(r.id) ?? null,
    flagged: issues.has(r.id),
    depositAmount: r.depositAmount,
    depositStatus: r.depositStatus,
  }));

  return (
    <div className="space-y-4">
      <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Takvim</h1>
      <CalendarView
        slug={slug}
        date={date}
        view={view}
        branchId={branch.id}
        branches={business.branches.map((b) => ({ id: b.id, name: b.name }))}
        staff={staff}
        dayEvents={mapped.filter((r) => r.date === date)}
        weekEvents={mapped}
        openMin={openMin}
        closeMin={closeMin}
        sector={business.category.sector}
        canDrag
      />
    </div>
  );
}
