import Link from 'next/link';
import { MapPin, Clock3, Building2 } from 'lucide-react';
import { BusinessCover } from './cover';
import { Rating } from '@/components/ui/rating';
import { Badge } from '@/components/ui/badge';
import { money, priceLevel, relativeDay } from '@/lib/format';
import { SECTOR_LABEL, type Sector } from '@/lib/constants';
import { hhmm } from '@/lib/time';
import { cn } from '@/lib/utils';
import type { BusinessCardData } from '@/server/discovery';

/** Keşif kartı: görsel, isim, kategori, puan, konum, fiyat ve en yakın saat. */
export function BusinessCard({ business, className }: { business: BusinessCardData; className?: string }) {
  const branch = business.branches[0];
  const cheapest = business.services[0];
  const districts = new Set(business.branches.map((b) => b.district));

  return (
    <Link
      href={`/isletme/${business.slug}`}
      className={cn(
        'card card-hover group flex flex-col overflow-hidden focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
        className,
      )}
    >
      <div className="relative">
        <BusinessCover
          hue={business.brandHue}
          sector={business.category.sector}
          src={business.coverUrl}
          name={business.name}
          className="h-32 sm:h-36"
        />
        <div className="absolute left-3 top-3 flex gap-1.5">
          <Badge tone="solid" className="bg-navy/80 backdrop-blur">
            {/* Kategori adı çoğuldur ("Halı sahalar"); rozette tekil etiket kullanılır. */}
            {SECTOR_LABEL[business.category.sector as Sector] ?? business.category.name}
          </Badge>
          {business.featured ? <Badge tone="blue" className="bg-white/95">Öne çıkan</Badge> : null}
        </div>
        {business.nextSlot ? (
          <div className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-[12px] font-medium text-success shadow-sm backdrop-blur">
            <Clock3 size={13} aria-hidden />
            {relativeDay(business.nextSlot.date)} {hhmm(business.nextSlot.startMin)}
          </div>
        ) : (
          <div className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-[12px] font-medium text-ink-3 shadow-sm backdrop-blur">
            <Clock3 size={13} aria-hidden />
            Yakın saat yok
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-3.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-1 text-[15px] font-semibold text-navy group-hover:text-brand-700">
            {business.name}
          </h3>
          {business.ratingCount > 0 ? (
            <Rating value={business.ratingAvg} count={business.ratingCount} />
          ) : (
            <span className="shrink-0 text-[12px] text-ink-3">Yeni</span>
          )}
        </div>

        <p className="mt-1 line-clamp-1 text-[13px] text-ink-3">{business.tagline}</p>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-ink-2">
          <span className="inline-flex items-center gap-1">
            <MapPin size={13} className="text-ink-3" aria-hidden />
            {branch ? `${branch.district}, ${branch.city}` : 'Ankara'}
          </span>
          {districts.size > 1 || business._count.branches > 1 ? (
            <span className="inline-flex items-center gap-1 text-ink-3">
              <Building2 size={13} aria-hidden />
              {business._count.branches} şube
            </span>
          ) : null}
        </div>

        <div className="mt-3 flex items-end justify-between border-t border-line pt-3">
          <div>
            <p className="text-[11.5px] text-ink-3">Başlangıç</p>
            <p className="tnum text-[15px] font-semibold text-navy">
              {!cheapest ? '—' : cheapest.price === 0 ? 'Ücretsiz' : money(cheapest.price)}
            </p>
          </div>
          <span className="tnum text-[13px] font-medium text-ink-3">
            {priceLevel(business.priceLevel)}
          </span>
        </div>
      </div>
    </Link>
  );
}
