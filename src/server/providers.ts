import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

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
  /** 3DS bitince müşterinin geri döneceği adres. */
  returnUrl: string;
  /** Pazaryeri bölüşümü. subMerchantKey yoksa tahsilat tek parça alınır. */
  split?: {
    commission: number;
    subMerchantKey: string | null;
  };
};

/**
 * Tahsilat sonucu.
 *
 * `PENDING` gerçek dünyanın varsayılanı: Türkiye'de kart ödemesi 3D Secure'dan
 * geçiyor, müşteri bankanın sayfasına gidiyor ve sonuç bize **webhook ile**
 * dönüyor. Eskiden `charge()` senkron `PAID` döndürüyordu; bu, ödemenin
 * sonucunu bilmeden bildiğimizi varsaymak demekti.
 *
 * `PAID` yine mümkün (3DS'siz kart, sıfır tutar) ama artık istisna.
 */
export type ChargeResult =
  | { status: 'PAID'; providerRef: string }
  | { status: 'PENDING'; providerRef: string; redirectUrl: string }
  | { status: 'FAILED'; reason: string };

export type SettlementResult = { ok: boolean; reason?: string };

/**
 * Sağlayıcıdan gelen olay.
 *
 * `id` idempotens anahtarı: teslimat garantisi "en az bir kez" olduğu için
 * aynı olay iki kez gelebilir ve ikinci teslimat kaporayı iki kez işlememeli.
 */
export type WebhookEvent = {
  id: string;
  type: 'payment.paid' | 'payment.failed';
  providerRef: string;
  /** Bizim tarafımızdaki referans: rezervasyon kodu. */
  reference: string;
  reason?: string;
};

export interface PaymentProvider {
  readonly name: string;
  /** Tahsilat başlatır. Genellikle 3DS'e yönlendirir; sonuç webhook'la gelir. */
  charge(input: ChargeInput): Promise<ChargeResult>;
  /** Blokeyi çözer: işletme payı hak ediş olarak yazılır. */
  release(providerRef: string): Promise<SettlementResult>;
  /** Tam iade. Komisyon da geri alınır; platform kazanmaz. */
  refund(providerRef: string): Promise<SettlementResult>;
  /**
   * Webhook gövdesini doğrular ve olaya çevirir. İmza geçersizse `null`.
   *
   * Ham gövde üzerinden çalışıyor: JSON'a çevirip yeniden dizmek anahtar
   * sırasını ve boşlukları değiştirir, imza tutmaz.
   */
  verifyWebhook(rawBody: string, signature: string | null): WebhookEvent | null;
}

/**
 * Sahte sağlayıcı (T17).
 *
 * Kart verisi almaz, gerçek para hareketi yoktur. Amacı akışın **şeklini**
 * taklit etmek: 3DS yönlendirmesi, webhook'la gelen sonuç, imza doğrulaması
 * ve terk senaryosu. Senkron `PAID` döndüren eski sahte sağlayıcı, üretimde
 * asla yaşanmayacak bir akışı test ediyordu.
 */
const MOCK_SECRET = 'mock-webhook-secret';

export function mockSignature(rawBody: string): string {
  return createHmac('sha256', MOCK_SECRET).update(rawBody).digest('hex');
}

const mockPayments: PaymentProvider = {
  name: 'mock',
  async charge(input) {
    if (input.amount <= 0) return { status: 'FAILED', reason: 'Tutar geçersiz.' };
    if (input.split && input.split.commission > input.amount) {
      return { status: 'FAILED', reason: 'Komisyon tahsilattan büyük olamaz.' };
    }
    const providerRef = `mock_${input.reference}_${Date.now()}`;
    // Gerçek sağlayıcı bankanın 3DS sayfasına yönlendirir; burada kendi
    // taklit sayfamıza gidiyoruz ki akış uçtan uca denenebilsin.
    const url = new URL('/odeme/3ds', input.returnUrl);
    url.searchParams.set('ref', providerRef);
    url.searchParams.set('kod', input.reference);
    return { status: 'PENDING', providerRef, redirectUrl: url.toString() };
  },
  async release(providerRef) {
    if (!providerRef) return { ok: false, reason: 'Ödeme referansı yok.' };
    return { ok: true };
  },
  async refund(providerRef) {
    if (!providerRef) return { ok: false, reason: 'Ödeme referansı yok.' };
    return { ok: true };
  },
  verifyWebhook(rawBody, signature) {
    if (!signature) return null;
    const beklenen = mockSignature(rawBody);
    // timingSafeEqual eşit uzunluk istiyor; farklı uzunluk zaten geçersiz.
    if (signature.length !== beklenen.length) return null;
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(beklenen))) return null;

    const veri = JSON.parse(rawBody) as Partial<WebhookEvent>;
    if (!veri.id || !veri.type || !veri.providerRef || !veri.reference) return null;
    if (veri.type !== 'payment.paid' && veri.type !== 'payment.failed') return null;
    return {
      id: veri.id,
      type: veri.type,
      providerRef: veri.providerRef,
      reference: veri.reference,
      ...(veri.reason ? { reason: veri.reason } : {}),
    };
  },
};

/**
 * Yürürlükteki ödeme sağlayıcısı.
 *
 * Değişken okunmadan koşulsuz sahte sağlayıcı döndürmek, canlıya çıkarken
 * yapılabilecek en pahalı sessiz hataydı: `PAYMENT_PROVIDER=iyzico` yazıp
 * dağıtan biri hiçbir uyarı almadan sahte sağlayıcıyla çalışır, uygulama
 * "ödeme alındı" der ve hiçbir para hareket etmezdi.
 *
 * Bu yüzden tanınmayan değer sessizce sahteye düşmüyor, hata fırlatıyor.
 */
export function paymentProvider(): PaymentProvider {
  const secilen = process.env['PAYMENT_PROVIDER'] ?? 'mock';
  if (secilen !== 'mock') {
    throw new Error(
      `PAYMENT_PROVIDER="${secilen}" için adaptör yazılmadı. Gerçek sağlayıcı bağlanana kadar ` +
        'yalnızca "mock" desteklenir; kapora tahsilatı için DEPOSITS_ENABLED=false kullanın.',
    );
  }
  return mockPayments;
}

/** Sahte sağlayıcıyla mı çalışıyoruz? Üretim kontrolleri ve 3DS taklit ekranı bunu sorar. */
export function usingMockPayments(): boolean {
  return (process.env['PAYMENT_PROVIDER'] ?? 'mock') === 'mock';
}
