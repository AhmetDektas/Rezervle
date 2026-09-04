import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  CalendarDays,
  Wallet,
  Clock4,
  UserX,
  Phone,
  CalendarPlus,
  ArrowRight,
  CircleAlert,
} from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireRole, requireBusinessAccess } from '@/server/auth';
import { rangeStats, dayAgenda, utilizationStats } from '@/server/panel';
import { auditReservations } from '@/server/audit';
import { StatCard, BarRow } from '@/components/panel/stat-card';
import { StatusActions } from '@/components/panel/status-actions';
import { IssueBadge, IssueNote } from '@/components/panel/issue-badge';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { Card, CardHeader, CardBody } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { money, dayWithWeekday, duration, phone as fmtPhone, percent } from '@/lib/format';
import { hhmm, today, nowMinutes } from '@/lib/time';
import type { ReservationStatus } from '@/lib/constants';

export const metadata: Metadata = { title: 'Bugün' };
export const dynamic = 'force-dynamic';

type Params = Promise<{ slug: string }>;

export default async function PanelTodayPage({ params }: { params: Params }) {
  const [{ slug }, user] = await Promise.all([params, requireRole(['OWNER', 'STAFF', 'ADMIN'])]);
  const business = await prisma.business.findUnique({
    where: { slug },
    select: { id: true, name: true, status: true },
  });
  if (!business) notFound();
  await requireBusinessAccess(user, business.id);

  const t = today();
  const nm = nowMinutes();

  const [stats, agenda, utilization, pendingSoon] = await Promise.all([
    rangeStats(business.id, t, t),
    dayAgenda(business.id, t),
    utilizationStats(business.id, t, t),
    prisma.reservation.findMany({
      where: { businessId: business.id, status: 'PENDING', date: { gte: t } },
      orderBy: [{ date: 'asc' }, { startMin: 'asc' }],
      take: 5,
      include: {
        service: { select: { name: true } },
        customer: { select: { name: true, phone: true } },
      },
    }),
  ]);

  // Sonradan geçersizleşen randevular (saat değişikliği, yeni mola…) işaretlenir.
  const issues = await auditReservations([...agenda, ...pendingSoon]);

  const capacity = utilization.reduce((s, u) => s + u.capacityMin, 0);
  const booked = utilization.reduce((s, u) => s + u.bookedMin, 0);
  const upcomingToday = agenda.filter(
    (r) => r.endMin >= nm && !['CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(r.status),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Bugün</h1>
          <p className="mt-0.5 text-[13.5px] text-ink-3">{dayWithWeekday(t)}</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="secondary" size="sm">
            <Link href={`/panel/${slug}/takvim`}>
              <CalendarDays size={15} aria-hidden />
              Takvim
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href={`/panel/${slug}/randevular?yeni=1`}>
              <CalendarPlus size={15} aria-hidden />
              Randevu ekle
            </Link>
          </Button>
        </div>
      </div>

      {business.status !== 'APPROVED' ? (
        <div className="flex items-start gap-3 rounded-2xl border border-warn-line bg-warn-soft p-4">
          <CircleAlert size={19} className="mt-0.5 shrink-0 text-warn" aria-hidden />
          <div>
            <p className="text-[14px] font-semibold text-warn">İşletmeniz henüz yayında değil</p>
            <p className="mt-0.5 text-[13.5px] text-warn/90">
              Platform onayı tamamlanana kadar müşteriler işletmenizi göremez ve online randevu
              oluşturamaz. Panelde hazırlık yapmaya devam edebilirsiniz.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Bugünkü randevu"
          value={String(stats.total)}
          hint={`${stats.completed} tamamlandı`}
          icon={<CalendarDays size={16} />}
        />
        <StatCard
          label="Gerçekleşen ciro"
          value={money(stats.revenue)}
          hint={stats.expected > 0 ? `${money(stats.expected)} bekleyen` : 'Bekleyen yok'}
          tone="money"
          icon={<Wallet size={16} />}
        />
        <StatCard
          label="Onay bekleyen"
          value={String(stats.pending)}
          hint={stats.pending > 0 ? 'Aksiyon gerekiyor' : 'Hepsi onaylı'}
          tone={stats.pending > 0 ? 'warn' : 'neutral'}
          icon={<Clock4 size={16} />}
        />
        <StatCard
          label="Doluluk"
          value={percent(capacity > 0 ? (booked / capacity) * 100 : 0)}
          hint={`${Math.round(booked / 60)} / ${Math.round(capacity / 60)} saat`}
          icon={<UserX size={16} />}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader
            title="Günün programı"
            description={
              upcomingToday.length > 0
                ? `${upcomingToday.length} randevu kaldı`
                : 'Bugün için kalan randevu yok'
            }
            action={
              <Button asChild variant="ghost" size="sm">
                <Link href={`/panel/${slug}/takvim`}>
                  Tümü
                  <ArrowRight size={14} aria-hidden />
                </Link>
              </Button>
            }
          />
          {agenda.length === 0 ? (
            <CardBody>
              <EmptyState
                icon={<CalendarDays size={20} />}
                title="Bugün randevu yok"
                description="Takvim boş görünüyor. Telefonla gelen bir talebi panelden ekleyebilirsiniz."
                action={
                  <Button asChild size="sm">
                    <Link href={`/panel/${slug}/randevular?yeni=1`}>Randevu ekle</Link>
                  </Button>
                }
              />
            </CardBody>
          ) : (
            <ul className="divide-y divide-line">
              {agenda.map((r) => {
                const past = r.endMin < nm;
                return (
                  <li
                    key={r.id}
                    className={past && r.status !== 'COMPLETED' ? 'bg-sunken/40 p-4' : 'p-4'}
                  >
                    <div className="flex flex-wrap items-start gap-3">
                      <div className="tnum w-[52px] shrink-0">
                        <p className="text-[15px] font-semibold text-navy">{hhmm(r.startMin)}</p>
                        <p className="text-[12px] text-ink-3">{hhmm(r.endMin)}</p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[14.5px] font-medium text-navy">{r.customer.name}</p>
                          <StatusBadge status={r.status as ReservationStatus} />
                          {issues.has(r.id) ? <IssueBadge issue={issues.get(r.id)!} /> : null}
                        </div>
                        <p className="mt-0.5 text-[13.5px] text-ink-2">
                          {r.service.name} · {duration(r.service.durationMin)}
                        </p>
                        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-ink-3">
                          <span className="inline-flex items-center gap-1.5">
                            <Avatar name={r.staff.displayName} size={18} hue={r.staff.hue} />
                            {r.staff.displayName}
                          </span>
                          {r.customer.phone ? (
                            <a
                              href={`tel:${r.customer.phone}`}
                              className="inline-flex items-center gap-1 hover:text-brand-600"
                            >
                              <Phone size={12} aria-hidden />
                              {fmtPhone(r.customer.phone)}
                            </a>
                          ) : null}
                          <span className="tnum">{money(r.finalPrice)}</span>
                        </p>
                        {r.note ? (
                          <p className="mt-1.5 rounded-lg bg-sunken px-2.5 py-1.5 text-[12.5px] text-ink-2">
                            Müşteri notu: {r.note}
                          </p>
                        ) : null}
                        {issues.has(r.id) ? <IssueNote issue={issues.get(r.id)!} /> : null}
                      </div>
                      <div className="w-full sm:w-auto">
                        <StatusActions
                          slug={slug}
                          reservationId={r.id}
                          status={r.status as ReservationStatus}
                        />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Onay bekleyenler" description="Müşteri yanıt bekliyor" />
            {pendingSoon.length === 0 ? (
              <CardBody>
                <p className="text-[13.5px] text-ink-3">Bekleyen randevu yok. Her şey güncel.</p>
              </CardBody>
            ) : (
              <ul className="divide-y divide-line">
                {pendingSoon.map((r) => (
                  <li key={r.id} className="p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[14px] font-medium text-navy">{r.customer.name}</p>
                      {issues.has(r.id) ? <IssueBadge issue={issues.get(r.id)!} /> : null}
                    </div>
                    <p className="mt-0.5 text-[13px] text-ink-2">{r.service.name}</p>
                    <p className="tnum mt-0.5 text-[12.5px] text-ink-3">
                      {dayWithWeekday(r.date)} · {hhmm(r.startMin)}
                    </p>
                    {issues.has(r.id) ? <IssueNote issue={issues.get(r.id)!} /> : null}
                    <div className="mt-2">
                      <StatusActions slug={slug} reservationId={r.id} status="PENDING" />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Personel doluluğu" description="Bugün" />
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
                      max={u.capacityMin}
                      right={
                        u.capacityMin === 0
                          ? 'İzinli'
                          : `${percent((u.bookedMin / u.capacityMin) * 100)} · ${u.count} randevu`
                      }
                    />
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
