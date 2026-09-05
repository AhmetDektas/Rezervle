/** Uygulama genelinde kullanılan sabitler. SQLite enum desteklemediği için
 *  veritabanında String tutulur, tip güvenliği burada sağlanır. */

export const ROLES = ['CUSTOMER', 'STAFF', 'OWNER', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

export const RESERVATION_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'ARRIVED',
  'COMPLETED',
  'NO_SHOW',
  'CANCELLED',
] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

/** Slotu dolu sayan durumlar. İptal edilen kayıt slotu serbest bırakır. */
export const ACTIVE_STATUSES: readonly ReservationStatus[] = [
  'PENDING',
  'CONFIRMED',
  'ARRIVED',
  'COMPLETED',
  'NO_SHOW',
];

export const CHANNELS = ['ONLINE', 'PHONE', 'WALK_IN', 'STAFF'] as const;
export type Channel = (typeof CHANNELS)[number];

export const BUSINESS_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'] as const;
export type BusinessStatus = (typeof BUSINESS_STATUSES)[number];

/**
 * KVKK kayıtları.
 *
 * İki ayrı şey: aydınlatma bir yükümlülük (bilgilendirdik mi?), açık rıza bir
 * izin (verdi mi?). Tek kutuyla ikisi birden alınıyor ama kayıt ayrı tutuluyor
 * çünkü geri alınabilen yalnızca rıza; aydınlatmanın geri alınması diye bir şey
 * yok. Aynı satırda tutulsalardı rıza geri alındığında aydınlatma kaydı da
 * kaybolurdu.
 */
export const CONSENT_KINDS = ['AYDINLATMA', 'ACIK_RIZA'] as const;
export type ConsentKind = (typeof CONSENT_KINDS)[number];

/**
 * Yürürlükteki metin sürümü. Aydınlatma metni değişirse burası da değişir;
 * eski kayıtlar hangi metne onay verildiğini göstermeye devam eder.
 */
export const CONSENT_VERSION = '2026-09-05';

export const SECTORS = [
  'RESTAURANT',
  'BEAUTY',
  'PITCH',
  'DENTAL',
  'VET',
  'AESTHETIC',
  'GYM',
] as const;
export type Sector = (typeof SECTORS)[number];

