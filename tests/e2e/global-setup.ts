/**
 * E2E ısınma adımı.
 *
 * Testler geliştirme sunucusuna karşı koşuyor ve Next.js her rotayı İLK
 * istekte derliyor. Uzun bir koşunun sonunda ilk kez ziyaret edilen bir rota
 * (çıkış, panel alt sayfaları, ödeme dönüşü) saniyelerce derleniyor ve testin
 * 60 saniyelik bütçesini aşabiliyor.
 *
 * Bu, her koşuda BAŞKA bir testin düşmesine yol açıyordu — sıra kime gelirse.
 * Testleri tek tek daha uzun zaman aşımıyla yamamak sebebi değil belirtiyi
 * tedavi etmek olurdu; burada rotalar bir kez ısıtılıyor.
 *
 * Gecikme üründe değil: aynı sayfalar üretim derlemesinde 50–200 ms.
 */

const ROTALAR = [
  '/',
  '/kesfet',
  '/kesfet?kategori=hali-saha',
  '/giris',
  '/kayit',
  '/kayit/isletme',
  '/kayit/isletme/paket',
  '/cikis',
  '/profil',
  '/randevularim',
  '/bildirimler',
  '/favorilerim',
  '/kvkk',
  '/sozlesme',
  '/odeme/donus?kod=ISINMA',
  '/isletme/kavakli-ocakbasi',
  '/isletme/kavakli-ocakbasi/randevu',
  '/panel',
  '/panel/gulveren-spor-tesisleri',
  '/panel/gulveren-spor-tesisleri/takvim',
  '/panel/gulveren-spor-tesisleri/randevular',
  '/panel/gulveren-spor-tesisleri/musteriler',
  '/panel/gulveren-spor-tesisleri/hizmetler',
  '/panel/gulveren-spor-tesisleri/personel',
  '/panel/gulveren-spor-tesisleri/subeler',
  '/panel/gulveren-spor-tesisleri/kampanyalar',
  '/panel/gulveren-spor-tesisleri/raporlar',
  '/panel/gulveren-spor-tesisleri/ayarlar',
  '/panel/gulveren-spor-tesisleri/bildirimler',
  '/panel/kavakli-ocakbasi/menu',
  '/yonetim',
  '/yonetim/isletmeler',
  '/yonetim/kullanicilar',
  '/yonetim/kategoriler',
  '/yonetim/degerlendirmeler',
  '/yonetim/randevular',
  '/yonetim/komisyon',
  '/yonetim/analitik',
  '/yonetim/kuyruk',
];

export default async function globalSetup(): Promise<void> {
  const taban = `http://127.0.0.1:${process.env['E2E_PORT'] ?? 3100}`;
  const basla = Date.now();

  // Sırayla: paralel istek dev sunucusunu derleme sırasında boğuyor ve
  // ısınma amacının tersine çalışıyor.
  for (const rota of ROTALAR) {
    try {
      await fetch(`${taban}${rota}`, { redirect: 'manual' });
    } catch {
      // Isınma en iyi çaba: bir rota derlenemezse asıl test zaten düşer ve
      // sebebi orada görünür. Burada durmak, teşhisi gizlemek olurdu.
    }
  }

  console.info(`E2E ısınma: ${ROTALAR.length} rota, ${Math.round((Date.now() - basla) / 1000)} sn`);
}
