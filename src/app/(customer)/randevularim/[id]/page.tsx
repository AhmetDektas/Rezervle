import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ChevronLeft,
  MapPin,
  Phone,
  CheckCircle2,
  Wallet,
  StickyNote,
  History,
} from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireUser } from '@/server/auth';
import { customerCanModify } from '@/server/reservations';
import { StatusBadge, Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { Rating, ReviewStars } from '@/components/ui/rating';
import { ReservationActions } from '@/components/booking/reservation-actions';
import { money, duration, dayWithWeekday, phone as fmtPhone, ago } from '@/lib/format';
import { hhmm } from '@/lib/time';
import { DEPOSIT_STATUS_LABEL, type DepositStatus } from '@/lib/deposit';
import {
  RESERVATION_STATUS_LABEL,
  RESERVATION_STATUS_MEANING,
  CHANNEL_LABEL,
  type ReservationStatus,
  type Channel,
} from '@/lib/constants';

export const metadata: Metadata = { title: 'Randevu detayı' };
export const dynamic = 'force-dynamic';

type Params = Promise<{ id: string }>;
type Search = Promise<{ yeni?: string }>;

export default async function ReservationDetailPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const [{ id }, search, user] = await Promise.all([
    params,
    searchParams,
    requireUser('/randevularim'),
  ]);

  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: {
      business: { select: { name: true, slug: true, phone: true, ratingAvg: true, ratingCount: true } },
      branch: true,
      service: true,
      staff: { select: { displayName: true, title: true, hue: true } },
      payment: true,
      review: true,
      history: { orderBy: { createdAt: 'asc' } },
    },
  });

  // Yetki: yalnızca randevunun sahibi görebilir (yönetici hariç).
  if (!reservation || (reservation.customerId !== user.id && user.role !== 'ADMIN')) notFound();

  const status = reservation.status as ReservationStatus;
  const modifiable = customerCanModify(reservation);
  const isNew = search.yeni === '1';

  const cutoffNote =
    status === 'PENDING' || status === 'CONFIRMED'
      ? 'Randevunuza 2 saatten az kaldı. Değişiklik için lütfen işletmeyi arayın.'
      : status === 'CANCELLED'
        ? 'Bu randevu iptal edildi.'
        : status === 'COMPLETED'
          ? 'Bu randevu tamamlandı.'
          : status === 'NO_SHOW'
            ? 'Randevuya gelinmediği işaretlendi.'
            : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6 sm:py-7">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/randevularim">
          <ChevronLeft size={17} aria-hidden />
          Randevularım
        </Link>
      </Button>

      {isNew ? (
        <div className="mt-3 flex items-start gap-3 rounded-2xl border border-success-line bg-success-soft p-4">
          <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-success" aria-hidden />
          <div>
            <p className="text-[14.5px] font-semibold text-success">Randevunuz oluşturuldu</p>
            <p className="mt-0.5 text-[13.5px] text-success/90">
              Randevu kodunuz <span className="font-mono font-semibold">{reservation.code}</span>.
              İşletme onayladığında bildirim alacaksınız.
            </p>
          </div>
        </div>
      ) : null}

      <div className="card mt-4 overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line p-4 sm:p-5">
          <div className="min-w-0">
            <Link
              href={`/isletme/${reservation.business.slug}`}
              className="text-[18px] font-semibold text-navy hover:text-brand-700"
            >
              {reservation.business.name}
            </Link>
            <p className="mt-0.5 text-[14px] text-ink-2">{reservation.service.name}</p>
            {reservation.business.ratingCount > 0 ? (
              <div className="mt-1.5">
                <Rating value={reservation.business.ratingAvg} count={reservation.business.ratingCount} />
              </div>
            ) : null}
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <StatusBadge status={status} />
            <span className="font-mono text-[12px] text-ink-3">{reservation.code}</span>
          </div>
        </div>

        <div
          className={
            status === 'CANCELLED' || status === 'NO_SHOW'
              ? 'border-b border-line bg-danger-soft/50 px-4 py-3 sm:px-5'
              : status === 'PENDING'
                ? 'border-b border-line bg-warn-soft/50 px-4 py-3 sm:px-5'
                : 'border-b border-line bg-success-soft/50 px-4 py-3 sm:px-5'
          }
        >
          <p
            className={
              status === 'CANCELLED' || status === 'NO_SHOW'
                ? 'text-[13.5px] leading-relaxed text-danger'
                : status === 'PENDING'
                  ? 'text-[13.5px] leading-relaxed text-warn'
                  : 'text-[13.5px] leading-relaxed text-success'
            }
          >
            {RESERVATION_STATUS_MEANING[status]}
          </p>
        </div>

        <dl className="divide-y divide-line">
          <Row label="Tarih">
            <span className="tnum">{dayWithWeekday(reservation.date)}</span>
          </Row>
          <Row label="Saat">
            <span className="tnum">
              {hhmm(reservation.startMin)} – {hhmm(reservation.endMin)}
            </span>
            <span className="ml-2 text-[13px] font-normal text-ink-3">
              ({duration(reservation.service.durationMin)})
            </span>
          </Row>
          <Row label="Personel">
            <span className="inline-flex items-center gap-2">
              <Avatar name={reservation.staff.displayName} size={24} hue={reservation.staff.hue} />
              {reservation.staff.displayName}
            </span>
          </Row>
          <Row label="Şube">
            <div className="text-right">
              <p>{reservation.branch.name}</p>
              <p className="mt-0.5 inline-flex items-center gap-1 text-[13px] font-normal text-ink-3">
                <MapPin size={13} aria-hidden />
                {reservation.branch.address}
              </p>
            </div>
          </Row>
          <Row label="Kanal">
            <Badge tone="neutral">{CHANNEL_LABEL[reservation.channel as Channel]}</Badge>
          </Row>
          {reservation.note ? (
            <Row label="Notunuz">
              <span className="inline-flex items-start gap-1.5 text-[13.5px] font-normal text-ink-2">
                <StickyNote size={14} className="mt-0.5 shrink-0 text-ink-3" aria-hidden />
                {reservation.note}
              </span>
            </Row>
          ) : null}
        </dl>

        <div className="border-t border-line bg-sunken/60 p-4 sm:p-5">
          <div className="flex items-center justify-between text-[14px]">
            <span className="text-ink-2">Hizmet ücreti</span>
            <span className="tnum text-navy">{money(reservation.price)}</span>
          </div>
          {reservation.discount > 0 ? (
            <div className="mt-1.5 flex items-center justify-between text-[14px]">
              <span className="text-success">Kampanya indirimi</span>
              <span className="tnum text-success">−{money(reservation.discount)}</span>
            </div>
          ) : null}
          {reservation.depositAmount > 0 ? (
            <div className="mt-1.5 flex items-center justify-between text-[14px]">
              <span className="text-ink-2">
                Kapora
                <span className="ml-1.5 text-[12.5px] text-ink-3">
                  ({DEPOSIT_STATUS_LABEL[reservation.depositStatus as DepositStatus]})
                </span>
              </span>
              <span className="tnum text-navy">{money(reservation.depositAmount)}</span>
            </div>
          ) : null}
          {reservation.depositStatus === 'PAID' ? (
            <div className="mt-1.5 flex items-center justify-between text-[14px]">
              <span className="text-ink-2">İşletmede ödenecek</span>
              <span className="tnum text-navy">
                {money(Math.max(0, reservation.finalPrice - reservation.depositAmount))}
              </span>
            </div>
          ) : null}
          <div className="mt-2.5 flex items-center justify-between border-t border-line pt-2.5">
            <span className="text-[14px] font-medium text-navy">Toplam</span>
            <span className="tnum text-[18px] font-semibold text-navy">
              {money(reservation.finalPrice)}
            </span>
          </div>
          {reservation.payment ? (
            <p className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] text-ink-3">
              <Wallet size={13} aria-hidden />
              {reservation.payment.method === 'ONLINE' ? 'Online ödeme' : 'İşletmede ödeme'} ·{' '}
              {reservation.payment.status === 'PAID'
                ? 'Ödendi'
                : reservation.payment.status === 'REFUNDED'
                  ? 'İade edildi'
                  : 'Ödeme bekleniyor'}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-4">
        <ReservationActions
          reservationId={reservation.id}
          branchId={reservation.branchId}
          serviceId={reservation.serviceId}
          staffId={reservation.staffId}
          canModify={modifiable}
          canReview={status === 'COMPLETED' && !reservation.review}
          cutoffNote={modifiable ? null : cutoffNote}
        />
      </div>

      {reservation.review ? (
        <div className="card mt-4 p-4 sm:p-5">
          <p className="text-[15px] font-semibold text-navy">Değerlendirmeniz</p>
          <div className="mt-2">
            <ReviewStars value={reservation.review.rating} size={16} />
          </div>
          {reservation.review.comment ? (
            <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{reservation.review.comment}</p>
          ) : null}
        </div>
      ) : null}

      {reservation.business.phone ? (
        <a
          href={`tel:${reservation.business.phone}`}
          className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-line-strong bg-surface py-3 text-[14px] font-medium text-navy transition hover:bg-sunken"
        >
          <Phone size={16} aria-hidden />
          İşletmeyi ara · {fmtPhone(reservation.business.phone)}
        </a>
      ) : null}

      <section className="mt-6">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold text-navy">
          <History size={16} className="text-ink-3" aria-hidden />
          Randevu geçmişi
        </h2>
        <ol className="mt-3 space-y-3 border-l border-line pl-4">
          {reservation.history.map((h) => (
            <li key={h.id} className="relative">
              <span
                className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-brand-400"
                aria-hidden
              />
              <p className="text-[13.5px] font-medium text-navy">
                {RESERVATION_STATUS_LABEL[h.toStatus as ReservationStatus]}
              </p>
              {h.note ? <p className="text-[12.5px] text-ink-3">{h.note}</p> : null}
              <p className="text-[12px] text-ink-3">{ago(h.createdAt)}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3 sm:px-5">
      <dt className="shrink-0 pt-0.5 text-[13px] text-ink-3">{label}</dt>
      <dd className="text-right text-[14px] font-medium text-navy">{children}</dd>
    </div>
  );
}
