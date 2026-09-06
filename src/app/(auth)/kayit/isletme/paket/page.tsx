import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireRole } from '@/server/auth';
import { PlanPicker } from '@/components/auth/plan-picker';
import type { PlanKey } from '@/lib/plans';

export const metadata: Metadata = { title: 'Paket seçimi' };
export const dynamic = 'force-dynamic';

/**
 * Kaydın ikinci adımı: paket seçimi.
 *
 * Ayrı sayfa olması bilinçli — başvuru formuna fiyat kararı eklemek, formu
 * iki katına çıkarır ve henüz ürünü görmemiş işletmeyi ödeme düşüncesiyle
 * karşılardı. Kayıt tamamlanmış, deneme başlamış durumda; burada yalnızca
 * hangi pakette olacağı belirleniyor.
 */
export default async function PlanPage() {
  const user = await requireRole(['OWNER', 'ADMIN'], '/kayit/isletme/paket');

  const business = await prisma.business.findFirst({
    where: { ownerId: user.id },
    orderBy: { createdAt: 'desc' },
    select: { planKey: true, planPrice: true },
  });
  // İşletmesi olmayan biri buraya düşerse panele: orada "işletmeniz yok"
  // ekranı zaten doğru yönlendirmeyi yapıyor.
  if (!business) redirect('/panel');

  // planPrice 0 ise paket henüz SEÇİLMEDİ: planKey varsayılan değerinde
  // duruyor ve onu "seçili" göstermek yanlış olurdu.
  const current = business.planPrice > 0 ? (business.planKey as PlanKey) : null;

  return <PlanPicker current={current} />;
}
