'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { simulateThreeDSAction } from '@/app/actions/payment';

/**
 * Sahte 3DS sonucu seçimi (T17).
 *
 * Üç seçenek gerçek dünyanın üç sonucu: onaylandı, banka reddetti, müşteri
 * terk etti. Üçüncüsü en sinsisi — hiçbir olay gelmez ve saat, süresi dolana
 * kadar kilitli kalır (T5 işini bu senaryo için yazdık).
 */
export function MockThreeDSForm({ providerRef, code }: { providerRef: string; code: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = React.useState<'paid' | 'failed' | null>(null);

  async function sec(sonuc: 'paid' | 'failed') {
    setPending(sonuc);
    const r = await simulateThreeDSAction({ providerRef, code, outcome: sonuc });
    setPending(null);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    // Gerçek akışta banka bizi dönüş adresine yollar; burada da öyle yapıyoruz.
    router.push(`/odeme/donus?kod=${encodeURIComponent(code)}`);
  }

  return (
    <div className="mt-5 space-y-2">
      <Button full loading={pending === 'paid'} disabled={pending !== null} onClick={() => sec('paid')}>
        Ödemeyi onayla
      </Button>
      <Button
        full
        variant="secondary"
        loading={pending === 'failed'}
        disabled={pending !== null}
        onClick={() => sec('failed')}
      >
        Bankadan reddedildi
      </Button>
      <p className="pt-1 text-center text-[12.5px] text-ink-3">
        Sekmeyi kapatırsanız ödeme terk edilmiş sayılır ve saat 15 dakika içinde
        yeniden satışa açılır.
      </p>
    </div>
  );
}
