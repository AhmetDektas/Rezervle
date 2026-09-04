'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { GripVertical, AlertTriangle } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { rescheduleBookingAction } from '@/app/actions/booking';
import { hhmm } from '@/lib/time';
import { money } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { ReservationStatus } from '@/lib/constants';

export type CalEvent = {
  id: string;
  staffId: string;
  startMin: number;
  endMin: number;
  blockEnd: number;
  status: ReservationStatus;
  customerName: string;
  serviceName: string;
  price: number;
  /** Sonradan geçersizleşen randevu takvimde de işaretlenir. */
  flagged?: boolean;
};

export type CalStaff = { id: string; name: string; hue: number; startMin: number; endMin: number; closed: boolean };

const PX_PER_MIN = 1.15; // 1 saat ≈ 69px
const SNAP = 15;

/**
 * Gün görünümü: personel sütunları + saat ızgarası.
 *
 * Sürükle-bırak, bırakma anında sunucuya gider; sunucu çakışmayı reddederse
 * blok eski yerine döner. İyimser gösterim yapılır ama doğruluk sunucudadır.
 */
export function CalendarDay({
  date,
  staff,
  events,
  openMin,
  closeMin,
  onSelect,
  canDrag,
}: {
  date: string;
  staff: CalStaff[];
  events: CalEvent[];
  openMin: number;
  closeMin: number;
  onSelect: (id: string) => void;
  canDrag: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const gridRef = React.useRef<HTMLDivElement>(null);
  const [drag, setDrag] = React.useState<{
    id: string;
    staffId: string;
    startMin: number;
    duration: number;
    offsetY: number;
  } | null>(null);
  const [saving, setSaving] = React.useState<string | null>(null);

  const from = Math.floor(openMin / 60) * 60;
  const to = Math.ceil(closeMin / 60) * 60;
  const height = (to - from) * PX_PER_MIN;
  const hours = Array.from({ length: Math.max(1, (to - from) / 60 + 1) }, (_, i) => from + i * 60);

  function yToMin(clientY: number): number {
    const box = gridRef.current?.getBoundingClientRect();
    if (!box) return from;
    const raw = from + (clientY - box.top) / PX_PER_MIN;
    return Math.max(from, Math.min(to, Math.round(raw / SNAP) * SNAP));
  }

  function columnAt(clientX: number): string | null {
    const box = gridRef.current?.getBoundingClientRect();
    if (!box || staff.length === 0) return null;
    const ratio = (clientX - box.left) / box.width;
    const index = Math.floor(ratio * staff.length);
    return staff[Math.max(0, Math.min(staff.length - 1, index))]?.id ?? null;
  }

  function onPointerDown(event: React.PointerEvent, ev: CalEvent) {
    if (!canDrag || ['CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(ev.status)) return;
    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture(event.pointerId);
    const box = target.getBoundingClientRect();
    setDrag({
      id: ev.id,
      staffId: ev.staffId,
      startMin: ev.startMin,
      duration: ev.endMin - ev.startMin,
      offsetY: event.clientY - box.top,
    });
  }

  function onPointerMove(event: React.PointerEvent) {
    if (!drag) return;
    event.preventDefault();
    const start = yToMin(event.clientY - drag.offsetY);
    const staffId = columnAt(event.clientX) ?? drag.staffId;
    if (start !== drag.startMin || staffId !== drag.staffId) {
      setDrag({ ...drag, startMin: start, staffId });
    }
  }

  async function onPointerUp() {
    if (!drag) return;
    const moved = events.find((e) => e.id === drag.id);
    setDrag(null);
    if (!moved) return;
    if (moved.startMin === drag.startMin && moved.staffId === drag.staffId) return;

    setSaving(drag.id);
    const result = await rescheduleBookingAction({
      reservationId: drag.id,
      date,
      startMin: drag.startMin,
      staffId: drag.staffId,
    });
    setSaving(null);
    if (!result.ok) {
      toast.error('Taşınamadı', result.error);
      return;
    }
    toast.success('Randevu taşındı', `${hhmm(drag.startMin)}`);
    router.refresh();
  }

  if (staff.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-line-strong p-8 text-center text-[14px] text-ink-3">
        Bu şubede aktif personel yok.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[560px]">
        {/* Sütun başlıkları */}
        <div className="sticky top-0 z-10 flex border-b border-line bg-surface">
          <div className="w-[52px] shrink-0" />
          {staff.map((s) => (
            <div key={s.id} className="min-w-0 flex-1 px-2 py-2.5 text-center">
              <p className="truncate text-[13px] font-semibold text-navy">{s.name}</p>
              <p className="tnum text-[11.5px] text-ink-3">
                {s.closed ? 'Kapalı' : `${hhmm(s.startMin)}–${hhmm(s.endMin)}`}
              </p>
            </div>
          ))}
        </div>

        <div className="flex">
          {/* Saat sütunu */}
          <div className="w-[52px] shrink-0" style={{ height }}>
            {hours.map((h) => (
              <div
                key={h}
                className="tnum relative text-[11.5px] text-ink-3"
                style={{ height: 60 * PX_PER_MIN }}
              >
                <span className="absolute -top-1.5 right-2">{hhmm(h)}</span>
              </div>
            ))}
          </div>

          {/* Izgara */}
          <div
            ref={gridRef}
            className="relative flex flex-1 select-none"
            style={{ height }}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => setDrag(null)}
          >
            {hours.map((h, i) => (
              <div
                key={h}
                className="pointer-events-none absolute inset-x-0 border-t border-line"
                style={{ top: i * 60 * PX_PER_MIN }}
                aria-hidden
              />
            ))}

            {staff.map((s) => {
              const columnEvents = events.filter((e) => e.staffId === s.id);
              return (
                <div key={s.id} className="relative min-w-0 flex-1 border-l border-line">
                  {s.closed ? (
                    <div className="absolute inset-0 bg-sunken/70" aria-hidden />
                  ) : (
                    <>
                      {s.startMin > from ? (
                        <div
                          className="absolute inset-x-0 bg-sunken/70"
                          style={{ top: 0, height: (s.startMin - from) * PX_PER_MIN }}
                          aria-hidden
                        />
                      ) : null}
                      {s.endMin < to ? (
                        <div
                          className="absolute inset-x-0 bg-sunken/70"
                          style={{ top: (s.endMin - from) * PX_PER_MIN, bottom: 0 }}
                          aria-hidden
                        />
                      ) : null}
                    </>
                  )}

                  {columnEvents.map((ev) => {
                    const dragging = drag?.id === ev.id;
                    const start = dragging ? drag.startMin : ev.startMin;
                    const shownStaff = dragging ? drag.staffId : ev.staffId;
                    if (shownStaff !== s.id) return null;
                    const length = ev.endMin - ev.startMin;
                    return (
                      <Block
                        key={ev.id}
                        ev={ev}
                        top={(start - from) * PX_PER_MIN}
                        height={length * PX_PER_MIN}
                        dragging={dragging}
                        saving={saving === ev.id}
                        canDrag={canDrag}
                        onPointerDown={(e) => onPointerDown(e, ev)}
                        onSelect={() => onSelect(ev.id)}
                      />
                    );
                  })}

                  {/* Sürüklenen blok başka sütuna geçtiyse burada çizilir. */}
                  {drag && drag.staffId === s.id && !columnEvents.some((e) => e.id === drag.id)
                    ? (() => {
                        const ev = events.find((e) => e.id === drag.id);
                        if (!ev) return null;
                        return (
                          <Block
                            ev={ev}
                            top={(drag.startMin - from) * PX_PER_MIN}
                            height={drag.duration * PX_PER_MIN}
                            dragging
                            saving={false}
                            canDrag={canDrag}
                            onPointerDown={() => undefined}
                            onSelect={() => undefined}
                          />
                        );
                      })()
                    : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

const TONE: Record<ReservationStatus, string> = {
  PENDING: 'border-l-warn bg-warn-soft/70',
  CONFIRMED: 'border-l-brand-500 bg-brand-50',
  ARRIVED: 'border-l-brand-700 bg-brand-100',
  COMPLETED: 'border-l-success bg-success-soft',
  NO_SHOW: 'border-l-danger bg-danger-soft',
  CANCELLED: 'border-l-line-strong bg-sunken line-through opacity-60',
};

function Block({
  ev,
  top,
  height,
  dragging,
  saving,
  canDrag,
  onPointerDown,
  onSelect,
}: {
  ev: CalEvent;
  top: number;
  height: number;
  dragging: boolean;
  saving: boolean;
  canDrag: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onSelect: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        'absolute inset-x-0.5 overflow-hidden rounded-lg border border-line border-l-[3px] px-1.5 py-1 text-left transition-shadow',
        TONE[ev.status],
        ev.flagged && 'ring-1 ring-danger',
        dragging ? 'z-20 shadow-pop ring-2 ring-brand-400' : 'hover:shadow-card',
        saving && 'opacity-60',
      )}
      style={{ top, height: Math.max(22, height) }}
      aria-label={`${hhmm(ev.startMin)} ${ev.customerName}, ${ev.serviceName}`}
    >
      <div className="flex items-start gap-1">
        {ev.flagged ? (
          <AlertTriangle size={12} className="mt-0.5 shrink-0 text-danger" aria-label="Dikkat" />
        ) : null}
        {canDrag ? (
          <span
            onPointerDown={onPointerDown}
            className="mt-0.5 shrink-0 cursor-grab touch-none text-ink-3 active:cursor-grabbing"
            aria-hidden
          >
            <GripVertical size={12} />
          </span>
        ) : null}
        <div className="min-w-0">
          <p className="tnum truncate text-[11px] font-semibold text-navy">
            {hhmm(ev.startMin)} {ev.customerName}
          </p>
          {height > 34 ? (
            <p className="truncate text-[10.5px] text-ink-2">{ev.serviceName}</p>
          ) : null}
          {height > 56 ? (
            <p className="tnum truncate text-[10.5px] text-ink-3">{money(ev.price)}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
