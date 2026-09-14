'use client';

import * as React from 'react';
import { Bell, BellOff, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { pushAboneOlAction, pushAbonelikBitirAction } from '@/app/actions/push';

/**
 * Telefona bildirim gönderme izni.
 *
 * İZİN KENDİLİĞİNDEN İSTENMİYOR. Sayfa açılır açılmaz izin kutusu çıkarmak
 * en yüksek ret oranını veren kalıp; Chrome bunu yapan siteleri ayrıca
 * kısıtlıyor. Kullanıcı düğmeye bastığında, ne için istendiğini okuduktan
 * sonra soruyoruz.
 *
 * DESTEKLENMEYEN DURUMLAR SESSİZCE GİZLENMİYOR: "neden bu düğme çalışmıyor"
 * sorusunun cevabı ekranda yazıyor. Özellikle iOS'ta push YALNIZCA uygulama
 * ana ekrana eklendiğinde çalışıyor (16.4+) — bunu söylemezsek işletme sahibi
 * bildirimlerin çalıştığını sanıp randevu kaçırır.
 */

type Durum = 'yukleniyor' | 'destekyok' | 'ioskurulumgerek' | 'kapali' | 'acik' | 'reddedildi';

function iosMu(): boolean {
  if (typeof navigator === 'undefined') return false;
  // iPadOS kendini Mac gibi tanıtıyor; dokunma noktası sayısı ayırıyor.
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function anaEkranaEklenmis(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari standart API'yi desteklemiyor, kendi bayrağını koyuyor.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** base64url VAPID anahtarını subscribe()'ın beklediği bayt dizisine çevirir. */
function anahtariCoz(base64: string): Uint8Array {
  const dolgu = '='.repeat((4 - (base64.length % 4)) % 4);
  const duz = (base64 + dolgu).replace(/-/g, '+').replace(/_/g, '/');
  const ham = atob(duz);
  const cikti = new Uint8Array(ham.length);
  for (let i = 0; i < ham.length; i += 1) cikti[i] = ham.charCodeAt(i);
  return cikti;
}

/**
 * Kitleye göre metin.
 *
 * İşletme için push BİRİNCİL kanal: panel kapalıyken haber almanın tek yolu.
 * Müşteri için EK kanal — SMS ve e-posta zaten gidiyor. Metinlerin bunu doğru
 * söylemesi gerekiyor: müşteriye "bildirim kapalıysa haberin olmaz" demek
 * yanlış olurdu, işletmeye "zaten SMS gidiyor" demek de öyle.
 */
const METIN = {
  isletme: {
    kapaliIpucu: 'Yeni randevu geldiğinde e-posta beklemeden haberiniz olur.',
    acikIpucu: 'Yeni randevu ve iptaller bu cihaza anında düşüyor.',
    yedekKanal: 'Randevu bildirimleri e-posta ile gelmeye devam ediyor.',
  },
  musteri: {
    kapaliIpucu: 'Randevu onayı ve hatırlatma bu cihaza da düşsün.',
    acikIpucu: 'Randevu onayı ve hatırlatmalar bu cihaza da düşüyor.',
    yedekKanal: 'Randevu bildirimleriniz SMS ve e-posta ile gelmeye devam ediyor.',
  },
} as const;

export function PushToggle({
  acikAnahtar,
  kitle = 'isletme',
}: {
  acikAnahtar: string | null;
  kitle?: keyof typeof METIN;
}) {
  const metin = METIN[kitle];
  const toast = useToast();
  const [durum, setDurum] = React.useState<Durum>('yukleniyor');
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    let iptal = false;
    (async () => {
      if (!acikAnahtar) return void (!iptal && setDurum('destekyok'));
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        // iOS'ta PushManager ana ekrana eklenmeden HİÇ tanımlı değil.
        return void (!iptal && setDurum(iosMu() && !anaEkranaEklenmis() ? 'ioskurulumgerek' : 'destekyok'));
      }
      if (Notification.permission === 'denied') return void (!iptal && setDurum('reddedildi'));

      const kayit = await navigator.serviceWorker.getRegistration();
      // Servis çalışanı yalnızca üretimde kaydediliyor (bkz. service-worker.tsx):
      // geliştirmede burada kayıt bulunmaz ve bu beklenen durumdur.
      if (!kayit) return void (!iptal && setDurum('destekyok'));

      const abone = await kayit.pushManager.getSubscription();
      if (!abone) return void (!iptal && setDurum('kapali'));

      // ORTAK CİHAZ: aboneliği HER AÇILIŞTA mevcut kullanıcıya yeniden bağla.
      //
      // Önceden yalnızca tarayıcıdaki aboneliğe bakılıp "açık" deniyordu.
      // A hesabı bildirim açıp çıkış yapar, aynı tarayıcıda B giriş yaparsa
      // uç nokta sunucuda hâlâ A'ya bağlı kalıyordu: B, A'nın randevu
      // bildirimlerini görüyor, kendi bildirimlerini alamıyordu.
      //
      // `pushAbone` uç nokta tekilliği üzerinden sahibi güncellediği için
      // yeniden göndermek bağı düzeltiyor. Sunucu reddederse (ör. artık
      // desteklenmeyen bir push servisi) tarayıcı aboneliği de bırakılıyor,
      // yoksa kullanıcı çalıştığını sanırdı.
      const json = abone.toJSON();
      const eslestir = await pushAboneOlAction({
        endpoint: abone.endpoint,
        p256dh: json.keys?.['p256dh'] ?? '',
        auth: json.keys?.['auth'] ?? '',
        userAgent: navigator.userAgent,
      });
      if (!eslestir.ok) {
        await abone.unsubscribe().catch(() => {});
        return void (!iptal && setDurum('kapali'));
      }
      if (!iptal) setDurum('acik');
    })().catch(() => {
      if (!iptal) setDurum('destekyok');
    });
    return () => {
      iptal = true;
    };
  }, [acikAnahtar]);

  async function ac() {
    if (!acikAnahtar) return;
    setPending(true);
    try {
      const izin = await Notification.requestPermission();
      if (izin !== 'granted') {
        setDurum(izin === 'denied' ? 'reddedildi' : 'kapali');
        return;
      }
      const kayit = await navigator.serviceWorker.ready;
      const abone = await kayit.pushManager.subscribe({
        // Zorunlu: her push bir bildirim göstermek zorunda. Sessiz push
        // tarayıcının izni geri almasına yol açıyor.
        userVisibleOnly: true,
        applicationServerKey: anahtariCoz(acikAnahtar),
      });
      const json = abone.toJSON();
      const sonuc = await pushAboneOlAction({
        endpoint: abone.endpoint,
        p256dh: json.keys?.['p256dh'] ?? '',
        auth: json.keys?.['auth'] ?? '',
        userAgent: navigator.userAgent,
      });
      if (!sonuc.ok) {
        // Sunucu kaydı tutmadıysa tarayıcıdaki aboneliği de geri al: aksi
        // halde tarayıcı "abonesin" der, sunucu o cihazı hiç bilmez ve
        // kullanıcı çalıştığını sanır.
        await abone.unsubscribe().catch(() => {});
        toast.error('Bildirim açılamadı', sonuc.error);
        setDurum('kapali');
        return;
      }
      setDurum('acik');
      toast.success('Bildirimler açıldı', metin.acikIpucu);
    } catch {
      toast.error('Bildirim açılamadı', 'Tarayıcı isteği tamamlayamadı.');
      setDurum('kapali');
    } finally {
      setPending(false);
    }
  }

  async function kapat() {
    setPending(true);
    try {
      const kayit = await navigator.serviceWorker.ready;
      const abone = await kayit.pushManager.getSubscription();
      if (abone) {
        await pushAbonelikBitirAction({ endpoint: abone.endpoint });
        await abone.unsubscribe().catch(() => {});
      }
      setDurum('kapali');
      toast.success('Bildirimler kapatıldı');
    } catch {
      toast.error('Bildirim kapatılamadı');
    } finally {
      setPending(false);
    }
  }

  if (durum === 'yukleniyor') return null;

  if (durum === 'ioskurulumgerek') {
    return (
      <Aciklama ikon={<Smartphone size={16} />}>
        iPhone ve iPad&apos;de bildirim, uygulama ana ekrana eklendikten sonra
        çalışıyor. Safari&apos;de <strong>Paylaş → Ana Ekrana Ekle</strong> deyip
        uygulamayı oradan açın. {metin.yedekKanal}
      </Aciklama>
    );
  }

  if (durum === 'destekyok') {
    return (
      <Aciklama ikon={<BellOff size={16} />}>
        Bu tarayıcı anlık bildirimi desteklemiyor. {metin.yedekKanal}
      </Aciklama>
    );
  }

  if (durum === 'reddedildi') {
    return (
      <Aciklama ikon={<BellOff size={16} />}>
        Bildirim izni bu site için engellenmiş. Tarayıcının adres çubuğundaki kilit
        simgesinden izni açtıktan sonra tekrar deneyebilirsiniz.
      </Aciklama>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        variant={durum === 'acik' ? 'secondary' : 'primary'}
        size="sm"
        loading={pending}
        onClick={durum === 'acik' ? kapat : ac}
      >
        {durum === 'acik' ? <BellOff size={15} /> : <Bell size={15} />}
        {durum === 'acik' ? 'Bu cihazda kapat' : 'Bu cihaza bildirim gönder'}
      </Button>
      <p className="text-[13px] text-ink-3">
        {durum === 'acik' ? metin.acikIpucu : metin.kapaliIpucu}
      </p>
    </div>
  );
}

function Aciklama({ ikon, children }: { ikon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-line bg-sunken px-3.5 py-3 text-[13px] leading-relaxed text-ink-2">
      <span className="mt-0.5 shrink-0 text-ink-3">{ikon}</span>
      <span>{children}</span>
    </div>
  );
}