export const PAYMENT_METHODS = ['AT_VENUE', 'ONLINE'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_STATUSES = ['PENDING', 'PAID', 'REFUNDED', 'FAILED'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const REVIEW_STATUSES = ['PUBLISHED', 'REPORTED', 'HIDDEN'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const RESERVATION_STATUS_LABEL: Record<ReservationStatus, string> = {
  PENDING: 'Onay bekliyor',
  CONFIRMED: 'Onaylandı',
  ARRIVED: 'Geldi',
  COMPLETED: 'Tamamlandı',
  NO_SHOW: 'Gelmedi',
  CANCELLED: 'İptal edildi',
};

/**
 * Durumun müşteri için ne anlama geldiği.
 *
 * "Onay bekliyor" tek başına belirsiz görünür: müşteri saatinin tutulup
 * tutulmadığını bilemez. Oysa bekleyen randevu da slotu kilitler — bunu
 * açıkça söylüyoruz ki kimse ikinci kez aramak zorunda kalmasın.
 */
export const RESERVATION_STATUS_MEANING: Record<ReservationStatus, string> = {
  PENDING:
    'Saatiniz size ayrıldı; bu saate başka kimse randevu alamaz. İşletme onayladığında bildirim göndereceğiz.',
  CONFIRMED: 'İşletme randevunuzu onayladı. Belirtilen saatte sizi bekliyor.',
  ARRIVED: 'İşletme gelişinizi kaydetti.',
  COMPLETED: 'Randevu tamamlandı. Deneyiminizi değerlendirebilirsiniz.',
  NO_SHOW: 'İşletme randevuya gelinmediğini işaretledi. Hatalıysa işletmeyle iletişime geçin.',
  CANCELLED: 'Bu randevu iptal edildi ve saat yeniden randevuya açıldı.',
};

export const CHANNEL_LABEL: Record<Channel, string> = {
  ONLINE: 'Online',
  PHONE: 'Telefon',
  WALK_IN: 'Kapıdan',
  STAFF: 'Personel',
};

export const BUSINESS_STATUS_LABEL: Record<BusinessStatus, string> = {
  PENDING: 'Onay bekliyor',
  APPROVED: 'Yayında',
  REJECTED: 'Reddedildi',
  SUSPENDED: 'Askıda',
};

export const ROLE_LABEL: Record<Role, string> = {
  CUSTOMER: 'Müşteri',
  STAFF: 'Personel',
  OWNER: 'İşletme sahibi',
  ADMIN: 'Platform yöneticisi',
};

export const SECTOR_LABEL: Record<Sector, string> = {
  RESTAURANT: 'Restoran',
  BEAUTY: 'Güzellik salonu',
  PITCH: 'Halı saha',
  DENTAL: 'Diş kliniği',
  VET: 'Veteriner kliniği',
  AESTHETIC: 'Estetik kliniği',
  GYM: 'Spor salonu',
};

/**
 * Sektöre göre kaynak terminolojisi.
 *
 * Rezervasyon çekirdeği her sektörde aynıdır: bir "kaynak" belirli bir aralık
 * için ayrılır. Ama kullanıcı için o kaynak kimi zaman bir hekim, kimi zaman
 * bir saha ya da masadır. Arayüz metinlerini tek yerden okuyoruz ki
 * halı saha müşterisine "kiminle görüşmek istersiniz?" diye sorulmasın.
 */
export type SectorTerms = {
  /** Kaynağın tekil adı: "Personel", "Saha", "Masa" */
  resource: string;
  /** Müşteri tarafındaki bölüm başlığı: "Ekip", "Sahalar", "Masalar" */
  resourcePlural: string;
  /** Panelde gezinme ve liste başlığı: "Personel", "Sahalar", "Masalar" */
  resourceAdminPlural: string;
  /** Rezervasyon adımının sorusu */
  pickPrompt: string;
  /** "Fark etmez" seçeneğinin açıklaması */
  anyHint: (count: number) => string;
  /** Hizmet listesinin başlığı */
  services: string;
  /** Rezervasyonun ilk adımının sorusu */
  servicePrompt: string;
};

const PERSON_TERMS: SectorTerms = {
  resource: 'Personel',
  resourcePlural: 'Ekip',
  resourceAdminPlural: 'Personel',
  pickPrompt: 'Kiminle görüşmek istersiniz?',
  anyHint: (n) => `Uygun olan ilk personel atanır (${n} kişi)`,
  services: 'Hizmetler ve fiyatlar',
  servicePrompt: 'Hangi hizmeti alacaksınız?',
};

export const SECTOR_TERMS: Record<Sector, SectorTerms> = {
  DENTAL: PERSON_TERMS,
  BEAUTY: PERSON_TERMS,
  AESTHETIC: PERSON_TERMS,
  VET: { ...PERSON_TERMS, pickPrompt: 'Hangi veteriner hekim?' },
  GYM: {
    resource: 'Eğitmen',
    resourcePlural: 'Eğitmenler',
    resourceAdminPlural: 'Eğitmenler',
    pickPrompt: 'Hangi eğitmenle çalışacaksınız?',
    anyHint: (n) => `Uygun olan ilk eğitmen atanır (${n} kişi)`,
    services: 'Dersler ve fiyatlar',
    servicePrompt: 'Hangi dersi alacaksınız?',
  },
  PITCH: {
    resource: 'Saha',
    resourcePlural: 'Sahalar',
    resourceAdminPlural: 'Sahalar',
    pickPrompt: 'Hangi sahayı istersiniz?',
    anyHint: (n) => `Uygun olan ilk saha ayrılır (${n} saha)`,
    services: 'Kiralama seçenekleri',
    servicePrompt: 'Ne kadar süre kiralamak istersiniz?',
  },
  RESTAURANT: {
    resource: 'Masa',
    resourcePlural: 'Masalar',
    resourceAdminPlural: 'Masalar',
    pickPrompt: 'Hangi masayı istersiniz?',
    anyHint: (n) => `Uygun olan ilk masa ayrılır (${n} masa)`,
    services: 'Rezervasyon seçenekleri',
    servicePrompt: 'Kaç kişilik masa istersiniz?',
  },
};

export function termsFor(sector: string): SectorTerms {
  return SECTOR_TERMS[sector as Sector] ?? PERSON_TERMS;
}

export const WEEKDAYS = [
  'Pazar',
  'Pazartesi',
  'Salı',
  'Çarşamba',
  'Perşembe',
  'Cuma',
  'Cumartesi',
] as const;
export const WEEKDAYS_SHORT = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'] as const;

/** Müşteri arayüzünde slot adımı (dakika). */
export const SLOT_STEP_MIN = 15;

/** İleriye dönük rezervasyon penceresi (gün). */
export const BOOKING_HORIZON_DAYS = 60;

/**
 * 3DS için tanınan süre (dakika).
 *
 * Müşteri bankanın sayfasına gittiği anda saat ona ayrılmış durumda. Süre
 * dolduğunda kayıt iptal edilip saat yeniden satışa açılıyor (T5).
 *
 * 15 dakika: SMS ile gelen 3DS kodunu girmek için fazlasıyla yeterli, ama
 * popüler bir saatin yarım gün kilitli kalmasına da izin vermiyor. Kısası
 * gerçekten ödeyecek müşteriyi keser, uzunu saati boşa yakar.
 */
export const PAYMENT_DEADLINE_MIN = 15;

/**
 * Uygulamanın kendi adresi. Ödeme sağlayıcısına "müşteriyi buraya geri
 * gönder" derken gerekiyor; sağlayıcı bizim tarafımızı tahmin edemez.
 */
export function appUrl(): string {
  return process.env['NEXT_PUBLIC_APP_URL'] || 'http://localhost:3000';
}

/** Randevuya bu süreden az kaldıysa müşteri kendi iptal/erteleme yapamaz. */
export const CUSTOMER_CHANGE_CUTOFF_MIN = 120;

export const ANKARA_DISTRICTS = [
  'Çankaya',
  'Keçiören',
  'Yenimahalle',
  'Mamak',
  'Etimesgut',
  'Sincan',
  'Altındağ',
  'Gölbaşı',
  'Pursaklar',
] as const;

export const CITIES = ['Ankara', 'İstanbul', 'İzmir'] as const;
