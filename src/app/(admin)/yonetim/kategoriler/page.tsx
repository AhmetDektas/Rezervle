import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { CategoryEditor } from '@/components/admin/admin-actions';
import { SECTOR_ICON } from '@/components/business/cover';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SECTOR_LABEL, type Sector } from '@/lib/constants';

export const metadata: Metadata = { title: 'Kategoriler' };
export const dynamic = 'force-dynamic';

export default async function AdminCategoriesPage() {
  const categories = await prisma.businessCategory.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { _count: { select: { businesses: true } } },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Kategoriler</h1>
          <p className="mt-0.5 text-[13.5px] text-ink-3">
            Pasif kategoriler ana sayfada “Yakında” olarak görünür.
          </p>
        </div>
        <CategoryEditor />
      </div>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((c) => {
          const Icon = SECTOR_ICON[c.sector] ?? SECTOR_ICON['BEAUTY']!;
          return (
            <li key={c.id}>
              <Card className="flex h-full items-start gap-3 p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <Icon size={19} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[14.5px] font-semibold text-navy">{c.name}</p>
                    {!c.active ? <Badge tone="neutral">Pasif</Badge> : null}
                  </div>
                  <p className="mt-0.5 text-[12.5px] text-ink-3">
                    {SECTOR_LABEL[c.sector as Sector] ?? c.sector} · /{c.slug}
                  </p>
                  {c.blurb ? <p className="mt-1 text-[13px] text-ink-2">{c.blurb}</p> : null}
                  <p className="tnum mt-1.5 text-[12.5px] text-ink-3">{c._count.businesses} işletme</p>
                </div>
                <CategoryEditor
                  category={{ id: c.id, name: c.name, sector: c.sector, blurb: c.blurb, active: c.active }}
                />
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
