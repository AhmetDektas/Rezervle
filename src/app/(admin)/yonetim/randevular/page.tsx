import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { StatCard } from '@/components/panel/stat-card';
import { Card } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { money, dayWithWeekday, percent } from '@/lib/format';
import { hhmm, today, addDays } from '@/lib/time';
import { RESERVATION_STATUSES, type ReservationStatus } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { serviceLabel } from '@/lib/services';

export const metadata: Metadata = { title: 'Randevular' };
export const dynamic = 'force-dynamic';

type Search = Promise<{ durum?: string }>;

export default async function AdminReservationsPage({ searchParams }: { searchParams: Search }) {
  const search = await searchParams;
  const status = RESERVATION_STATUSES.includes(search.durum as ReservationStatus)
    ? (search.durum as ReservationStatus)
    : undefined;

  const t = today();
  const from = addDays(t, -29);

  const [rows, counts, revenue] = await Promise.all([
    prisma.reservation.findMany({
      where: { ...(status ? { status } : {}), date: { gte: from } },
      orderBy: [{ date: 'desc' }, { startMin: 'desc' }],
      take: 80,
      include: {
        business: { select: { name: true, slug: true } },
        service: { select: { name: true } },
        // Ek hizmetlerin varlığı listede de görünsün (bkz. serviceLabel).
        _count: { select: { services: true } },
        customer: { select: { name: true } },
        staff: { select: { displayName: true } },
      },
    }),
    prisma.reservation.groupBy({
      by: ['status'],
      where: { date: { gte: from } },
      _count: { _all: true },
    }),
    prisma.reservation.aggregate({
      where: { date: { gte: from }, status: 'COMPLETED' },
      _sum: { finalPrice: true },
    }),
  ]);

  const total = counts.reduce((s, c) => s + c._count._all, 0);
  const cancelled = counts.find((c) => c.status === 'CANCELLED')?._count._all ?? 0;
  const noShow = counts.find((c) => c.status === 'NO_SHOW')?._count._all ?? 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Randevular</h1>
        <p className="mt-0.5 text-[13.5px] text-ink-3">Son 30 gün, tüm işletmeler</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Toplam randevu" value={String(total)} />
        <StatCard label="İşlem hacmi" value={money(revenue._sum.finalPrice ?? 0)} tone="money" />
        <StatCard
          label="İptal oranı"
          value={percent(total > 0 ? (cancelled / total) * 100 : 0, 1)}
          tone={total > 0 && cancelled / total > 0.15 ? 'danger' : 'neutral'}
        />
        <StatCard
          label="Gelmeme oranı"
          value={percent(total > 0 ? (noShow / total) * 100 : 0, 1)}
          tone={total > 0 && noShow / total > 0.1 ? 'danger' : 'neutral'}
        />
      </div>

      <nav className="flex flex-wrap gap-1.5" aria-label="Durum filtresi">
        <Link
          href="/yonetim/randevular"
          className={cn(
            'flex min-h-[38px] items-center rounded-xl border px-3 text-[13px] font-medium transition',
            !status ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-line-strong bg-surface text-ink-2',
          )}
        >
          Tümü
        </Link>
        {RESERVATION_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/yonetim/randevular?durum=${s}`}
            className={cn(
              'flex min-h-[38px] items-center gap-1.5 rounded-xl border px-3 text-[13px] font-medium transition',
              status === s
                ? 'border-brand-500 bg-brand-50 text-brand-700'
                : 'border-line-strong bg-surface text-ink-2 hover:text-navy',
            )}
          >
            <StatusBadge status={s} />
            <span className="tnum text-ink-3">
              {counts.find((c) => c.status === s)?._count._all ?? 0}
            </span>
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <EmptyState title="Kayıt yok" description="Bu filtreye uyan randevu bulunmuyor." />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead>
                <tr className="border-b border-line bg-sunken/60 text-[12px] uppercase tracking-wide text-ink-3">
                  <th scope="col" className="px-4 py-2.5 font-medium">Tarih</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">İşletme</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Müşteri</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Hizmet</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Durum</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Tutar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-sunken/40">
                    <td className="tnum whitespace-nowrap px-4 py-3 text-[13px] text-ink-2">
                      {dayWithWeekday(r.date)} · {hhmm(r.startMin)}
                    </td>
                    <td className="px-4 py-3 text-[13.5px]">
                      <Link href={`/isletme/${r.business.slug}`} target="_blank" className="text-navy hover:text-brand-600">
                        {r.business.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[13.5px] text-ink-2">{r.customer.name}</td>
                    <td className="px-4 py-3 text-[13.5px] text-ink-2">
                      {serviceLabel(r.service.name, r._count.services)}
                      <span className="block text-[12px] text-ink-3">{r.staff.displayName}</span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status as ReservationStatus} />
                    </td>
                    <td className="tnum px-4 py-3 text-right text-[13.5px] font-medium text-navy">
                      {money(r.finalPrice)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
