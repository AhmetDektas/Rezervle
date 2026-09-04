'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { CalendarSearch, Check, XCircle, Phone, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, SheetContent } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { IssueNote } from './issue-badge';
import { dayContextAction, setStatusAction, type DayContext } from '@/app/actions/panel';
import { money, duration, dayWithWeekday, phone as fmtPhone } from '@/lib/format';
import { hhmm } from '@/lib/time';
import { DEPOSIT_STATUS_LABEL, type DepositStatus } from '@/lib/deposit';
import { cn } from '@/lib/utils';
import type { ReservationStatus } from '@/lib/constants';

/**
 * Onay öncesi gün bakışı.
 *
 * Çakışma zaten oluşturma anında engellenir; bu ekran çakışmayı bulmak için
 * değil, kararı bağlamıyla vermek içindir: randevu günün neresine düşüyor,
 * öncesinde ve sonrasında ne var, arada ne kadar boşluk kalıyor.
 */
export function ApprovalReview({
  slug,
  reservationId,
}: {
  slug: string;
  reservationId: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = React.useState(false);
  // Liste sayfalarında onlarca satır var; kapalı diyalog ağacını hiç kurmuyoruz.
  // İlk tıklamadan sonra bileşen bellekte kalır, tekrar açılış anında olur.
  const [mounted, setMounted] = React.useState(false);
  const [data, setData] = React.useState<DayContext | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [pending, setPending] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setData(null);
    dayContextAction(reservationId)
      .then((result) => {
        if (cancelled) return;
        if (result.ok) setData(result.data);
        else toast.error(result.error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, reservationId, toast]);

  async function decide(status: 'CONFIRMED' | 'CANCELLED') {
    setPending(status);
    const result = await setStatusAction(slug, { reservationId, status });
    setPending(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(status === 'CONFIRMED' ? 'Randevu onaylandı' : 'Randevu iptal edildi');
    setOpen(false);
    router.refresh();
  }

  const target = data?.items.find((i) => i.isTarget) ?? null;
  const index = data && target ? data.items.indexOf(target) : -1;
  const before = data && index > 0 ? data.items[index - 1]! : null;
  const after = data && index >= 0 && index < data.items.length - 1 ? data.items[index + 1]! : null;

  return (
    <>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => {
          setMounted(true);
          setOpen(true);
        }}
      >
        <CalendarSearch size={15} aria-hidden />
        Takvimde gör
      </Button>

      {!mounted ? null : (
      <Dialog open={open} onOpenChange={setOpen}>
        <SheetContent
          title="Onay öncesi gün bakışı"
          description={data ? `${dayWithWeekday(data.date)} · ${data.staffName}` : 'Yükleniyor…'}
        >
          {loading || !data ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="card p-4">
                <p className="text-[15px] font-semibold text-navy">{data.customerName}</p>
                <p className="mt-0.5 text-[13.5px] text-ink-2">
                  {data.serviceName} · {data.branchName}
                </p>
                {target ? (
                  <p className="tnum mt-1 text-[13.5px] font-medium text-navy">
                    {hhmm(target.startMin)}–{hhmm(target.endMin)} (
                    {duration(target.endMin - target.startMin)})
                  </p>
                ) : null}
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <span className="tnum text-[14px] font-semibold text-navy">
                    {money(data.price)}
                  </span>
                  {data.depositAmount > 0 ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-success-line bg-success-soft px-2.5 py-0.5 text-[12px] font-medium text-success">
                      <ShieldCheck size={12} aria-hidden />
                      {money(data.depositAmount)} ·{' '}
                      {DEPOSIT_STATUS_LABEL[data.depositStatus as DepositStatus]}
                    </span>
                  ) : null}
                  {data.customerPhone ? (
                    <a
                      href={`tel:${data.customerPhone}`}
                      className="tnum inline-flex items-center gap-1.5 text-[13px] text-brand-600 hover:underline"
                    >
                      <Phone size={13} aria-hidden />
                      {fmtPhone(data.customerPhone)}
                    </a>
                  ) : null}
                </div>
              </div>

              {data.issue ? <IssueNote issue={data.issue} /> : null}

              <div className="rounded-xl border border-line bg-sunken/60 px-3.5 py-3 text-[13px] text-ink-2">
                {before ? (
                  <p>
                    Önceki randevu <span className="tnum font-medium">{hhmm(before.endMin)}</span>{' '}
                    bitiyor
                    {target ? (
                      <>
                        {' · '}
                        <span className="tnum font-medium">
                          {target.startMin - before.blockEnd} dk
                        </span>{' '}
                        boşluk
                      </>
                    ) : null}
                  </p>
                ) : (
                  <p>Bu, günün ilk randevusu.</p>
                )}
                {after && target ? (
                  <p className="mt-1">
                    Sonraki randevu <span className="tnum font-medium">{hhmm(after.startMin)}</span>{' '}
                    başlıyor ·{' '}
                    <span className="tnum font-medium">{after.startMin - target.blockEnd} dk</span>{' '}
                    boşluk
                  </p>
                ) : (
                  <p className="mt-1">Sonrasında başka randevu yok.</p>
                )}
              </div>

              <div>
                <p className="mb-2 text-[13px] font-medium text-ink-2">
                  {dayWithWeekday(data.date)} programı ({data.items.length} randevu)
                </p>
                <ul className="space-y-1.5">
                  {data.items.map((item) => (
                    <li
                      key={item.id}
                      className={cn(
                        'flex items-center gap-3 rounded-xl border px-3 py-2.5',
                        item.isTarget
                          ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-200'
                          : 'border-line bg-surface',
                      )}
                    >
                      <span className="tnum w-[46px] shrink-0 text-[13px] font-semibold text-navy">
                        {hhmm(item.startMin)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-medium text-navy">
                          {item.customerName}
                          {item.isTarget ? (
                            <span className="ml-1.5 text-[11.5px] font-semibold text-brand-600">
                              ← onaylanacak
                            </span>
                          ) : null}
                        </span>
                        <span className="block truncate text-[12px] text-ink-3">
                          {item.serviceName} · {hhmm(item.endMin)} bitiş
                        </span>
                      </span>
                      <StatusBadge status={item.status as ReservationStatus} />
                    </li>
                  ))}
                </ul>
              </div>

              <div className="sticky bottom-0 -mx-5 flex gap-2 border-t border-line bg-surface px-5 pb-1 pt-3">
                <Button
                  full
                  loading={pending === 'CONFIRMED'}
                  onClick={() => decide('CONFIRMED')}
                >
                  <Check size={16} aria-hidden />
                  Onayla
                </Button>
                <Button
                  variant="dangerGhost"
                  loading={pending === 'CANCELLED'}
                  onClick={() => decide('CANCELLED')}
                >
                  <XCircle size={16} aria-hidden />
                  Reddet
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Dialog>
      )}
    </>
  );
}
