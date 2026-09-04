'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Phone, StickyNote, CalendarPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/field';
import { Segmented } from '@/components/ui/segmented';
import { Dialog, SheetContent } from '@/components/ui/dialog';
import { StatusBadge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Avatar } from '@/components/ui/avatar';
import { StatusActions } from './status-actions';
import { CalendarDay, type CalEvent, type CalStaff } from './calendar-day';
import { IssueNote } from './issue-badge';
import type { ReservationIssue } from '@/server/audit';
import { DEPOSIT_STATUS_LABEL, type DepositStatus } from '@/lib/deposit';
import { money, duration, dayWithWeekday, relativeDay, phone as fmtPhone, weekdayShort } from '@/lib/format';
import { hhmm, addDays, today } from '@/lib/time';
import { CHANNEL_LABEL, termsFor, type Channel, type ReservationStatus } from '@/lib/constants';
import { cn } from '@/lib/utils';

export type CalReservation = CalEvent & {
  date: string;
  staffName: string;
  staffHue: number;
  branchName: string;
  customerPhone: string | null;
  customerId: string;
  channel: Channel;
  note: string | null;
  internalNote: string | null;
  code: string;
  /** Sonradan geçersizleşmişse nedeni; yoksa null. */
  issue: ReservationIssue | null;
  depositAmount: number;
  depositStatus: string;
};

