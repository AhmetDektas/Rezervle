import { Skeleton } from '@/components/ui/skeleton';

export default function BusinessLoading() {
  return (
    <div role="status" aria-label="Yükleniyor">
      <Skeleton className="h-40 w-full rounded-none sm:h-56" />
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="relative -mt-8 space-y-3 rounded-2xl border border-line bg-surface p-5 shadow-card">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-7 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
        <div className="mt-6 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      </div>
      <span className="sr-only">Yükleniyor…</span>
    </div>
  );
}
