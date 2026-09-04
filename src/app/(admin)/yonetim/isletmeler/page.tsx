import type { Metadata } from 'next';
import Link from 'next/link';
import { Store } from 'lucide-react';
import { prisma } from '@/lib/db';
import { BusinessStatusActions } from '@/components/admin/admin-actions';
import { BusinessCover } from '@/components/business/cover';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Rating } from '@/components/ui/rating';
import { EmptyState } from '@/components/ui/empty-state';
import { ago } from '@/lib/format';
import { BUSINESS_STATUSES, BUSINESS_STATUS_LABEL, type BusinessStatus } from '@/lib/constants';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'İşletmeler' };
export const dynamic = 'force-dynamic';

type Search = Promise<{ durum?: string }>;

export default async function AdminBusinessesPage({ searchParams }: { searchParams: Search }) {
  const search = await searchParams;
  const status = BUSINESS_STATUSES.includes(search.durum as BusinessStatus)
    ? (search.durum as BusinessStatus)
    : undefined;

  const [businesses, counts] = await Promise.all([
    prisma.business.findMany({
      where: status ? { status } : {},
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      include: {
        category: { select: { name: true, sector: true } },
        owner: { select: { name: true, email: true } },
        branches: { where: { active: true }, select: { district: true } },
        _count: { select: { reservations: true, staff: true, services: true } },
      },
    }),
    prisma.business.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">İşletmeler</h1>
        <p className="mt-0.5 text-[13.5px] text-ink-3">
          Onay, askıya alma ve öne çıkarma işlemleri buradan yapılır.
        </p>
      </div>

      <nav className="flex flex-wrap gap-1.5" aria-label="Durum filtresi">
        <Link
          href="/yonetim/isletmeler"
          className={cn(
            'flex min-h-[38px] items-center gap-1.5 rounded-xl border px-3 text-[13px] font-medium transition',
            !status ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-line-strong bg-surface text-ink-2 hover:text-navy',
          )}
        >
          Tümü
          <span className="tnum text-ink-3">{businesses.length > 0 || status ? counts.reduce((s, c) => s + c._count._all, 0) : 0}</span>
        </Link>
        {BUSINESS_STATUSES.map((s) => {
          const count = counts.find((c) => c.status === s)?._count._all ?? 0;
          return (
            <Link
              key={s}
              href={`/yonetim/isletmeler?durum=${s}`}
              className={cn(
                'flex min-h-[38px] items-center gap-1.5 rounded-xl border px-3 text-[13px] font-medium transition',
                status === s
                  ? 'border-brand-500 bg-brand-50 text-brand-700'
                  : 'border-line-strong bg-surface text-ink-2 hover:text-navy',
              )}
            >
              {BUSINESS_STATUS_LABEL[s]}
              <span className="tnum text-ink-3">{count}</span>
            </Link>
          );
        })}
      </nav>

      {businesses.length === 0 ? (
        <EmptyState icon={<Store size={22} />} title="Kayıt yok" description="Bu filtreye uyan işletme bulunmuyor." />
      ) : (
        <ul className="grid gap-4 xl:grid-cols-2">
          {businesses.map((b) => (
            <li key={b.id}>
              <Card className="flex h-full flex-col overflow-hidden">
                <div className="flex gap-3 p-4">
                  <BusinessCover
                    hue={b.brandHue}
                    sector={b.category.sector}
                    name={b.name}
                    rounded="rounded-xl"
                    className="h-16 w-16 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/isletme/${b.slug}`}
                        target="_blank"
                        className="text-[15px] font-semibold text-navy hover:text-brand-600"
                      >
                        {b.name}
                      </Link>
                      <Badge
                        tone={b.status === 'APPROVED' ? 'green' : b.status === 'PENDING' ? 'amber' : 'red'}
                      >
                        {BUSINESS_STATUS_LABEL[b.status as BusinessStatus]}
                      </Badge>
                      {b.featured ? <Badge tone="blue">Öne çıkan</Badge> : null}
                      {b.depositAddon ? (
                        <Badge tone="green">
                          Kapora paketi{b.depositEnabled ? ' · açık' : ' · işletme kapattı'}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-[13px] text-ink-3">
                      {b.category.name} · {[...new Set(b.branches.map((x) => x.district))].join(', ') || 'Şube yok'}
                    </p>
                    <p className="mt-1 text-[12.5px] text-ink-3">
                      {b.owner.name} · {b.owner.email} · {ago(b.createdAt)}
                    </p>
                    <p className="tnum mt-1 text-[12.5px] text-ink-3">
                      {b._count.staff} personel · {b._count.services} hizmet · {b._count.reservations} randevu
                    </p>
                    {b.ratingCount > 0 ? (
                      <div className="mt-1">
                        <Rating value={b.ratingAvg} count={b.ratingCount} />
                      </div>
                    ) : null}
                    {b.rejectionReason ? (
                      <p className="mt-2 rounded-lg bg-danger-soft px-2.5 py-1.5 text-[12.5px] text-danger">
                        Ret gerekçesi: {b.rejectionReason}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="mt-auto border-t border-line bg-sunken/40 p-3">
                  <BusinessStatusActions
                    businessId={b.id}
                    status={b.status}
                    featured={b.featured}
                    depositAddon={b.depositAddon}
                  />
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
