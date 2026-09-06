import { z } from 'zod';
import { CHANNELS, RESERVATION_STATUSES, PAYMENT_METHODS, MAX_SERVICES_PER_BOOKING } from './constants';

/** Türkiye cep telefonu: 5xx xxx xx xx (başında 0 veya +90 olabilir). */
export const phoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/\D/g, '').replace(/^90/, '').replace(/^0/, ''))
  .refine((v) => v.length === 10 && v.startsWith('5'), {
    message: 'Geçerli bir cep telefonu girin (5xx xxx xx xx).',
  });

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'E-posta adresi gerekli.')
  .email('Geçerli bir e-posta adresi girin.')
  .toLowerCase();

export const passwordSchema = z
  .string()
  .min(8, 'Parola en az 8 karakter olmalı.')
  .max(72, 'Parola en fazla 72 karakter olabilir.')
  .refine((v) => /[a-zA-Z]/.test(v) && /\d/.test(v), {
    message: 'Parola en az bir harf ve bir rakam içermeli.',
  });

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Adınızı girin.').max(80),
  email: emailSchema,
  phone: phoneSchema.optional().or(z.literal('')),
  password: passwordSchema,
  kvkk: z.literal(true, { errorMap: () => ({ message: 'Devam etmek için onay verin.' }) }),
});

/**
 * İşletme başvurusu.
 *
 * Alanlar bilinçli olarak az (S11-2): başvuruda yalnızca "kimsiniz ve
 * neredesiniz" soruluyor. Çalışma saati, hizmet ve personel onaydan sonra
 * panelde rehberli olarak giriliyor — henüz ürüne güvenmemiş bir işletme
 * sahibi uzun formu büyük ihtimalle bitirmez.
 */
export const businessRegisterSchema = z.object({
  ownerName: z.string().trim().min(2, 'Adınızı girin.').max(80),
  email: emailSchema,
  phone: phoneSchema,
  password: passwordSchema,
  businessName: z.string().trim().min(2, 'İşletme adını girin.').max(80),
  categorySlug: z.string().trim().min(1, 'Kategori seçin.'),
  district: z.string().trim().min(1, 'Semt seçin.'),
  address: z.string().trim().min(10, 'Açık adres girin (en az 10 karakter).').max(200),
  kvkk: z.literal(true, { errorMap: () => ({ message: 'Devam etmek için onay verin.' }) }),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Parolanızı girin.'),
});

export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Tarih biçimi geçersiz.');

export const minuteSchema = z.coerce.number().int().min(0).max(1439);

export const bookingSchema = z.object({
  businessId: z.string().min(1),
  branchId: z.string().min(1, 'Şube seçin.'),
  serviceIds: z
    .array(z.string().min(1))
    .min(1, 'En az bir hizmet seçin.')
    .max(MAX_SERVICES_PER_BOOKING, `Bir randevuda en fazla ${MAX_SERVICES_PER_BOOKING} hizmet seçilebilir.`)
    // Aynı hizmet iki kez gönderilirse süre ve tutar iki katına çıkardı.
    .refine((ids) => new Set(ids).size === ids.length, 'Aynı hizmet birden fazla kez seçilemez.'),
  staffId: z.string().min(1, 'Personel seçin.'),
  date: dateSchema,
  startMin: minuteSchema,
  note: z.string().trim().max(500, 'Not en fazla 500 karakter olabilir.').optional(),
  promotionCode: z.string().trim().max(32).optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).default('AT_VENUE'),
});

export const staffBookingSchema = bookingSchema.extend({
  customerName: z.string().trim().min(2, 'Müşteri adı gerekli.').max(80),
  customerPhone: phoneSchema,
  customerEmail: emailSchema.optional().or(z.literal('')),
  channel: z.enum(CHANNELS).default('PHONE'),
  internalNote: z.string().trim().max(500).optional(),
});

export const rescheduleSchema = z.object({
  reservationId: z.string().min(1),
  date: dateSchema,
  startMin: minuteSchema,
  staffId: z.string().min(1).optional(),
});

export const statusSchema = z.object({
  reservationId: z.string().min(1),
  status: z.enum(RESERVATION_STATUSES),
  note: z.string().trim().max(300).optional(),
});

export const serviceSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, 'Hizmet adı gerekli.').max(80),
  description: z.string().trim().max(400).default(''),
  durationMin: z.coerce.number().int().min(5, 'Süre en az 5 dakika.').max(600),
  bufferMin: z.coerce.number().int().min(0).max(120),
  price: z.coerce.number().int().min(0, 'Fiyat negatif olamaz.').max(1_000_000),
  active: z.coerce.boolean().default(true),
  staffIds: z.array(z.string()).default([]),
});

export const staffSchema = z.object({
  id: z.string().optional(),
  displayName: z.string().trim().min(2, 'Personel adı gerekli.').max(80),
  title: z.string().trim().max(60).default(''),
  bio: z.string().trim().max(400).default(''),
  branchId: z.string().optional(),
  active: z.coerce.boolean().default(true),
  serviceIds: z.array(z.string()).default([]),
});

export const workingHoursSchema = z.object({
  targetId: z.string().min(1),
  days: z
    .array(
      z.object({
        weekday: z.coerce.number().int().min(0).max(6),
        closed: z.coerce.boolean(),
        startMin: minuteSchema,
        endMin: z.coerce.number().int().min(0).max(1440),
      }),
    )
    .length(7),
});


