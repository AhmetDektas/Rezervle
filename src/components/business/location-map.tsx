'use client';

import * as React from 'react';
import { MapPin, ExternalLink } from 'lucide-react';

/**
 * İşletme konumu haritası.
 *
 * Google'ın klasik gömme adresi (`output=embed`) kullanılıyor: API anahtarı
 * istemiyor. Resmî Maps Embed API daha fazlasını yapıyor ama faturalandırılan
 * bir anahtar gerektiriyor — anahtar olmadan harita SESSİZCE boş bir kutu
 * olarak yüklenirdi, ki bu "harita var" görüntüsüyle "harita yok" gerçeğinin
 * en kötü birleşimi.
 *
 * **iframe ekrana girene kadar HİÇ kurulmuyor.** `loading="lazy"` yetmedi:
 * tarayıcı görüş alanına yakın çerçeveleri yine de yüklemeye başlıyor ve
 * üçüncü taraf yavaşladığında sayfanın `load` olayı onu bekliyor. Sonuç,
 * bizim içeriğimizle ilgisi olmayan bir gecikme — testlerde zaman aşımı
 * olarak, gerçek kullanıcıda "sayfa hâlâ yükleniyor" hissi olarak görünüyordu.
 *
 * Koordinat varsa nokta tam yerinde; yoksa adres metniyle aranıyor. İkisi de
 * yoksa harita hiç gösterilmiyor: yanlış bir konum, konum göstermemekten
 * kötüdür — müşteri yanlış yere gider.
 */
export function LocationMap({
  name,
  address,
  district,
  city,
  lat,
  lng,
  variant = 'card',
}: {
  name: string;
  address: string;
  district: string;
  city: string;
  lat?: number | null;
  lng?: number | null;
  /**
   * `hero`: sayfanın en üstünde, kapak yerine. Adres satırı yok — altındaki
   * işletme kartı oraya biniyor ve gizlenmiş bir satır bilgi taşımaz.
   * Yol tarifi bağlantısı bu yüzden haritanın üstünde yüzüyor.
   */
  variant?: 'card' | 'hero';
}) {
  const tamAdres = `${address}, ${district}, ${city}`;
  const koordinatVar = typeof lat === 'number' && typeof lng === 'number';

  // Koordinat kesin; adres araması yaklaşık.
  //
  // `enlem,boylam(Etiket)` biçimi haritaya ADI YAZAN bir iğne koyuyor. Düz
  // adres sorgusu, kurgusal ya da yeni bir adresi çözemediğinde bölgeyi
  // gösterip iğneyi hiç koymuyordu — kullanıcı "işletme tam olarak nerede"
  // sorusunu cevapsız bırakan bir harita görüyordu.
  const sorgu = koordinatVar ? `${lat},${lng}(${name})` : `${name}, ${tamAdres}`;
  const gomme = `https://maps.google.com/maps?q=${encodeURIComponent(sorgu)}&z=16&output=embed`;
  // Yol tarifi bağlantısında etiket parantezi işe yaramıyor; ham koordinat
  // ya da adres gidiyor.
  const disHedef = koordinatVar ? `${lat},${lng}` : `${name}, ${tamAdres}`;
  const disBaglanti = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(disHedef)}`;

  const kutuRef = React.useRef<HTMLDivElement>(null);
  const [gorunur, setGorunur] = React.useState(false);

  React.useEffect(() => {
    const el = kutuRef.current;
    if (!el || gorunur) return;
    // IntersectionObserver olmayan ortamda haritayı doğrudan göster:
    // özelliğin hiç çalışmaması, geç yüklenmesinden kötü.
    if (typeof IntersectionObserver === 'undefined') {
      setGorunur(true);
      return;
    }
    const gozlemci = new IntersectionObserver(
      (girisler) => {
        if (girisler.some((g) => g.isIntersecting)) {
          setGorunur(true);
          gozlemci.disconnect();
        }
      },
      // 200px önden: kullanıcı oraya varmadan harita hazır olsun.
      { rootMargin: '200px' },
    );
    gozlemci.observe(el);
    return () => gozlemci.disconnect();
  }, [gorunur]);

  const cerceve = gorunur ? (
    <iframe
      src={gomme}
      title={`${name} konumu`}
      loading="lazy"
      // Referrer gönderilmiyor: harita sağlayıcısına hangi sayfada
      // olduğumuzu bildirmenin bir faydası yok.
      referrerPolicy="no-referrer-when-downgrade"
      className="h-full w-full border-0"
      allowFullScreen
    />
  ) : null;

  if (variant === 'hero') {
    return (
      <section aria-label="Konum" className="relative">
        <div ref={kutuRef} className="h-44 w-full bg-sunken sm:h-60">
          {cerceve}
        </div>
        <a
          href={disBaglanti}
          target="_blank"
          rel="noreferrer"
          className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-xl bg-surface/95 px-3 py-2 text-[13px] font-medium text-brand-600 shadow-card backdrop-blur transition hover:bg-surface"
        >
          <MapPin size={14} aria-hidden />
          Yol tarifi
          <ExternalLink size={12} aria-hidden />
        </a>
      </section>
    );
  }

  return (
    <section aria-label="Konum" className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div ref={kutuRef} className="h-52 w-full bg-sunken sm:h-64">
        {cerceve}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <p className="flex min-w-0 items-start gap-2 text-[13.5px] text-ink-2">
          <MapPin size={15} className="mt-0.5 shrink-0 text-ink-3" aria-hidden />
          <span className="min-w-0">{tamAdres}</span>
        </p>
        <a
          href={disBaglanti}
          target="_blank"
          rel="noreferrer"
          className="inline-flex shrink-0 items-center gap-1.5 text-[13.5px] font-medium text-brand-600 underline-offset-4 hover:underline"
        >
          Yol tarifi
          <ExternalLink size={13} aria-hidden />
        </a>
      </div>
    </section>
  );
}
