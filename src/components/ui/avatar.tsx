import { cn } from '@/lib/utils';
import { initials as toInitials, } from '@/lib/format';
import { hueFromString } from '@/lib/utils';

/** Fotoğraf yoksa isimden türeyen kararlı gradient — hiçbir zaman boş kutu değil. */
export function Avatar({
  name,
  src,
  size = 40,
  className,
  hue,
}: {
  name: string;
  src?: string | null;
  size?: number;
  className?: string;
  hue?: number;
}) {
  const h = hue ?? hueFromString(name);
  const font = Math.max(11, Math.round(size * 0.36));
  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-white',
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: font,
        background: `linear-gradient(140deg, hsl(${h} 70% 55%), hsl(${(h + 30) % 360} 66% 40%))`,
      }}
      aria-hidden
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : (
        toInitials(name)
      )}
    </span>
  );
}