/** Boş formu "değer yok" sayar; sıfıra çevirmez. */
function bosluguYokSay<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
    schema.optional(),
  );
}

export const branchSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, 'Şube adı gerekli.').max(80),
  city: z.string().trim().min(2).max(40),
  district: z.string().trim().min(2, 'İlçe gerekli.').max(40),
  address: z.string().trim().min(5, 'Adres gerekli.').max(200),
  phone: phoneSchema.optional().or(z.literal('')),
  // Harita koordinatı isteğe bağlı: doluysa iğne tam yerinde, boşsa adres
  // metniyle aranıyor.
  //
  // preprocess ŞART: boş dize doğrudan z.coerce.number()'a girerse 0'a
  // dönüşür ve 0,0 Atlas Okyanusu'nda geçerli bir koordinattır. Koordinat
  // girmeyen her şube haritada Afrika açıklarını gösterirdi — sessiz ve
  // tamamen yanlış. Aralık kontrolü de enlem/boylamı ters yazmayı yakalıyor.
  lat: bosluguYokSay(z.number().min(-90).max(90)),
  lng: bosluguYokSay(z.number().min(-180).max(180)),
  active: z.coerce.boolean().default(true),
});

export const reviewSchema = z.object({
  reservationId: z.string().min(1),
  rating: z.coerce.number().int().min(1, 'Puan verin.').max(5),
  comment: z.string().trim().max(600).default(''),
});

export const promotionSchema = z.object({
  id: z.string().optional(),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(3, 'Kod en az 3 karakter.')
    .max(24)
    .regex(/^[A-Z0-9]+$/, 'Kod yalnızca harf ve rakam içerebilir.'),
  title: z.string().trim().min(3, 'Başlık gerekli.').max(80),
  description: z.string().trim().max(200).default(''),
  kind: z.enum(['PERCENT', 'AMOUNT']),
  value: z.coerce.number().int().min(1, 'Değer gerekli.'),
  minAmount: z.coerce.number().int().min(0).default(0),
  startsAt: dateSchema,
  endsAt: dateSchema,
  maxUses: z.coerce.number().int().min(0).default(0),
  active: z.coerce.boolean().default(true),
});

export const profileSchema = z.object({
  name: z.string().trim().min(2, 'Adınızı girin.').max(80),
  phone: phoneSchema.optional().or(z.literal('')),
  city: z.string().trim().max(40).optional(),
  district: z.string().trim().max(40).optional(),
  smsOptIn: z.coerce.boolean().default(true),
  emailOptIn: z.coerce.boolean().default(true),
});

export const businessProfileSchema = z.object({
  name: z.string().trim().min(2, 'İşletme adı gerekli.').max(80),
  tagline: z.string().trim().max(120).default(''),
  about: z.string().trim().max(2000).default(''),
  phone: phoneSchema.optional().or(z.literal('')),
  email: emailSchema.optional().or(z.literal('')),
  website: z.string().trim().url('Geçerli bir adres girin.').optional().or(z.literal('')),
  priceLevel: z.coerce.number().int().min(1).max(3),
  amenities: z.array(z.string().trim().max(40)).max(20).default([]),
});

export const depositSettingsSchema = z
  .object({
    enabled: z.coerce.boolean().default(false),
    kind: z.enum(['PERCENT', 'AMOUNT']),
    value: z.coerce.number().int().min(1, 'Kapora değeri gerekli.'),
    minPrice: z.coerce.number().int().min(0).default(0),
    refundHours: z.coerce.number().int().min(0).max(168).default(24),
  })
  .refine((v) => v.kind !== 'PERCENT' || v.value <= 100, {
    message: 'Yüzde kapora en fazla %100 olabilir.',
    path: ['value'],
  });

/** Hak ediş hesabı. IBAN yalnızca biçim olarak doğrulanır; gerçek doğrulama
 *  ödeme kuruluşunun alt üye işyeri kaydında yapılır. */
export const payoutSchema = z.object({
  payoutTitle: z.string().trim().min(3, 'Hesap ünvanı gerekli.').max(120),
  payoutIban: z
    .string()
    .trim()
    .transform((v) => v.replace(/\s+/g, '').toUpperCase())
    .refine((v) => /^TR\d{24}$/.test(v), { message: 'IBAN "TR" ile başlamalı ve 26 karakter olmalı.' }),
  taxNumber: z
    .string()
    .trim()
    .refine((v) => /^\d{10,11}$/.test(v), { message: 'Vergi veya TC kimlik numarası 10-11 hane olmalı.' }),
});

/** Zod hatalarını alan adına göre düz bir sözlüğe indirger. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'form';
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/**
 * Restoran menü kalemi.
 *
 * Bölüm adı serbest metin: sabit bir liste her mutfağa uymazdı (kahvaltıcının
 * bölümleriyle balıkçınınki aynı değil).
 */
export const menuItemSchema = z.object({
  id: z.string().optional(),
  businessId: z.string().min(1),
  category: z.string().trim().min(2, 'Bölüm adı girin.').max(40),
  name: z.string().trim().min(2, 'Ürün adı girin.').max(80),
  description: z.string().trim().max(200, 'Açıklama en fazla 200 karakter olabilir.').optional(),
  price: z.coerce.number().int().min(0, 'Fiyat negatif olamaz.').max(100_000),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
});
