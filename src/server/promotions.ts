import 'server-only';
import { prisma } from '@/lib/db';
import { money } from '@/lib/format';

/**
 * Platform geneli (işletmeye bağlı olmayan) aktif kampanya.
 *
 * Hoş geldin bildirimi kampanya kodunu ve tutarını metnin içine gömüyordu.
 * Kod veritabanında ayrıca duruyordu ve ikisi birbirinden habersizdi: kampanya
 * kapatılsa bile bildirim tutulamayan bir söz vermeye devam ederdi. Dahası
 * sabit metin `minAmount` koşulunu hiç söylemiyordu, yani söz kısmen yanlıştı.
 *
 * Tek kaynak ilkesi: söz de koşul da kampanyanın kendisinden okunuyor.
 */
export type PlatformPromotion = {
  code: string;
  kind: string;
  value: number;
  minAmount: number;
};

export async function activePlatformPromotion(
  now: Date = new Date(),
): Promise<PlatformPromotion | null> {
  const rows = await prisma.promotion.findMany({
    where: {
      businessId: null, // yalnızca platform geneli
      active: true,
      startsAt: { lte: now },
      endsAt: { gte: now },
    },
    orderBy: { startsAt: 'desc' },
    select: { code: true, kind: true, value: true, minAmount: true, maxUses: true, usedCount: true },
  });

  // "Sınırsız VEYA limit dolmamış" koşulu sütun karşılaştırması gerektiriyor;
  // Prisma'nın where'i bunu ifade edemiyor. Platform geneli kampanya sayısı
  // tek haneli olduğu için burada süzmek ucuz ve okunur.
  const usable = rows.find((p) => p.maxUses === 0 || p.usedCount < p.maxUses);
  if (!usable) return null;

  return {
    code: usable.code,
    kind: usable.kind,
    value: usable.value,
    minAmount: usable.minAmount,
  };
}

/**
 * Yeni kullanıcıya gösterilecek karşılama metni.
 * Kampanya yoksa kampanyadan hiç bahsetmez — tutulamayacak söz verilmez.
 */
export function welcomeBody(promo: PlatformPromotion | null): string {
  if (!promo) {
    return 'Ankara’daki işletmelerin gerçek boş saatlerini görün, seçtiğiniz an size ayrılsın.';
  }
  const discount = promo.kind === 'PERCENT' ? `%${promo.value}` : money(promo.value);
  const condition = promo.minAmount > 0 ? ` ${money(promo.minAmount)} ve üzeri randevularda geçerli.` : '';
  return `İlk randevunuzda ${promo.code} kodu ile ${discount} indirim kazanın.${condition}`;
}
