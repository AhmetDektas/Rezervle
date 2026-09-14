import 'server-only';
import { defineJob } from '../define-job';
import { bekleyenMutabakatlar, mutabakatiTamamla } from '@/server/settlement';

/**
 * Takılı kalmış hak ediş / iade işlemlerini tekrar dener.
 *
 * NEDEN VAR: iade ve hak ediş kararı veritabanına yazılıyor ama parayı
 * sağlayıcı hareket ettiriyor. Sağlayıcı o an cevap vermezse — ağ hatası,
 * bakım penceresi, dağıtım sırasında kesilen süreç — karar bekleyen durumda
 * kalıyor. Bu iş olmasaydı o kayıtlar sonsuza kadar öyle kalırdı: müşteri
 * iadesini beklerken sistemde "bekliyor" yazan ama kimsenin bakmadığı satır.
 *
 * Eski davranışta daha kötüsü oluyordu: durum doğrudan REFUNDED yazılıyor,
 * sağlayıcı hatası yalnızca nota düşüyordu. Yani para hareket etmeden kayıt
 * sonuçlanmış görünüyor ve tekrar denenecek bir iz bırakmıyordu.
 *
 * GECİKME PENCERESİ önemli: az önce bekleyen duruma geçmiş ve ilk denemesi
 * hâlâ süren kayıtlara dokunulmuyor. Aksi hâlde aynı tahsilat için iki
 * eşzamanlı iade çağrısı gidebilirdi.
 */

/** İlk denemenin bitmesi için tanınan süre. */
const BEKLEME_PENCERESI_MS = 2 * 60_000;

export type SettlementRetryPayload = { now?: string };

export const settlementRetryJob = defineJob<SettlementRetryPayload>({
  name: 'mutabakat-tekrar',
  async handler(payload, ctx) {
    const simdi = payload.now ? new Date(payload.now) : new Date();
    const once = new Date(simdi.getTime() - BEKLEME_PENCERESI_MS);

    const bekleyenler = await bekleyenMutabakatlar(once);
    let tamamlanan = 0;
    for (const reservationId of bekleyenler) {
      // Sırayla: sağlayıcıya aynı anda onlarca istek atmak, zaten sorun
      // yaşadığımız bir servisi daha da zorlamak olurdu.
      if (await mutabakatiTamamla(reservationId)) tamamlanan += 1;
    }

    ctx.meta = { ...(ctx.meta ?? {}), bekleyen: bekleyenler.length, tamamlanan };
  },
});
