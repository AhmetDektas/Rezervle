import { BUSINESSES, SERVICE_SETS, SERVICE_SETS_EXTRA, type SeedMenuItem } from './seed-data';

/**
 * İkinci dalga işletmeler ve restoran menüleri.
 *
 * Ayrı dosya: `seed-data.ts` zaten 600 satırın üzerinde ve tek bir veri
 * dosyasının sonsuza kadar büyümesi, içinde bir şey aramayı imkânsız kılıyor.
 *
 * Vitrinin gerçekçi görünmesi için tek başına sayı yetmiyor: her kayıt kendi
 * semtinde, kendi fiyat seviyesinde ve kendi anlatısıyla duruyor. Aynı
 * şablondan üretilmiş on işletme listeyi doldurur ama inandırıcı kılmaz.
 */
BUSINESSES.push(
  {
    slug: 'ocakbasi-1071-etlik',
    name: 'Ocakbaşı 1071',
    sector: 'RESTAURANT',
    tagline: 'Etlik’te odun ateşinde ızgara, 1998’den beri',
    about:
      'Etlerimizi günlük alıyor, kendi kasabımızda dinlendiriyoruz. Ocak başında oturmak isteyenler için altı kişilik tezgâh masamız var; rezervasyonda belirtmeniz yeterli.',
    hue: 18,
    priceLevel: 2,
    featured: false,
    amenities: ['Ocak başı masa', 'Vale', 'Aile salonu', 'Kredi kartına taksit'],
    owner: { name: 'Hüseyin Çakır', email: 'huseyin@ocakbasi1071.com' },
    branches: [
      { name: 'Etlik', district: 'Keçiören', address: 'Yayla Cad. No:31, Etlik', phone: '3123251071' },
    ],
    services: SERVICE_SETS_EXTRA.RESTAURANT,
    staff: [{ name: 'Salon', title: 'Masa düzeni', bio: 'Ocak başı ve salon masaları.', services: [0, 1, 2] }],
  },
  {
    slug: 'balikci-deniz-yildizi',
    name: 'Balıkçı Deniz Yıldızı',
    sector: 'RESTAURANT',
    tagline: 'Günlük balık, meze tezgâhı, Gaziosmanpaşa',
    about:
      'Balığımız her sabah geliyor. Meze tezgâhından seçim yaparak başlayabilir, mevsim balığını tartıda görüp seçebilirsiniz. Rakı-balık akşamları için 19:00 sonrası rezervasyon öneriyoruz.',
    hue: 202,
    priceLevel: 3,
    featured: true,
    amenities: ['Günlük balık', 'Meze tezgâhı', 'Canlı fasıl (Cuma-Cmt)', 'Vale'],
    owner: { name: 'Yaşar Deniz', email: 'yasar@denizyildizi.com' },
    branches: [
      { name: 'Gaziosmanpaşa', district: 'Çankaya', address: 'Reşit Galip Cad. No:64, Gaziosmanpaşa', phone: '3124470909' },
    ],
    services: SERVICE_SETS_EXTRA.RESTAURANT,
    staff: [{ name: 'Salon', title: 'Masa düzeni', bio: 'Salon ve teras masaları.', services: [0, 1, 2] }],
    deposit: { addon: true, enabled: true, kind: 'AMOUNT', value: 200, minPrice: 0, refundHours: 24 },
  },
  {
    slug: 'kahvalti-bahcesi-cayyolu',
    name: 'Kahvaltı Bahçesi',
    sector: 'RESTAURANT',
    tagline: 'Çayyolu’nda serpme kahvaltı, hafta sonu 12:00’ye kadar',
    about:
      'Köy yumurtası, kendi yaptığımız reçeller ve odun fırınından çıkan bazlama ile serpme kahvaltı. Bahçemiz nisan-ekim arası açık; hafta sonu masalar hızlı doluyor.',
    hue: 96,
    priceLevel: 2,
    featured: false,
    amenities: ['Bahçe', 'Çocuk oyun alanı', 'Otopark', 'Evcil hayvan dostu'],
    owner: { name: 'Emine Sarıoğlu', email: 'emine@kahvaltibahcesi.com' },
    branches: [
      { name: 'Çayyolu', district: 'Çankaya', address: 'Alacaatlı Cad. No:12, Çayyolu', phone: '3122411616' },
    ],
    services: SERVICE_SETS_EXTRA.RESTAURANT,
    staff: [{ name: 'Salon', title: 'Masa düzeni', bio: 'Bahçe ve iç salon.', services: [0, 1, 2] }],
  },
  {
    slug: 'trattoria-via-roma',
    name: 'Trattoria Via Roma',
    sector: 'RESTAURANT',
    tagline: 'Taş fırında Napoli usulü pizza, Bahçelievler',
    about:
      'Hamurumuz 48 saat mayalanıyor, taş fırında 90 saniyede pişiyor. Açık mutfak; pizzayı hazırlayan ustayı izleyebilirsiniz.',
    hue: 8,
    priceLevel: 3,
    featured: true,
    amenities: ['Taş fırın', 'Açık mutfak', 'Vejetaryen seçenek', 'Şarap listesi'],
    owner: { name: 'Luca Bianchi', email: 'luca@viaroma.com' },
    branches: [
      { name: 'Bahçelievler', district: 'Çankaya', address: '7. Cad. No:19, Bahçelievler', phone: '3122130707' },
    ],
    services: SERVICE_SETS_EXTRA.RESTAURANT,
    staff: [{ name: 'Salon', title: 'Masa düzeni', bio: 'Salon ve bar masaları.', services: [0, 1, 2] }],
  },
  {
    slug: 'yesil-vadi-hali-saha',
    name: 'Yeşil Vadi Halı Saha',
    sector: 'PITCH',
    tagline: 'Mamak’ta iki kapalı saha, gece 02:00’ye kadar',
    about:
      'Yeni nesil suni çim, LED aydınlatma ve kapalı tribün. Duş ve kilitli dolap ücretsiz. Kurumsal turnuvalar için hafta içi gündüz saatlerinde indirim uyguluyoruz.',
    hue: 128,
    priceLevel: 2,
    featured: false,
    amenities: ['Kapalı saha', 'Duş', 'Kilitli dolap', 'Otopark', 'Kafeterya'],
    owner: { name: 'Tuncay Er', email: 'tuncay@yesilvadi.com' },
    branches: [
      { name: 'Mamak', district: 'Mamak', address: 'Şahintepe Mah. 212. Sok. No:4, Mamak', phone: '3123641818' },
    ],
    services: SERVICE_SETS_EXTRA.PITCH,
    staff: [
      { name: 'Saha 1', title: 'Kapalı saha', bio: '30x50 m, suni çim.', services: [0, 1] },
      { name: 'Saha 2', title: 'Kapalı saha', bio: '25x45 m, suni çim.', services: [0, 1] },
    ],
    deposit: { addon: true, enabled: true, kind: 'AMOUNT', value: 300, minPrice: 0, refundHours: 12 },
  },
  {
    slug: 'kale-spor-tesisleri',
    name: 'Kale Spor Tesisleri',
    sector: 'PITCH',
    tagline: 'Sincan’da üç saha, hafta içi sabah uygun fiyat',
    about:
      'Üç açık saha ve bir kapalı sahamız var. Sabah 08:00-12:00 arası kurumsal ve öğrenci indirimimiz geçerli. Forma ve top ücretsiz.',
    hue: 142,
    priceLevel: 1,
    featured: false,
    amenities: ['Üç saha', 'Duş', 'Forma dahil', 'Otopark'],
    owner: { name: 'Ramazan Kaleli', email: 'ramazan@kalespor.com' },
    branches: [
      { name: 'Sincan', district: 'Sincan', address: 'Fatih Mah. 1234. Cad. No:7, Sincan', phone: '3122712424' },
    ],
    services: SERVICE_SETS_EXTRA.PITCH,
    staff: [
      { name: 'Saha A', title: 'Açık saha', bio: '30x50 m.', services: [0, 1] },
      { name: 'Saha B', title: 'Açık saha', bio: '30x50 m.', services: [0, 1] },
    ],
  },
  {
    slug: 'atolye-sac-tasarim',
    name: 'Atölye Saç Tasarım',
    sector: 'BEAUTY',
    tagline: 'Kızılay’da kesim ve renk üzerine uzman ekip',
    about:
      'Saç kesimi ve renklendirme üzerine yoğunlaşan küçük bir ekibiz. Her randevu öncesi 10 dakikalık ücretsiz danışma yapıyoruz; ne istediğinizden emin değilseniz birlikte karar veriyoruz.',
    hue: 288,
    priceLevel: 2,
    featured: false,
    amenities: ['Ücretsiz danışma', 'Organik boya', 'Metroya yakın', 'Wi-Fi'],
    owner: { name: 'Deniz Aydın', email: 'deniz@atolyesac.com' },
    branches: [
      { name: 'Kızılay', district: 'Çankaya', address: 'Selanik Cad. No:28/4, Kızılay', phone: '3124195656' },
    ],
    services: SERVICE_SETS.BEAUTY,
    staff: [
      { name: 'Deniz Aydın', title: 'Kurucu, Renk Uzmanı', bio: 'Balyaj ve renk düzeltme.', services: [0, 1, 2, 3] },
      { name: 'Kerem Aslan', title: 'Saç Tasarımcısı', bio: 'Kesim ve şekillendirme.', services: [0, 1] },
    ],
  },
  {
    slug: 'zeynep-guzellik-batikent',
    name: 'Zeynep Güzellik',
    sector: 'BEAUTY',
    tagline: 'Batıkent’te cilt bakımı ve tırnak',
    about:
      'On yıldır aynı yerdeyiz. Cilt bakımı, manikür-pedikür ve ağda hizmetlerimiz var. Randevusuz gelen müşterimizi çevirmemek için takvimimizi güncel tutuyoruz.',
    hue: 320,
    priceLevel: 1,
    featured: false,
    amenities: ['Tek kullanımlık malzeme', 'Otopark', 'Kadınlara özel'],
    owner: { name: 'Zeynep Uçar', email: 'zeynep@zeynepguzellik.com' },
    branches: [
      { name: 'Batıkent', district: 'Yenimahalle', address: 'Batı Çarşı No:44, Batıkent', phone: '3122551212' },
    ],
    services: SERVICE_SETS.BEAUTY,
    staff: [{ name: 'Zeynep Uçar', title: 'Güzellik Uzmanı', bio: 'Cilt bakımı ve ağda.', services: [0, 1, 2, 3] }],
  },
  {
    slug: 'pursaklar-agiz-dis-sagligi',
    name: 'Pursaklar Ağız ve Diş Sağlığı',
    sector: 'DENTAL',
    tagline: 'Pursaklar’da cumartesi de açık',
    about:
      'Hafta içi çalışanlar için cumartesi 09:00-17:00 arası hizmet veriyoruz. Çocuk hastalarımız için ayrı bekleme alanımız var.',
    hue: 190,
    priceLevel: 1,
    featured: false,
    amenities: ['Cumartesi açık', 'Çocuk dostu', 'Otopark', 'Kredi kartına taksit'],
    owner: { name: 'Dt. Okan Şimşek', email: 'okan@pursaklardis.com' },
    branches: [
      { name: 'Pursaklar', district: 'Pursaklar', address: 'Merkez Mah. Belediye Cad. No:9, Pursaklar', phone: '3123281414' },
    ],
    services: SERVICE_SETS.DENTAL,
    staff: [
      { name: 'Dt. Okan Şimşek', title: 'Diş Hekimi', bio: 'Genel diş hekimliği ve protez.', services: [0, 1, 2, 3, 4, 5] },
      { name: 'Dt. Büşra Yıldız', title: 'Pedodonti Uzmanı', bio: 'Çocuk diş hekimliği.', services: [0, 1, 2] },
    ],
  },
  {
    slug: 'can-dostlar-veteriner-golbasi',
    name: 'Can Dostlar Veteriner',
    sector: 'VET',
    tagline: 'Gölbaşı’nda 7/24 acil veteriner',
    about:
      'Gece nöbeti tutan az sayıdaki kliniklerden biriyiz. Aşı, cerrahi ve dahiliye hizmetlerimizin yanında büyük ırk köpekler için ayrı muayene odamız var.',
    hue: 152,
    priceLevel: 2,
    featured: true,
    amenities: ['7/24 acil', 'Laboratuvar', 'Otopark', 'Büyük ırk odası'],
    owner: { name: 'Vet. Hek. Sinem Aktan', email: 'sinem@candostlarvet.com' },
    branches: [
      { name: 'Gölbaşı', district: 'Gölbaşı', address: 'Şafak Mah. Ankara Cad. No:52, Gölbaşı', phone: '3124842323' },
    ],
    services: SERVICE_SETS_EXTRA.VET,
    staff: [
      { name: 'Vet. Hek. Sinem Aktan', title: 'Veteriner Hekim, Kurucu', bio: 'Dahiliye ve acil.', services: [0, 1, 2, 3] },
      { name: 'Vet. Hek. Barış Tunç', title: 'Veteriner Hekim', bio: 'Cerrahi ve ortopedi.', services: [0, 1, 2] },
    ],
  },
);

