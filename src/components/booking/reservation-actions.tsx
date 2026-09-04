'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { CalendarClock, XCircle, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm';
import { Field, Textarea } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { RatingInput } from '@/components/ui/rating';
import { useToast } from '@/components/ui/toast';
import { cancelBookingAction, rescheduleBookingAction, slotsAction } from '@/app/actions/booking';
import { submitReviewAction } from '@/app/actions/customer';
import { relativeDay, weekdayShort } from '@/lib/format';
import { hhmm, today, addDays } from '@/lib/time';
import { cn } from '@/lib/utils';
import type { Slot } from '@/lib/availability';

export type ReservationActionsProps = {
  reservationId: string;
  branchId: string;
  serviceId: string;
  staffId: string;
  canModify: boolean;
  canReview: boolean;
  cutoffNote: string | null;
};

export function ReservationActions({
  reservationId,
  branchId,
  serviceId,
  staffId,
  canModify,
  canReview,
  cutoffNote,
}: ReservationActionsProps) {
  const router = useRouter();
  const toast = useToast();

  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [moveOpen, setMoveOpen] = React.useState(false);
  const [reviewOpen, setReviewOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  const [date, setDate] = React.useState(today());
  const [startMin, setStartMin] = React.useState<number | null>(null);
  const [slots, setSlots] = React.useState<Slot[] | null>(null);
  const [loadingSlots, setLoadingSlots] = React.useState(false);

  const [rating, setRating] = React.useState(5);
  const [comment, setComment] = React.useState('');

  const dates = React.useMemo(() => Array.from({ length: 14 }, (_, i) => addDays(today(), i)), []);

  React.useEffect(() => {
    if (!moveOpen) return;
    let cancelled = false;
    setLoadingSlots(true);
    setSlots(null);
    slotsAction({ branchId, serviceId, staffId, date, excludeReservationId: reservationId })
      .then((result) => {
        if (cancelled) return;
        setSlots(result.ok ? result.data : []);
        setStartMin(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false);
      });
    return () => {
      cancelled = true;
    };
  }, [moveOpen, date, branchId, serviceId, staffId, reservationId]);

  async function cancel() {
    setPending(true);
    const result = await cancelBookingAction(reservationId);
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setCancelOpen(false);
    toast.success('Randevunuz iptal edildi');
    router.refresh();
  }

  async function move() {
    if (startMin === null) return;
    setPending(true);
    const result = await rescheduleBookingAction({ reservationId, date, startMin });
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setMoveOpen(false);
    toast.success('Randevunuz ertelendi', `${relativeDay(date)} ${hhmm(startMin)}`);
    router.refresh();
  }

  async function review() {
    setPending(true);
    const result = await submitReviewAction({ reservationId, rating, comment });
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setReviewOpen(false);
    toast.success('Değerlendirmeniz için teşekkürler');
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {canModify ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <Button variant="secondary" onClick={() => setMoveOpen(true)}>
            <CalendarClock size={17} aria-hidden />
            Ertele
          </Button>
          <Button variant="dangerGhost" onClick={() => setCancelOpen(true)}>
            <XCircle size={17} aria-hidden />
            İptal et
          </Button>
        </div>
      ) : cutoffNote ? (
        <p className="rounded-xl border border-line bg-sunken px-3.5 py-3 text-[13px] text-ink-3">
          {cutoffNote}
        </p>
      ) : null}

      {canReview ? (
        <Button variant="primary" full onClick={() => setReviewOpen(true)}>
          <Star size={17} aria-hidden />
          Değerlendir
        </Button>
      ) : null}

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Randevuyu iptal edelim mi?"
        description="Bu işlem geri alınamaz. Saat yeniden satışa açılır."
        confirmLabel="Evet, iptal et"
        cancelLabel="Vazgeç"
        loading={pending}
        onConfirm={cancel}
      />

      <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
        <DialogContent title="Randevuyu ertele" description="Yeni tarih ve saati seçin">
          <ul className="rail" role="listbox" aria-label="Tarih">
            {dates.map((d) => {
              const active = d === date;
              return (
                <li key={d} className="shrink-0 snap-start">
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => setDate(d)}
                    className={cn(
                      'flex h-[64px] w-[58px] flex-col items-center justify-center rounded-xl border text-center transition',
                      active
                        ? 'border-brand-500 bg-brand-500 text-white'
                        : 'border-line bg-surface text-ink-2 hover:border-brand-300',
                    )}
                  >
                    <span className={cn('text-[11px]', active ? 'text-white/80' : 'text-ink-3')}>
                      {weekdayShort(d)}
                    </span>
                    <span className="tnum text-[18px] font-semibold leading-tight">
                      {Number(d.slice(8, 10))}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="mt-4">
            {loadingSlots ? (
              <div className="grid grid-cols-4 gap-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-11 rounded-xl" />
                ))}
              </div>
            ) : slots && slots.length > 0 ? (
              <ul className="grid grid-cols-4 gap-2">
                {slots.map((s) => (
                  <li key={s.startMin}>
                    <button
                      type="button"
                      onClick={() => setStartMin(s.startMin)}
                      aria-pressed={startMin === s.startMin}
                      className={cn(
                        'tnum h-11 w-full rounded-xl border text-[13.5px] font-medium transition',
                        startMin === s.startMin
                          ? 'border-brand-500 bg-brand-500 text-white'
                          : 'border-line bg-surface text-navy hover:border-brand-300',
                      )}
                    >
                      {hhmm(s.startMin)}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title="Bu gün için uygun saat yok"
                description="Başka bir gün seçmeyi deneyin."
              />
            )}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary" type="button">
                Vazgeç
              </Button>
            </DialogClose>
            <Button onClick={move} disabled={startMin === null} loading={pending} type="button">
              Yeni saate taşı
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent
          title="Deneyiminizi değerlendirin"
          description="Yorumunuz işletme sayfasında yayınlanır."
          size="sm"
        >
          <div className="space-y-4">
            <div>
              <p className="text-[13px] font-medium text-ink-2">Puanınız</p>
              <div className="mt-1.5">
                <RatingInput value={rating} onChange={setRating} />
              </div>
            </div>
            <Field label="Yorumunuz (isteğe bağlı)" htmlFor="review-comment">
              <Textarea
                id="review-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                maxLength={600}
                placeholder="Nasıl bir deneyim yaşadınız?"
              />
            </Field>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary" type="button">
                Vazgeç
              </Button>
            </DialogClose>
            <Button onClick={review} loading={pending} type="button">
              Gönder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
