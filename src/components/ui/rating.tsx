import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Rating({
  value,
  count,
  size = 14,
  className,
  showValue = true,
}: {
  value: number;
  count?: number;
  size?: number;
  className?: string;
  showValue?: boolean;
}) {
  const rounded = Math.round(value * 10) / 10;
  return (
    <span
      className={cn('inline-flex items-center gap-1 text-[13px] text-ink-2', className)}
      title={`${rounded} / 5${count ? ` · ${count} değerlendirme` : ''}`}
    >
      <Star size={size} className="fill-warn text-warn" aria-hidden />
      {showValue ? (
        <span className="tnum font-semibold text-navy">{rounded.toFixed(1).replace('.', ',')}</span>
      ) : null}
      {count !== undefined ? <span className="tnum text-ink-3">({count})</span> : null}
      <span className="sr-only">
        5 üzerinden {rounded} puan{count !== undefined ? `, ${count} değerlendirme` : ''}
      </span>
    </span>
  );
}

/** Yıldızlarla puan seçimi (klavye ile de çalışır: radio grubu). */
export function RatingInput({
  value,
  onChange,
  name = 'rating',
}: {
  value: number;
  onChange: (v: number) => void;
  name?: string;
}) {
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="Puan">
      {[1, 2, 3, 4, 5].map((n) => (
        <label
          key={n}
          className="cursor-pointer rounded-lg p-1 transition hover:bg-sunken focus-within:ring-2 focus-within:ring-brand-500"
        >
          <input
            type="radio"
            name={name}
            value={n}
            checked={value === n}
            onChange={() => onChange(n)}
            className="sr-only"
          />
          <Star
            size={28}
            className={n <= value ? 'fill-warn text-warn' : 'text-line-strong'}
            aria-hidden
          />
          <span className="sr-only">{n} yıldız</span>
        </label>
      ))}
    </div>
  );
}
