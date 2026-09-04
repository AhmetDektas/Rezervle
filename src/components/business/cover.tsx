import { Scissors, Sparkles, Smile, PawPrint, Dumbbell, UtensilsCrossed, Goal } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Sector } from '@/lib/constants';

export const SECTOR_ICON: Record<string, LucideIcon> = {
  RESTAURANT: UtensilsCrossed,
  BEAUTY: Scissors,
  PITCH: Goal,
  DENTAL: Smile,
  VET: PawPrint,
  AESTHETIC: Sparkles,
  GYM: Dumbbell,
};

/**
 * İşletme kapağı.
 *
 * Fotoğraf yoksa (veya yüklenemezse) kapak, işletmenin kendi renk tonundan
 * türeyen bir gradient ve sektör deseniyle çizilir. Böylece liste hiçbir
 * koşulda gri kutulara düşmez ve dış kaynağa bağımlı değildir.
 */
export function BusinessCover({
  hue,
  sector,
  src,
  name,
  className,
  rounded = 'rounded-t-2xl',
}: {
  hue: number;
  sector: Sector | string;
  src?: string | null;
  name: string;
  className?: string;
  rounded?: string;
}) {
  const Icon = SECTOR_ICON[sector] ?? Sparkles;
  return (
    <div
      className={cn('relative overflow-hidden bg-brand-900', rounded, className)}
      style={{
        backgroundImage: `linear-gradient(135deg, hsl(${hue} 68% 46%), hsl(${(hue + 28) % 360} 72% 32%))`,
      }}
      aria-hidden
    >
      {/* Işık halkaları ve ince ızgara: düz renkten daha derin bir yüzey. */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(120% 80% at 85% 0%, rgba(255,255,255,.28), transparent 55%), radial-gradient(90% 70% at 0% 100%, rgba(0,0,0,.28), transparent 60%)',
        }}
      />
      <div
        className="absolute inset-0 opacity-[.13]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,.9) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.9) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
      ) : null}
      <Icon
        className="absolute -bottom-4 -right-3 h-24 w-24 text-white/25"
        strokeWidth={1.25}
        aria-hidden
      />
      <span className="sr-only">{name}</span>
    </div>
  );
}
