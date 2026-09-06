import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { SearchX } from 'lucide-react';
import { prisma } from '@/lib/db';
import { searchBusinesses } from '@/server/discovery';
import { BusinessCard } from '@/components/business/card';
import { BusinessFilters } from '@/components/business/filters';
import { SkeletonCards } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Keşfet',
  description: 'Ankara’daki diş, güzellik ve estetik işletmelerini filtreleyerek bulun.',
};

export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

async function Results({ params }: { params: Record<string, string | undefined> }) {
  const sort = params['sirala'];
  // Sayfa numarası 1'den başlıyor; bozuk değer ilk sayfaya düşüyor.
  const sayfa = Math.max(1, Number(params['sayfa']) || 1);
  const ADET = 24;
  const { items, dahaVar } = await searchBusinesses({
    q: params['q'],
    category: params['kategori'],
    district: params['ilce'],
    minRating: params['puan'] ? Number(params['puan']) : undefined,
    maxPriceLevel: params['fiyat'] ? Number(params['fiyat']) : undefined,
    availableToday: params['bugun'] === '1',
    sort: sort === 'puan' || sort === 'fiyat' || sort === 'yeni' ? sort : 'onerilen',
  }, ADET, (sayfa - 1) * ADET);

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<SearchX size={22} />}
        title="Aramanıza uygun işletme bulunamadı"
        description="Filtreleri gevşetmeyi ya da farklı bir semt seçmeyi deneyin. Aradığınız hizmeti sunan bir işletme yakında eklenebilir."
        action={
          <Button asChild variant="secondary">
            <Link href="/kesfet">Tüm işletmeleri gör</Link>
          </Button>
        }
      />
    );
  }

  const baglanti = (hedef: number) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][],
    );
    if (hedef <= 1) qs.delete('sayfa');
    else qs.set('sayfa', String(hedef));
    const q = qs.toString();
    return q ? `/kesfet?${q}` : '/kesfet';
  };

  return (
    <>
      <p className="mb-3 text-[13px] text-ink-3" role="status">
        <span className="tnum font-medium text-navy">{items.length}</span> işletme listeleniyor
        {sayfa > 1 ? <span className="ml-1">· {sayfa}. sayfa</span> : null}
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((b) => (
          <BusinessCard key={b.id} business={b} />
        ))}
      </div>

      {/* Sayfalama bağlantı (link) olarak: JavaScript olmadan da çalışıyor ve
          her sayfanın kendi adresi var — paylaşılabilir ve geri tuşu doğru. */}
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
    </>
  );
}

export default async function DiscoverPage({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const params = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, one(v)])) as Record<
    string,
    string | undefined
  >;

  const [categories, total] = await Promise.all([
    prisma.businessCategory.findMany({
      where: { active: true, businesses: { some: { status: 'APPROVED' } } },
      orderBy: { sortOrder: 'asc' },
      select: { slug: true, name: true },
    }),
    prisma.business.count({ where: { status: 'APPROVED' } }),
  ]);

  const heading = params['q']
    ? `“${params['q']}” için sonuçlar`
    : params['kategori']
      ? (categories.find((c) => c.slug === params['kategori'])?.name ?? 'Keşfet')
      : 'Tüm işletmeler';

  return (
    <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-7">
      <h1 className="text-[22px] font-semibold tracking-[-0.02em] sm:text-[26px]">{heading}</h1>
      <p className="mt-1 text-[14px] text-ink-3">
        {params['ilce'] ? `${params['ilce']}, Ankara` : 'Ankara genelinde arama yapıyorsunuz'}
      </p>

      <div className="mt-4">
        <Suspense fallback={<div className="h-9" />}>
          <BusinessFilters categories={categories} total={total} />
        </Suspense>
      </div>

      <div className="mt-5">
        <Suspense key={JSON.stringify(params)} fallback={<SkeletonCards count={6} />}>
          <Results params={params} />
        </Suspense>
      </div>
    </div>
  );
}
