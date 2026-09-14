'use server';

import { z } from 'zod';
import { run, DomainError, type ActionResult } from '@/server/errors';
import { requireUserAction } from '@/server/auth';
import { pushAbone, pushAbonelikBitir, pushYapilandirildi } from '@/server/push';
import { pushHedefiDogrula } from '@/lib/push-endpoint';

/**
 * Tarayıcı push aboneliğini kaydeder/kaldırır.
 *
 * Abonelik tarayıcıda kuruluyor (izin kutusu orada çıkıyor), ama sunucunun
 * uç noktayı ve anahtarları bilmesi gerekiyor — bildirimi gönderen sunucu.
 */

const aboneSemasi = z.object({
  endpoint: z.string().url().max(1000),
  p256dh: z.string().min(1).max(255),
  auth: z.string().min(1).max(255),
  userAgent: z.string().max(255).optional(),
});

export async function pushAboneOlAction(girdi: unknown): Promise<ActionResult<null>> {
  return run(async (ctx) => {
    const user = await requireUserAction();
    ctx.userId = user.id;

    if (!pushYapilandirildi()) {
      throw new DomainError('Bildirim altyapısı bu kurulumda tanımlı değil.', 'UNAVAILABLE');
    }

    const parsed = aboneSemasi.safeParse(girdi);
    if (!parsed.success) throw new DomainError('Abonelik bilgisi geçersiz.', 'VALIDATION');

    // URL BİÇİMİ YETMEZ. Uç noktayı tarayıcı veriyor ve sunucu o adrese kendi
    // ağından istek atacak: `https://127.0.0.1:8443/admin` de geçerli bir URL.
    // Hedefin gerçekten bir push servisi olduğu burada doğrulanıyor.
    const hedef = pushHedefiDogrula(parsed.data.endpoint);
    if (!hedef.ok) throw new DomainError(hedef.sebep, 'VALIDATION');

    await pushAbone(user.id, parsed.data);
    return null;
  }, { action: 'pushAboneOl' });
}

const bitirSemasi = z.object({ endpoint: z.string().url().max(1000) });

export async function pushAbonelikBitirAction(girdi: unknown): Promise<ActionResult<null>> {
  return run(async (ctx) => {
    const user = await requireUserAction();
    ctx.userId = user.id;

    const parsed = bitirSemasi.safeParse(girdi);
    if (!parsed.success) throw new DomainError('Abonelik bilgisi geçersiz.', 'VALIDATION');

    await pushAbonelikBitir(user.id, parsed.data.endpoint);
    return null;
  }, { action: 'pushAbonelikBitir' });
}
