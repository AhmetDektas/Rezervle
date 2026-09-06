/** Tohum verisi — gerçekçi Türkçe içerik. Görseller kasıtlı olarak yok:
 *  kapaklar deterministik gradient + sektör deseniyle üretilir, böylece
 *  dış kaynak çökse bile arayüz eksiksiz görünür. */

export type SeedService = {
  name: string;
  description: string;
  durationMin: number;
  bufferMin: number;
  price: number;
};

export type SeedStaff = { name: string; title: string; bio: string; services: number[] };

export type SeedBranch = { name: string; district: string; address: string; phone: string };

export type SeedBusiness = {
  slug: string;
  name: string;
  sector: 'DENTAL' | 'BEAUTY' | 'AESTHETIC' | 'VET' | 'PITCH' | 'RESTAURANT';
  tagline: string;
  about: string;
  hue: number;
  priceLevel: number;
  featured: boolean;
  amenities: string[];
  owner: { name: string; email: string };
  branches: SeedBranch[];
  services: SeedService[];
  staff: SeedStaff[];
  status?: 'PENDING';
  /** Kapora paketi: platform açtı mı, işletme kullanıyor mu? */
  deposit?: { addon: boolean; enabled: boolean; kind: 'PERCENT' | 'AMOUNT'; value: number; minPrice: number; refundHours: number };
  /**
   * Kapak ve galeri görselleri.
   *
   * Dış kaynaktan geliyor ve yüklenmezse arayüz gradient kapağa düşüyor
   * (bkz. BusinessCover) — bu yüzden görsel eklemek bir bağımlılık değil,
   * iyileştirme. Kaynak sabit boyutlu ve kırpılmış istekle çağrılıyor ki
   * liste ekranında megabaytlarca fotoğraf inmesin.
   */
  cover?: string;
  photos?: string[];
  /**
   * Hafif kayıt: geçmiş randevu penceresi kısa tutulur.
   *
   * 120 işletme için tam pencere (60 gün) ~45 bin randevu demekti; tohum
   * dakikalarca sürer ve geliştirme veritabanı gereksiz şişerdi. Vitrin için
   * önemli olan işletmenin dolu görünmesi, arşivinin derinliği değil.
   */
  light?: boolean;
};

