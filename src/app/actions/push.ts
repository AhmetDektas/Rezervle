'use server';

import { z } from 'zod';
import { run, DomainError, type ActionResult } from '@/server/errors';
import { requireUserAction } from '@/server/auth';
import { pushAbone, pushAbonelikBitir, pushYapilandirildi } from '@/server/push';

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
