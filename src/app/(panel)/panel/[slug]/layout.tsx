import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireRole, accessibleBusinesses, requireBusinessAccess } from '@/server/auth';
import { PanelShell } from '@/components/panel/panel-shell';
import { termsFor } from '@/lib/constants';

export const dynamic = 'force-dynamic';

/**
 * Panel AYRI BİR UYGULAMA olarak kurulur.
 *
 * Tek bir manifest vardı (`scope: "/"`) ve işletme sahibi telefonunda "ana
 * ekrana ekle" dediğinde MÜŞTERİ uygulamasını ekliyordu: simgesi müşteri
 * simgesi, açılışı müşteri ana sayfası. Panel zaten kendi rota grubunda,
 * kendi menüsüyle, kendi yetki kapısıyla çalışıyordu — eksik olan tek şey
 * telefonda ayrı bir uygulama gibi görünmesiydi.
 *
 * Next iç içe layout'lardaki metadata'yı birleştiriyor: bu blok yalnızca
 * /panel/* altında geçerli, müşteri tarafı kendi manifestiyle kalıyor.
 * Tarayıcı kurulum kimliğini `id` + `start_url` üzerinden belirlediği için
 * iki uygulama ana ekranda yan yana ve ayrı ayrı durabiliyor.
 */
export const metadata: Metadata = {
  applicationName: 'Rezzerv İşletme',
  manifest: '/isletme.webmanifest',
  appleWebApp: { capable: true, title: 'Rezzerv İşletme', statusBarStyle: 'black-translucent' },
  icons: {
    icon: [
      { url: '/isletme-icon.svg', type: 'image/svg+xml' },
      { url: '/isletme-icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/isletme-apple-touch-icon.png', sizes: '180x180' }],
  },
};

/** Lacivert tema: kurulu uygulamada durum çubuğu da işletme rengini alır. */
export const viewport: Viewport = { themeColor: '#0B1F3A' };

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
