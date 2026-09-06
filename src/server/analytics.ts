import 'server-only';
import { prisma } from '@/lib/db';
import { today, addDays } from '@/lib/time';

/**
 * İki taraflı huni ölçümü (T15 / S8-2).
 *
 * Rezzerv iki taraflı bir pazaryeri ve iki taraf ayrı ayrı ölçülmezse biri
 * sessizce ölür. Klasik hata yalnızca talebi ölçmek: rezervasyon sayısı
 * artıyor görünürken arz tarafı hiç aktifleşmemiş olabilir.
 *
 *   ARZ    basvuru ──▶ onay ──▶ kurulum ──▶ ilk randevu
 *   TALEP  randevu ──▶ (odendi) ──▶ gelme / gelmeme
 *
 * **Olay tablosu YOK, sayılar mevcut veriden türetiliyor.** Ayrı bir olay
 * yazımı (E8) kuyruk üzerinden yapılacaktı; gerekmedi. Yazmadığımız veri
 * bozulamıyor, kuyruk arızasında kaybolamıyor ve geriye dönük olarak da
 * doğru — olay tablosu kurulmadan önceki dönem için kör kalmıyoruz.
 *
 * **Ölçmediğimiz şey: ziyaret.** Sayfa görüntüleme takibi çerez ve açık rıza
 * gerektiriyor; KVKK yüzeyini genişletmemek için kapsam dışı bırakıldı. Bu
 * yüzden talep hunisi "ziyaret→rezervasyon" dönüşümünü değil, rezervasyonun
 * kendisinden sonrasını ölçüyor. Eksik olduğunu bilmek, yanlış ölçmekten iyi.
 */

export type SupplyFunnel = {
  basvuru: number;
  onaylanan: number;
  /** Hizmeti VE çalışma saati tanımlanmış: rezervasyon alabilecek durumda. */
  kurulumTamam: number;
  /** En az bir randevu almış işletme. */
  ilkRandevuAlan: number;
};

export type DemandFunnel = {
  toplam: number;
  /** Kapora istenen randevularda 3DS başlatılıp tamamlananlar. */
  kaporaBaslayan: number;
  kaporaOdenen: number;
  tamamlanan: number;
  gelmeyen: number;
  iptal: number;
};

export type Funnels = {
  gunSayisi: number;
  arz: SupplyFunnel;
  talep: DemandFunnel;
};

export async function funnels(gunSayisi = 30): Promise<Funnels> {
  const bitis = today();
  const baslangic = addDays(bitis, -(gunSayisi - 1));
  const baslangicAn = new Date(`${baslangic}T00:00:00.000Z`);

  const [
    basvuru,
    onaylanan,
    kurulumAdaylari,
    randevular,
    kaporaBaslayan,
    kaporaOdenen,
  ] = await Promise.all([
    prisma.business.count({ where: { createdAt: { gte: baslangicAn } } }),
    prisma.business.count({
      where: { createdAt: { gte: baslangicAn }, status: 'APPROVED' },
    }),
    // Kurulum ve ilk randevu tek sorguda: iki ayrı sayım için işletmeleri
    // iki kez taramanın anlamı yok.
    prisma.business.findMany({
      where: { createdAt: { gte: baslangicAn }, status: 'APPROVED' },
      select: {
        _count: { select: { services: true, reservations: true } },
        branches: { select: { _count: { select: { hours: true } } } },
      },
    }),
    prisma.reservation.groupBy({
      by: ['status'],
      where: { date: { gte: baslangic, lte: bitis } },
      _count: { _all: true },
    }),
    prisma.payment.count({
      where: { createdAt: { gte: baslangicAn }, capturedAmount: { gt: 0 } },
    }),
    prisma.payment.count({
      where: { createdAt: { gte: baslangicAn }, status: 'PAID' },
    }),
  ]);

  const kurulumTamam = kurulumAdaylari.filter(
    (b) => b._count.services > 0 && b.branches.some((s) => s._count.hours > 0),
  ).length;
  const ilkRandevuAlan = kurulumAdaylari.filter((b) => b._count.reservations > 0).length;

  const say = (durum: string) =>
    randevular.find((r) => r.status === durum)?._count._all ?? 0;
  const toplam = randevular.reduce((t, r) => t + r._count._all, 0);

  return {
    gunSayisi,
    arz: { basvuru, onaylanan, kurulumTamam, ilkRandevuAlan },
    talep: {
      toplam,
      kaporaBaslayan,
      kaporaOdenen,
      tamamlanan: say('COMPLETED'),
      gelmeyen: say('NO_SHOW'),
      iptal: say('CANCELLED'),
    },
  };
}

/** Yüzde. Payda sıfırsa null: "%0" demek "veri yok" ile aynı şey değil. */
export function oran(pay: number, payda: number): number | null {
  if (payda === 0) return null;
  return Math.round((pay / payda) * 100);
}
