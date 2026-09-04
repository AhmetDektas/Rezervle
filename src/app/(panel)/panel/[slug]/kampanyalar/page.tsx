import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Tag } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireRole, requireBusinessAccess } from '@/server/auth';
import { PromotionEditor, PromotionToggle } from '@/components/panel/promotion-editor';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { money, longDate } from '@/lib/format';

export const metadata: Metadata = { title: 'Kampanyalar' };
export const dynamic = 'force-dynamic';

type Params = Promise<{ slug: string }>;

export default async function PromotionsPage({ params }: { params: Params }) {
  const [{ slug }, user] = await Promise.all([params, requireRole(['OWNER', 'STAFF', 'ADMIN'])]);
  const business = await prisma.business.findUnique({
    where: { slug },
    select: {
      id: true,
      promotions: {
        orderBy: [{ active: 'desc' }, { endsAt: 'desc' }],
        include: { _count: { select: { reservations: true } } },
      },
    },
  });
  if (!business) notFound();
  await requireBusinessAccess(user, business.id);

  const now = new Date();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Kampanyalar</h1>
          <p className="mt-0.5 text-[13.5px] text-ink-3">
            İndirim, randevu oluşturulurken kod girildiğinde uygulanır.
          </p>
        </div>
        <PromotionEditor slug={slug} businessId={business.id} />
      </div>

      {business.promotions.length === 0 ? (
        <EmptyState
          icon={<Tag size={22} />}
          title="Kampanya yok"
          description="Yeni müşteri kazanmak için bir indirim kodu tanımlayabilirsiniz."
        />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line">
            {business.promotions.map((p) => {
              const expired = p.endsAt < now;
              const notStarted = p.startsAt > now;
              return (
                <li key={p.id} className="flex flex-wrap items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-lg bg-navy px-2 py-0.5 font-mono text-[12.5px] font-semibold text-white">
                        {p.code}
                      </span>
                      <p className="text-[14.5px] font-medium text-navy">{p.title}</p>
                      {expired ? <Badge tone="neutral">Süresi doldu</Badge> : null}
                      {notStarted ? <Badge tone="amber">Henüz başlamadı</Badge> : null}
                      {!p.active ? <Badge tone="neutral">Durduruldu</Badge> : null}
                    </div>
                    {p.description ? (
                      <p className="mt-0.5 text-[13px] text-ink-3">{p.description}</p>
                    ) : null}
                    <p className="tnum mt-1 text-[12.5px] text-ink-3">
                      {p.kind === 'PERCENT' ? `%${p.value} indirim` : `${money(p.value)} indirim`}
                      {p.minAmount > 0 ? ` · en az ${money(p.minAmount)}` : ''} ·{' '}
                      {longDate(p.startsAt.toISOString().slice(0, 10))} –{' '}
                      {longDate(p.endsAt.toISOString().slice(0, 10))}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="tnum text-[14px] font-semibold text-navy">
                      {p.usedCount}
                      {p.maxUses > 0 ? ` / ${p.maxUses}` : ''}
                    </p>
                    <p className="text-[12px] text-ink-3">kullanım</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <PromotionToggle slug={slug} id={p.id} active={p.active} />
                    <PromotionEditor
                      slug={slug}
                      businessId={business.id}
                      trigger="edit"
                      promotion={{
                        id: p.id, code: p.code, title: p.title, description: p.description,
                        kind: p.kind, value: p.value, minAmount: p.minAmount,
                        startsAt: p.startsAt.toISOString().slice(0, 10),
                        endsAt: p.endsAt.toISOString().slice(0, 10),
                        maxUses: p.maxUses, active: p.active,
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