/** Unsplash görselini sabit boyutta ve kırpılmış olarak ister. */
function foto(id: string, w = 1200): string {
  return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=70`;
}

/**
 * Sektöre göre görsel havuzu.
 *
 * İşletmeye özel fotoğraf çekmek mümkün olmadığı için sektöre uygun stok
 * görseller kullanılıyor. Her işletme havuzdan kendi sırasına göre farklı bir
 * set alıyor: aynı fotoğrafın on kartta tekrarlanması, stok görsel kullanmanın
 * en çok belli eden hâli.
 */
export const SECTOR_PHOTOS: Record<string, string[]> = {
  DENTAL: [
    '1629909613654-28e377c37b09',
    '1588776814546-1ffcf47267a5',
    '1606811841689-23dfddce3e95',
    '1609840114035-3c981b782dfe',
    '1598256989800-fe5f95da9787',
  ],
  BEAUTY: [
    '1560066984-138dadb4c035',
    '1522337360788-8b13dee7a37e',
    '1580618672591-eb180b1a973f',
    '1562322140-8baeececf3df',
    '1487412947147-5cebf100ffc2',
  ],
  AESTHETIC: [
    '1570172619644-dfd03ed5d881',
    '1512290923902-8a9f81dc236c',
    '1519824145371-296894a0daa9',
    '1616394584738-fc6e612e71b9',
    '1515377905703-c4788e51af15',
  ],
  VET: [
    '1516734212186-a967f81ad0d7',
    '1583337130417-3346a1be7dee',
    '1548767797-d8c844163c4c',
    '1601758228041-f3b2795255f1',
    '1587300003388-59208cc962cb',
  ],
  PITCH: [
    '1459865264687-595d652de67e',
    '1551958219-acbc608c6377',
    '1522778119026-d647f0596c20',
    '1431324155629-1a6deb1dec8d',
    '1574629810360-7efbbe195018',
  ],
  RESTAURANT: [
    '1517248135467-4c7edcad34c4',
    '1414235077428-338989a2e8c0',
    '1552566626-52f8b828add9',
    '1466978913421-dad2ebd01d17',
    '1555396273-367ea4eb4db5',
  ],
};

/** İşletmenin sırasına göre havuzdan kapak + galeri seçer. */
export function gorselSeti(sector: string, sira: number): { cover: string; photos: string[] } {
  const havuz = SECTOR_PHOTOS[sector] ?? SECTOR_PHOTOS['RESTAURANT']!;
  const bas = sira % havuz.length;
  const sirali = [...havuz.slice(bas), ...havuz.slice(0, bas)];
  return {
    cover: foto(sirali[0]!, 1400),
    photos: sirali.slice(1, 4).map((id) => foto(id, 900)),
  };
}

export const CATEGORIES = [
  {
    slug: 'restoran',
    name: 'Restoranlar',
    sector: 'RESTAURANT',
    icon: 'utensils',
    blurb: 'Masa rezervasyonu ve özel gün menüleri',
    sortOrder: 1,
  },
  {
    slug: 'guzellik-salonu',
    name: 'Güzellik salonları',
    sector: 'BEAUTY',
    icon: 'scissors',
    blurb: 'Saç, cilt bakımı, manikür ve makyaj',
    sortOrder: 2,
  },
  {
    slug: 'hali-saha',
    name: 'Halı sahalar',
    sector: 'PITCH',
    icon: 'goal',
    blurb: 'Saat bazlı saha kiralama, duş ve otopark',
    sortOrder: 3,
  },
  {
    slug: 'dis-klinigi',
    name: 'Diş klinikleri',
    sector: 'DENTAL',
    icon: 'tooth',
    blurb: 'Kontrol, dolgu, implant ve estetik diş hekimliği',
    sortOrder: 4,
  },
  {
    slug: 'veteriner',
    name: 'Veterinerler',
    sector: 'VET',
    icon: 'paw',
    blurb: 'Muayene, aşı, tıraş ve pet bakımı',
    sortOrder: 5,
  },
  {
    slug: 'estetik-klinigi',
    name: 'Estetik klinikleri',
    sector: 'AESTHETIC',
    icon: 'sparkles',
    blurb: 'Medikal estetik, dolgu ve cilt gençleştirme',
    sortOrder: 6,
  },
  {
    slug: 'spor-salonu',
    name: 'Spor salonları',
    sector: 'GYM',
    icon: 'dumbbell',
    blurb: 'Üyelik, birebir antrenman ve grup dersleri',
    sortOrder: 7,
  },
] as const;

export const CUSTOMER_NAMES = [
  'Elif Yıldırım', 'Mert Aksoy', 'Zeynep Korkmaz', 'Burak Şahin', 'Ayşe Demirtaş',
  'Can Özkan', 'Selin Arslan', 'Emre Yalçın', 'Deniz Kaya', 'Ceren Aydın',
  'Onur Balcı', 'Melis Turan', 'Kaan Erdoğan', 'Buse Çetin', 'Serkan Polat',
  'Nazlı Güneş', 'Uğur Doğan', 'Pelin Kurt', 'Barış Tekin', 'Ece Sarı',
  'Tolga Ünal', 'Damla Bozkurt', 'Furkan Acar', 'Sıla Yavuz', 'Hakan Bulut',
  'Gizem Ateş', 'Berk Sönmez', 'Yasemin Kılıç', 'Arda Çelik', 'Merve Aslan',
];

export const REVIEW_TEXTS = [
  'Randevu saatinde alındım, çok memnun kaldım. Tekrar geleceğim.',
  'İlgi ve alaka için teşekkürler, sonuçtan çok memnunum.',
  'Temiz ve ferah bir yer. Personel oldukça ilgili.',
  'Fiyat–performans olarak gayet iyi, tavsiye ederim.',
  'İşlem öncesi her adım tek tek anlatıldı, güven verdi.',
  'Biraz beklemek zorunda kaldım ama sonuç güzeldi.',
  'Uzun zamandır buraya geliyorum, hep aynı özenle ilgileniyorlar.',
  'Randevu almak çok kolaydı, saatinde başladı.',
  'Sonuçtan memnunum, sadece otopark biraz sıkıntılı.',
  'Ekip işini biliyor. Kesinlikle tavsiye ederim.',
];

const DENTAL_SERVICES: SeedService[] = [
  { name: 'Muayene ve kontrol', description: 'Ağız içi genel değerlendirme ve tedavi planı.', durationMin: 30, bufferMin: 10, price: 750 },
  { name: 'Diş taşı temizliği', description: 'Ultrasonik temizlik ve parlatma.', durationMin: 45, bufferMin: 10, price: 1450 },
  { name: 'Kompozit dolgu', description: 'Tek diş estetik dolgu uygulaması.', durationMin: 60, bufferMin: 15, price: 2200 },
  { name: 'Diş beyazlatma', description: 'Ofis tipi beyazlatma, tek seans.', durationMin: 75, bufferMin: 15, price: 5900 },
  { name: 'İmplant konsültasyonu', description: 'Röntgen değerlendirmesi ve planlama görüşmesi.', durationMin: 40, bufferMin: 10, price: 900 },
  { name: 'Kanal tedavisi', description: 'Tek kanal endodontik tedavi.', durationMin: 90, bufferMin: 20, price: 4300 },
];

const BEAUTY_SERVICES: SeedService[] = [
  { name: 'Saç kesimi', description: 'Yıkama, kesim ve fön dahil.', durationMin: 45, bufferMin: 10, price: 850 },
  { name: 'Saç boyama', description: 'Kök boyası ve bakım uygulaması.', durationMin: 120, bufferMin: 15, price: 2600 },
  { name: 'Fön ve şekillendirme', description: 'Yıkama ve fön.', durationMin: 30, bufferMin: 5, price: 550 },
  { name: 'Manikür', description: 'Klasik manikür ve oje.', durationMin: 45, bufferMin: 10, price: 700 },
  { name: 'Kalıcı oje', description: 'Protez tırnak hazırlığı ve kalıcı oje.', durationMin: 60, bufferMin: 10, price: 950 },
  { name: 'Cilt bakımı', description: 'Derin temizlik ve nemlendirme seansı.', durationMin: 60, bufferMin: 15, price: 1800 },
  { name: 'Gelin makyajı', description: 'Deneme dahil özel gün makyajı.', durationMin: 90, bufferMin: 20, price: 4500 },
];

const AESTHETIC_SERVICES: SeedService[] = [
  { name: 'Ücretsiz konsültasyon', description: 'Hekim görüşmesi ve uygulama planı.', durationMin: 30, bufferMin: 10, price: 0 },
  { name: 'Botoks uygulaması', description: 'Üst yüz bölgesi, hekim uygulaması.', durationMin: 45, bufferMin: 15, price: 8500 },
  { name: 'Dolgu uygulaması', description: 'Dudak veya orta yüz dolgusu.', durationMin: 60, bufferMin: 15, price: 12500 },
  { name: 'Hydrafacial', description: 'Cilt yenileme ve nem takviyesi.', durationMin: 60, bufferMin: 15, price: 4200 },
  { name: 'Lazer epilasyon (bölgesel)', description: 'Tek bölge, tek seans.', durationMin: 40, bufferMin: 10, price: 2400 },
  { name: 'Mezoterapi', description: 'Saç veya cilt mezoterapisi.', durationMin: 45, bufferMin: 10, price: 3600 },
];

export const SERVICE_SETS = {
  DENTAL: DENTAL_SERVICES,
  BEAUTY: BEAUTY_SERVICES,
  AESTHETIC: AESTHETIC_SERVICES,
};


const PITCH_SERVICES: SeedService[] = [
  { name: 'Halı saha — 1 saat', description: 'Yıkanmış forma, top ve yelek dahil.', durationMin: 60, bufferMin: 15, price: 1400 },
  { name: 'Halı saha — 1,5 saat', description: 'Uzun maç için ideal, ara verme payı dahil.', durationMin: 90, bufferMin: 15, price: 2000 },
  { name: 'Halı saha — 2 saat (turnuva)', description: 'Grup maçları ve turnuvalar için.', durationMin: 120, bufferMin: 20, price: 2600 },
  { name: 'Çocuk sahası — 1 saat', description: 'Küçük boy saha, 7-12 yaş grubu.', durationMin: 60, bufferMin: 10, price: 900 },
];

const VET_SERVICES: SeedService[] = [
  { name: 'Genel muayene', description: 'Ateş, kilo ve genel sağlık kontrolü.', durationMin: 30, bufferMin: 10, price: 900 },
  { name: 'Aşı uygulaması', description: 'Karma, kuduz veya iç-dış parazit.', durationMin: 20, bufferMin: 10, price: 750 },
  { name: 'Tıraş ve bakım', description: 'Tüy tıraşı, tırnak kesimi ve kulak temizliği.', durationMin: 60, bufferMin: 15, price: 1250 },
  { name: 'Diş taşı temizliği (anestezili)', description: 'Ultrasonik temizlik, gün içi takip dahil.', durationMin: 90, bufferMin: 30, price: 3800 },
  { name: 'Ultrason', description: 'Karın bölgesi görüntüleme.', durationMin: 40, bufferMin: 10, price: 1600 },
];

const RESTAURANT_SERVICES: SeedService[] = [
  { name: '2 kişilik masa', description: 'Standart salon masası.', durationMin: 90, bufferMin: 20, price: 0 },
  { name: '4 kişilik masa', description: 'Salon veya bahçe, doluluk durumuna göre.', durationMin: 120, bufferMin: 20, price: 0 },
  { name: '6 kişilik masa', description: 'Kalabalık gruplar için birleşik masa.', durationMin: 120, bufferMin: 30, price: 0 },
  { name: 'Özel gün menüsü (kişi başı)', description: 'Doğum günü ve yıl dönümü için sabit menü.', durationMin: 150, bufferMin: 30, price: 1200 },
];

export const SERVICE_SETS_EXTRA = {
  PITCH: PITCH_SERVICES,
  VET: VET_SERVICES,
  RESTAURANT: RESTAURANT_SERVICES,
};

export const BUSINESSES: SeedBusiness[] = [
  {
    slug: 'beyaz-dis-poliklinigi',
    name: 'Beyaz Diş Polikliniği',
    sector: 'DENTAL',
    tagline: 'Çankaya’da 14 yıldır ağız ve diş sağlığı',
    about:
      'Beyaz Diş Polikliniği, 2011’den bu yana Çankaya’da hizmet veriyor. Dijital röntgen, ağız içi kamera ve tek seans dolgu uygulamalarıyla tedavi süresini kısaltıyoruz. Randevunuzu online oluşturduğunuzda dosyanız siz gelmeden hazırlanır.',
    hue: 206,
    priceLevel: 2,
    featured: true,
    amenities: ['Otopark', 'Dijital röntgen', 'Kredi kartına taksit', 'Engelli erişimi', 'Wi-Fi'],
    owner: { name: 'Dt. Serhat Yılmaz', email: 'serhat@beyazdis.com' },
    branches: [
      { name: 'Çankaya Merkez', district: 'Çankaya', address: 'Cinnah Cad. No:42/5, Çankaya', phone: '3124661200' },
      { name: 'Keçiören Şube', district: 'Keçiören', address: 'Fatih Cad. No:118, Keçiören', phone: '3123601188' },
    ],
    services: SERVICE_SETS.DENTAL,
    staff: [
      { name: 'Dt. Serhat Yılmaz', title: 'Diş Hekimi, Kurucu', bio: 'Restoratif diş tedavisi ve implant üzerine çalışıyor.', services: [0, 1, 2, 3, 4, 5] },
      { name: 'Dt. Aylin Kara', title: 'Diş Hekimi', bio: 'Estetik diş hekimliği ve beyazlatma uygulamaları.', services: [0, 1, 2, 3] },
      { name: 'Dt. Mehmet Uçar', title: 'Endodonti Uzmanı', bio: 'Kanal tedavisi ve mikroskobik endodonti.', services: [0, 4, 5] },
    ],
  },
  {
    slug: 'ankaradent-agiz-ve-dis-sagligi',
    name: 'AnkaraDent Ağız ve Diş Sağlığı',
    sector: 'DENTAL',
    tagline: 'Kızılay’ın merkezinde, akşam 20:00’ye kadar açık',
    about:
      'İş çıkışı randevuya gelebilmeniz için hafta içi akşam 20:00’ye kadar hizmet veriyoruz. Çocuk diş hekimliği ve ortodonti dahil geniş bir ekiple çalışıyoruz.',
    hue: 198,
    priceLevel: 2,
    featured: true,
    amenities: ['Akşam randevusu', 'Çocuk dostu', 'Metroya yakın', 'Kredi kartına taksit'],
    owner: { name: 'Dt. Gizem Aktaş', email: 'gizem@ankaradent.com' },
    branches: [{ name: 'Kızılay', district: 'Çankaya', address: 'Meşrutiyet Cad. No:21/3, Kızılay', phone: '3124189044' }],
    services: SERVICE_SETS.DENTAL,
    staff: [
      { name: 'Dt. Gizem Aktaş', title: 'Diş Hekimi, Kurucu', bio: 'Ortodonti ve çocuk diş hekimliği.', services: [0, 1, 2, 4] },
      { name: 'Dt. Kerem Doğru', title: 'Diş Hekimi', bio: 'Protez ve implant üstü restorasyon.', services: [0, 2, 3, 5] },
    ],
  },
  {
    slug: 'gulen-yuz-dis-klinigi',
    name: 'Gülen Yüz Diş Kliniği',
    sector: 'DENTAL',
    tagline: 'Yenimahalle’de aile diş hekimliği',
    about:
      'Ailecek gelebileceğiniz, çocuklar için ayrı bekleme alanı olan bir klinik. Kontrol randevularınızı hatırlatıyor, tedavi planınızı yazılı paylaşıyoruz.',
    hue: 190,
    priceLevel: 1,
    featured: false,
    amenities: ['Çocuk oyun alanı', 'Otopark', 'Ücretsiz kontrol'],
    owner: { name: 'Dt. Nihan Er', email: 'nihan@gulenyuz.com' },
    branches: [{ name: 'Yenimahalle', district: 'Yenimahalle', address: 'İvedik Cad. No:76, Yenimahalle', phone: '3123443311' }],
    services: SERVICE_SETS.DENTAL.slice(0, 5),
    staff: [
      { name: 'Dt. Nihan Er', title: 'Diş Hekimi', bio: 'Koruyucu diş hekimliği ve pedodonti.', services: [0, 1, 2, 3, 4] },
      { name: 'Dt. Onur Şen', title: 'Diş Hekimi', bio: 'Cerrahi ve implant uygulamaları.', services: [0, 1, 4] },
    ],
  },
];

BUSINESSES.push(
  {
    slug: 'studio-nar-guzellik',
    name: 'Studio Nar Güzellik',
    sector: 'BEAUTY',
    tagline: 'Saç, cilt ve tırnak — tek çatı altında',
    about:
      'Studio Nar, Çankaya’da küçük ve sakin bir salon. Aynı anda az sayıda misafir alıyoruz; randevunuz gecikmez, sıra beklemezsiniz. Kullandığımız ürünlerin tamamı vegan sertifikalı.',
    hue: 330,
    priceLevel: 2,
    featured: true,
    amenities: ['Vegan ürünler', 'Randevu hatırlatma', 'Kahve ikramı', 'Wi-Fi'],
    owner: { name: 'Nar Güneş', email: 'nar@studionar.com' },
    branches: [{ name: 'Çankaya', district: 'Çankaya', address: 'Tunalı Hilmi Cad. No:88/4, Kavaklıdere', phone: '3124275566' }],
    services: SERVICE_SETS.BEAUTY,
    staff: [
      { name: 'Nar Güneş', title: 'Kurucu, Saç Tasarımcısı', bio: 'Kesim ve renklendirme üzerine 12 yıl deneyim.', services: [0, 1, 2] },
      { name: 'Ebru Tan', title: 'Cilt Bakım Uzmanı', bio: 'Cilt analizi ve bakım protokolleri.', services: [5, 6] },
      { name: 'Simge Alp', title: 'Tırnak Teknisyeni', bio: 'Manikür ve kalıcı oje uygulamaları.', services: [3, 4] },
    ],
  },
  {
    slug: 'ayna-kuafor-guzellik',
    name: 'Ayna Kuaför & Güzellik',
    sector: 'BEAUTY',
    tagline: 'Keçiören’in mahalle kuaförü, 20 yıldır aynı yerde',
    about:
      'Ayna Kuaför, 2005’ten beri Keçiören’de. Gelin başı ve özel gün hazırlıklarında bölgenin en deneyimli ekiplerinden biriyiz. Hafta sonu randevuları hızlı doluyor.',
    hue: 292,
    priceLevel: 1,
    featured: false,
    amenities: ['Gelin paketi', 'Kapıda ödeme', 'Otopark'],
    owner: { name: 'Sevgi Akın', email: 'sevgi@aynakuafor.com' },
    branches: [{ name: 'Keçiören', district: 'Keçiören', address: 'Şehit Cengiz Karaca Cad. No:14, Keçiören', phone: '3123802244' }],
    services: SERVICE_SETS.BEAUTY.slice(0, 5),
    staff: [
      { name: 'Sevgi Akın', title: 'Kurucu, Kuaför', bio: 'Gelin saçı ve topuz uygulamaları.', services: [0, 1, 2] },
      { name: 'Hatice Yurt', title: 'Kuaför', bio: 'Kesim, fön ve bakım.', services: [0, 2, 3, 4] },
    ],
  },
  {
    slug: 'lila-beauty-lounge',
    name: 'Lila Beauty Lounge',
    sector: 'BEAUTY',
    tagline: 'İki şube, aynı ekip standardı',
    about:
      'Lila Beauty Lounge’da her uygulama öncesi kısa bir analiz yapılır ve size uygun olmayan işlemi önermeyiz. Randevunuzu iki şubemizden birinde alabilirsiniz.',
    hue: 268,
    priceLevel: 3,
    featured: true,
    amenities: ['İki şube', 'Vale', 'Özel oda', 'Hediye çeki', 'Wi-Fi'],
    owner: { name: 'Lila Demir', email: 'lila@lilabeauty.com' },
    branches: [
      { name: 'Yenimahalle', district: 'Yenimahalle', address: 'Batıkent Bulvarı No:5/2, Yenimahalle', phone: '3122551177' },
      { name: 'Etimesgut', district: 'Etimesgut', address: 'Eryaman 4. Cad. No:31, Etimesgut', phone: '3122801199' },
    ],
    services: SERVICE_SETS.BEAUTY,
    staff: [
      { name: 'Lila Demir', title: 'Kurucu', bio: 'Renk uzmanı, balyaj ve ombre.', services: [0, 1, 2] },
      { name: 'Cansu Ergin', title: 'Güzellik Uzmanı', bio: 'Cilt bakımı ve makyaj.', services: [5, 6] },
      { name: 'Melike Sarp', title: 'Tırnak & Bakım', bio: 'Manikür, pedikür, kalıcı oje.', services: [3, 4] },
    ],
  },
);

BUSINESSES.push(
  {
    slug: 'estetika-medikal-estetik',
    name: 'Estetika Medikal Estetik',
    sector: 'AESTHETIC',
    tagline: 'Hekim kontrolünde medikal estetik',
    about:
      'Estetika’da tüm uygulamalar hekim tarafından yapılır. İlk görüşme ücretsizdir ve size uygun olmadığını düşündüğümüz işlemi açıkça söyleriz. Uygulama sonrası kontrol randevunuz otomatik planlanır.',
    hue: 214,
    priceLevel: 3,
    featured: true,
    amenities: ['Hekim uygulaması', 'Ücretsiz konsültasyon', 'Vale', 'Kontrol randevusu dahil'],
    owner: { name: 'Dr. Selin Ergün', email: 'selin@estetika.com' },
    // Yüksek tutarlı işlemler: %20 kapora, 48 saat iade penceresi.
    deposit: { addon: true, enabled: true, kind: 'PERCENT', value: 20, minPrice: 2000, refundHours: 48 },
    branches: [{ name: 'Çankaya Klinik', district: 'Çankaya', address: 'Uğur Mumcu Cad. No:61/3, Gaziosmanpaşa', phone: '3124478833' }],
    services: SERVICE_SETS.AESTHETIC,
    staff: [
      { name: 'Dr. Selin Ergün', title: 'Tıp Doktoru, Kurucu', bio: 'Medikal estetik uygulamaları üzerine 10 yıl.', services: [0, 1, 2, 5] },
      { name: 'Dr. Alp Yener', title: 'Tıp Doktoru', bio: 'Dolgu ve cilt gençleştirme.', services: [0, 1, 2] },
      { name: 'Esra Koç', title: 'Medikal Estetisyen', bio: 'Hydrafacial ve lazer uygulamaları.', services: [3, 4] },
    ],
  },
  {
    slug: 'derma-ankara-estetik',
    name: 'Derma Ankara Estetik Kliniği',
    sector: 'AESTHETIC',
    tagline: 'Cilt sağlığı ve lazer uygulamaları',
    about:
      'Derma Ankara, cilt hastalıkları ve estetik dermatoloji alanında çalışıyor. Lazer cihazlarımız FDA onaylı; seans planınızı ilk görüşmede netleştiriyoruz.',
    hue: 178,
    priceLevel: 2,
    featured: false,
    amenities: ['FDA onaylı cihaz', 'Seans paketi', 'Otopark', 'Engelli erişimi'],
    owner: { name: 'Dr. Barış Ilgaz', email: 'baris@dermaankara.com' },
    branches: [{ name: 'Çukurambar', district: 'Çankaya', address: 'Kızılırmak Mah. 1445. Cad. No:12, Çukurambar', phone: '3122860077' }],
    services: SERVICE_SETS.AESTHETIC.slice(0, 5),
    staff: [
      { name: 'Dr. Barış Ilgaz', title: 'Dermatolog', bio: 'Estetik dermatoloji ve lazer.', services: [0, 1, 2, 4] },
      { name: 'Zehra Naz', title: 'Estetisyen', bio: 'Cilt bakımı ve seans takibi.', services: [3, 4] },
    ],
  },
  {
    slug: 'nova-estetik-merkezi',
    name: 'Nova Estetik Merkezi',
    sector: 'AESTHETIC',
    tagline: 'Etimesgut’ta uygun fiyatlı estetik uygulamalar',
    about:
      'Nova Estetik, ulaşılabilir fiyatlarla medikal estetik sunar. Seans paketlerinde peşin ödeme indirimi uygularız; ilk konsültasyon her zaman ücretsizdir.',
    hue: 158,
    priceLevel: 1,
    featured: false,
    amenities: ['Uygun fiyat', 'Paket indirimi', 'Ücretsiz konsültasyon'],
    owner: { name: 'Dr. Yasin Toprak', email: 'yasin@novaestetik.com' },
    branches: [{ name: 'Eryaman', district: 'Etimesgut', address: 'Eryaman Mah. Güzelkent Cad. No:9, Etimesgut', phone: '3122790055' }],
    services: SERVICE_SETS.AESTHETIC.slice(0, 4),
    staff: [
      { name: 'Dr. Yasin Toprak', title: 'Tıp Doktoru', bio: 'Botoks ve dolgu uygulamaları.', services: [0, 1, 2] },
      { name: 'Hande Kılıçarslan', title: 'Estetisyen', bio: 'Cilt bakımı ve hydrafacial.', services: [3] },
    ],
  },
  {
    // Yönetici panelinde onay akışını göstermek için bekleyen kayıt.
    slug: 'yeni-umut-dis-poliklinigi',
    name: 'Yeni Umut Diş Polikliniği',
    sector: 'DENTAL',
    tagline: 'Mamak’ta yeni açılan poliklinik',
    about: 'Mamak’ta hizmete yeni başlayan polikliniğimiz platform onayını bekliyor.',
    hue: 220,
    priceLevel: 1,
    featured: false,
    amenities: ['Otopark'],
    owner: { name: 'Dt. Hasan Kurt', email: 'hasan@yeniumutdis.com' },
    branches: [{ name: 'Mamak', district: 'Mamak', address: 'Şahintepe Mah. 100. Yıl Cad. No:3, Mamak', phone: '3123901122' }],
    services: SERVICE_SETS.DENTAL.slice(0, 3),
    staff: [{ name: 'Dt. Hasan Kurt', title: 'Diş Hekimi', bio: 'Genel diş hekimliği.', services: [0, 1, 2] }],
    status: 'PENDING',
  },
);

// --- Halı sahalar --------------------------------------------------------
// "Personel" burada sahanın kendisidir: rezervasyon çekirdeği için ikisi de
// aynı anda tek işe ayrılan bir kaynaktır.

BUSINESSES.push(
  {
    slug: 'gulveren-spor-tesisleri',
    name: 'Gülveren Spor Tesisleri',
    sector: 'PITCH',
    tagline: 'Mamak’ta üç saha, ışıklandırma gece 24:00’e kadar',
    about:
      '1998’den beri Gülveren’de hizmet veriyoruz. Üç açık saha ve bir kapalı sahamız var; kapalı saha yağmurda da oynanabiliyor. Duş, kilitli dolap ve ücretsiz otopark tesisin içinde.',
    hue: 142,
    priceLevel: 2,
    featured: true,
    amenities: ['Kapalı saha', 'Duş ve soyunma odası', 'Ücretsiz otopark', 'Kantin', 'Işıklandırma'],
    owner: { name: 'Kemal Gülveren', email: 'kemal@gulverenspor.com' },
    // Halı sahada gelmeme sık: sabit 300 TL kapora, 24 saat iade penceresi.
    deposit: { addon: true, enabled: true, kind: 'AMOUNT', value: 300, minPrice: 0, refundHours: 24 },
    branches: [{ name: 'Gülveren Tesis', district: 'Mamak', address: 'Gülveren Mah. Spor Cad. No:14, Mamak', phone: '3123651144' }],
    services: SERVICE_SETS_EXTRA.PITCH,
    staff: [
      { name: '1. Saha (açık)', title: 'Açık saha · 30x50 m', bio: 'Suni çim, 2024’te yenilendi. Gece ışıklandırması var.', services: [0, 1, 2] },
      { name: '2. Saha (açık)', title: 'Açık saha · 25x45 m', bio: 'Tesisin girişine en yakın saha.', services: [0, 1, 2] },
      { name: 'Kapalı Saha', title: 'Kapalı saha · 22x42 m', bio: 'Yağmur ve rüzgârdan etkilenmez, kışın tercih ediliyor.', services: [0, 1, 2] },
      { name: 'Çocuk Sahası', title: 'Mini saha · 15x25 m', bio: '7-12 yaş grubu için küçük boy saha.', services: [3] },
    ],
  },
  {
    slug: 'batikent-arena-hali-saha',
    name: 'Batıkent Arena Halı Saha',
    sector: 'PITCH',
    tagline: 'Metroya 5 dakika, hafta içi gündüz indirimli',
    about:
      'Batıkent metro çıkışına yürüme mesafesindeyiz. Hafta içi 09:00–16:00 arası saatler indirimlidir. Kaleci yeleği, top ve yelek kiralama ücretsizdir.',
    hue: 96,
    priceLevel: 1,
    featured: false,
    amenities: ['Metroya yakın', 'Ücretsiz malzeme', 'Duş', 'Gündüz indirimi'],
    owner: { name: 'Serkan Arena', email: 'serkan@batikentarena.com' },
    branches: [{ name: 'Batıkent', district: 'Yenimahalle', address: 'Batıkent Bulvarı No:220, Yenimahalle', phone: '3122561177' }],
    services: SERVICE_SETS_EXTRA.PITCH.slice(0, 3),
    staff: [
      { name: 'A Sahası', title: 'Açık saha · 28x48 m', bio: 'Ana saha, tribün tarafında.', services: [0, 1, 2] },
      { name: 'B Sahası', title: 'Açık saha · 26x44 m', bio: 'Kantine bakan saha.', services: [0, 1, 2] },
    ],
  },
);

// --- Veterinerler --------------------------------------------------------

BUSINESSES.push(
  {
    slug: 'patiler-veteriner-klinigi',
    name: 'Patiler Veteriner Kliniği',
    sector: 'VET',
    tagline: 'Çankaya’da 7/24 acil, randevulu poliklinik',
    about:
      'Patiler Veteriner Kliniği’nde kedi ve köpeklerin yanı sıra egzotik hayvanlara da bakıyoruz. Randevunuzu online aldığınızda dosyanız siz gelmeden hazırlanır; ilk muayenede aşı takviminizi yazılı veriyoruz.',
    hue: 24,
    priceLevel: 2,
    featured: true,
    amenities: ['7/24 acil hattı', 'Kedi dostu bekleme alanı', 'Otopark', 'Laboratuvar', 'Ultrason'],
    owner: { name: 'Vet. Hek. Deniz Arıcan', email: 'deniz@patilervet.com' },
    branches: [{ name: 'Çankaya Klinik', district: 'Çankaya', address: 'Hoşdere Cad. No:184/A, Çankaya', phone: '3124392266' }],
    services: SERVICE_SETS_EXTRA.VET,
    staff: [
      { name: 'Vet. Hek. Deniz Arıcan', title: 'Veteriner Hekim, Kurucu', bio: 'İç hastalıkları ve görüntüleme üzerine çalışıyor.', services: [0, 1, 3, 4] },
      { name: 'Vet. Hek. Emre Balaban', title: 'Veteriner Hekim', bio: 'Cerrahi ve diş sağlığı uygulamaları.', services: [0, 1, 3] },
      { name: 'Sude Karahan', title: 'Pet Kuaförü', bio: 'Kedi ve köpek tıraşı, tırnak ve kulak bakımı.', services: [2] },
    ],
  },
  {
    slug: 'dostlar-veteriner',
    name: 'Dostlar Veteriner',
    sector: 'VET',
    tagline: 'Keçiören’de mahalle kliniği, uygun fiyatlı aşı paketleri',
    about:
      'Keçiören’de 12 yıldır aynı yerdeyiz. Sokak hayvanları için ücretsiz ilk muayene uyguluyoruz. Aşı paketlerimiz peşin ödemede indirimlidir.',
    hue: 8,
    priceLevel: 1,
    featured: false,
    amenities: ['Uygun fiyat', 'Aşı paketi', 'Sokak hayvanına ücretsiz muayene'],
    owner: { name: 'Vet. Hek. Aslı Toprak', email: 'asli@dostlarvet.com' },
    branches: [{ name: 'Keçiören', district: 'Keçiören', address: 'Kalaba Mah. Yeşilöz Cad. No:41, Keçiören', phone: '3123581199' }],
    services: SERVICE_SETS_EXTRA.VET.slice(0, 3),
    staff: [
      { name: 'Vet. Hek. Aslı Toprak', title: 'Veteriner Hekim', bio: 'Koruyucu hekimlik ve aşılama.', services: [0, 1, 2] },
      { name: 'Vet. Hek. Cem Ünsal', title: 'Veteriner Hekim', bio: 'Küçük hayvan hekimliği.', services: [0, 1] },
    ],
  },
);

// --- Restoranlar ---------------------------------------------------------
// Kaynak masadır: aynı masa aynı anda tek gruba ayrılır. Servis süresi
// masanın ne kadar tutulacağını, tampon ise hazırlık payını belirler.

BUSINESSES.push(
  {
    slug: 'kavakli-ocakbasi',
    name: 'Kavaklı Ocakbaşı',
    sector: 'RESTAURANT',
    tagline: 'Kavaklıdere’de 22 yıllık ocakbaşı, akşam masaları hızlı doluyor',
    about:
      'Kuzu şiş ve ciğeri kendi ocağımızda pişiriyoruz. Salon 14 masalık, bahçe yaz aylarında açık. Hafta sonu akşam masaları için birkaç gün önceden rezervasyon öneriyoruz.',
    hue: 18,
    priceLevel: 2,
    featured: true,
    amenities: ['Bahçe', 'Vale', 'Canlı müzik (Cuma-Cmt)', 'Grup rezervasyonu', 'Kart geçer'],
    owner: { name: 'Hüseyin Kavaklı', email: 'huseyin@kavakliocakbasi.com' },
    // Paket verilmiş ama işletme henüz açmamış — panelde kapalı görünür.
    deposit: { addon: true, enabled: false, kind: 'PERCENT', value: 10, minPrice: 0, refundHours: 12 },
    branches: [{ name: 'Kavaklıdere', district: 'Çankaya', address: 'Bestekar Sok. No:78, Kavaklıdere', phone: '3124261188' }],
    services: SERVICE_SETS_EXTRA.RESTAURANT,
    staff: [
      { name: 'Salon 1-4 (2 kişilik)', title: 'Salon · pencere kenarı', bio: 'İki kişilik, cam kenarı masalar.', services: [0, 3] },
      { name: 'Salon 5-9 (4 kişilik)', title: 'Salon · orta bölüm', bio: 'Dört kişilik standart masalar.', services: [1, 3] },
      { name: 'Bahçe (4 kişilik)', title: 'Bahçe · mevsimlik', bio: 'Hava uygun olduğunda açılır.', services: [1, 3] },
      { name: 'Grup masası (6 kişilik)', title: 'Salon · birleşik', bio: 'Kalabalık gruplar için birleştirilen masa.', services: [2, 3] },
    ],
  },
  {
    slug: 'bahce-mutfak-eryaman',
    name: 'Bahçe Mutfak',
    sector: 'RESTAURANT',
    tagline: 'Eryaman’da ev yemekleri, öğle menüsü 12:00–15:00',
    about:
      'Günlük değişen ev yemekleri menüsüyle çalışıyoruz. Öğle saatlerinde iş yemeği yoğunluğu oluyor; rezervasyon yaptırdığınızda masanız 15 dakika bekletilir.',
    hue: 68,
    priceLevel: 1,
    featured: false,
    amenities: ['Öğle menüsü', 'Çocuk sandalyesi', 'Otopark', 'Vejetaryen seçenek'],
    owner: { name: 'Gülay Bahçe', email: 'gulay@bahcemutfak.com' },
    branches: [{ name: 'Eryaman', district: 'Etimesgut', address: 'Eryaman 3. Etap, Devrim Bulvarı No:12, Etimesgut', phone: '3122804466' }],
    services: SERVICE_SETS_EXTRA.RESTAURANT.slice(0, 3),
    staff: [
      { name: 'Pencere masaları (2 kişilik)', title: 'Salon', bio: 'İki kişilik, sokağa bakan masalar.', services: [0] },
      { name: 'Orta salon (4 kişilik)', title: 'Salon', bio: 'Dört kişilik masalar.', services: [1] },
      { name: 'Arka salon (6 kişilik)', title: 'Salon · sakin', bio: 'Kalabalık ve iş yemekleri için.', services: [2] },
    ],
  },
);

/**
 * Örnek restoran menüsü.
 *
 * Tohum verisi menüsüz kalsaydı, menü özelliği demo'da hiç görünmezdi ve
 * "yazdım ama kimse görmedi" durumu oluşurdu.
 */
export type SeedMenuItem = {
  category: string;
  name: string;
  description?: string;
  price: number;
};

export const RESTAURANT_MENU: SeedMenuItem[] = [
  { category: 'Başlangıçlar', name: 'Mercimek çorbası', description: 'Tereyağı ve limon ile', price: 95 },
  { category: 'Başlangıçlar', name: 'Humus', description: 'Nohut ezmesi, susam tahini, zeytinyağı', price: 120 },
  { category: 'Başlangıçlar', name: 'Sigara böreği', description: '6 adet, beyaz peynirli', price: 135 },
  { category: 'Ana yemekler', name: 'Adana kebap', description: 'Közlenmiş biber ve domates ile', price: 420 },
  { category: 'Ana yemekler', name: 'Izgara köfte', description: 'Pilav ve mevsim salata ile', price: 380 },
  { category: 'Ana yemekler', name: 'Tavuk şiş', description: 'Marine edilmiş, közde', price: 350 },
  { category: 'Ana yemekler', name: 'Karışık ızgara', description: '2 kişilik', price: 780 },
  { category: 'Tatlılar', name: 'Künefe', description: 'Antep fıstıklı, tereyağlı', price: 180 },
  { category: 'Tatlılar', name: 'Sütlaç', description: 'Fırında, tarçınlı', price: 130 },
  { category: 'İçecekler', name: 'Ayran', price: 45 },
  { category: 'İçecekler', name: 'Şalgam', price: 50 },
  { category: 'İçecekler', name: 'Türk kahvesi', price: 85 },
];

/**
 * Ankara ilçe merkezlerinin yaklaşık koordinatları.
 *
 * Harita iğnesi ancak koordinat varsa görünüyor: adres metniyle arama, kurgusal
 * bir adresi çözemediğinde bölgeyi gösterip iğneyi koymuyor — kullanıcı "burası
 * neresi" diye bakakalıyor.
 *
 * Bunlar İLÇE MERKEZİ konumları, tohum işletmelerinin gerçek adresi değil.
 * Kurgusal adreslere kesin koordinat uydurmak, yanlış bir noktayı doğruymuş
 * gibi göstermek olurdu. Gerçek işletme kendi koordinatını panelden giriyor.
 */
export const ILCE_KOORDINAT: Record<string, { lat: number; lng: number }> = {
  Çankaya: { lat: 39.908, lng: 32.854 },
  Keçiören: { lat: 39.98, lng: 32.869 },
  Yenimahalle: { lat: 39.97, lng: 32.76 },
  Mamak: { lat: 39.93, lng: 32.92 },
  Etimesgut: { lat: 39.95, lng: 32.67 },
  Sincan: { lat: 39.97, lng: 32.58 },
  Altındağ: { lat: 39.945, lng: 32.86 },
  Gölbaşı: { lat: 39.79, lng: 32.8 },
  Pursaklar: { lat: 40.04, lng: 32.9 },
};

/**
 * Şubeye konum verir: ilçe merkezinden küçük, deterministik bir sapma.
 *
 * Sapma olmasa aynı ilçedeki yirmi işletme tek noktada üst üste binerdi.
 * ~0,01 derece kabaca 1 km; ilçe içinde makul bir dağılım veriyor.
 */
export function subeKoordinat(ilce: string, tohum: number): { lat: number; lng: number } | null {
  const merkez = ILCE_KOORDINAT[ilce];
  if (!merkez) return null;
  const a = ((tohum * 47) % 21) - 10; // -10..10
  const b = ((tohum * 83) % 21) - 10;
  return {
    lat: Number((merkez.lat + a * 0.0012).toFixed(6)),
    lng: Number((merkez.lng + b * 0.0016).toFixed(6)),
  };
}
