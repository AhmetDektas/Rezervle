import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import type { ReservationStatus } from '@/lib/constants';
import { RESERVATION_STATUS_LABEL } from '@/lib/constants';

const badge = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[12px] font-medium leading-5',
  {
    variants: {
      tone: {
        neutral: 'border-line-strong bg-sunken text-ink-2',
        blue: 'border-brand-200 bg-brand-50 text-brand-700',
        green: 'border-success-line bg-success-soft text-success',
        red: 'border-danger-line bg-danger-soft text-danger',
        amber: 'border-warn-line bg-warn-soft text-warn',
        solid: 'border-transparent bg-navy text-white',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badge>;

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badge({ tone }), className)} {...props} />;
}

const STATUS_TONE: Record<ReservationStatus, NonNullable<BadgeProps['tone']>> = {
  PENDING: 'amber',
  CONFIRMED: 'blue',
  ARRIVED: 'blue',
  COMPLETED: 'green',
  NO_SHOW: 'red',
  CANCELLED: 'red',
};

export function StatusBadge({ status, className }: { status: ReservationStatus; className?: string }) {
  return (
    <Badge tone={STATUS_TONE[status]} className={className}>
      <span
        aria-hidden
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          status === 'COMPLETED' && 'bg-success',
          status === 'PENDING' && 'bg-warn',
          (status === 'CONFIRMED' || status === 'ARRIVED') && 'bg-brand-500',
          (status === 'CANCELLED' || status === 'NO_SHOW') && 'bg-danger',
        )}
      />
      {RESERVATION_STATUS_LABEL[status]}
    </Badge>
  );
}
