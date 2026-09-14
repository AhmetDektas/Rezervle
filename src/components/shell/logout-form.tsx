'use client';

import * as React from 'react';
import { pushAbonelikBitirAction } from '@/app/actions/push';

/**
 * Çıkış formu — çıkarken bu cihazın push aboneliğini de bırakır.
 *
 * NEDEN GEREKLİ: abonelik hesaba bağlı, tarayıcıya değil. A hesabı bildirim
 * açıp çıkış yaptığında uç nokta sunucuda A'ya bağlı kalıyordu ve cihaz A'nın
 * randevu bildirimlerini almaya devam ediyordu — hesabı kapatmış olmasına
 * rağmen. Ortak kullanılan bir bilgisayarda ya da devredilen bir telefonda bu
 * doğrudan kişisel veri sızıntısı.
 *
 * Diğer yarısı `push-toggle.tsx` içinde: yeni kullanıcı giriş yaptığında
 * abonelik ona yeniden bağlanıyor. Bu ikisi birlikte "cihaz her zaman o an
 * giriş yapmış kişiye ait" kuralını kuruyor.
 *
 * ÇIKIŞI HİÇBİR ŞEY ENGELLEMEZ. Abonelik bırakma başarısız olursa da form
 * gönderiliyor: oturumu kapatamamak, bildirim kaydını silememekten çok daha
 * kötü. Bu yüzden `finally` içinde gönderiliyor ve süre sınırı var.
 */

/** Abonelik bırakma için üst sınır; aşılırsa çıkış yine de yapılır. */
const BIRAKMA_SURESI_MS = 2_000;

export function LogoutForm({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const form = React.useRef<HTMLFormElement>(null);
  const [gonderiliyor, setGonderiliyor] = React.useState(false);

  async function birak(): Promise<void> {
    if (!('serviceWorker' in navigator)) return;
    const kayit = await navigator.serviceWorker.getRegistration();
    const abone = await kayit?.pushManager.getSubscription();
    if (!abone) return;
    await pushAbonelikBitirAction({ endpoint: abone.endpoint });
    await abone.unsubscribe().catch(() => {});
  }

  async function gonder(e: React.FormEvent<HTMLFormElement>) {
    if (gonderiliyor) return; // finally'den gelen ikinci gönderim
    e.preventDefault();
    setGonderiliyor(true);
    try {
      await Promise.race([
        birak(),
        new Promise((r) => setTimeout(r, BIRAKMA_SURESI_MS)),
      ]);
    } catch {
      // Yut: çıkış her hâlükârda yapılacak.
    } finally {
      form.current?.requestSubmit();
    }
  }

  return (
    <form ref={form} action="/cikis" method="post" onSubmit={gonder} className={className}>
      {children}
    </form>
  );
}
