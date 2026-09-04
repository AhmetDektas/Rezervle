import { AlertTriangle } from 'lucide-react';
import type { ReservationIssue } from '@/server/audit';
import { cn } from '@/lib/utils';

/**
 * Sonradan geçersizleşen randevuyu işaretler.
 *
 * Çakışma oluşturma anında engellendiği için bu rozet nadir görünür; göründüğü
 * anlar gerçekten dikkat gerektirir (saat değişikliği, sonradan eklenen mola).
 */
export function IssueBadge({ issue, className }: { issue: ReservationIssue; className?: string }) {
  return (
    <span
      title={issue.detail}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-danger-line bg-danger-soft px-2.5 py-0.5 text-[12px] font-medium leading-5 text-danger',
        className,
      )}
    >
      <AlertTriangle size={12} aria-hidden />
      {issue.badge}
    </span>
  );
}

/** Satır altında gösterilen açıklama kutusu. */
export function IssueNote({ issue }: { issue: ReservationIssue }) {
  return (
    <p
      role="alert"
      className="mt-2 flex items-start gap-2 rounded-lg border border-danger-line bg-danger-soft px-2.5 py-1.5 text-[12.5px] text-danger"
    >
      <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden />
      <span>
        {issue.detail} Onaylamadan önce randevuyu taşımanız veya müşteriyle
        görüşmeniz önerilir.
      </span>
    </p>
  );
}
