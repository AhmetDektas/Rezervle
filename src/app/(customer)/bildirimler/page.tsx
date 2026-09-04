import type { Metadata } from 'next';
import Link from 'next/link';
import { BellOff, CalendarCheck, Star, Megaphone, Info } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireUser } from '@/server/auth';
import { EmptyState } from '@/components/ui/empty-state';
import { MarkAllRead } from '@/components/shell/mark-all-read';
import { ago } from '@/lib/format';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Bildirimler' };
export const dynamic = 'force-dynamic';

const ICONS: Record<string, React.ElementType> = {
  RESERVATION: CalendarCheck,
  REVIEW: Star,
  PROMO: Megaphone,
  SYSTEM: Info,
  INFO: Info,
};

export default async function NotificationsPage() {
  const user = await requireUser('/bildirimler');
  const items = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  const unread = items.filter((n) => n.readAt === null).length;

  return (
    <div className="mx-auto max-w-2xl px-4 py-5 sm:px-6 sm:py-7">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em] sm:text-[26px]">Bildirimler</h1>
          <p className="mt-1 text-[14px] text-ink-3">
            {unread > 0 ? `${unread} okunmamış bildirim` : 'Tümü okundu'}
          </p>
        </div>
        {unread > 0 ? <MarkAllRead /> : null}
      </div>

      <div className="mt-5">
        {items.length === 0 ? (
          <EmptyState
            icon={<BellOff size={22} />}
            title="Bildiriminiz yok"
            description="Randevu onayları, hatırlatmalar ve kampanyalar burada görünür."
          />
        ) : (
          <ul className="space-y-2">
            {items.map((n) => {
              const Icon = ICONS[n.kind] ?? Info;
              const body = (
                <div
                  className={cn(
                    'flex gap-3 rounded-2xl border p-4 transition',
                    n.readAt === null ? 'border-brand-200 bg-brand-50/50' : 'border-line bg-surface',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                      n.readAt === null ? 'bg-brand-100 text-brand-700' : 'bg-sunken text-ink-3',
                    )}
                  >
                    <Icon size={17} aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-medium text-navy">{n.title}</p>
                    {n.body ? <p className="mt-0.5 text-[13.5px] text-ink-2">{n.body}</p> : null}
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
                    <Link href={n.href} className="block">
                      {body}
                    </Link>
                  ) : (
                    body
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
