'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, CheckCircle2, XCircle, Clock3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { paymentStateAction } from '@/app/actions/payment';

/**
 * 3DS dönüş ekranı (T19).
 *
 * Müşteri bankadan döndüğünde sonucu **henüz bilmiyoruz**: onu webhook
 * getiriyor ve saniyeler sürebilir. "Başarılı" yazmak da "başarısız" yazmak
 * da o anda yalan olurdu — biri müşteriyi olmayan bir randevuya, diğeri
 * ödediği hâlde vazgeçmeye götürür.
 *
 * Bu yüzden ekran üç durumu ayrı ayrı gösteriyor ve bekleme durumunu açıkça
 * söylüyor:
 *
 *   bekliyor ──(webhook)──▶ onaylandı
 *       │
 *       └──(süre doldu / red)──▶ oluşturulamadı
 *
 * Yoklama sabit aralıklı ve üst sınırlı: sonsuz dönen bir çark, arıza
 * durumunda kullanıcıyı ekranda hapsederdi.
 */

const ARALIK_MS = 2000;
const UST_SINIR_MS = 90_000;

type Durum = 'bekliyor' | 'onaylandi' | 'basarisiz' | 'zaman-asimi' | 'hata';

export function PaymentReturn({ code }: { code: string }) {
  const router = useRouter();
  const [durum, setDurum] = React.useState<Durum>('bekliyor');
  const [reservationId, setReservationId] = React.useState<string | null>(null);
  const [mesaj, setMesaj] = React.useState<string | null>(null);

  React.useEffect(() => {
    let durduruldu = false;
    const baslangic = Date.now();

    async function yokla() {
      const r = await paymentStateAction(code);
      if (durduruldu) return;

      if (!r.ok) {
        setDurum('hata');
        setMesaj(r.error);
        return;
      }
      setReservationId(r.data.reservationId);

      if (r.data.depositStatus === 'PAID') {
        setDurum('onaylandi');
        router.refresh();
        return;
      }
      if (r.data.cancelled) {
        setDurum('basarisiz');
        return;
      }
      if (Date.now() - baslangic > UST_SINIR_MS) {
        setDurum('zaman-asimi');
        return;
      }
      setTimeout(() => void yokla(), ARALIK_MS);
    }

    void yokla();
    return () => {
      durduruldu = true;
    };
  }, [code, router]);

  if (durum === 'onaylandi') {
    return (
      <Kart
        ikon={<CheckCircle2 size={26} className="text-success" aria-hidden />}
        baslik="Ödemeniz alındı"
        metin="Randevunuz onaylandı. Ayrıntıları randevu sayfanızda görebilirsiniz."
      >
        <Button asChild full>
          <Link href={reservationId ? `/randevularim/${reservationId}` : '/randevularim'}>
            Randevuma git
          </Link>
        </Button>
      </Kart>
    );
  }

  if (durum === 'basarisiz') {
    return (
      <Kart
        ikon={<XCircle size={26} className="text-danger" aria-hidden />}
        baslik="Randevu oluşturulamadı"
        metin="Kapora tahsil edilemediği için saat yeniden satışa açıldı. Dilerseniz tekrar deneyebilirsiniz."
      >
        <Button asChild full>
          <Link href="/kesfet">İşletmeleri keşfet</Link>
        </Button>
      </Kart>
    );
  }

  if (durum === 'zaman-asimi') {
    return (
      <Kart
        ikon={<Clock3 size={26} className="text-warn" aria-hidden />}
        baslik="Sonuç hâlâ bekleniyor"
        metin="Bankanızdan onay bilgisi beklenmeye devam ediyor. Bu ekranı kapatabilirsiniz; sonuç belli olduğunda size bildirim göndereceğiz."
      >
        <Button asChild full variant="secondary">
          <Link href="/randevularim">Randevularıma git</Link>
        </Button>
      </Kart>
    );
  }

  if (durum === 'hata') {
    return (
      <Kart
        ikon={<XCircle size={26} className="text-danger" aria-hidden />}
        baslik="Durum okunamadı"
        metin={mesaj ?? 'Beklenmeyen bir sorun oluştu.'}
      >
        <Button asChild full variant="secondary">
          <Link href="/randevularim">Randevularıma git</Link>
        </Button>
      </Kart>
    );
  }

  return (
    <Kart
      ikon={<Loader2 size={26} className="animate-spin text-brand-600" aria-hidden />}
      baslik="Ödemeniz doğrulanıyor"
      metin="Bankanızdan gelen onayı bekliyoruz. Bu genelde birkaç saniye sürer; lütfen sayfayı kapatmayın."
    />
  );
}

function Kart({
  ikon,
  baslik,
  metin,
  children,
}: {
  ikon: React.ReactNode;
  baslik: string;
  metin: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="card p-6 text-center" role="status" aria-live="polite">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sunken">
        {ikon}
      </div>
      <h1 className="mt-4 text-[19px] font-semibold tracking-[-0.01em]">{baslik}</h1>
      <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{metin}</p>
      {children ? <div className="mt-5">{children}</div> : null}
    </div>
  );
}
