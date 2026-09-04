import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BellOff, CalendarCheck, Star, Info } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireRole, requireBusinessAccess } from '@/server/auth';
import { EmptyState } from '@/components/ui/empty-state';
import { MarkAllRead } from '@/components/shell/mark-all-read';
import { Card } from '@/components/ui/card';
import { ago } from '@/lib/format';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Bildirimler' };
export const dynamic = 'force-dynamic';

type Params = Promise<{ slug: string }>;

const ICONS: Record<string, React.ElementType> = {
  RESERVATION: CalendarCheck,
  REVIEW: Star,
  SYSTEM: Info,
  INFO: Info,
  PROMO: Info,
};

export default async function PanelNotificationsPage({ params }: { params: Params }) {
  const [{ slug }, user] = await Promise.all([params, requireRole(['OWNER', 'STAFF', 'ADMIN'])]);
  const business = await prisma.business.findUnique({ where: { slug }, select: { id: true } });
  if (!business) notFound();
  await requireBusinessAccess(user, business.id);

  const items = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 60,
  });
  const unread = items.filter((n) => n.readAt === null).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Bildirimler</h1>
          <p className="mt-0.5 text-[13.5px] text-ink-3">
            {unread > 0 ? `${unread} okunmamış bildirim` : 'Tümü okundu'}
          </p>
        </div>
        {unread > 0 ? <MarkAllRead /> : null}
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={<BellOff size={22} />}
          title="Bildiriminiz yok"
          description="Yeni randevu, iptal ve değerlendirme bildirimleri burada birikir."
        />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line">
            {items.map((n) => {
              const Icon = ICONS[n.kind] ?? Info;
              const inner = (
                <div className={cn('flex gap-3 p-4', n.readAt === null && 'bg-brand-50/40')}>
                  <span
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                      n.readAt === null ? 'bg-brand-100 text-brand-700' : 'bg-sunken text-ink-3',
                    )}
                  >
                    <Icon size={16} aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-medium text-navy">{n.title}</p>
                    {n.body ? <p className="mt-0.5 text-[13px] text-ink-2">{n.body}</p> : null}
                    <p className="mt-1 text-[12px] text-ink-3">{ago(n.createdAt)}</p>
                  </div>
                  {n.readAt === null ? (
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" aria-label="Okunmadı" />
                  ) : null}
                </div>
              );
              return (
                <li key={n.id}>
                  {n.href ? (
                    <Link href={n.href} className="block transition hover:bg-sunken/40">
                      {inner}
                    </Link>
                  ) : (
                    inner
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
