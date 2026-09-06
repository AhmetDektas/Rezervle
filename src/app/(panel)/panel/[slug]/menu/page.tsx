import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { UtensilsCrossed } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireRole, requireBusinessAccess } from '@/server/auth';
import { MenuEditor, MenuRowActions } from '@/components/panel/menu-editor';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { money } from '@/lib/format';

export const metadata: Metadata = { title: 'Menü' };
export const dynamic = 'force-dynamic';

type Params = Promise<{ slug: string }>;

/**
 * Restoran menüsü yönetimi.
 *
 * Yalnızca restoran sektöründe erişilebilir; diğer sektörlerde panele
 * yönlendiriliyor. Menüsü olmayan bir kuaförün bu sayfaya girip boş bir
 * ekranla karşılaşması, gezinmede görünmemesinden daha kafa karıştırıcı olurdu.
 */
export default async function MenuPage({ params }: { params: Params }) {
  const [{ slug }, user] = await Promise.all([params, requireRole(['OWNER', 'STAFF', 'ADMIN'])]);
  const business = await prisma.business.findUnique({
    where: { slug },
    select: {
      id: true,
      category: { select: { sector: true } },
      menuItems: { orderBy: [{ active: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }] },
    },
  });
  if (!business) notFound();
  await requireBusinessAccess(user, business.id);
  if (business.category.sector !== 'RESTAURANT') redirect(`/panel/${slug}`);

  const bolumler = [...new Set(business.menuItems.map((m) => m.category))];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Menü</h1>
          <p className="mt-0.5 text-[13.5px] text-ink-3">
            İşletme sayfanızda görünür. Fiyatlar bilgilendirme amaçlıdır; rezervasyon
            tutarına eklenmez.
          </p>
        </div>
        <MenuEditor businessId={business.id} bolumler={bolumler} />
      </div>

      {business.menuItems.length === 0 ? (
        <EmptyState
          icon={<UtensilsCrossed size={22} />}
          title="Menünüz henüz boş"
          description="Bölüm ve ürün ekleyerek başlayın. Menüsü olan restoranlar keşfette daha çok inceleniyor."
        />
      ) : (
        <Card>
          <ul className="divide-y divide-line">
            {business.menuItems.map((m) => (
              <li
                key={m.id}
                className={`flex items-start justify-between gap-3 px-4 py-3 sm:px-5 ${m.active ? '' : 'opacity-60'}`}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[14.5px] font-medium text-navy">{m.name}</span>
                    <Badge tone="neutral">{m.category}</Badge>
                    {!m.active ? <Badge tone="amber">Yayında değil</Badge> : null}
                  </div>
                  {m.description ? (
                    <p className="mt-0.5 text-[13px] leading-relaxed text-ink-3">{m.description}</p>
                  ) : null}
                  <p className="tnum mt-1 text-[13.5px] text-ink-2">{money(m.price)}</p>
                </div>
                <MenuRowActions businessId={business.id} item={m} bolumler={bolumler} />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
