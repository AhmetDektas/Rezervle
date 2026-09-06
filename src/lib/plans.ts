/**
 * Abonelik paketleri.
 *
 * Platformun **ana geliri** aylık abonelik; kapora komisyonu bunun üzerine
 * gelen eklenti.
 *
 * ⚠️ AŞAĞIDAKİ FİYAT VE PAKET İÇERİKLERİ GEÇİCİDİR. Ücretlendirme çalışması
 * sürüyor; kesinleşince yalnızca bu dosyadaki `PLANS` dizisi güncellenecek.
 * Sistemin geri kalanı paket tanımını buradan okuyor, hiçbir yere fiyat
 * gömülmedi.
 *
 * Geçici sayılar 41 işletmelik anketten: abonelik beklentisinin ortancası
 * 2.000 TL, çeyrekler 1.500–2.500 TL. Katılımcıların %71'i abonelik,
 * %95'i ücretsiz deneme istiyor.
 *
 * Fiyat değişikliği MEVCUT abonelere yansımıyor: seçilen ücret kayıt anında
 * `Business.planPrice` alanına donduruluyor.
 *
 * Saf modül: veritabanı bilmez, sunucu ve istemci birlikte kullanabilir.
 */

export type PlanKey = 'baslangic' | 'profesyonel' | 'kurumsal';

export type Plan = {
  key: PlanKey;
  name: string;
  /** Aylık ücret (TL). */
  price: number;
  tagline: string;
  features: string[];
  /** Kapora tahsilatı eklentisi bu pakete dahil mi? */
  deposit: boolean;
  /** Kaç şubeye kadar. null = sınırsız. */
  branchLimit: number | null;
  popular?: boolean;
};

/**
 * Deneme süresi.
 *
 * Ankette %95 "üç ay ücretsiz denemek isterim" dedi ve mevcut alışkanlık
 * telefon + defter: yazılıma geçiş kararı bir ayda verilmiyor. Kısa deneme,
 * işletmenin ürünü ilk yoğun sezonunda görmesine yetmezdi.
 */
export const TRIAL_DAYS = 90;

export const PLANS: Plan[] = [
  {
    key: 'baslangic',
    name: 'Başlangıç',
    price: 1500,
    tagline: 'Tek şube, temel randevu yönetimi',
    features: [
      'Sınırsız online randevu',
      'Otomatik hatırlatma (SMS + e-posta)',
      'Müşteri kaydı ve notlar',
      'Tek şube',
      'Keşfet sayfasında listelenme',
    ],
    deposit: false,
    branchLimit: 1,
  },
  {
    key: 'profesyonel',
    name: 'Profesyonel',
    price: 2000,
    tagline: 'Kapora tahsilatı ve çok şube',
    features: [
      'Başlangıç paketindeki her şey',
      'Kapora tahsilatı (no-show’a karşı)',
      'Kampanya ve indirim kodları',
      '3 şubeye kadar',
      'Ciro ve doluluk raporları',
    ],
    deposit: true,
    branchLimit: 3,
    popular: true,
  },
  {
    key: 'kurumsal',
    name: 'Kurumsal',
    price: 3000,
    tagline: 'Sınırsız şube ve öncelikli destek',
    features: [
      'Profesyonel paketindeki her şey',
      'Sınırsız şube',
      'Öne çıkan işletme rozeti',
      'Öncelikli destek',
    ],
    deposit: true,
    branchLimit: null,
  },
];

export function planByKey(key: string): Plan {
  // Bilinmeyen anahtar en düşük pakete düşüyor: eksik bilgiden dolayı
  // işletmeye ödemediği bir özelliği açmak, tersinden daha pahalı.
  return PLANS.find((p) => p.key === key) ?? PLANS[0]!;
}

export const PLAN_STATUSES = ['TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED'] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

export const PLAN_STATUS_LABEL: Record<PlanStatus, string> = {
  TRIAL: 'Deneme sürüyor',
  ACTIVE: 'Abonelik aktif',
  PAST_DUE: 'Ödeme bekleniyor',
  CANCELLED: 'İptal edildi',
};

/** Denemenin bitmesine kaç gün kaldı. Bitmişse 0. */
export function trialDaysLeft(trialEndsAt: Date | null, now: Date = new Date()): number {
  if (!trialEndsAt) return 0;
  const fark = trialEndsAt.getTime() - now.getTime();
  if (fark <= 0) return 0;
  return Math.ceil(fark / (24 * 60 * 60 * 1000));
}

/**
 * İşletme şu anda hizmet alabiliyor mu?
 *
 * Deneme ve aktif abonelik çalışır; ödeme gecikmişse de **kapatmıyoruz**.
 * Randevu almayı durdurmak, işletmenin müşterisini cezalandırmak olurdu ve
 * müşteri gecikmiş faturadan haberdar bile değil. Gecikme panelde uyarı
 * olarak görünüyor; tahsilat insan işi.
 */
export function planActive(status: string): boolean {
  return status !== 'CANCELLED';
}
