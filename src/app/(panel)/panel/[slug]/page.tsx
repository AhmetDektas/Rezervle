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
} from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireRole, requireBusinessAccess } from '@/server/auth';
import { rangeStats, dayAgenda, utilizationStats } from '@/server/panel';
import { auditReservations } from '@/server/audit';
import { activationChecklist } from '@/server/activation';
import { ActivationChecklist } from '@/components/panel/activation-checklist';
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
import { serviceLabel } from '@/lib/services';

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

  const [kurulum, stats, agenda, utilization, pendingSoon, pendingLater] = await Promise.all([
    activationChecklist(business.id, slug),
    rangeStats(business.id, t, t),
    dayAgenda(business.id, t),
    utilizationStats(business.id, t, t),
    prisma.reservation.findMany({
      where: { businessId: business.id, status: 'PENDING', date: { gte: t } },
      orderBy: [{ date: 'asc' }, { startMin: 'asc' }],
      take: 5,
      include: {
        service: { select: { name: true } },
        // Ek hizmetlerin varlığı listede de görünsün (bkz. serviceLabel).
        _count: { select: { services: true } },
        customer: { select: { name: true, phone: true } },
      },
    }),
    // Üstteki kutu yalnızca bugünü sayar, yandaki liste bugün ve sonrasını
    // gösterir. İkisi yan yana durduğu için "0 · Hepsi onaylı" yazarken beş
    // kişilik onay listesi göstermek çelişki yaratıyordu; ipucunda ileri
    // tarihli bekleyenlerin sayısını da söylüyoruz.
    prisma.reservation.count({
      where: { businessId: business.id, status: 'PENDING', date: { gt: t } },
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

      {/* Başvuru formu kısa tutuldu (S11-2); bedeli onaydan sonra boş panel.
          Liste o bedeli ödüyor ve tamamlanınca kendiliğinden kayboluyor. */}
      <ActivationChecklist liste={kurulum} />

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
          label="Bugün onay bekleyen"
          value={String(stats.pending)}
          hint={
            stats.pending > 0
              ? 'Aksiyon gerekiyor'
              : pendingLater > 0
                ? `${pendingLater} ileri tarihli bekliyor`
                : 'Hepsi onaylı'
          }
          tone={stats.pending > 0 || pendingLater > 0 ? 'warn' : 'neutral'}
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
                      {/*
                        Aksiyon grubu aynı satırda duruyor ve içerik `flex-1`
                        olduğu için tüm genişliği ona bırakıyordu: dört düğmede
                        içerik 181 px'e, onay bekleyen satırlarda beş düğme
                        çıktığı için 54 px'e düşüyordu. O satırda müşteri adı,
                        hizmet ve telefon üçer dört satıra sarıyor, satır
                        yüksekliği 127 px'ten 357 px'e çıkıyordu.

                        Alt sınır koyunca düğmeler sığmadığında kendi satırına
                        iniyor; içerik tek satırda okunuyor ve satır yüksekliği
                        aşağı yukarı aynı kalıyor. Mobilde aksiyonlar zaten
                        `w-full`, o yüzden kısıt sm'den itibaren.
                      */}
                      <div className="min-w-0 flex-1 sm:min-w-[260px]">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[14.5px] font-medium text-navy">{r.customer.name}</p>
                          <StatusBadge status={r.status as ReservationStatus} />
                          {issues.has(r.id) ? <IssueBadge issue={issues.get(r.id)!} /> : null}
                        </div>
                        <p className="mt-0.5 text-[13.5px] text-ink-2">
                          {serviceLabel(r.service.name, r._count.services)} · {duration(r.service.durationMin)}
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
                    <p className="mt-0.5 text-[13px] text-ink-2">
                      {serviceLabel(r.service.name, r._count.services)}
                    </p>
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
