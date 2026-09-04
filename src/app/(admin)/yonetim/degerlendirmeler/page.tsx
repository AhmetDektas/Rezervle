import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { prisma } from '@/lib/db';
import { ReviewModeration } from '@/components/admin/admin-actions';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ReviewStars } from '@/components/ui/rating';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { ago } from '@/lib/format';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Değerlendirmeler' };
export const dynamic = 'force-dynamic';

type Search = Promise<{ durum?: string }>;

const TABS = [
  { key: 'REPORTED', label: 'Şikayet edilen' },
  { key: 'HIDDEN', label: 'Gizlenen' },
  { key: 'PUBLISHED', label: 'Yayında' },
];

export default async function AdminReviewsPage({ searchParams }: { searchParams: Search }) {
  const search = await searchParams;
  const status = TABS.some((t) => t.key === search.durum) ? search.durum! : 'REPORTED';

  const [reviews, counts] = await Promise.all([
    prisma.review.findMany({
      where: { status },
      orderBy: { createdAt: 'desc' },
      take: 60,
      include: {
        user: { select: { name: true, avatarSeed: true } },
        business: { select: { name: true, slug: true } },
      },
    }),
    prisma.review.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Değerlendirme moderasyonu</h1>
        <p className="mt-0.5 text-[13.5px] text-ink-3">
          Gizlenen yorumlar puan ortalamasına dahil edilmez.
        </p>
      </div>

      <nav className="flex flex-wrap gap-1.5" aria-label="Durum filtresi">
        {TABS.map((t) => {
          const count = counts.find((c) => c.status === t.key)?._count._all ?? 0;
          return (
            <Link
              key={t.key}
              href={`/yonetim/degerlendirmeler?durum=${t.key}`}
              className={cn(
                'flex min-h-[38px] items-center gap-1.5 rounded-xl border px-3 text-[13px] font-medium transition',
                status === t.key
                  ? 'border-brand-500 bg-brand-50 text-brand-700'
                  : 'border-line-strong bg-surface text-ink-2 hover:text-navy',
              )}
            >
              {t.label}
              <span className="tnum text-ink-3">{count}</span>
            </Link>
          );
        })}
      </nav>

      {reviews.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck size={22} />}
          title="İnceleyecek bir şey yok"
          description="Bu durumda değerlendirme bulunmuyor."
        />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line">
            {reviews.map((r) => (
              <li key={r.id} className="p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Avatar name={r.user.name} size={36} hue={Number(r.user.avatarSeed) * 37} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-medium text-navy">{r.user.name}</p>
                    <p className="text-[12.5px] text-ink-3">
                      <Link href={`/isletme/${r.business.slug}`} target="_blank" className="hover:text-brand-600">
                        {r.business.name}
                      </Link>{' '}
                      · {ago(r.createdAt)}
                    </p>
                  </div>
                  <ReviewStars value={r.rating} />
                  {r.status === 'REPORTED' ? <Badge tone="red">Şikayet</Badge> : null}
                  {r.status === 'HIDDEN' ? <Badge tone="neutral">Gizli</Badge> : null}
                </div>
                {r.comment ? (
                  <p className="mt-2 text-[13.5px] leading-relaxed text-ink-2">{r.comment}</p>
                ) : null}
                {r.reportReason ? (
                  <p className="mt-2 rounded-lg bg-warn-soft px-2.5 py-1.5 text-[12.5px] text-warn">
                    Bildirim: {r.reportReason}
                  </p>
                ) : null}
                <div className="mt-3">
                  <ReviewModeration reviewId={r.id} status={r.status} />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
