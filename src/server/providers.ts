import 'server-only';

/**
 * Sağlayıcı adaptörleri.
 *
 * MVP'de e-posta ve SMS konsola yazar, ödeme sahte sağlayıcıdan geçer.
 * Gerçek entegrasyon eklenirken yalnızca bu dosya değişir; rezervasyon
 * mantığı sağlayıcıyı hiç bilmez.
 */

export type EmailMessage = { to: string; subject: string; body: string };
export type SmsMessage = { to: string; body: string };

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<{ id: string }>;
}

export interface SmsProvider {
  readonly name: string;
  send(message: SmsMessage): Promise<{ id: string }>;
}

const consoleEmail: EmailProvider = {
  name: 'console',
  async send(message) {
    console.info(`[e-posta → ${message.to}] ${message.subject}\n${message.body}`);
    return { id: `mail_${Date.now()}` };
  },
};

const consoleSms: SmsProvider = {
  name: 'console',
  async send(message) {
    console.info(`[sms → ${message.to}] ${message.body}`);
    return { id: `sms_${Date.now()}` };
  },
};

export function emailProvider(): EmailProvider {
  // SMTP_URL tanımlandığında burada gerçek sağlayıcı döndürülür.
  return consoleEmail;
}

export function smsProvider(): SmsProvider {
  return consoleSms;
}

/**
 * Kanal gönderimi. `null` adres "bu kanala gönderme" demektir; kimin hangi
 * kanalı istediğine çağıran karar verir (bkz. notifications.ts), adaptör
 * yalnızca eline verileni gönderir.
 */
export async function notify(input: {
  email: string | null;
  phone: string | null;
  name: string;
  subject: string;
  body: string;
}): Promise<void> {
  if (input.email) await emailProvider().send({ to: input.email, subject: input.subject, body: input.body });
  if (input.phone) await smsProvider().send({ to: input.phone, body: `${input.subject} — ${input.body}` });
}

// --- Ödeme (pazaryeri modeli) --------------------------------------------

/**
 * Ödeme sağlayıcısı, **alt üye işyeri (pazaryeri)** modeliyle çalışır.
 *
 * Müşteri kaporayı tek seferde öder. Lisanslı ödeme kuruluşu tutarı ödeme
 * anında böler: platform komisyonu platformun üye işyeri hesabına geçer,
 * işletme payı kuruluşta **bloke** kalır. Randevu sonuçlanınca blokeyi ya
 * serbest bırakırız (hak ediş) ya da tümünü iade ederiz.
 *
 * Bu ayrım tesadüfi değil: müşteri parasını toplayıp sonra dağıtmak 6493
 * sayılı Kanun kapsamında ödeme hizmetidir ve lisans gerektirir. Parayı
 * lisanslı kuruluşta tutarak bu yükümlülüğe girmiyoruz. İyzico "alt üye
 * işyeri", PayTR ve Param "pazaryeri" ürünleri bu arayüzün arkasına
 * doğrudan oturur.
 */

export type ChargeInput = {
  amount: number;
  currency: string;
  reference: string;
  /** Pazaryeri bölüşümü. subMerchantKey yoksa tahsilat tek parça alınır. */
  split?: {
    commission: number;
    subMerchantKey: string | null;
  };
};

export type ChargeResult =
  | { status: 'PAID'; providerRef: string }
  | { status: 'FAILED'; reason: string };

export type SettlementResult = { ok: boolean; reason?: string };

export interface PaymentProvider {
  readonly name: string;
  /** Tahsilat. İşletme payı bloke olarak başlar. */
  charge(input: ChargeInput): Promise<ChargeResult>;
  /** Blokeyi çözer: işletme payı hak ediş olarak yazılır. */
  release(providerRef: string): Promise<SettlementResult>;
  /** Tam iade. Komisyon da geri alınır; platform kazanmaz. */
  refund(providerRef: string): Promise<SettlementResult>;
}

/**
 * Sahte sağlayıcı. Kart verisi almaz, gerçek para hareketi yoktur; yalnızca
 * durum geçişlerini taklit eder ki akış uçtan uca denenebilsin.
 */
const mockPayments: PaymentProvider = {
  name: 'mock',
  async charge(input) {
    if (input.amount <= 0) return { status: 'FAILED', reason: 'Tutar geçersiz.' };
    if (input.split && input.split.commission > input.amount) {
      return { status: 'FAILED', reason: 'Komisyon tahsilattan büyük olamaz.' };
    }
    return { status: 'PAID', providerRef: `mock_${input.reference}_${Date.now()}` };
  },
  async release(providerRef) {
    if (!providerRef) return { ok: false, reason: 'Ödeme referansı yok.' };
    return { ok: true };
  },
  async refund(providerRef) {
    if (!providerRef) return { ok: false, reason: 'Ödeme referansı yok.' };
    return { ok: true };
  },
};

export function paymentProvider(): PaymentProvider {
  // PAYMENT_PROVIDER=iyzico olduğunda burada gerçek sağlayıcı döndürülür.
  return mockPayments;
}
