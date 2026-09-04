'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { Select, Input } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { RESERVATION_STATUSES, RESERVATION_STATUS_LABEL } from '@/lib/constants';

/** Randevu listesi filtreleri. Durum URL'de tutulur; liste paylaşılabilir. */
export function ReservationFilters({ slug }: { slug: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = React.useState(params.get('q') ?? '');

  function apply(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    next.delete('yeni');
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '') next.delete(k);
      else next.set(k, v);
    }
    router.push(`/panel/${slug}/randevular?${next.toString()}`);
  }

  const hasFilter =
    Boolean(params.get('q')) ||
    Boolean(params.get('durum')) ||
    Boolean(params.get('baslangic')) ||
    Boolean(params.get('bitis'));

  return (
    <div className="card flex flex-wrap items-end gap-3 p-3.5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          apply({ q: q.trim() || null });
        }}
        role="search"
        className="relative min-w-[200px] flex-1"
      >
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3"
          aria-hidden
        />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ad, telefon veya randevu kodu"
          aria-label="Randevu ara"
          className="pl-9"
        />
      </form>

      <div className="w-[168px]">
        <Select
          aria-label="Durum"
          value={params.get('durum') ?? ''}
          onChange={(e) => apply({ durum: e.target.value })}
        >
          <option value="">Tüm durumlar</option>
          {RESERVATION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {RESERVATION_STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
      </div>

      <div className="w-[150px]">
        <Input
          type="date"
          aria-label="Başlangıç tarihi"
          value={params.get('baslangic') ?? ''}
          onChange={(e) => apply({ baslangic: e.target.value })}
        />
      </div>
      <div className="w-[150px]">
        <Input
          type="date"
          aria-label="Bitiş tarihi"
          value={params.get('bitis') ?? ''}
          onChange={(e) => apply({ bitis: e.target.value })}
        />
      </div>

      {hasFilter ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setQ('');
            router.push(`/panel/${slug}/randevular`);
          }}
        >
          <X size={15} aria-hidden />
          Temizle
        </Button>
      ) : null}
    </div>
  );
}