/**
 * Restorana ÖZEL menüler.
 *
 * Tek bir örnek menüyü altı restorana birden yazmak, menü özelliğini
 * göstermeye yeter ama vitrini inandırıcı kılmaz: balıkçıda künefe, pizzacıda
 * Adana kebap görmek "bu veri uydurma" demenin en hızlı yolu. Her mutfak
 * kendi bölümleriyle ve kendi fiyat aralığıyla duruyor.
 *
 * Anahtar işletme slug'ı; slug'ı burada olmayan restoran menüsüz kalıyor ve
 * menü bölümü hiç çizilmiyor.
 */
export const MENULER: Record<string, SeedMenuItem[]> = {
  'kavakli-ocakbasi': [
    { category: 'Başlangıçlar', name: 'Mercimek çorbası', description: 'Tereyağı ve limon ile', price: 95 },
    { category: 'Başlangıçlar', name: 'Ezme', description: 'Acılı, cevizli', price: 110 },
    { category: 'Başlangıçlar', name: 'Haydari', description: 'Süzme yoğurt, nane', price: 105 },
    { category: 'Başlangıçlar', name: 'Sigara böreği', description: '6 adet, beyaz peynirli', price: 135 },
    { category: 'Izgara', name: 'Adana kebap', description: 'Közlenmiş biber ve domates ile', price: 420 },
    { category: 'Izgara', name: 'Urfa kebap', description: 'Acısız, közde', price: 420 },
    { category: 'Izgara', name: 'Kuzu şiş', description: 'Dinlendirilmiş kuzu eti', price: 520 },
    { category: 'Izgara', name: 'Kaburga', description: '400 gr, odun ateşinde', price: 610 },
    { category: 'Izgara', name: 'Karışık ızgara', description: '2 kişilik', price: 980 },
    { category: 'Tatlılar', name: 'Künefe', description: 'Antep fıstıklı, tereyağlı', price: 180 },
    { category: 'Tatlılar', name: 'Kazandibi', price: 140 },
    { category: 'İçecekler', name: 'Ayran', description: 'Yayık', price: 55 },
    { category: 'İçecekler', name: 'Şalgam', price: 50 },
    { category: 'İçecekler', name: 'Türk kahvesi', price: 85 },
  ],
  'ocakbasi-1071-etlik': [
    { category: 'Başlangıçlar', name: 'İşkembe çorbası', price: 110 },
    { category: 'Başlangıçlar', name: 'Acılı ezme', price: 95 },
    { category: 'Başlangıçlar', name: 'Patlıcan salatası', description: 'Közlenmiş, sarımsaklı', price: 115 },
    { category: 'Ocak başı', name: 'Ciğer şiş', description: 'Kuzu ciğeri, kekikli soğan ile', price: 380 },
    { category: 'Ocak başı', name: 'Kanat', description: '8 adet', price: 340 },
    { category: 'Ocak başı', name: 'Pirzola', description: '350 gr kuzu pirzola', price: 590 },
    { category: 'Ocak başı', name: 'Tavuk şiş', price: 320 },
    { category: 'Ocak başı', name: 'Tezgâh tabağı', description: '4 kişilik karışık', price: 1450 },
    { category: 'Tatlılar', name: 'Fıstıklı baklava', description: 'Porsiyon, 4 dilim', price: 190 },
    { category: 'İçecekler', name: 'Ayran', price: 45 },
    { category: 'İçecekler', name: 'Şalgam', price: 45 },
  ],
  'balikci-deniz-yildizi': [
    { category: 'Mezeler', name: 'Levrek marin', description: 'Limon, dereotu', price: 210 },
    { category: 'Mezeler', name: 'Ahtapot salatası', price: 280 },
    { category: 'Mezeler', name: 'Deniz börülcesi', price: 150 },
    { category: 'Mezeler', name: 'Kalamar tava', price: 320 },
    { category: 'Mezeler', name: 'Lakerda', price: 260 },
    { category: 'Ana yemekler', name: 'Levrek ızgara', description: 'Porsiyon, mevsim yeşilliği ile', price: 620 },
    { category: 'Ana yemekler', name: 'Çipura ızgara', price: 580 },
    { category: 'Ana yemekler', name: 'Hamsi tava', description: 'Mevsiminde', price: 340 },
    { category: 'Ana yemekler', name: 'Karides güveç', price: 540 },
    { category: 'Tatlılar', name: 'İrmik helvası', description: 'Dondurma ile', price: 160 },
    { category: 'İçecekler', name: 'Şalgam', price: 55 },
    { category: 'İçecekler', name: 'Soda', price: 40 },
  ],
  'kahvalti-bahcesi-cayyolu': [
    { category: 'Kahvaltı', name: 'Serpme kahvaltı', description: 'Kişi başı, 22 çeşit, çay dahil', price: 450 },
    { category: 'Kahvaltı', name: 'Köy kahvaltısı', description: 'İki kişilik tabak', price: 780 },
    { category: 'Sıcaklar', name: 'Menemen', description: 'Kaşarlı ya da sade', price: 220 },
    { category: 'Sıcaklar', name: 'Sucuklu yumurta', price: 240 },
    { category: 'Sıcaklar', name: 'Gözleme', description: 'Peynirli, patatesli ya da kıymalı', price: 180 },
    { category: 'Sıcaklar', name: 'Bal kaymak', description: 'Süzme bal, manda kaymağı', price: 260 },
    { category: 'Fırından', name: 'Bazlama', description: 'Odun fırınından, 2 adet', price: 90 },
    { category: 'Fırından', name: 'Simit', price: 40 },
    { category: 'İçecekler', name: 'Semaver çay', description: 'Sınırsız, kişi başı', price: 70 },
    { category: 'İçecekler', name: 'Taze portakal suyu', price: 130 },
    { category: 'İçecekler', name: 'Türk kahvesi', price: 85 },
  ],
  'trattoria-via-roma': [
    { category: 'Antipasti', name: 'Bruschetta', description: 'Domates, fesleğen, sarımsak', price: 180 },
    { category: 'Antipasti', name: 'Caprese', description: 'Mozzarella di bufala, domates', price: 290 },
    { category: 'Antipasti', name: 'Arancini', description: '4 adet, risotto topu', price: 240 },
    { category: 'Pizza', name: 'Margherita', description: 'San Marzano domates, mozzarella, fesleğen', price: 380 },
    { category: 'Pizza', name: 'Diavola', description: 'Acı salam, mozzarella', price: 450 },
    { category: 'Pizza', name: 'Quattro formaggi', description: 'Dört peynirli', price: 470 },
    { category: 'Pizza', name: 'Prosciutto e rucola', price: 520 },
    { category: 'Makarna', name: 'Cacio e pepe', description: 'Pecorino, karabiber', price: 340 },
    { category: 'Makarna', name: 'Tagliatelle al ragù', price: 420 },
    { category: 'Dolci', name: 'Tiramisù', description: 'Ev yapımı', price: 200 },
    { category: 'Dolci', name: 'Panna cotta', price: 180 },
    { category: 'İçecekler', name: 'Espresso', price: 90 },
    { category: 'İçecekler', name: 'Limonata', description: 'Taze sıkma', price: 120 },
  ],
  'bahce-mutfak-eryaman': [
    { category: 'Çorbalar', name: 'Ezogelin', price: 95 },
    { category: 'Çorbalar', name: 'Yayla çorbası', price: 95 },
    { category: 'Ev yemekleri', name: 'Karnıyarık', description: 'Pilav ile', price: 280 },
    { category: 'Ev yemekleri', name: 'Etli türlü', price: 310 },
    { category: 'Ev yemekleri', name: 'Kuru fasulye', description: 'Pirinç pilavı ve turşu ile', price: 250 },
    { category: 'Ev yemekleri', name: 'Mantı', description: 'Yoğurtlu, naneli tereyağı', price: 290 },
    { category: 'Ev yemekleri', name: 'İçli köfte', description: '2 adet', price: 220 },
    { category: 'Tatlılar', name: 'Sütlaç', description: 'Fırında, tarçınlı', price: 130 },
    { category: 'Tatlılar', name: 'Ayva tatlısı', description: 'Mevsiminde, kaymaklı', price: 160 },
    { category: 'İçecekler', name: 'Ayran', price: 45 },
    { category: 'İçecekler', name: 'Ev limonatası', price: 95 },
  ],
};
