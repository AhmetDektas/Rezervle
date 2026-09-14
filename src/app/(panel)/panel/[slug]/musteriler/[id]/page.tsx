import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, Phone, Mail, StickyNote } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireRole, requireBusinessAccess } from '@/server/auth';
import { CustomerNoteForm, CustomerTags } from '@/components/panel/customer-notes';
import { StatusBadge } from '@/components/ui/badge';
import { Card, CardHeader, CardBody } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { StatCard } from '@/components/panel/stat-card';
import { money, dayWithWeekday, phone as fmtPhone, ago, relativeDay } from '@/lib/format';
import { hhmm, today } from '@/lib/time';
import type { ReservationStatus } from '@/lib/constants';
import { serviceLabel } from '@/lib/services';

export const metadata: Metadata = { title: 'Müşteri kartı' };
export const dynamic = 'force-dynamic';

/** Geçmiş listesinde gösterilen kayıt sayısı; toplamlar bundan bağımsız. */
const LISTE_ADEDI = 40;

type Params = Promise<{ slug: string; id: string }>;

export default async function CustomerDetailPage({ params }: { params: Params }) {
  const [{ slug, id }, user] = await Promise.all([params, requireRole(['OWNER', 'STAFF', 'ADMIN'])]);
  const business = await prisma.business.findUnique({
    where: { slug },
    select: { id: true, tags: { orderBy: { name: 'asc' } } },
  });
  if (!business) notFound();
  await requireBusinessAccess(user, business.id);

  const customer = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      createdAt: true,
      avatarSeed: true,
      customerProfile: { select: { city: true, district: true } },
      tagLinks: { select: { tagId: true } },
    },
  });
  if (!customer) notFound();

  // Yalnızca bu işletmedeki randevular gösterilir; başka işletmenin verisi sızmaz.
  const kapsam = { businessId: business.id, customerId: id };
  const [reservations, notes, toplamlar, gelmeyen, harcama] = await Promise.all([
    prisma.reservation.findMany({
      where: kapsam,
      orderBy: [{ date: 'desc' }, { startMin: 'desc' }],
      take: LISTE_ADEDI,
      include: {
        service: { select: { name: true } },
        // Ek hizmetlerin varlığı listede de görünsün (bkz. serviceLabel).
        _count: { select: { services: true } },
        staff: { select: { displayName: true } },
      },
    }),
    prisma.customerNote.findMany({
      where: { businessId: business.id, customerId: id },
      orderBy: { createdAt: 'desc' },
      include: { author: { select: { name: true } } },
    }),
    // TOPLAMLAR AYRI SORGULARDAN.
    //
    // Önceden ziyaret sayısı, gelmeme sayısı ve harcama, ekranda gösterilen
    // SON 40 kayıttan hesaplanıyordu. 40'tan fazla randevusu olan — yani en
    // değerli — müşterilerde bu sayılar sessizce yanlıştı ve her zaman olduğundan
    // düşük çıkıyordu. Sayım veritabanında, listeden bağımsız yapılıyor.
    prisma.reservation.count({ where: kapsam }),
    prisma.reservation.count({ where: { ...kapsam, status: 'NO_SHOW' } }),
    prisma.reservation.aggregate({
      where: { ...kapsam, status: 'COMPLETED' },
      _sum: { finalPrice: true },
      _count: { _all: true },
    }),
  ]);

  if (toplamlar === 0) notFound();

  const noShow = gelmeyen;
  const spend = harcama._sum.finalPrice ?? 0;
  const completedCount = harcama._count._all;
  const t = today();
  const upcoming = reservations.filter(
    (r) => r.date >= t && ['PENDING', 'CONFIRMED', 'ARRIVED'].includes(r.status),
  );

  return (
    <div className="space-y-5">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={`/panel/${slug}/musteriler`}>
          <ChevronLeft size={16} aria-hidden />
          Müşteriler
        </Link>
      </Button>

      <div className="flex flex-wrap items-start gap-4">
        <Avatar name={customer.name} size={58} hue={Number(customer.avatarSeed) * 37} />
        <div className="min-w-0 flex-1">
          <h1 className="text-[22px] font-semibold tracking-[-0.02em]">{customer.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-2">
            {customer.phone ? (
              <a href={`tel:${customer.phone}`} className="tnum inline-flex items-center gap-1.5 hover:text-brand-600">
                <Phone size={13} aria-hidden />
                {fmtPhone(customer.phone)}
              </a>
            ) : null}
            <span className="inline-flex items-center gap-1.5 text-ink-3">
              <Mail size={13} aria-hidden />
              {customer.email}
            </span>
            {customer.customerProfile?.district ? (
              <span className="text-ink-3">{customer.customerProfile.district}</span>
            ) : null}
          </div>
          <p className="mt-1 text-[12.5px] text-ink-3">
            {ago(customer.createdAt)} kayıt oldu
            {upcoming[0] ? ` · sıradaki randevu ${relativeDay(upcoming[0].date)}` : ''}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Toplam randevu" value={String(toplamlar)} />
        <StatCard label="Tamamlanan" value={String(completedCount)} />
        <StatCard label="Toplam harcama" value={money(spend)} tone="money" />
        <StatCard
          label="Gelmediği randevu"
          value={String(noShow)}
          tone={noShow > 0 ? 'danger' : 'neutral'}
          hint={noShow >= 2 ? 'Kapora önerilir' : undefined}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader title="Randevu geçmişi" description={`${reservations.length} kayıt`} />
          <ul className="divide-y divide-line">
            {reservations.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 p-4">
                <div className="tnum w-[120px] shrink-0">
                  <p className="text-[13.5px] font-medium text-navy">{dayWithWeekday(r.date)}</p>
                  <p className="text-[12.5px] text-ink-3">{hhmm(r.startMin)}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] text-navy">{serviceLabel(r.service.name, r._count.services)}</p>
                  <p className="text-[12.5px] text-ink-3">{r.staff.displayName}</p>
                </div>
                <StatusBadge status={r.status as ReservationStatus} />
                <p className="tnum w-20 text-right text-[13.5px] font-medium text-navy">
                  {money(r.finalPrice)}
                </p>
              </li>
            ))}
          </ul>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Etiketler" description="Yalnızca ekibiniz görür" />
            <CardBody>
              <CustomerTags
                slug={slug}
                businessId={business.id}
                customerId={customer.id}
                tags={business.tags.map((t) => ({
                  id: t.id,
                  name: t.name,
                  tone: t.tone,
                  attached: customer.tagLinks.some((l) => l.tagId === t.id),
                }))}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Notlar" description="Müşteri bu notları göremez" />
            <CardBody className="space-y-4">
              <CustomerNoteForm slug={slug} businessId={business.id} customerId={customer.id} />
              {notes.length === 0 ? (
                <p className="flex items-center gap-2 text-[13px] text-ink-3">
                  <StickyNote size={14} aria-hidden />
                  Henüz not yok.
                </p>
              ) : (
                <ul className="space-y-3">
                  {notes.map((n) => (
                    <li key={n.id} className="rounded-xl border border-line bg-sunken/60 p-3">
                      <p className="text-[13.5px] leading-relaxed text-ink-2">{n.body}</p>
                      <p className="mt-1.5 text-[12px] text-ink-3">
                        {n.author?.name ?? 'Ekip'} · {ago(n.createdAt)}
                      </p>
                    </li>
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
