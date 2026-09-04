'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Keşfet aramasına yönlendiren giriş alanı. Enter ile arar, X ile temizler. */
export function SearchInput({
  className,
  placeholder = 'Hizmet, işletme veya semt ara',
  autoFocus = false,
  size = 'md',
}: {
  className?: string;
  placeholder?: string;
  autoFocus?: boolean;
  size?: 'md' | 'lg';
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [value, setValue] = React.useState(params.get('q') ?? '');

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const next = new URLSearchParams(params.toString());
    if (value.trim()) next.set('q', value.trim());
    else next.delete('q');
    router.push(`/kesfet?${next.toString()}`);
  }

  return (
    <form onSubmit={submit} role="search" className={cn('relative', className)}>
      <Search
        size={18}
        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3"
        aria-hidden
      />
      <input
        type="search"
        name="q"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label="Ara"
        className={cn(
          'w-full rounded-xl border border-line-strong bg-surface pl-11 pr-10 text-[15px] text-navy placeholder:text-ink-3 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100',
          size === 'lg' ? 'h-12' : 'h-11',
        )}
      />
      {value ? (
        <button
          type="button"
          onClick={() => setValue('')}
          aria-label="Aramayı temizle"
          className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-ink-3 hover:bg-sunken"
        >
          <X size={16} aria-hidden />
        </button>
      ) : null}
    </form>
  );
}
