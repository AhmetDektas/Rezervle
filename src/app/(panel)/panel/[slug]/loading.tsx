import { Skeleton } from '@/components/ui/skeleton';

export default function PanelLoading() {
  return (
    <div className="space-y-5" role="status" aria-label="Yükleniyor">
      <Skeleton className="h-7 w-40" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <Skeleton className="h-80 rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
      <span className="sr-only">Yükleniyor…</span>
    </div>
  );
}
