import { CustomerHeader } from '@/components/shell/customer-header';
import { CustomerTabBar } from '@/components/shell/customer-tabbar';
import { currentUser } from '@/server/auth';
import { prisma } from '@/lib/db';
import { SiteFooter } from '@/components/shell/site-footer';

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  const unread = user
    ? await prisma.notification.count({ where: { userId: user.id, readAt: null } })
    : 0;

  return (
    <div className="flex min-h-dvh flex-col">
      <CustomerHeader
        user={user ? { id: user.id, name: user.name, role: user.role, avatarSeed: user.avatarSeed } : null}
        unread={unread}
      />
      <main id="icerik" className="flex-1 pb-[calc(var(--tabbar-h)+env(safe-area-inset-bottom))] lg:pb-0">
        {children}
      </main>
      <SiteFooter />
      <CustomerTabBar />
    </div>
  );
}
