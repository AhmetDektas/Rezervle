import 'server-only';
import { defineJob } from '../define-job';
import { runSubscriptionCycle } from '@/server/subscription';

/**
 * Abonelik döngüsü.
 *
 * Abonelik önce yalnızca bir DURUM alanıydı: kayıtta `TRIAL` yazılıyor ve
 * ondan sonra hiçbir şey olmuyordu. Deneme bitmiyor, dönem ilerlemiyor, borç
 * oluşmuyordu — platformun ana geliri bir veri alanı olarak duruyordu. Bu iş
 * döngüyü yürüten yer.
 *
 *   deneme (trialEndsAt)
 *        │
 *        ├── bitmesine 7 gün ──▶ uyarı (trialWarnedAt damgalanır, bir kez)
 *        │
 *        └── bitti ──▶ ilk dönemin faturası ──▶ planStatus = PAST_DUE
 *                            │
 *                     yönetici "ödendi" ──▶ ACTIVE, currentPeriodEnd ilerler
 *                            │
 *                     dönem bitti ──▶ sonraki dönemin faturası ──▶ PAST_DUE
 *
 * PAST_DUE hizmeti KAPATMIYOR: işletmeyi kilitlemek, onun müşterisini
 * cezalandırmak olurdu ve müşteri gecikmiş faturadan haberdar bile değil
 * (bkz. plans.ts `planActive`). Gecikme panelde uyarı, yönetimde liste.
 *
 * Günde bir koşuyor. Daha sık koşması zararsız — fatura üretimi dönem
 * anahtarıyla idempotent, uyarı damgayla tek sefer — ama gereksiz: dönem
 * sınırı gün hassasiyetinde.
 */

export type SubscriptionCyclePayload = { now?: string };

export const subscriptionCycleJob = defineJob<SubscriptionCyclePayload>({
  name: 'abonelik-dongusu',
  async handler(payload, ctx) {
    const simdi = payload.now ? new Date(payload.now) : new Date();
    const sonuc = await runSubscriptionCycle(simdi);
    ctx.meta = { ...(ctx.meta ?? {}), ...sonuc };
  },
});
