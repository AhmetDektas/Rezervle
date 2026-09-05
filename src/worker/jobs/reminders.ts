import 'server-only';
import { prisma } from '@/lib/db';
import { defineJob } from '../define-job';
import { notifyUser } from '@/server/notifications';
import { longDate } from '@/lib/format';
import { hhmm } from '@/lib/time';

/**
 * 24 saat önce randevu hatırlatması (T10).
 *
 * İşletmeye anlatılacak en somut fayda bu: gelmeme oranı hatırlatmayla
 * düşüyor. Boş kalan saat işletme için doğrudan kayıp gelir.
 *
 * İdempotens `reminderSentAt` ile: BullMQ başarısız işi yeniden deniyor ve
 * ikinci deneme aynı randevuya ikinci SMS gönderirse müşteri rahatsız olur,
 * işletme para öder. Damga gönderimden ÖNCE atılıyor — iki kez göndermektense
 * arıza hâlinde hiç göndermemeyi tercih ediyoruz; hatırlatma yardımcı bir
 * özellik, randevunun kendisi değil.
 */

const PENCERE_SAAT = 24;
/** Tarama aralığı kadar tolerans: dakikada bir koşan iş hiçbir randevuyu atlamamalı. */
const TOLERANS_DK = 10;

export type ReminderPayload = { now?: string };

export const reminderJob = defineJob<ReminderPayload>({
  name: 'randevu-hatirlatma',
  async handler(payload, ctx) {
    const now = payload.now ? new Date(payload.now) : new Date();
    const hedefBaslangic = new Date(now.getTime() + PENCERE_SAAT * 60 * 60_000);
    const hedefBitis = new Date(hedefBaslangic.getTime() + TOLERANS_DK * 60_000);

    const randevular = await prisma.reservation.findMany({
      where: {
        startsAt: { gte: hedefBaslangic, lt: hedefBitis },
        reminderSentAt: null,
        status: { in: ['PENDING', 'CONFIRMED'] },
        // Ödemesi tamamlanmamış kayıt için hatırlatma göndermek, birazdan
        // iptal edilecek bir randevuyu duyurmak olurdu.
        depositStatus: { not: 'PENDING' },
      },
      select: {
        id: true,
        customerId: true,
        date: true,
        startMin: true,
        business: { select: { name: true } },
        service: { select: { name: true } },
      },
      take: 200,
    });

    let gonderilen = 0;
    for (const r of randevular) {
      // Koşullu damga: iki worker aynı anda çalışsa bile yalnızca biri
      // 1 satır günceller ve yalnızca o gönderir.
      const damga = await prisma.reservation.updateMany({
        where: { id: r.id, reminderSentAt: null },
        data: { reminderSentAt: now },
      });
      if (damga.count === 0) continue;

      gonderilen += 1;
      await notifyUser({
        userId: r.customerId,
        kind: 'RESERVATION',
        title: 'Yarınki randevunuz',
        body: `${r.business.name} · ${r.service.name} · ${longDate(r.date)} ${hhmm(r.startMin)}`,
        href: `/randevularim/${r.id}`,
        alsoSend: true,
      });
    }

    ctx.meta = { ...(ctx.meta ?? {}), bulunan: randevular.length, gonderilen };
  },
});
