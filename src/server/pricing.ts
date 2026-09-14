import 'server-only';
import { prisma } from '@/lib/db';

/**
 * İşletmenin en düşük aktif hizmet fiyatını tazeler.
 *
 * NEDEN DENORMALİZE: Keşfet'te "en uygun fiyat" sıralaması sayfa çekildikten
 * SONRA bellekte yapılıyordu — önce "önerilen" sırasıyla 20 kayıt alınıyor,
 * sonra o 20'si fiyata göre diziliyordu. En ucuz işletme ikinci sayfadaysa
 * listenin başında hiç görünmüyordu; sıralama adı dışında bir şey yapmıyordu.
 *
 * Doğru sıralama için değerin SORGUDA olması gerekiyor. İlişkili tablodaki
 * MIN(price) üzerinden sıralamak Prisma ile mümkün değil, bu yüzden değer
 * işletme satırında tutuluyor ve hizmet yazmalarında burada tazeleniyor.
 *
 * Tek yazma noktası olması önemli: ikinci bir yerde elle güncellenirse
 * sessizce eskir ve sıralama yine yanlışa döner.
 */
export async function minFiyatiTazele(businessId: string): Promise<void> {
  const enDusuk = await prisma.service.aggregate({
    where: { businessId, active: true },
    _min: { price: true },
  });
  await prisma.business.update({
    where: { id: businessId },
    data: { minPrice: enDusuk._min.price ?? 0 },
  });
}
