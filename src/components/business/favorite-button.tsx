'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Heart } from 'lucide-react';
import { toggleFavoriteAction } from '@/app/actions/customer';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

/** Favori değişimi anında gösterilir, hata olursa geri alınır. */
export function FavoriteButton({
  businessId,
  initial,
  loggedIn,
  className,
  label = false,
}: {
  businessId: string;
  initial: boolean;
  loggedIn: boolean;
  className?: string;
  label?: boolean;
}) {
  const [favorite, setFavorite] = React.useState(initial);
  const [pending, setPending] = React.useState(false);
  const toast = useToast();
  const router = useRouter();

  async function toggle() {
    if (!loggedIn) {
      router.push(`/giris?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    const next = !favorite;
    setFavorite(next);
    setPending(true);
    const result = await toggleFavoriteAction(businessId);
    setPending(false);
    if (!result.ok) {
      setFavorite(!next);
      toast.error(result.error);
      return;
    }
    toast.success(result.data.favorite ? 'Favorilere eklendi' : 'Favorilerden çıkarıldı');
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={favorite}
      aria-label={favorite ? 'Favorilerden çıkar' : 'Favorilere ekle'}
      className={cn(
        'inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-line-strong bg-surface px-3.5 text-[14px] font-medium transition hover:bg-sunken disabled:opacity-60',
        favorite ? 'text-danger' : 'text-ink-2',
        className,
      )}
    >
      <Heart size={18} className={favorite ? 'fill-danger' : ''} aria-hidden />
      {label ? (favorite ? 'Favorilerde' : 'Favorilere ekle') : null}
    </button>
  );
}
