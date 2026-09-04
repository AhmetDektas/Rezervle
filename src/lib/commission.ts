/**
 * Komisyon ve hak ediş hesabı.
 *
 * Model: **pazaryeri (alt üye işyeri) tahsilatı.** Müşteri kaporayı tek
 * seferde öder; lisanslı ödeme kuruluşu tutarı ödeme anında ikiye böler.
 * Platform payı platformun üye işyeri hesabına geçer, işletme payı ödeme
 * kuruluşunda **bloke** kalır ve randevu sonuçlanınca serbest bırakılır.
 *
 * Platform müşteri parasını hiçbir zaman kendi banka hesabında tutmaz; bu
 * kasıtlı bir tercihtir (bkz. README — "Kapora tahsilatı ve komisyon").
 *
 * Saf fonksiyonlar: veritabanı ve sağlayıcı bilmezler.
 */

export const SETTLEMENT_STATUSES = ['NONE', 'HELD', 'RELEASED', 'REFUNDED'] as const;
export type SettlementStatus = (typeof SETTLEMENT_STATUSES)[number];

export const SETTLEMENT_LABEL: Record<SettlementStatus, string> = {
  NONE: 'Tahsilat yok',
  HELD: 'Bloke (randevu bekleniyor)',
  RELEASED: 'Hak ediş yazıldı',
  REFUNDED: 'Müşteriye iade edildi',
};

export type Split = {
  /** Müşteriden tahsil edilen toplam. */
  total: number;
  /** Platform payı. */
  commission: number;
  /** İşletmeye kalan. */
  net: number;
  /** Ödeme anında dondurulan oran. */
  rate: number;
};

/**
 * Tahsilatı platform ve işletme payına böler.
 *
 * Yuvarlama işletme lehinedir: komisyon aşağı yuvarlanır, kuruş farkı
 * işletmede kalır. Böylece net + komisyon her zaman toplamı verir ve
 * platform hiçbir zaman hak ettiğinden fazlasını almaz.
 */
export function splitPayment(total: number, ratePercent: number): Split {
  const rate = Math.max(0, Math.min(100, Math.round(ratePercent)));
  if (total <= 0) return { total: 0, commission: 0, net: 0, rate };
  const commission = Math.floor((total * rate) / 100);
  return { total, commission, net: total - commission, rate };
}

/**
 * Randevunun sonucuna göre kaporanın akıbeti.
 *
 * - Zamanında iptal → müşteriye tam iade; komisyon da geri alınır, platform
 *   kazanmaz. Tahsil edilmemiş bir hizmetten pay almak savunulamaz.
 * - Gelmedi / geç iptal → kapora işletmeye kalır, platform komisyonunu alır.
 * - Tamamlandı → kapora hizmet bedelinden düşülür, işletmeye hak ediş yazılır.
 */
export type Outcome = 'COMPLETED' | 'NO_SHOW' | 'CANCELLED_IN_WINDOW' | 'CANCELLED_LATE';

export function settlementFor(outcome: Outcome): SettlementStatus {
  return outcome === 'CANCELLED_IN_WINDOW' ? 'REFUNDED' : 'RELEASED';
}

/** İşletmenin bu tahsilattan eline geçecek tutar. */
export function payoutFor(split: Split, status: SettlementStatus): number {
  return status === 'RELEASED' ? split.net : 0;
}

/** Platformun bu tahsilattan kazandığı tutar. */
export function platformEarnsFor(split: Split, status: SettlementStatus): number {
  return status === 'RELEASED' ? split.commission : 0;
}
