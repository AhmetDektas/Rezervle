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
import { serviceLabel } from '@/lib/services';

export const metadata: Metadata = { title: 'Randevularım' };
export const dynamic = 'force-dynamic';

type Search = Promise<{ sekme?: string; sayfa?: string }>;

/**
 * Sayfa başına randevu.
 *
 * Sayfa önceden müşterinin BÜTÜN randevularını çekiyordu: sınır yok, filtre
 * JavaScript'te. Düzenli randevu alan bir müşteride bu liste sürekli büyüyor
 * ve sayfa kullanılamaz hâle geliyor — demo hesapta 1420 kayda ulaşmıştı ve
 * uçtan uca testler bu yüzden zaman aşımına uğruyordu. Keşfet sayfasında
 * kapatılan hatanın aynısı.
 */
const SAYFA_ADEDI = 20;

export default async function MyReservationsPage({ searchParams }: { searchParams: Search }) {
  const [user, search] = await Promise.all([requireUser('/randevularim'), searchParams]);
  const tab = search.sekme === 'gecmis' ? 'gecmis' : 'yaklasan';
  const t = today();
  const nm = nowMinutes();

  const sayfa = Math.max(1, Number(search.sayfa) || 1);

  // Yaklaşan/geçmiş ayrımı artık SQL'de. Önceden bütün kayıtlar çekilip
  // JavaScript'te süzülüyordu: atılacak veriyi de altı tabloyla birleştirip
  // taşımak demekti.
  const aktifDurum = { status: { notIn: ['CANCELLED', 'COMPLETED', 'NO_SHOW'] } };
  const gelecekZaman = { OR: [{ date: { gt: t } }, { date: t, endMin: { gte: nm } }] };
  const yaklasanKosul = { customerId: user.id, ...aktifDurum, ...gelecekZaman };
  // Geçmiş, yaklaşanın tam tersi (De Morgan): ya durum kapalı ya zaman geçmiş.
  const gecmisKosul = {
    customerId: user.id,
    OR: [
      { status: { in: ['CANCELLED', 'COMPLETED', 'NO_SHOW'] } },
      { date: { lt: t } },
      { date: t, endMin: { lt: nm } },
    ],
  };

  const [upcomingCount, pastCount] = await Promise.all([
    prisma.reservation.count({ where: yaklasanKosul }),
    prisma.reservation.count({ where: gecmisKosul }),
  ]);

  // take + 1: fazladan bir kayıt istemek, ayrı bir sayım sorgusu açmadan
  // "devamı var mı" sorusunu cevaplıyor.
  const kayitlar = await prisma.reservation.findMany({
    where: tab === 'gecmis' ? gecmisKosul : yaklasanKosul,
    orderBy:
      tab === 'gecmis'
        ? [{ date: 'desc' }, { startMin: 'desc' }]
        : [{ date: 'asc' }, { startMin: 'asc' }],
    take: SAYFA_ADEDI + 1,
    skip: (sayfa - 1) * SAYFA_ADEDI,
    include: {
      business: { select: { name: true, slug: true, brandHue: true, category: { select: { sector: true } } } },
      branch: { select: { name: true, district: true } },
      service: { select: { name: true, durationMin: true } },
      // Ek hizmetlerin varlığı listede de görünsün (bkz. serviceLabel).
      _count: { select: { services: true } },
      staff: { select: { displayName: true, hue: true } },
      review: { select: { id: true } },
    },
  });

  const dahaVar = kayitlar.length > SAYFA_ADEDI;
  const items = dahaVar ? kayitlar.slice(0, SAYFA_ADEDI) : kayitlar;

  function baglanti(hedef: number): string {
    const qs = new URLSearchParams();
    if (tab === 'gecmis') qs.set('sekme', 'gecmis');
    if (hedef > 1) qs.set('sayfa', String(hedef));
    const q = qs.toString();
    return q ? `/randevularim?${q}` : '/randevularim';
  }

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
        <TabLink href="/randevularim" active={tab === 'yaklasan'} count={upcomingCount}>
          Yaklaşan
        </TabLink>
        <TabLink href="/randevularim?sekme=gecmis" active={tab === 'gecmis'} count={pastCount}>
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
                        <p className="mt-0.5 truncate text-[13.5px] text-ink-2">
                          {serviceLabel(r.service.name, r._count.services)}
                        </p>
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

        {/* Sayfalama bağlantı olarak: JavaScript olmadan da çalışıyor ve her
            sayfanın kendi adresi var — paylaşılabilir, geri tuşu doğru. */}
        {sayfa > 1 || dahaVar ? (
          <nav className="mt-6 flex items-center justify-between gap-3" aria-label="Sayfalama">
            {sayfa > 1 ? (
              <Button asChild variant="secondary">
                <Link href={baglanti(sayfa - 1)} rel="prev">
                  Önceki
                </Link>
              </Button>
            ) : (
              <span />
            )}
            {dahaVar ? (
              <Button asChild variant="secondary">
                <Link href={baglanti(sayfa + 1)} rel="next">
                  Daha fazla göster
                </Link>
              </Button>
            ) : (
              <span />
            )}
          </nav>
        ) : null}
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
