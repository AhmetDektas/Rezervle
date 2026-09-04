import type { Metadata } from 'next';
import Link from 'next/link';
import { CalendarX2, ChevronRight, MapPin } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireUser } from '@/server/auth';
import { StatusBadge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { BusinessCover } from '@/components/business/cover';
import { money, relativeDay, duration } from '@/lib/format';
import { hhmm, today, nowMinutes } from '@/lib/time';
import type { ReservationStatus } from '@/lib/constants';

export const metadata: Metadata = { title: 'Randevularım' };
export const dynamic = 'force-dynamic';

type Search = Promise<{ sekme?: string }>;

export default async function MyReservationsPage({ searchParams }: { searchParams: Search }) {
  const [user, search] = await Promise.all([requireUser('/randevularim'), searchParams]);
  const tab = search.sekme === 'gecmis' ? 'gecmis' : 'yaklasan';
  const t = today();
  const nm = nowMinutes();

  const all = await prisma.reservation.findMany({
    where: { customerId: user.id },
    orderBy: [{ date: 'desc' }, { startMin: 'desc' }],
    include: {
      business: { select: { name: true, slug: true, brandHue: true, category: { select: { sector: true } } } },
      branch: { select: { name: true, district: true } },
      service: { select: { name: true, durationMin: true } },
      staff: { select: { displayName: true, hue: true } },
      review: { select: { id: true } },
    },
  });

  // "Yaklaşan": iptal edilmemiş ve zamanı geçmemiş kayıtlar.
  const isUpcoming = (r: (typeof all)[number]): boolean =>
    r.status !== 'CANCELLED' &&
    r.status !== 'COMPLETED' &&
    r.status !== 'NO_SHOW' &&
    (r.date > t || (r.date === t && r.endMin >= nm));

  const upcoming = all.filter(isUpcoming).sort((a, b) => (a.date + a.startMin).localeCompare(b.date + b.startMin));
  const past = all.filter((r) => !isUpcoming(r));
  const items = tab === 'gecmis' ? past : upcoming;

  return (
    <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6 sm:py-7">
      <h1 className="text-[22px] font-semibold tracking-[-0.02em] sm:text-[26px]">Randevularım</h1>
      <p className="mt-1 text-[14px] text-ink-3">
        Yaklaşan randevularınızı yönetin, geçmişi inceleyin.
      </p>

      <div
        className="mt-4 inline-flex rounded-xl border border-line-strong bg-sunken p-1"
        role="tablist"
        aria-label="Randevu filtresi"
      >
        <TabLink href="/randevularim" active={tab === 'yaklasan'} count={upcoming.length}>
          Yaklaşan
        </TabLink>
        <TabLink href="/randevularim?sekme=gecmis" active={tab === 'gecmis'} count={past.length}>
          Geçmiş
        </TabLink>
      </div>

      <div className="mt-5">
        {items.length === 0 ? (
          <EmptyState
            icon={<CalendarX2 size={22} />}
            title={tab === 'gecmis' ? 'Geçmiş randevunuz yok' : 'Yaklaşan randevunuz yok'}
            description={
              tab === 'gecmis'
                ? 'Tamamlanan ve iptal edilen randevularınız burada listelenir.'
                : 'Ankara’daki işletmelerden birini seçip birkaç adımda randevu oluşturabilirsiniz.'
            }
            action={
              <Button asChild>
                <Link href="/kesfet">İşletmeleri keşfet</Link>
              </Button>
            }
          />
        ) : (
          <ul className="space-y-3">
            {items.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/randevularim/${r.id}`}
                  className="card card-hover flex items-stretch gap-0 overflow-hidden"
                >
                  <BusinessCover
                    hue={r.business.brandHue}
                    sector={r.business.category.sector}
                    name={r.business.name}
                    rounded=""
                    className="w-2 shrink-0 sm:w-2.5"
                  />
                  <div className="min-w-0 flex-1 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[15px] font-semibold text-navy">{r.business.name}</p>
                        <p className="mt-0.5 truncate text-[13.5px] text-ink-2">{r.service.name}</p>
                      </div>
                      <StatusBadge status={r.status as ReservationStatus} />
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-ink-2">
                      <span className="tnum font-medium text-navy">
                        {relativeDay(r.date)} · {hhmm(r.startMin)}
                      </span>
                      <span className="tnum text-ink-3">{duration(r.service.durationMin)}</span>
                      <span className="inline-flex items-center gap-1 text-ink-3">
                        <MapPin size={13} aria-hidden />
                        {r.branch.district}
                      </span>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
                      <span className="flex items-center gap-2 text-[13px] text-ink-2">
                        <Avatar name={r.staff.displayName} size={24} hue={r.staff.hue} />
                        {r.staff.displayName}
                      </span>
                      <span className="flex items-center gap-1 text-[13px] font-semibold text-navy">
                        <span className="tnum">{money(r.finalPrice)}</span>
                        <ChevronRight size={16} className="text-ink-3" aria-hidden />
                      </span>
                    </div>

                    {r.status === 'COMPLETED' && !r.review ? (
                      <p className="mt-2.5 text-[12.5px] font-medium text-brand-600">
                        Değerlendirmenizi bekliyoruz →
                      </p>
                    ) : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function TabLink({
  href,
  active,
  count,
  children,
}: {
  href: string;
  active: boolean;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      role="tab"
      aria-selected={active}
      className={
        active
          ? 'flex min-h-[38px] items-center gap-1.5 rounded-lg bg-surface px-3.5 text-[13.5px] font-medium text-navy shadow-[0_1px_2px_rgba(11,31,58,.10)]'
          : 'flex min-h-[38px] items-center gap-1.5 rounded-lg px-3.5 text-[13.5px] font-medium text-ink-3 hover:text-navy'
      }
    >
      {children}
      <span className="tnum text-[12px] text-ink-3">{count}</span>
    </Link>
  );
}
