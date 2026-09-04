'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Check, LogIn, CheckCircle2, UserX, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm';
import { useToast } from '@/components/ui/toast';
import { setStatusAction } from '@/app/actions/panel';
import { ApprovalReview } from './approval-review';
import { RESERVATION_STATUS_LABEL, type ReservationStatus } from '@/lib/constants';

/** Duruma göre bir sonraki adımlar. Sunucu da aynı geçiş tablosunu doğrular. */
const NEXT: Partial<Record<ReservationStatus, { to: ReservationStatus; label: string; icon: React.ElementType; variant: 'primary' | 'secondary' | 'success' }[]>> = {
  PENDING: [
    { to: 'CONFIRMED', label: 'Onayla', icon: Check, variant: 'primary' },
    { to: 'ARRIVED', label: 'Geldi', icon: LogIn, variant: 'secondary' },
  ],
  CONFIRMED: [
    { to: 'ARRIVED', label: 'Geldi', icon: LogIn, variant: 'primary' },
    { to: 'COMPLETED', label: 'Tamamla', icon: CheckCircle2, variant: 'secondary' },
  ],
  ARRIVED: [{ to: 'COMPLETED', label: 'Tamamla', icon: CheckCircle2, variant: 'success' }],
};

const DESTRUCTIVE: Partial<Record<ReservationStatus, { to: ReservationStatus; label: string; icon: React.ElementType }[]>> = {
  PENDING: [
    { to: 'NO_SHOW', label: 'Gelmedi', icon: UserX },
    { to: 'CANCELLED', label: 'İptal et', icon: XCircle },
  ],
  CONFIRMED: [
    { to: 'NO_SHOW', label: 'Gelmedi', icon: UserX },
    { to: 'CANCELLED', label: 'İptal et', icon: XCircle },
  ],
  ARRIVED: [{ to: 'NO_SHOW', label: 'Gelmedi', icon: UserX }],
};

export function StatusActions({
  slug,
  reservationId,
  status,
  size = 'sm',
}: {
  slug: string;
  reservationId: string;
  status: ReservationStatus;
  size?: 'sm' | 'md';
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = React.useState<ReservationStatus | null>(null);
  const [confirm, setConfirm] = React.useState<ReservationStatus | null>(null);
  // Diyalog yalnızca gerçekten gerektiğinde kurulur; liste sayfalarında satır
  // başına kapalı bir diyalog ağacı taşımak render maliyetini ikiye katlıyordu.
  const [touched, setTouched] = React.useState(false);

  async function apply(to: ReservationStatus) {
    setPending(to);
    const result = await setStatusAction(slug, { reservationId, status: to });
    setPending(null);
    setConfirm(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`Durum güncellendi: ${RESERVATION_STATUS_LABEL[to]}`);
    router.refresh();
  }

  const primary = NEXT[status] ?? [];
  const risky = DESTRUCTIVE[status] ?? [];
  if (primary.length === 0 && risky.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {/* Onay bekleyen randevularda karar öncesi günün programına bakılabilir. */}
      {status === 'PENDING' ? <ApprovalReview slug={slug} reservationId={reservationId} /> : null}
      {primary.map((a) => {
        const Icon = a.icon;
        return (
          <Button
            key={a.to}
            size={size}
            variant={a.variant}
            loading={pending === a.to}
            onClick={() => apply(a.to)}
          >
            <Icon size={15} aria-hidden />
            {a.label}
          </Button>
        );
      })}
      {risky.map((a) => {
        const Icon = a.icon;
        return (
          <Button
            key={a.to}
            size={size}
            variant="ghost"
            onClick={() => {
              setTouched(true);
              setConfirm(a.to);
            }}
          >
            <Icon size={15} aria-hidden />
            {a.label}
          </Button>
        );
      })}

      {confirm === null && !touched ? null : (
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(v) => (v ? undefined : setConfirm(null))}
        title={
          confirm === 'CANCELLED'
            ? 'Randevu iptal edilsin mi?'
            : 'Randevu "gelmedi" olarak işaretlensin mi?'
        }
        description={
          confirm === 'CANCELLED'
            ? 'Saat yeniden satışa açılır ve müşteriye bildirim gider. Bu işlem geri alınamaz.'
            : 'Müşteriye bildirim gider. Randevu saati serbest bırakılmaz.'
        }
        confirmLabel={confirm === 'CANCELLED' ? 'Evet, iptal et' : 'Evet, işaretle'}
        loading={pending !== null}
        onConfirm={() => (confirm ? apply(confirm) : undefined)}
      />
      )}
    </div>
  );
}
