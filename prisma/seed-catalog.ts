import { BUSINESSES, SERVICE_SETS, SERVICE_SETS_EXTRA, type SeedBusiness } from './seed-data';
import { slugify } from '../src/lib/utils';

/**
 * Katalog: her sektörü 20 işletmeye tamamlayan kayıtlar.
 *
 * Elle yazılmış 26 işletme vitrinin "derin" tarafı — kendi anlatısı, kendi
 * ekibi, kendi menüsü olanlar. Bu dosya sayıyı tamamlıyor.
 *
 * **Görünen alanlar elle yazıldı, derin metin bileşimle üretiliyor.** Listede
 * müşterinin okuduğu şey isim, slogan, semt ve fiyat; bunların 94 tanesini
 * şablondan üretmek "hepsi aynı yerden çıkmış" hissini anında verirdi.
 * Tanıtım metni, olanaklar ve ekip ise sektöre özel havuzlardan bileşiliyor —
 * bu alanlar zaten gerçek hayatta da birbirine benziyor.
 *
 * `light` bayrağı geçmiş randevu penceresini kısaltıyor: 120 işletme için tam
 * pencere ~45 bin randevu demekti ve tohum dakikalarca sürerdi.
 */

type Tohum = {
  ad: string;
  semt: string;
  slogan: string;
  /** 1 ekonomik · 2 orta · 3 üst. Belirtilmezse sektör ortalaması. */
  fiyat?: number;
  onecikan?: boolean;
};

/** Semte göre gerçek cadde/sokak adları: adres alanı inandırıcı olsun. */
const SOKAKLAR: Record<string, string[]> = {
  Çankaya: ['Tunalı Hilmi Cad.', 'Cinnah Cad.', 'Simon Bolivar Cad.', 'Bestekar Sok.', 'Kuloğlu Sok.'],
  Keçiören: ['Kalaba Cad.', 'Fatih Cad.', 'Yayla Cad.', 'Şehit Sok.', 'İncirli Cad.'],
  Yenimahalle: ['İvedik Cad.', 'Ragıp Tüzün Cad.', 'Batı Çarşı Sok.', 'Anadolu Bulvarı', 'Yunus Emre Cad.'],
  Mamak: ['Şahintepe Cad.', 'Natoyolu Cad.', 'Akdere Sok.', 'General Zeki Doğan Cad.'],
  Etimesgut: ['İstasyon Cad.', 'Atatürk Bulvarı', 'Elvankent Cad.', 'Piyade Sok.'],
  Sincan: ['Onur Sok.', 'Fatih Mah. 1234. Cad.', 'Ankara Cad.', 'Törekent Cad.'],
  Altındağ: ['Hacı Bayram Cad.', 'Ulucanlar Cad.', 'Anafartalar Cad.', 'Doğanbey Sok.'],
  Gölbaşı: ['Şafak Mah. Ankara Cad.', 'Sahil Yolu Cad.', 'Karagedik Sok.'],
  Pursaklar: ['Belediye Cad.', 'Merkez Mah. Okul Sok.', 'Saray Cad.'],
};

/** Deterministik seçim: aynı tohum her koşuda aynı sonucu versin. */
function sec<T>(liste: readonly T[], tohum: number): T {
  return liste[Math.abs(tohum) % liste.length]!;
}

/**
 * Uygulamanın kendi slug üreticisini kullanıyor.
 *
 * Kopyası vardı ve düzeltme işaretli harfleri (â) bilmiyordu; "Kasap Dükkânı"
 * için "kasap-dukk-ni" üretiyordu. İki ayrı slug mantığı olduğu sürece biri
 * düzeltilince diğeri geride kalır.
 */
function slugla(ad: string, semt: string): string {
  return slugify(`${ad} ${semt}`);
}

type SektorKurgu = {
  sector: SeedBusiness['sector'];
  services: SeedBusiness['services'];
  hue: number;
  fiyat: number;
  olanaklar: string[];
  tanitim: string[];
  ekip: { unvan: string; bio: string }[];
  /** Kaynak adı: personel yerine saha/masa olan sektörlerde. */
  kaynak?: string[];
};