export function CalendarView({
  slug,
  date,
  view,
  branchId,
  branches,
  staff,
  dayEvents,
  weekEvents,
  openMin,
  closeMin,
  canDrag,
  sector,
}: {
  slug: string;
  date: string;
  view: 'gun' | 'hafta' | 'ajanda';
  branchId: string;
  branches: { id: string; name: string }[];
  staff: CalStaff[];
  dayEvents: CalReservation[];
  weekEvents: CalReservation[];
  openMin: number;
  closeMin: number;
  canDrag: boolean;
  sector: string;
}) {
  const router = useRouter();
  const terms = termsFor(sector);
  const [selected, setSelected] = React.useState<string | null>(null);

  const all = React.useMemo(
    () => [...dayEvents, ...weekEvents.filter((w) => !dayEvents.some((d) => d.id === w.id))],
    [dayEvents, weekEvents],
  );
  const current = all.find((e) => e.id === selected) ?? null;

  function go(patch: { tarih?: string; gorunum?: string; sube?: string }) {
    const next = new URLSearchParams();
    next.set('tarih', patch.tarih ?? date);
    next.set('gorunum', patch.gorunum ?? view);
    next.set('sube', patch.sube ?? branchId);
    router.push(`/panel/${slug}/takvim?${next.toString()}`);
  }

  const weekStart = React.useMemo(() => {
    const wd = new Date(`${date}T00:00:00Z`).getUTCDay();
    return addDays(date, wd === 0 ? -6 : 1 - wd);
  }, [date]);
  const weekDays = React.useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const step = view === 'hafta' ? 7 : 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button variant="secondary" size="iconSm" onClick={() => go({ tarih: addDays(date, -step) })} aria-label="Önceki">
            <ChevronLeft size={17} aria-hidden />
          </Button>
          <Button variant="secondary" size="iconSm" onClick={() => go({ tarih: addDays(date, step) })} aria-label="Sonraki">
            <ChevronRight size={17} aria-hidden />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => go({ tarih: today() })}>
            Bugün
          </Button>
        </div>

        <p className="text-[15px] font-semibold text-navy">
          {view === 'hafta'
            ? `${relativeDay(weekStart)} – ${dayWithWeekday(addDays(weekStart, 6))}`
            : dayWithWeekday(date)}
        </p>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {branches.length > 1 ? (
            <Select
              aria-label="Şube"
              value={branchId}
              onChange={(e) => go({ sube: e.target.value })}
              className="h-9 w-auto min-w-[150px] text-[13px]"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          ) : null}
          <Segmented
            label="Görünüm"
            value={view}
            onChange={(v) => go({ gorunum: v })}
            options={[
              { value: 'gun', label: 'Gün' },
              { value: 'hafta', label: 'Hafta' },
              { value: 'ajanda', label: 'Ajanda' },
            ]}
          />
          <Button asChild size="sm">
            <Link href={`/panel/${slug}/randevular?yeni=1&tarih=${date}`}>
              <CalendarPlus size={15} aria-hidden />
              Ekle
            </Link>
          </Button>
        </div>
      </div>

      <div className="card overflow-hidden">
        {view === 'gun' ? (
          <CalendarDay
            date={date}
            staff={staff}
            events={dayEvents}
            openMin={openMin}
            closeMin={closeMin}
            onSelect={setSelected}
            canDrag={canDrag}
          />
        ) : view === 'hafta' ? (
          <WeekGrid days={weekDays} events={weekEvents} date={date} onSelect={setSelected} onDay={(d) => go({ tarih: d, gorunum: 'gun' })} />
        ) : (
          <AgendaList events={weekEvents} onSelect={setSelected} slug={slug} />
        )}
      </div>

      {canDrag && view === 'gun' ? (
        <p className="text-[12.5px] text-ink-3">
          İpucu: bir randevuyu tutamağından sürükleyerek başka bir saate ya da{' '}
          {terms.resource.toLocaleLowerCase('tr-TR')} sütununa taşıyabilirsiniz. Çakışan bir yere
          bırakılırsa taşıma reddedilir.
        </p>
      ) : null}

      <Dialog open={current !== null} onOpenChange={(v) => (v ? undefined : setSelected(null))}>
        {current ? (
          <SheetContent title={current.customerName} description={`${current.serviceName} · ${current.code}`}>
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <StatusBadge status={current.status} />
                <span className="tnum text-[16px] font-semibold text-navy">{money(current.price)}</span>
              </div>

              {current.issue ? <IssueNote issue={current.issue} /> : null}

              <dl className="card divide-y divide-line">
                <DetailRow label="Tarih">
                  <span className="tnum">{dayWithWeekday(current.date)}</span>
                </DetailRow>
                <DetailRow label="Saat">
                  <span className="tnum">
                    {hhmm(current.startMin)} – {hhmm(current.endMin)}
                  </span>
                </DetailRow>
                <DetailRow label="Süre">{duration(current.endMin - current.startMin)}</DetailRow>
                <DetailRow label={terms.resource}>
                  <span className="inline-flex items-center gap-2">
                    <Avatar name={current.staffName} size={22} hue={current.staffHue} />
                    {current.staffName}
                  </span>
                </DetailRow>
                <DetailRow label="Şube">{current.branchName}</DetailRow>
                <DetailRow label="Kanal">{CHANNEL_LABEL[current.channel]}</DetailRow>
                {current.depositAmount > 0 ? (
                  <DetailRow label="Kapora">
                    <span className="tnum">{money(current.depositAmount)}</span>
                    <span className="ml-1.5 text-[12.5px] font-normal text-ink-3">
                      {DEPOSIT_STATUS_LABEL[current.depositStatus as DepositStatus]}
                    </span>
                  </DetailRow>
                ) : null}
              </dl>

              {current.customerPhone ? (
                <a
                  href={`tel:${current.customerPhone}`}
                  className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-line-strong text-[14px] font-medium text-navy hover:bg-sunken"
                >
                  <Phone size={16} aria-hidden />
                  {fmtPhone(current.customerPhone)}
                </a>
              ) : null}

              {current.note ? (
                <div className="rounded-xl border border-line bg-sunken p-3.5">
                  <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-ink-3">
                    <StickyNote size={13} aria-hidden />
                    Müşteri notu
                  </p>
                  <p className="mt-1 text-[13.5px] text-ink-2">{current.note}</p>
                </div>
              ) : null}

              <div>
                <p className="mb-2 text-[13px] font-medium text-ink-2">Durum</p>
                <StatusActions slug={slug} reservationId={current.id} status={current.status} size="md" />
              </div>

              <Button asChild variant="secondary" full>
                <Link href={`/panel/${slug}/musteriler/${current.customerId}`}>Müşteri kartını aç</Link>
              </Button>
            </div>
          </SheetContent>
        ) : null}
      </Dialog>
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2.5">
      <dt className="text-[13px] text-ink-3">{label}</dt>
      <dd className="text-right text-[13.5px] font-medium text-navy">{children}</dd>
    </div>
  );
}

