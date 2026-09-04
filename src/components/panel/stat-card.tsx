import { cn } from '@/lib/utils';

/** Panel ölçüm kartı. Renk yalnızca anlam taşıdığında kullanılır. */
export function StatCard({
  label,
  value,
  hint,
  tone = 'neutral',
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'neutral' | 'money' | 'warn' | 'danger';
  icon?: React.ReactNode;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[12.5px] font-medium text-ink-3">{label}</p>
        {icon ? <span className="text-ink-3">{icon}</span> : null}
      </div>
      <p
        className={cn(
          'tnum mt-1.5 text-[24px] font-semibold tracking-[-0.02em]',
          tone === 'money' && 'text-success',
          tone === 'warn' && 'text-warn',
          tone === 'danger' && 'text-danger',
          tone === 'neutral' && 'text-navy',
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-[12px] text-ink-3">{hint}</p> : null}
    </div>
  );
}

/** Yatay oran çubuğu — doluluk ve dağılım göstergeleri için. */
export function BarRow({
  label,
  value,
  max,
  right,
  tone = 'brand',
}: {
  label: string;
  value: number;
  max: number;
  right: string;
  tone?: 'brand' | 'success';
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <li className="py-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-[13.5px] text-navy">{label}</span>
        <span className="tnum shrink-0 text-[13px] font-medium text-ink-2">{right}</span>
      </div>
      <div
        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-sunken"
        role="img"
        aria-label={`${label}: yüzde ${pct}`}
      >
        <div
          className={cn('h-full rounded-full', tone === 'success' ? 'bg-success' : 'bg-brand-500')}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </li>
  );
}
