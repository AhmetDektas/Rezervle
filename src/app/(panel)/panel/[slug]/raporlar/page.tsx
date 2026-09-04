import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CalendarCheck2, Wallet, UserX, XCircle, ShieldCheck } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireRole, requireBusinessAccess } from '@/server/auth';
import { rangeStats, utilizationStats, topServices, settlementStats } from '@/server/panel';
import { StatCard, BarRow } from '@/components/panel/stat-card';
import { Card, CardHeader, CardBody } from '@/components/ui/card';
import { money, percent, shortDate, longDate, duration } from '@/lib/format';
import { today, addDays, startOfMonth } from '@/lib/time';
import { CHANNEL_LABEL, ACTIVE_STATUSES, type Channel } from '@/lib/constants';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Raporlar' };
export const dynamic = 'force-dynamic';

type Params = Promise<{ slug: string }>;
type Search = Promise<{ aralik?: string }>;

const RANGES = [
  { key: '7', label: 'Son 7 gün' },
  { key: '30', label: 'Son 30 gün' },
  { key: '90', label: 'Son 90 gün' },
  { key: 'ay', label: 'Bu ay' },
];

function resolveRange(key: string | undefined): { from: string; to: string; label: string } {
  const t = today();
  if (key === 'ay') return { from: startOfMonth(t), to: t, label: 'Bu ay' };
  if (key === '7') return { from: addDays(t, -6), to: t, label: 'Son 7 gün' };
  if (key === '90') return { from: addDays(t, -89), to: t, label: 'Son 90 gün' };
  return { from: addDays(t, -29), to: t, label: 'Son 30 gün' };
}