const KISI_ADLARI = [
  'Ayşe Demir', 'Mehmet Yalçın', 'Elif Korkmaz', 'Burak Şen', 'Selin Ateş',
  'Kaan Doğan', 'Merve Aslan', 'Onur Tekin', 'Zeynep Ünal', 'Emre Bulut',
  'Ceren Polat', 'Serkan Kurt', 'Pelin Acar', 'Tolga Yavuz', 'Damla Sarı',
  'Hakan Çelik', 'Nazlı Bozkurt', 'Furkan Güneş', 'Sıla Erdem', 'Barış Aydın',
];

const KURGULAR: Record<string, SektorKurgu> = {
  RESTAURANT: {
    sector: 'RESTAURANT',
    services: SERVICE_SETS_EXTRA.RESTAURANT,
    hue: 22,
    fiyat: 2,
    olanaklar: ['Vale', 'Bahçe', 'Aile salonu', 'Kredi kartına taksit', 'Otopark', 'Wi-Fi', 'Çocuk sandalyesi'],
    tanitim: [
      'Mutfağımızda günlük alışveriş yapıyoruz; menüdeki her şey aynı gün hazırlanıyor. Akşam saatleri için rezervasyon öneriyoruz.',
      'Aile işletmesiyiz ve aynı yerde uzun yıllardır hizmet veriyoruz. Salonumuz kalabalık gruplara uygun; masaları birleştirebiliyoruz.',
      'Yoğun saatlerde masa beklemek zorunda kalmayın diye rezervasyonu online açtık. Geldiğinizde masanız hazır oluyor.',
    ],
    ekip: [],
    kaynak: ['Salon', 'Bahçe', 'Teras'],
  },
  BEAUTY: {
    sector: 'BEAUTY',
    services: SERVICE_SETS.BEAUTY,
    hue: 300,
    fiyat: 2,
    olanaklar: ['Tek kullanımlık malzeme', 'Otopark', 'Wi-Fi', 'Randevulu çalışma', 'Kadınlara özel', 'Metroya yakın'],
    tanitim: [
      'Randevulu çalışıyoruz; bekleme salonunda vakit kaybetmiyorsunuz. Kullandığımız ürünlerin tamamı sertifikalı.',
      'Küçük bir ekibiz ve her müşteriye ayrı zaman ayırıyoruz. İşlem öncesi ne yapacağımızı birlikte konuşuyoruz.',
      'Saç, cilt ve tırnak hizmetlerini tek çatı altında veriyoruz. Aynı gün birden fazla işlem yaptırmak isteyenler için randevuları arka arkaya planlıyoruz.',
    ],
    ekip: [
      { unvan: 'Saç Tasarımcısı', bio: 'Kesim, şekillendirme ve bakım.' },
      { unvan: 'Renk Uzmanı', bio: 'Balyaj, röfle ve renk düzeltme.' },
      { unvan: 'Güzellik Uzmanı', bio: 'Cilt bakımı, ağda ve tırnak.' },
    ],
  },
  DENTAL: {
    sector: 'DENTAL',
    services: SERVICE_SETS.DENTAL,
    hue: 200,
    fiyat: 2,
    olanaklar: ['Dijital röntgen', 'Kredi kartına taksit', 'Otopark', 'Çocuk dostu', 'Engelli erişimi', 'Akşam randevusu'],
    tanitim: [
      'Dijital röntgen ve ağız içi kamera ile çalışıyoruz; tedavi planınızı ekranda birlikte görüyoruz.',
      'Hasta yoğunluğunu randevuya bağladık: geldiğiniz saatte işleminiz başlıyor, koridorda beklemiyorsunuz.',
      'Koruyucu diş hekimliğine önem veriyoruz. Altı ayda bir kontrol çağrısı gönderiyoruz.',
    ],
    ekip: [
      { unvan: 'Diş Hekimi', bio: 'Genel diş hekimliği ve restoratif tedavi.' },
      { unvan: 'Diş Hekimi', bio: 'Protez ve implant üstü restorasyon.' },
      { unvan: 'Pedodonti Uzmanı', bio: 'Çocuk diş hekimliği.' },
    ],
  },
  AESTHETIC: {
    sector: 'AESTHETIC',
    services: SERVICE_SETS.AESTHETIC,
    hue: 330,
    fiyat: 3,
    olanaklar: ['Hekim kontrolü', 'Ücretsiz ön görüşme', 'Otopark', 'Kredi kartına taksit', 'Wi-Fi'],
    tanitim: [
      'Tüm uygulamalar hekim kontrolünde yapılıyor. İlk görüşme ücretsiz; beklentinizin gerçekçi olup olmadığını açıkça konuşuyoruz.',
      'Cihazlarımız CE sertifikalı ve düzenli kalibre ediliyor. Uygulama öncesi ve sonrası fotoğraf kaydı tutuyoruz.',
      'Seans planını baştan paylaşıyoruz: kaç seans, ne aralıkla ve toplam ne kadar tutacak.',
    ],
    ekip: [
      { unvan: 'Estetisyen', bio: 'Cilt analizi ve bakım uygulamaları.' },
      { unvan: 'Uzman Hekim', bio: 'Medikal estetik uygulamaları.' },
    ],
  },
  VET: {
    sector: 'VET',
    services: SERVICE_SETS_EXTRA.VET,
    hue: 150,
    fiyat: 2,
    olanaklar: ['Laboratuvar', 'Otopark', 'Kedi dostu bekleme', 'Randevulu muayene', '7/24 acil'],
    tanitim: [
      'Aşı, muayene ve cerrahi hizmetlerimiz var. Dostunuzun stresini azaltmak için kedi ve köpek bekleme alanlarını ayırdık.',
      'Kendi laboratuvarımızda kan tahlili yapıyoruz; sonuçları aynı gün alıyorsunuz.',
      'Randevulu çalışıyoruz ki bekleme salonunda hayvanlar birbiriyle karşılaşmasın.',
    ],
    ekip: [
      { unvan: 'Veteriner Hekim', bio: 'Dahiliye ve koruyucu hekimlik.' },
      { unvan: 'Veteriner Hekim', bio: 'Cerrahi ve ortopedi.' },
    ],
  },
  PITCH: {
    sector: 'PITCH',
    services: SERVICE_SETS_EXTRA.PITCH,
    hue: 135,
    fiyat: 2,
    olanaklar: ['Duş', 'Kilitli dolap', 'Forma dahil', 'Otopark', 'Kafeterya', 'Kapalı saha'],
    tanitim: [
      'Suni çimimiz düzenli yenileniyor, aydınlatma LED. Forma ve top ücrete dahil.',
      'Hafta içi gündüz saatlerinde kurumsal ve öğrenci indirimi uyguluyoruz. Turnuva organizasyonu yapıyoruz.',
      'Saha kiralamayı online açtık: telefonda "acaba boş mu" diye sormaya gerek kalmıyor.',
    ],
    ekip: [],
    kaynak: ['Saha 1', 'Saha 2', 'Saha 3'],
  },
};

