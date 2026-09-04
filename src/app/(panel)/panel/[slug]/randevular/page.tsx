import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CalendarSearch, Phone } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireRole, requireBusinessAccess } from '@/server/auth';
import { NewReservationDialog, type PanelBookingData } from '@/components/panel/new-reservation';
import { StatusActions } from '@/components/panel/status-actions';
import { StatusBadge, Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Card } from '@/components/ui/card';
import { ReservationFilters } from '@/components/panel/reservation-filters';
import { IssueBadge } from '@/components/panel/issue-badge';
import { auditReservations } from '@/server/audit';
import { money, duration, dayWithWeekday, phone as fmtPhone } from '@/lib/format';
import { hhmm, today } from '@/lib/time';
import {
  RESERVATION_STATUSES,
  CHANNEL_LABEL,
  type Channel,
  type ReservationStatus,
} from '@/lib/constants';

export const metadata: Metadata = { title: 'Randevular' };
export const dynamic = 'force-dynamic';

type Params = Promise<{ slug: string }>;
type Search = Promise<{
  q?: string;
  durum?: string;
  baslangic?: string;
  bitis?: string;
  yeni?: string;
  tarih?: string;
}>;

export default async function ReservationsPage({
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
      branches: { where: { active: true }, orderBy: { isPrimary: 'desc' }, select: { id: true, name: true } },
      services: {
        where: { active: true },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, name: true, durationMin: true, price: true },
      },
      staff: {
        where: { active: true },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, displayName: true, branchId: true, services: { select: { serviceId: true } } },
      },
    },
  });
  if (!business) notFound();
  await requireBusinessAccess(user, business.id);

  const q = search.q?.trim();
  const status = RESERVATION_STATUSES.includes(search.durum as ReservationStatus)
    ? (search.durum as ReservationStatus)
    : undefined;
  const from = search.baslangic || undefined;
  const to = search.bitis || undefined;

  // Filtre yokken operatörün işine yarayan görünüm "bugünden itibaren, en yakın
  // önce"dir. Arama veya durum seçilirse geçmişe de bakılabilsin diye tüm
  // tarihler en yeniden eskiye sıralanır.
  const browsing = !q && !status && !from && !to;
  const effectiveFrom = browsing ? today() : from;
  const order: 'asc' | 'desc' = browsing || from || to ? 'asc' : 'desc';

  const reservations = await prisma.reservation.findMany({
    where: {
      businessId: business.id,
      ...(status ? { status } : {}),
      ...(effectiveFrom || to
        ? { date: { ...(effectiveFrom ? { gte: effectiveFrom } : {}), ...(to ? { lte: to } : {}) } }
        : {}),
      ...(q
        ? {
            OR: [
              { code: { contains: q } },
              { customer: { name: { contains: q } } },
              { customer: { phone: { contains: q } } },
              { service: { name: { contains: q } } },
            ],
          }
        : {}),
    },
    orderBy: [{ date: order }, { startMin: order }],
    take: 40,
    include: {
      service: { select: { name: true, durationMin: true } },
      staff: { select: { displayName: true } },
      customer: { select: { id: true, name: true, phone: true } },
      branch: { select: { name: true } },
    },
  });

  const issues = await auditReservations(reservations);

  const bookingData: PanelBookingData = {
    businessId: business.id,
    slug,
    sector: business.category.sector,
    branches: business.branches,
    services: business.services,
    staff: business.staff.map((s) => ({
      id: s.id,
      displayName: s.displayName,
      branchId: s.branchId,
      serviceIds: s.services.map((x) => x.serviceId),
    })),
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Randevular</h1>
          <p className="mt-0.5 text-[13.5px] text-ink-3">
            {browsing ? 'Bugünden itibaren · ' : ''}
            {reservations.length === 100 ? 'ilk 100 kayıt' : `${reservations.length} kayıt`}
            {browsing ? ' · geçmiş için tarih filtresi kullanın' : ''}
          </p>
        </div>
        <NewReservationDialog
          data={bookingData}
          defaultDate={search.tarih ?? today()}
          defaultOpen={search.yeni === '1'}
        />
      </div>

      <ReservationFilters slug={slug} />

      {reservations.length === 0 ? (
        <EmptyState
          icon={<CalendarSearch size={22} />}
          title="Kayıt bulunamadı"
          description="Filtreleri gevşetin ya da yeni bir randevu ekleyin."
        />
      ) : (
        <Card className="overflow-hidden">
          {/* Masaüstü: tablo. Mobil: kart listesi. Aynı veri, farklı düzen. */}
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[820px] text-left">
              <thead>
                <tr className="border-b border-line bg-sunken/60 text-[12px] uppercase tracking-wide text-ink-3">
                  <th scope="col" className="px-4 py-2.5 font-medium">Tarih / saat</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Müşteri</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Hizmet</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Personel</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Durum</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Tutar</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {reservations.map((r) => (
                  <tr key={r.id} className="align-top hover:bg-sunken/40">
                    <td className="px-4 py-3">
                      <p className="tnum text-[13.5px] font-medium text-navy">{dayWithWeekday(r.date)}</p>
                      <p className="tnum text-[12.5px] text-ink-3">
                        {hhmm(r.startMin)}–{hhmm(r.endMin)}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/panel/${slug}/musteriler/${r.customer.id}`}
                        className="text-[13.5px] font-medium text-navy hover:text-brand-600"
                      >
                        {r.customer.name}
                      </Link>
                      {r.customer.phone ? (
                        <p className="tnum text-[12.5px] text-ink-3">{fmtPhone(r.customer.phone)}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-[13.5px] text-navy">{r.service.name}</p>
                      <p className="text-[12.5px] text-ink-3">{duration(r.service.durationMin)}</p>
                    </td>
                    <td className="px-4 py-3 text-[13.5px] text-ink-2">{r.staff.displayName}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status as ReservationStatus} />
                      <p className="mt-1">
                        {issues.has(r.id) ? (
                          <IssueBadge issue={issues.get(r.id)!} />
                        ) : (
                          <Badge tone="neutral">{CHANNEL_LABEL[r.channel as Channel]}</Badge>
                        )}
                      </p>
                    </td>
                    <td className="tnum px-4 py-3 text-right text-[13.5px] font-medium text-navy">
                      {money(r.finalPrice)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusActions slug={slug} reservationId={r.id} status={r.status as ReservationStatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="divide-y divide-line lg:hidden">
            {reservations.map((r) => (
              <li key={r.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[14.5px] font-medium text-navy">{r.customer.name}</p>
                    <p className="text-[13px] text-ink-2">{r.service.name}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <StatusBadge status={r.status as ReservationStatus} />
                    {issues.has(r.id) ? <IssueBadge issue={issues.get(r.id)!} /> : null}
                  </div>
                </div>
                <p className="tnum mt-2 text-[13px] text-ink-3">
                  {dayWithWeekday(r.date)} · {hhmm(r.startMin)} · {r.staff.displayName}
                </p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  {r.customer.phone ? (
                    <a
                      href={`tel:${r.customer.phone}`}
                      className="tnum inline-flex items-center gap-1.5 text-[12.5px] text-brand-600"
                    >
                      <Phone size={12} aria-hidden />
                      {fmtPhone(r.customer.phone)}
                    </a>
                  ) : (
                    <span />
                  )}
                  <span className="tnum text-[14px] font-semibold text-navy">{money(r.finalPrice)}</span>
                </div>
                <div className="mt-2.5">
                  <StatusActions slug={slug} reservationId={r.id} status={r.status as ReservationStatus} />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
