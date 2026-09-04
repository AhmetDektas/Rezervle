import type { Metadata } from 'next';
import Link from 'next/link';
import { HeartOff } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireUser } from '@/server/auth';
import { nextAvailableSlots } from '@/server/discovery';
import { BusinessCard } from '@/components/business/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Favorilerim' };
export const dynamic = 'force-dynamic';

export default async function FavoritesPage() {
  const user = await requireUser('/favorilerim');
  const rows = await prisma.favorite.findMany({
    where: { userId: user.id, business: { status: 'APPROVED' } },
    orderBy: { createdAt: 'desc' },
    select: {
      business: {
        select: {
          id: true, slug: true, name: true, tagline: true, brandHue: true, priceLevel: true,
          ratingAvg: true, ratingCount: true, featured: true, coverUrl: true, createdAt: true,
          category: { select: { name: true, slug: true, sector: true } },
          branches: { where: { active: true }, select: { district: true, city: true, isPrimary: true }, orderBy: { isPrimary: 'desc' } },
          services: { where: { active: true }, select: { price: true, name: true }, orderBy: { price: 'asc' }, take: 3 },
          _count: { select: { branches: { where: { active: true } } } },
        },
      },
    },
  });

  const availability = await nextAvailableSlots(rows.map((r) => r.business.id), 3);
  const items = rows.map((r) => ({ ...r.business, nextSlot: availability[r.business.id] ?? null }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-7">
      <h1 className="text-[22px] font-semibold tracking-[-0.02em] sm:text-[26px]">Favorilerim</h1>
      <p className="mt-1 text-[14px] text-ink-3">
        Kaydettiğiniz işletmelerin uygun saatlerini buradan takip edin.
      </p>

      <div className="mt-5">
        {items.length === 0 ? (
          <EmptyState
            icon={<HeartOff size={22} />}
            title="Henüz favoriniz yok"
            description="Beğendiğiniz işletmeyi kalp simgesiyle kaydedin; uygun saatleri burada bir arada görün."
            action={
              <Button asChild>
                <Link href="/kesfet">İşletmeleri keşfet</Link>
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((b) => <BusinessCard key={b.id} business={b} />)}
          </div>
        )}
      </div>
    </div>
  );
}
