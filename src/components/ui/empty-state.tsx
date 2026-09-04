import * as React from 'react';
import { cn } from '@/lib/utils';

/** Boş ekranlar bir sonraki adımı önerir; sadece "veri yok" demez. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  tone = 'neutral',
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  tone?: 'neutral' | 'danger';
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-12 text-center',
        tone === 'danger' ? 'border-danger-line bg-danger-soft/50' : 'border-line-strong bg-surface',
        className,
      )}
    >
      {icon ? (
        <div
          className={cn(
            'mb-3 flex h-12 w-12 items-center justify-center rounded-2xl',
            tone === 'danger' ? 'bg-danger-soft text-danger' : 'bg-brand-50 text-brand-600',
          )}
          aria-hidden
        >
          {icon}
        </div>
      ) : null}
      <p className="text-[15px] font-semibold text-navy">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-[13.5px] leading-relaxed text-ink-3">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
