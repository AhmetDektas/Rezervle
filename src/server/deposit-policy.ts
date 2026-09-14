import 'server-only';
import type { DepositPolicy } from '@/lib/deposit';
import { kaporaHakki } from './entitlements';

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
  /** Paket anahtarı: kapora hakkının bir yarısı buradan geliyor. */
  planKey: string;
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
    // Etkin hak = pakete dahil olan + ayrıca satın alınmış eklenti.
    // Önceden yalnızca `depositAddon` okunuyordu ve o alan paket seçiminde
    // açılıp hiç kapatılmıyordu; alt pakete geçen işletmede hak kalıcı
    // oluyordu (bkz. server/entitlements.ts).
    addon: kaporaHakki(business),
    enabled: business.depositEnabled,
    kind: business.depositKind,
    value: business.depositValue,
    minPrice: business.depositMinPrice,
    refundHours: business.depositRefundHours,
  };
}
