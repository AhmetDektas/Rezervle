import 'server-only';
import { prisma } from '@/lib/db';
import { planByKey } from '@/lib/plans';
import { DomainError } from './errors';

/**
 * Paket hakları — tek kontrol noktası.
 *
 * SORUN 1 — HAKLAR HİÇ UYGULANMIYORDU. `plans.ts` içindeki `branchLimit`
 * yalnızca pazarlama sayfasında görünen bir sayıydı; şube oluşturma onu hiç
 * okumuyordu. Başlangıç paketindeki işletme istediği kadar şube açabiliyordu,
 * yani üst paketin satış gerekçesi kodda karşılıksızdı.
 *
 * SORUN 2 — EKLENTİ GERİ ALINMIYORDU. Paket seçimi `depositAddon`ı yalnızca
 * AÇIYOR, alt pakete geçişte kapatmıyordu. Üst paketi bir ay alıp alta dönen
 * işletmede kapora eklentisi kalıcı olarak açık kalıyordu.
 *
 * Çözüm ikisini AYIRMAK: `depositAddon` artık "ayrıca satın alınmış eklenti"
 * demek ve yalnızca yönetici tarafından veriliyor. Pakete dahil olma hâli
 * paketin kendisinden okunuyor. Etkin hak ikisinin birleşimi — böylece paket
 * değişimi satın alınmış bir eklentiyi silmiyor, alt pakete düşen işletme de
 * pakete dahil hakkı kendiliğinden kaybediyor.
 */

export type PaketSatiri = { planKey: string; depositAddon: boolean };

/** Kapora tahsilatı bu işletmeye açık mı? (paket + satın alınmış eklenti) */
export function kaporaHakki(business: PaketSatiri): boolean {
  return planByKey(business.planKey).deposit || business.depositAddon;
}

/**
 * Şube kotası — eşzamanlı yazmaya dayanıklı.
 *
 * Sayıp sonra yazmak yarışa açık: iki istek aynı anda "2 şube var, sınır 3"
 * deyip ikisi de yazabilir ve sınır 4'e çıkar. İşletme satırı işlem boyunca
 * kilitleniyor; aynı işletme için ikinci istek kilidi bekliyor ve sayımı
 * güncel görüyor. Farklı işletmeler birbirini beklemiyor.
 *
 * Çağıran BİR TRANSACTION içinde olmalı ve şubeyi aynı transaction'da
 * yazmalı; aksi hâlde kilit erken bırakılır ve koruma anlamını yitirir.
 */
export async function subeKotasiniAyir(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  businessId: string,
): Promise<void> {
  const satirlar = await tx.$queryRaw<{ planKey: string }[]>`
    SELECT "planKey" FROM "Business" WHERE id = ${businessId} FOR UPDATE
  `;
  const satir = satirlar[0];
  if (!satir) throw new DomainError('İşletme bulunamadı.', 'NOT_FOUND');

  const limit = planByKey(satir.planKey).branchLimit;
  if (limit === null) return; // sınırsız paket

  const mevcut = await tx.branch.count({ where: { businessId } });
  if (mevcut >= limit) {
    throw new DomainError(
      `${planByKey(satir.planKey).name} paketi ${limit} şubeye kadar. Daha fazlası için paketi yükseltin.`,
      'PLAN_LIMIT',
    );
  }
}