function uret(kurgu: SektorKurgu, t: Tohum, i: number): SeedBusiness {
  const sokaklar = SOKAKLAR[t.semt] ?? SOKAKLAR['Çankaya']!;
  const slug = slugla(t.ad, t.semt);
  const eposta = `${slug.replace(/-/g, '')}@ornek.com`.slice(0, 60);
  const sahip = sec(KISI_ADLARI, i * 7 + 3);

  const personel = kurgu.kaynak
    ? kurgu.kaynak.slice(0, 2 + (i % 2)).map((ad) => ({
        name: ad,
        title: kurgu.sector === 'PITCH' ? 'Saha' : 'Masa düzeni',
        bio: kurgu.sector === 'PITCH' ? '30x50 m, suni çim.' : 'Salon masaları.',
        services: [0, 1, 2].slice(0, kurgu.services.length),
      }))
    : kurgu.ekip.slice(0, 2 + (i % 2)).map((e, j) => ({
        name: sec(KISI_ADLARI, i * 11 + j * 5),
        title: e.unvan,
        bio: e.bio,
        services: kurgu.services.map((_, k) => k).filter((k) => k % (j + 1) === 0),
      }));

  return {
    slug,
    name: t.ad,
    sector: kurgu.sector,
    tagline: t.slogan,
    about: sec(kurgu.tanitim, i * 3 + 1),
    hue: (kurgu.hue + i * 17) % 360,
    priceLevel: t.fiyat ?? kurgu.fiyat,
    featured: t.onecikan ?? false,
    amenities: [
      sec(kurgu.olanaklar, i),
      sec(kurgu.olanaklar, i + 2),
      sec(kurgu.olanaklar, i + 4),
    ].filter((v, k, a) => a.indexOf(v) === k),
    owner: { name: sahip, email: eposta },
    branches: [
      {
        name: t.semt,
        district: t.semt,
        address: `${sec(sokaklar, i)} No:${8 + ((i * 13) % 120)}, ${t.semt}`,
        phone: `312${String(2000000 + i * 4523).slice(0, 7)}`,
      },
    ],
    services: kurgu.services,
    staff: personel,
    light: true,
  };
}

