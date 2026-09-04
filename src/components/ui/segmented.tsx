'use client';

import { cn } from '@/lib/utils';

/** Az sayıda seçenek için yatay segment denetimi (radio semantiği). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: readonly { value: T; label: string }[];
  className?: string;
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('inline-flex rounded-xl border border-line-strong bg-sunken p-1', className)}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'min-h-[36px] rounded-lg px-3 text-[13px] font-medium transition',
            value === o.value
              ? 'bg-surface text-navy shadow-[0_1px_2px_rgba(11,31,58,.10)]'
              : 'text-ink-3 hover:text-navy',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
