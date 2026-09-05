/**
 * Kapora hesabı.
 *
 * Kapora, no-show'u azaltmak için satılan bir ek pakettir. Üç anahtar vardır:
 * `platformEnabled` platform çapında ana şalter, `addon` platformun o
 * işletmeye açtığı paket, `enabled` işletmenin kendi tercihidir. Üçü birden
 * açık olmadan kapora istenmez — böylece paketi almayan bir işletmede özellik
 * hiç görünmez, alan işletme istediğinde kapatabilir ve bir arıza anında
 * platform tarafı tek ayarla tüm tahsilatı durdurabilir.
 *
 * Ana şalter neden var: gerçek para akarken bir sorun çıkarsa (sağlayıcı
 * arızası, webhook hatası) kodu geri alıp yeniden dağıtmak dakikalar sürer.
 * Şalter aynı işi saniyeler içinde yapar ve sistem `İşletmede öde` moduna
 * düşer — rezervasyon almaya devam edilir, yalnızca tahsilat durur.
 *
 * Saf fonksiyon: veritabanı bilmez, hem rezervasyon akışı hem panel aynı
 * hesabı kullanır.
 */

export type DepositPolicy = {
  /** Platform çapında ana şalter. Kapalıysa hiçbir işletmede kapora istenmez. */
  platformEnabled: boolean;
  addon: boolean;
  enabled: boolean;
  kind: string; // PERCENT | AMOUNT
  value: number;
  minPrice: number;
  refundHours: number;
};

import { money } from './format';

export const DEPOSIT_STATUSES = ['NONE', 'PAID', 'REFUNDED', 'FORFEITED'] as const;
export type DepositStatus = (typeof DEPOSIT_STATUSES)[number];

export const DEPOSIT_STATUS_LABEL: Record<DepositStatus, string> = {
  NONE: 'Kapora yok',
  PAID: 'Kapora alındı',
  REFUNDED: 'Kapora iade edildi',
  FORFEITED: 'Kapora gelir yazıldı',
};

/** İşletmede kapora özelliği fiilen açık mı? */
export function depositActive(policy: DepositPolicy): boolean {
  return policy.platformEnabled && policy.addon && policy.enabled;
}

/**
 * Bir randevu için istenecek kapora tutarı.
 * Kapora hiçbir zaman hizmet ücretini aşmaz ve ücretsiz hizmetlerde istenmez.
 */
export function depositFor(policy: DepositPolicy, price: number): number {
  if (!depositActive(policy)) return 0;
  if (price <= 0 || price < policy.minPrice) return 0;
  const raw =
    policy.kind === 'AMOUNT' ? policy.value : Math.round((price * policy.value) / 100);
  return Math.max(0, Math.min(raw, price));
}

/**
 * İptalde kapora iade edilir mi?
 * Randevuya `refundHours` saatten fazla varsa iade, kalmadıysa gelir yazılır.
 */
export function refundOnCancel(
  policy: Pick<DepositPolicy, 'refundHours'>,
  startsAt: Date,
  now: Date = new Date(),
): boolean {
  const hoursLeft = (startsAt.getTime() - now.getTime()) / 3_600_000;
  return hoursLeft >= policy.refundHours;
}

/**
 * Müşteriye gösterilen politika cümlesi.
 * Tutar, ekranın geri kalanıyla aynı para biçimini kullanır (₺1.445) —
 * ödeme metninde iki farklı biçim görmek güveni zedeler.
 */
export function depositPolicyText(policy: DepositPolicy, amount: number): string {
  if (amount <= 0) return '';
  return `${money(amount)} kapora randevu sırasında tahsil edilir ve toplam tutardan düşülür. Randevudan ${policy.refundHours} saat öncesine kadar iptal ederseniz kapora iade edilir; sonrasında veya randevuya gelinmezse iade edilmez.`;
}
