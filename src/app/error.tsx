'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Hata ayrıntısı kullanıcıya gösterilmez; yalnızca sunucu günlüğüne düşer.
    console.error('[rezzerv] arayüz hatası:', error);
  }, [error]);

  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-danger-soft text-danger">
        <AlertTriangle size={26} aria-hidden />
      </div>
      <h1 className="mt-5 text-[20px] font-semibold">Bir şeyler ters gitti</h1>
      <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-ink-2">
        Sayfa yüklenirken beklenmeyen bir hata oluştu. Tekrar denediğinizde çoğu durumda düzelir.
      </p>
      {error.digest ? (
        <p className="mt-2 font-mono text-[12px] text-ink-3">Hata kodu: {error.digest}</p>
      ) : null}
      <Button onClick={reset} className="mt-5">
        <RotateCw size={16} aria-hidden />
        Tekrar dene
      </Button>
    </div>
  );
}
