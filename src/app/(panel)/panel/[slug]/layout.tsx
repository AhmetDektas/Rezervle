import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireRole, accessibleBusinesses, requireBusinessAccess } from '@/server/auth';
import { PanelShell } from '@/components/panel/panel-shell';
import { termsFor } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export default async function PanelLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const [{ slug }, user] = await Promise.all([
    params,
    requireRole(['OWNER', 'STAFF', 'ADMIN'], '/panel'),
  ]);

  const business = await prisma.business.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      planStatus: true,
      trialEndsAt: true,
      planPrice: true,
      category: { select: { sector: true } },
    },
  });
  if (!business) notFound();

  // Yetki kontrolü sunucuda; menüyü gizlemek tek başına koruma değildir.
  await requireBusinessAccess(user, business.id);

  const [businesses, unread] = await Promise.all([
    accessibleBusinesses(user),
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);

  return (
    <PanelShell
      business={{
        id: business.id,
        name: business.name,
        slug: business.slug,
        status: business.status,
        planStatus: business.planStatus,
        trialEndsAt: business.trialEndsAt,
        planChosen: business.planPrice > 0,
      }}
      businesses={businesses}
      user={{ name: user.name, role: user.role, avatarSeed: user.avatarSeed }}
      unread={unread}
      resourcePlural={termsFor(business.category.sector).resourceAdminPlural}
      showMenu={business.category.sector === 'RESTAURANT'}
    >
      {children}
    </PanelShell>
  );
}
