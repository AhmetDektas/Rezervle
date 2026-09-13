import 'server-only';
import { prisma } from '@/lib/db';
import { DomainError } from './errors';

/**
 * İşletme sınırına bağlı yazma işlemleri.
 *
 * NEDEN AYRI BİR MODÜL: panel eylemleri `assertBusinessAccess(user, businessId)`
 * ile yetkiyi doğruluyor, ardından kaydı YALNIZCA `id` ile güncelliyordu:
 *
 *     await assertBusinessAccess(user, businessId);        // A işletmesi — geçer
 *     await prisma.service.update({ where: { id }, data }); // id = B'nin hizmeti
 *
 * Yetki A için verilmiş, yazma B'ye gidiyor. A işletmesinin sahibi kendi
 * işletme kimliğini ve başka bir işletmenin hizmet/personel/şube/kampanya
 * kimliğini göndererek o kaydı değiştirebiliyordu. Kimlikler cuid; tahmin
 * edilmesi zor ama bu bir yetkilendirme kontrolü değil, yalnızca belirsizlik.
 *
 * Güvence artık BURADA, eylemde değil: her yazma hem `id` hem yetkilendirilmiş
 * `businessId` ile sınırlandırılıyor. Eylem katmanı ince kalıyor ve aynı hata
 * yeni bir eylemde tekrarlanamıyor — çağıran, businessId vermeden yazamaz.
 *
 * Eşleşen satır yoksa NOT_FOUND dönüyor: "bu kayıt sizin değil" demek, saldırgana
 * kaydın var olduğunu doğrulardı.
 */

function bulunamadi(ne: string): never {
  throw new DomainError(`${ne} bulunamadı.`, 'NOT_FOUND');
}

/** Şube gerçekten bu işletmenin mi? Personelin şubesi buradan doğrulanır. */
export async function assertBranchBelongs(businessId: string, branchId: string): Promise<void> {
  const branch = await prisma.branch.findFirst({
    where: { id: branchId, businessId },
    select: { id: true },
  });
  if (!branch) throw new DomainError('Şube bu işletmeye ait değil.', 'FORBIDDEN');
}

export async function updateServiceScoped(
  businessId: string,
  id: string,
  data: Record<string, unknown>,
): Promise<void> {
  const sonuc = await prisma.service.updateMany({ where: { id, businessId }, data });
  if (sonuc.count === 0) bulunamadi('Hizmet');
}

export async function updateStaffScoped(
  businessId: string,
  id: string,
  data: Record<string, unknown>,
): Promise<void> {
  const sonuc = await prisma.staffMember.updateMany({ where: { id, businessId }, data });
  if (sonuc.count === 0) bulunamadi('Personel');
}

export async function updateBranchScoped(
  businessId: string,
  id: string,
  data: Record<string, unknown>,
): Promise<void> {
  const sonuc = await prisma.branch.updateMany({ where: { id, businessId }, data });
  if (sonuc.count === 0) bulunamadi('Şube');
}

export async function updatePromotionScoped(
  businessId: string,
  id: string,
  data: Record<string, unknown>,
): Promise<void> {
  const sonuc = await prisma.promotion.updateMany({ where: { id, businessId }, data });
  if (sonuc.count === 0) bulunamadi('Kampanya');
}
