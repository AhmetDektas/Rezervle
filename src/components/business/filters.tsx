'use client';

import * as React from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, Label } from '@/components/ui/field';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { ANKARA_DISTRICTS } from '@/lib/constants';
import { cn } from '@/lib/utils';

export type FilterOption = { slug: string; name: string };

const SORTS = [
  { value: 'onerilen', label: 'Önerilen' },
  { value: 'puan', label: 'En yüksek puan' },
  { value: 'fiyat', label: 'En uygun fiyat' },
  { value: 'yeni', label: 'Yeni eklenenler' },
];

/** URL parametreleri tek kaynaktır: filtrelenmiş liste paylaşılabilir. */
export function BusinessFilters({
  categories,
  total,
}: {
  categories: FilterOption[];
  total: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [open, setOpen] = React.useState(false);

  const current = {
    kategori: params.get('kategori') ?? '',
    ilce: params.get('ilce') ?? '',
    sirala: params.get('sirala') ?? 'onerilen',
    puan: params.get('puan') ?? '',
    fiyat: params.get('fiyat') ?? '',
    bugun: params.get('bugun') === '1',
  };

  const activeCount =
    (current.kategori ? 1 : 0) +
    (current.ilce ? 1 : 0) +
    (current.puan ? 1 : 0) +
    (current.fiyat ? 1 : 0) +
    (current.bugun ? 1 : 0);

  function apply(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '') next.delete(k);
      else next.set(k, v);
    }
    router.push(`${pathname}?${next.toString()}`);
  }

  function clearAll() {
    const next = new URLSearchParams();
    const q = params.get('q');
    if (q) next.set('q', q);
    router.push(`${pathname}?${next.toString()}`);
    setOpen(false);
  }

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="secondary" size="sm" className="shrink-0">
            <SlidersHorizontal size={15} aria-hidden />
            Filtreler
            {activeCount > 0 ? (
              <span className="tnum ml-0.5 rounded-full bg-brand-500 px-1.5 text-[11px] font-semibold text-white">
                {activeCount}
              </span>
            ) : null}
          </Button>
        </DialogTrigger>
        <DialogContent title="Filtreler" description={`${total} işletme listeleniyor`} size="sm">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="f-kategori">Kategori</Label>
              <Select
                id="f-kategori"
                value={current.kategori}
                onChange={(e) => apply({ kategori: e.target.value })}
              >
                <option value="">Tüm kategoriler</option>
                {categories.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="f-ilce">Semt</Label>
              <Select id="f-ilce" value={current.ilce} onChange={(e) => apply({ ilce: e.target.value })}>
                <option value="">Tüm semtler</option>
                {ANKARA_DISTRICTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="f-puan">En düşük puan</Label>
              <Select id="f-puan" value={current.puan} onChange={(e) => apply({ puan: e.target.value })}>
                <option value="">Fark etmez</option>
                <option value="4.5">4,5 ve üzeri</option>
                <option value="4">4,0 ve üzeri</option>
                <option value="3">3,0 ve üzeri</option>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="f-fiyat">Fiyat aralığı</Label>
              <Select id="f-fiyat" value={current.fiyat} onChange={(e) => apply({ fiyat: e.target.value })}>
                <option value="">Fark etmez</option>
                <option value="1">Ekonomik</option>
                <option value="2">Orta segment</option>
                <option value="3">Üst segment</option>
              </Select>
            </div>

            <label className="flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-xl border border-line-strong p-3">
              <input
                type="checkbox"
                checked={current.bugun}
                onChange={(e) => apply({ bugun: e.target.checked ? '1' : null })}
                className="h-[18px] w-[18px] rounded border-line-strong text-brand-500 focus:ring-brand-500"
              />
              <span className="text-[14px] text-navy">Yalnızca bugün müsait olanlar</span>
            </label>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={clearAll} type="button">
              Filtreleri temizle
            </Button>
            <DialogClose asChild>
              <Button type="button">{total} sonucu göster</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Chip active={current.bugun} onClick={() => apply({ bugun: current.bugun ? null : '1' })}>
        Bugün müsait
      </Chip>
      <Chip active={current.puan === '4'} onClick={() => apply({ puan: current.puan === '4' ? null : '4' })}>
        4 yıldız ve üzeri
      </Chip>
      <Chip active={current.fiyat === '1'} onClick={() => apply({ fiyat: current.fiyat === '1' ? null : '1' })}>
        Ekonomik
      </Chip>

      {activeCount > 0 ? (
        <button
          onClick={clearAll}
          className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full px-3 text-[13px] font-medium text-ink-3 hover:text-navy"
        >
          <X size={14} aria-hidden />
          Temizle
        </button>
      ) : null}

      <div className="ml-auto shrink-0 pl-2">
        <Select
          aria-label="Sıralama"
          value={current.sirala}
          onChange={(e) => apply({ sirala: e.target.value })}
          className="h-9 w-auto min-w-[150px] text-[13px]"
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex h-9 shrink-0 items-center rounded-full border px-3.5 text-[13px] font-medium transition',
        active
          ? 'border-brand-500 bg-brand-50 text-brand-700'
          : 'border-line-strong bg-surface text-ink-2 hover:border-brand-300 hover:text-navy',
      )}
    >
      {children}
    </button>
  );
}
