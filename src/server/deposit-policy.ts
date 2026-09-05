import 'server-only';
import type { DepositPolicy } from '@/lib/deposit';

/**
 * Kapora politikasının tek kurulum yeri.
 *
 * Politika nesnesi daha önce beş ayrı yerde elle kuruluyordu (rezervasyon
 * kotasyonu, rezervasyon oluşturma, müşteri randevu sayfası, panel ayarları,
 * panel önizlemesi). Ana şalter eklenirken beşine de aynı alanı eklemek
 * gerekiyordu ve biri unutulsa şalter o yolda çalışmazdı — yani tam olarak
 * şalterin var olma sebebini deler.
 */

/** İşletme satırından okunan kapora sütunları. */
export type DepositColumns = {
  depositAddon: boolean;
  depositEnabled: boolean;
  depositKind: string;
  depositValue: number;
  depositMinPrice: number;
  depositRefundHours: number;
};

/**
 * Platform çapında kapora tahsilatı açık mı?
 *
 * Varsayılan AÇIK: değişken tanımsızsa kapora çalışır. Ters kurgu (varsayılan
 * kapalı) bir dağıtımda değişken unutulduğunda geliri sessizce durdururdu.
 * Kapatmak açık bir eylem olmalı: `DEPOSITS_ENABLED=false`.
 */
export function depositsEnabledPlatformWide(): boolean {
  return process.env['DEPOSITS_ENABLED'] !== 'false';
}

export function depositPolicyFor(business: DepositColumns): DepositPolicy {
  return {
    platformEnabled: depositsEnabledPlatformWide(),
    addon: business.depositAddon,
    enabled: business.depositEnabled,
    kind: business.depositKind,
    value: business.depositValue,
    minPrice: business.depositMinPrice,
    refundHours: business.depositRefundHours,
  };
}