export default async function ReportsPage({
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
    select: { id: true, depositAddon: true, depositEnabled: true, commissionRate: true },
  });
  if (!business) notFound();
  await requireBusinessAccess(user, business.id);

  const active = search.aralik ?? '30';
  const { from, to, label } = resolveRange(active);

  const [stats, utilization, services, channels, daily, settlement] = await Promise.all([
    rangeStats(business.id, from, to),
    utilizationStats(business.id, from, to),
    topServices(business.id, from, to),
    prisma.reservation.groupBy({
      by: ['channel'],
      where: { businessId: business.id, date: { gte: from, lte: to } },
      _count: { _all: true },
    }),
    prisma.reservation.findMany({
      where: { businessId: business.id, date: { gte: from, lte: to }, status: { in: [...ACTIVE_STATUSES] } },
      select: { date: true, finalPrice: true, status: true },
    }),
    settlementStats(business.id, from, to),
  ]);

  // Günlük ciro serisi (grafik için).
  const byDay = new Map<string, number>();
  for (let d = from; d <= to; d = addDays(d, 1)) byDay.set(d, 0);
  for (const r of daily) {
    if (r.status !== 'COMPLETED') continue;
    byDay.set(r.date, (byDay.get(r.date) ?? 0) + r.finalPrice);
  }
  const series = [...byDay.entries()];
  const maxDay = Math.max(1, ...series.map(([, v]) => v));

  const cancelRate = stats.total > 0 ? (stats.cancelled / stats.total) * 100 : 0;
  const noShowRate = stats.total > 0 ? (stats.noShow / stats.total) * 100 : 0;
  const capacity = utilization.reduce((s, u) => s + u.capacityMin, 0);
  const booked = utilization.reduce((s, u) => s + u.bookedMin, 0);
  const totalChannel = channels.reduce((s, c) => s + c._count._all, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Raporlar</h1>
          <p className="mt-0.5 text-[13.5px] text-ink-3">
            {longDate(from)} – {longDate(to)}
          </p>
        </div>
        <nav className="flex rounded-xl border border-line-strong bg-sunken p-1" aria-label="Tarih aralığı">
          {RANGES.map((r) => (
            <Link
              key={r.key}
              href={`/panel/${slug}/raporlar?aralik=${r.key}`}
              aria-current={active === r.key ? 'page' : undefined}
              className={cn(
                'flex min-h-[36px] items-center rounded-lg px-3 text-[13px] font-medium transition',
                active === r.key
                  ? 'bg-surface text-navy shadow-[0_1px_2px_rgba(11,31,58,.10)]'
                  : 'text-ink-3 hover:text-navy',
              )}
            >
              {r.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Toplam randevu"
          value={String(stats.total)}
          hint={`${stats.completed} tamamlandı`}
          icon={<CalendarCheck2 size={16} />}
        />
        <StatCard
          label="Gerçekleşen ciro"
          value={money(stats.revenue)}
          hint={stats.completed > 0 ? `Ortalama ${money(Math.round(stats.revenue / stats.completed))}` : 'Henüz yok'}
          tone="money"
          icon={<Wallet size={16} />}
        />
        <StatCard
          label="İptal oranı"
          value={percent(cancelRate, 1)}
          hint={`${stats.cancelled} iptal`}
          tone={cancelRate > 15 ? 'danger' : 'neutral'}
          icon={<XCircle size={16} />}
        />
        <StatCard
          label="Gelmeme oranı"
          value={percent(noShowRate, 1)}
          hint={`${stats.noShow} randevu`}
          tone={noShowRate > 10 ? 'danger' : 'neutral'}
          icon={<UserX size={16} />}
        />
      </div>

      {business.depositAddon ? (
        <Card>
          <CardHeader
            title="Kapora ve hak ediş"
            description={`Uygulamadan tahsil edilen ${money(settlement.captured)} · platform komisyonu %${business.commissionRate}`}
          />
          <CardBody>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard
                label="Hesabınıza geçen"
                value={money(settlement.released)}
                hint="Komisyon düşülmüş net"
                tone="money"
                icon={<ShieldCheck size={16} />}
              />
              <StatCard
                label="Bloke bekleyen"
                value={money(settlement.held)}
                hint="Randevu sonuçlanınca aktarılır"
                icon={<ShieldCheck size={16} />}
              />
              <StatCard
                label="Platform komisyonu"
                value={money(settlement.commission)}
                hint={`Tahsilatın %${business.commissionRate}'u`}
              />
              <StatCard
                label="Müşteriye iade"
                value={money(settlement.refunded)}
                hint="Zamanında iptaller · komisyon alınmaz"
                tone={settlement.refunded > 0 ? 'warn' : 'neutral'}
              />
            </div>
            <p className="mt-3 text-[12.5px] leading-relaxed text-ink-3">
              Kapora ödeme kuruluşunda tutulur; randevu tamamlandığında, gelinmediğinde
              veya geç iptal edildiğinde komisyon düşülerek hesabınıza aktarılır. Zamanında
              iptal edilen randevularda tahsilatın tamamı müşteriye döner ve komisyon alınmaz.
            </p>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title="Günlük ciro"
          description={`${label} · toplam ${money(stats.revenue)}`}
        />
        <CardBody>
          {stats.revenue === 0 ? (
            <p className="py-6 text-center text-[13.5px] text-ink-3">
              Bu aralıkta tamamlanmış randevu yok.
            </p>
          ) : (
            <>
              <div className="flex h-[160px] items-end gap-[3px]" role="img" aria-label="Günlük ciro grafiği">
                {series.map(([date, value]) => (
                  <div
                    key={date}
                    className="group relative flex-1 rounded-t-sm bg-brand-500/85 transition hover:bg-brand-600"
                    style={{ height: `${Math.max(2, (value / maxDay) * 100)}%` }}
                    title={`${longDate(date)}: ${money(value)}`}
                  />
                ))}
              </div>
              <div className="mt-2 flex justify-between text-[11.5px] text-ink-3">
                <span>{shortDate(from)}</span>
                <span className="tnum">En yüksek gün: {money(maxDay)}</span>
                <span>{shortDate(to)}</span>
              </div>
            </>
          )}
        </CardBody>
      </Card>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader title="En çok tercih edilen hizmetler" />
          <CardBody>
            {services.length === 0 ? (
              <p className="text-[13.5px] text-ink-3">Veri yok.</p>
            ) : (
              <ul className="divide-y divide-line">
                {services.map((s) => (
                  <BarRow
                    key={s.id}
                    label={s.name}
                    value={s.count}
                    max={services[0]?.count ?? 1}
                    right={`${s.count} · ${money(s.revenue)}`}
                  />
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Personel doluluğu"
            description={`Genel: ${percent(capacity > 0 ? (booked / capacity) * 100 : 0)}`}
          />
          <CardBody>
            {utilization.length === 0 ? (
              <p className="text-[13.5px] text-ink-3">Aktif personel yok.</p>
            ) : (
              <ul className="divide-y divide-line">
                {utilization.map((u) => (
                  <BarRow
                    key={u.staffId}
                    label={u.name}
                    value={u.bookedMin}
                    max={Math.max(1, u.capacityMin)}
                    right={`${percent(u.capacityMin > 0 ? (u.bookedMin / u.capacityMin) * 100 : 0)} · ${duration(u.bookedMin)}`}
                    tone="success"
                  />
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Randevu kanalları" description="Nereden geldi?" />
          <CardBody>
            {totalChannel === 0 ? (
              <p className="text-[13.5px] text-ink-3">Veri yok.</p>
            ) : (
              <ul className="divide-y divide-line">
                {channels
                  .sort((a, b) => b._count._all - a._count._all)
                  .map((c) => (
                    <BarRow
                      key={c.channel}
                      label={CHANNEL_LABEL[c.channel as Channel] ?? c.channel}
                      value={c._count._all}
                      max={totalChannel}
                      right={`${c._count._all} · ${percent((c._count._all / totalChannel) * 100)}`}
                    />
                  ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