/** Sektör başına 20'ye tamamlayan kayıtlar. */
const TOHUMLAR: Record<string, Tohum[]> = {
  RESTAURANT: [
    { ad: 'Meşhur Kebapçı Halil', semt: 'Altındağ', slogan: 'Ulus’ta 40 yıllık kebap ustası', fiyat: 2 },
    { ad: 'Köşe Dönerci', semt: 'Keçiören', slogan: 'Odun ateşinde döner, öğle menüsü uygun', fiyat: 1 },
    { ad: 'Anadolu Sofrası', semt: 'Yenimahalle', slogan: 'Günlük ev yemekleri, öğlen 11:30’dan itibaren', fiyat: 1 },
    { ad: 'Mangalbaşı Keyif', semt: 'Etimesgut', slogan: 'Masada mangal, geniş bahçe', fiyat: 2, onecikan: true },
    { ad: 'Pide Evi Karadeniz', semt: 'Mamak', slogan: 'Taş fırında kapalı pide ve sütlaç', fiyat: 1 },
    { ad: 'Çorbacı Sabah', semt: 'Sincan', slogan: 'Sabah 06:00’da açık, işkembe ve kelle paça', fiyat: 1 },
    { ad: 'Lezzet Durağı', semt: 'Pursaklar', slogan: 'Izgara ve ev yemekleri bir arada', fiyat: 2 },
    { ad: 'Göl Kenarı Restoran', semt: 'Gölbaşı', slogan: 'Mogan kıyısında balık ve meze', fiyat: 3, onecikan: true },
    { ad: 'Kasap Dükkânı Steakhouse', semt: 'Çankaya', slogan: 'Kuru dinlendirilmiş et, açık mutfak', fiyat: 3 },
    { ad: 'Vejetaryen Mutfak', semt: 'Çankaya', slogan: 'Etsiz menü, günlük çorba ve buddha bowl', fiyat: 2 },
    { ad: 'Şark Sofrası', semt: 'Altındağ', slogan: 'Güneydoğu mutfağı, çiğ köfte ve lahmacun', fiyat: 1 },
    { ad: 'Terasta Akşam', semt: 'Yenimahalle', slogan: 'Şehir manzaralı teras, canlı müzik', fiyat: 3 },
    { ad: 'Mantı Diyarı', semt: 'Keçiören', slogan: 'El açması mantı ve gözleme', fiyat: 1 },
    { ad: 'Fırın Sofra', semt: 'Etimesgut', slogan: 'Odun fırınından tepsi kebabı, hafta sonu kahvaltı', fiyat: 2 },
  ],
  BEAUTY: [
    { ad: 'Güzellik Durağı', semt: 'Keçiören', slogan: 'Saç, cilt ve tırnak — randevulu çalışıyoruz', fiyat: 1 },
    { ad: 'Salon Elit', semt: 'Çankaya', slogan: 'Gelin saçı ve makyaj üzerine uzman', fiyat: 3, onecikan: true },
    { ad: 'Kuaför Melek', semt: 'Yenimahalle', slogan: 'Mahallenin 15 yıllık kuaförü', fiyat: 1 },
    { ad: 'Studio Bella', semt: 'Etimesgut', slogan: 'Keratin ve saç bakımı merkezi', fiyat: 2 },
    { ad: 'Renk Atölyesi', semt: 'Çankaya', slogan: 'Balyaj ve renk düzeltme uzmanı', fiyat: 3 },
    { ad: 'Naz Güzellik', semt: 'Mamak', slogan: 'Cilt bakımı ve ağda, uygun fiyat', fiyat: 1 },
    { ad: 'Erkek Kuaförü Usta', semt: 'Sincan', slogan: 'Sakal tıraşı ve klasik kesim', fiyat: 1 },
    { ad: 'Beyaz Lale Kuaför', semt: 'Altındağ', slogan: 'Kadınlara özel salon', fiyat: 1 },
    { ad: 'Tırnak Studio', semt: 'Çankaya', slogan: 'Protez tırnak ve nail art', fiyat: 2 },
    { ad: 'Saç Evi Ankara', semt: 'Pursaklar', slogan: 'Kesim, boya ve bakım', fiyat: 2 },
    { ad: 'Aura Güzellik', semt: 'Gölbaşı', slogan: 'Cilt analizi ile kişiye özel bakım', fiyat: 2 },
    { ad: 'Modern Kuaför', semt: 'Yenimahalle', slogan: 'Batıkent’te hafta sonu da açık', fiyat: 2 },
    { ad: 'İpek Saç Tasarım', semt: 'Keçiören', slogan: 'Düğün ve nişan saçı', fiyat: 2 },
    { ad: 'Cilt & Bakım Merkezi', semt: 'Etimesgut', slogan: 'Leke ve akne bakımı', fiyat: 2 },
    { ad: 'Zarif Kuaför', semt: 'Mamak', slogan: 'Randevusuz da kabul ediyoruz', fiyat: 1 },
  ],
  DENTAL: [
    { ad: 'Dentaltek Ağız ve Diş', semt: 'Yenimahalle', slogan: 'İmplant ve protez merkezi', fiyat: 3, onecikan: true },
    { ad: 'Gülüş Diş Kliniği', semt: 'Etimesgut', slogan: 'Estetik diş hekimliği ve beyazlatma', fiyat: 2 },
    { ad: 'Sağlık Diş Polikliniği', semt: 'Mamak', slogan: 'Uygun fiyat, taksit imkânı', fiyat: 1 },
    { ad: 'Ortodonti Merkezi Ankara', semt: 'Çankaya', slogan: 'Şeffaf plak ve tel tedavisi', fiyat: 3 },
    { ad: 'Çocuk Diş Kliniği Minik', semt: 'Keçiören', slogan: 'Sadece çocuk hastalar için', fiyat: 2 },
    { ad: 'Diş Hekimi Ahmet Yıldız', semt: 'Sincan', slogan: 'Tek hekim, randevulu muayene', fiyat: 1 },
    { ad: 'Batı Diş Polikliniği', semt: 'Etimesgut', slogan: 'Elvankent’te cumartesi açık', fiyat: 2 },
    { ad: 'İmplant Center Ankara', semt: 'Çankaya', slogan: 'Cerrahi implant ve kemik greftleme', fiyat: 3 },
    { ad: 'Kanal Tedavi Merkezi', semt: 'Altındağ', slogan: 'Mikroskobik endodonti', fiyat: 2 },
    { ad: 'Dişçim Aile Kliniği', semt: 'Pursaklar', slogan: 'Aile diş hekimliği, tüm yaşlara', fiyat: 1 },
    { ad: 'Estetik Diş Studio', semt: 'Gölbaşı', slogan: 'Lamine ve zirkonyum kaplama', fiyat: 3 },
    { ad: 'Yeni Diş Polikliniği', semt: 'Yenimahalle', slogan: 'Dijital ölçü, tek seans kaplama', fiyat: 2 },
    { ad: 'Ağız Sağlığı Merkezi', semt: 'Mamak', slogan: 'Diş taşı temizliği ve kontrol', fiyat: 1 },
    { ad: 'Smile Dental Ankara', semt: 'Çankaya', slogan: 'Gülüş tasarımı ve beyazlatma', fiyat: 3 },
    { ad: 'Kızılcahamam Diş', semt: 'Altındağ', slogan: 'Ulus’ta 20 yıllık klinik', fiyat: 1 },
  ],
  AESTHETIC: [
    { ad: 'Estetik Line', semt: 'Çankaya', slogan: 'Lazer epilasyon ve cilt gençleştirme', fiyat: 3, onecikan: true },
    { ad: 'Vita Medikal Estetik', semt: 'Yenimahalle', slogan: 'Hekim kontrolünde dolgu ve botoks', fiyat: 3 },
    { ad: 'Lazer Merkezi Ankara', semt: 'Keçiören', slogan: 'Buz lazer, tüm vücut seansı', fiyat: 2 },
    { ad: 'Dermaline Klinik', semt: 'Etimesgut', slogan: 'Leke tedavisi ve kimyasal peeling', fiyat: 2 },
    { ad: 'Beauty Med', semt: 'Mamak', slogan: 'Cilt bakımı ve mezoterapi', fiyat: 2 },
    { ad: 'Renova Estetik', semt: 'Çankaya', slogan: 'Yüz gençleştirme ve ip askı', fiyat: 3 },
    { ad: 'Klinik Ada', semt: 'Sincan', slogan: 'Lazer epilasyon, uygun paketler', fiyat: 1 },
    { ad: 'Medi Estetik Ankara', semt: 'Altındağ', slogan: 'Saç mezoterapisi ve PRP', fiyat: 2 },
    { ad: 'Skin Lab', semt: 'Gölbaşı', slogan: 'Cilt analizi ve kişiye özel program', fiyat: 3 },
    { ad: 'Perfect Look', semt: 'Pursaklar', slogan: 'Kalıcı makyaj ve kaş tasarımı', fiyat: 2 },
    { ad: 'Estetika Plus', semt: 'Yenimahalle', slogan: 'Bölgesel incelme ve selülit bakımı', fiyat: 2 },
    { ad: 'Nova Skin Clinic', semt: 'Çankaya', slogan: 'Hydrafacial ve cilt yenileme', fiyat: 3 },
    { ad: 'Ankara Lazer Estetik', semt: 'Keçiören', slogan: 'Erkeklere özel epilasyon seansları', fiyat: 2 },
    { ad: 'Derma Center', semt: 'Etimesgut', slogan: 'Akne ve iz tedavisi', fiyat: 2 },
    { ad: 'Güzellik Kliniği Ela', semt: 'Mamak', slogan: 'Cilt bakımı ve bakım paketleri', fiyat: 1 },
    { ad: 'Medikal Estetik Vera', semt: 'Sincan', slogan: 'Dolgu, botoks ve hekim görüşmesi', fiyat: 2 },
    { ad: 'Prestij Estetik', semt: 'Altındağ', slogan: 'Randevulu, hekim kontrolünde', fiyat: 2 },
  ],
  VET: [
    { ad: 'Pati Dostu Veteriner', semt: 'Yenimahalle', slogan: 'Aşı, muayene ve cerrahi', fiyat: 2 },
    { ad: 'Minik Dostlar Kliniği', semt: 'Keçiören', slogan: 'Kedi ve köpek bekleme alanları ayrı', fiyat: 2, onecikan: true },
    { ad: 'Anadolu Veteriner', semt: 'Mamak', slogan: 'Uygun fiyatlı aşı paketleri', fiyat: 1 },
    { ad: 'Vet Life Ankara', semt: 'Çankaya', slogan: 'Kendi laboratuvarımızda tahlil', fiyat: 3 },
    { ad: 'Sevimli Patiler', semt: 'Etimesgut', slogan: 'Kedi dostu klinik', fiyat: 2 },
    { ad: 'Hayvan Hastanesi Batı', semt: 'Sincan', slogan: 'Yatılı tedavi ve ameliyathane', fiyat: 2 },
    { ad: 'Dost Veteriner Kliniği', semt: 'Altındağ', slogan: 'Ulus’ta 12 yıllık klinik', fiyat: 1 },
    { ad: 'Petcare Ankara', semt: 'Pursaklar', slogan: 'Aşı takvimi hatırlatmalı', fiyat: 2 },
    { ad: 'Miyav Havhav Klinik', semt: 'Gölbaşı', slogan: 'Küçük hayvan dahiliyesi', fiyat: 2 },
    { ad: 'Veteriner Sağlık Merkezi', semt: 'Yenimahalle', slogan: 'Ortopedi ve cerrahi', fiyat: 3 },
    { ad: 'Kuyruk Sallayan', semt: 'Çankaya', slogan: 'Köpek eğitimi ve davranış danışmanlığı', fiyat: 3 },
    { ad: 'Pati Klinik Batıkent', semt: 'Yenimahalle', slogan: 'Ultrason ve röntgen', fiyat: 2 },
    { ad: 'Sağlıklı Pati', semt: 'Keçiören', slogan: 'Kısırlaştırma ve aşı', fiyat: 1 },
    { ad: 'Exotic Pet Vet', semt: 'Çankaya', slogan: 'Kuş, kemirgen ve sürüngen', fiyat: 3 },
    { ad: 'Ankara Pet Klinik', semt: 'Etimesgut', slogan: 'Randevulu muayene, kısa bekleme', fiyat: 2 },
    { ad: 'Şifa Veteriner', semt: 'Mamak', slogan: 'Acil müdahale ve serum', fiyat: 1 },
    { ad: 'Doğa Veteriner', semt: 'Sincan', slogan: 'Koruyucu hekimlik ve parazit programı', fiyat: 1 },
  ],
  PITCH: [
    { ad: 'Yıldız Halı Saha', semt: 'Keçiören', slogan: 'İki saha, gece 01:00’e kadar', fiyat: 2 },
    { ad: 'Gol Krallığı', semt: 'Yenimahalle', slogan: 'Batıkent’te kapalı saha', fiyat: 2, onecikan: true },
    { ad: 'Arena Spor Tesisleri', semt: 'Etimesgut', slogan: 'Üç saha ve kafeterya', fiyat: 2 },
    { ad: 'Çim Park', semt: 'Mamak', slogan: 'Yeni suni çim, LED aydınlatma', fiyat: 1 },
    { ad: 'Futbol Vadisi', semt: 'Altındağ', slogan: 'Turnuva organizasyonu yapıyoruz', fiyat: 1 },
    { ad: 'Şampiyon Saha', semt: 'Pursaklar', slogan: 'Duş ve kilitli dolap ücretsiz', fiyat: 1 },
    { ad: 'Yeşil Saha Gölbaşı', semt: 'Gölbaşı', slogan: 'Göl manzaralı açık saha', fiyat: 2 },
    { ad: 'Kale Arena', semt: 'Çankaya', slogan: 'Şehir merkezinde kapalı saha', fiyat: 3 },
    { ad: 'Spor Merkezi 06', semt: 'Sincan', slogan: 'Hafta içi sabah indirimli', fiyat: 1 },
    { ad: 'Orta Saha', semt: 'Keçiören', slogan: 'Forma ve top dahil', fiyat: 2 },
    { ad: 'Maç Saati', semt: 'Yenimahalle', slogan: 'Online rezervasyon, anında onay', fiyat: 2 },
    { ad: 'Beşiktaşlılar Sahası', semt: 'Etimesgut', slogan: 'Taraftar grubu indirimi', fiyat: 1 },
    { ad: 'Vadi Spor', semt: 'Mamak', slogan: 'İki kapalı, bir açık saha', fiyat: 2 },
    { ad: 'Ankara Futbol Park', semt: 'Altındağ', slogan: 'Otoparklı, geniş tesis', fiyat: 2 },
    { ad: 'Penaltı Halı Saha', semt: 'Çankaya', slogan: 'Öğrenci indirimi geçerli', fiyat: 2 },
    { ad: 'Kaleci Spor', semt: 'Gölbaşı', slogan: 'Hafta sonu turnuvaları', fiyat: 1 },
  ],
};

for (const [sektor, tohumlar] of Object.entries(TOHUMLAR)) {
  const kurgu = KURGULAR[sektor]!;
  tohumlar.forEach((t, i) => BUSINESSES.push(uret(kurgu, t, i)));
}