function WeekGrid({
  days,
  events,
  date,
  onSelect,
  onDay,
}: {
  days: string[];
  events: CalReservation[];
  date: string;
  onSelect: (id: string) => void;
  onDay: (date: string) => void;
}) {
  return (
    <div className="grid grid-cols-7 divide-x divide-line">
      {days.map((d) => {
        const dayEvents = events
          .filter((e) => e.date === d)
          .sort((a, b) => a.startMin - b.startMin);
        return (
          <div key={d} className="min-w-0">
            <button
              onClick={() => onDay(d)}
              className={cn(
                'w-full border-b border-line px-1.5 py-2 text-center transition hover:bg-sunken',
                d === date && 'bg-brand-50',
              )}
            >
              <p className="text-[11px] text-ink-3">{weekdayShort(d)}</p>
              <p className={cn('tnum text-[15px] font-semibold', d === today() ? 'text-brand-600' : 'text-navy')}>
                {Number(d.slice(8, 10))}
              </p>
              <p className="tnum text-[10.5px] text-ink-3">{dayEvents.length} randevu</p>
            </button>
            <ul className="max-h-[460px] space-y-1 overflow-y-auto p-1">
              {dayEvents.map((e) => (
                <li key={e.id}>
                  <button
                    onClick={() => onSelect(e.id)}
                    className={cn(
                      'w-full rounded-md border-l-[3px] bg-sunken px-1.5 py-1 text-left transition hover:bg-brand-50',
                      e.status === 'COMPLETED' && 'border-l-success',
                      e.status === 'PENDING' && 'border-l-warn',
                      (e.status === 'CONFIRMED' || e.status === 'ARRIVED') && 'border-l-brand-500',
                      (e.status === 'CANCELLED' || e.status === 'NO_SHOW') && 'border-l-danger opacity-70',
                    )}
                  >
                    <p className="tnum truncate text-[10.5px] font-semibold text-navy">{hhmm(e.startMin)}</p>
                    <p className="truncate text-[10.5px] text-ink-2">{e.customerName}</p>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function AgendaList({
  events,
  onSelect,
  slug,
}: {
  events: CalReservation[];
  onSelect: (id: string) => void;
  slug: string;
}) {
  const sorted = [...events].sort((a, b) =>
    a.date === b.date ? a.startMin - b.startMin : a.date.localeCompare(b.date),
  );
  if (sorted.length === 0) {
    return (
      <div className="p-6">
        <EmptyState
          title="Bu hafta randevu yok"
          description="Takvim boş. Telefonla gelen talepleri panelden ekleyebilirsiniz."
          action={
            <Button asChild size="sm">
              <Link href={`/panel/${slug}/randevular?yeni=1`}>Randevu ekle</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const groups = new Map<string, CalReservation[]>();
  for (const e of sorted) {
    const list = groups.get(e.date) ?? [];
    list.push(e);
    groups.set(e.date, list);
  }

  return (
    <div>
      {[...groups.entries()].map(([d, list]) => (
        <section key={d}>
          <h3 className="sticky top-0 border-y border-line bg-sunken px-4 py-2 text-[12.5px] font-semibold text-ink-2">
            {dayWithWeekday(d)} · {list.length} randevu
          </h3>
          <ul className="divide-y divide-line">
            {list.map((e) => (
              <li key={e.id}>
                <button
                  onClick={() => onSelect(e.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-sunken"
                >
                  <span className="tnum w-[46px] shrink-0 text-[13.5px] font-semibold text-navy">
                    {hhmm(e.startMin)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium text-navy">{e.customerName}</span>
                    <span className="block truncate text-[12.5px] text-ink-3">
                      {e.serviceName} · {e.staffName}
                    </span>
                  </span>
                  <StatusBadge status={e.status as ReservationStatus} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
