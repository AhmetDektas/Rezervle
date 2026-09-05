import 'server-only';
import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';
import { notify as notifyChannels } from './providers';
import { logSideEffectFailure } from './log';

type NotifyInput = {
  userId: string;
  kind?: 'INFO' | 'RESERVATION' | 'REVIEW' | 'SYSTEM' | 'PROMO';
  title: string;
  body?: string;
  href?: string;
  /** E-posta/SMS adaptörlerine de gönderilsin mi? */
  alsoSend?: boolean;
};

/** Uygulama içi bildirim yazar; istenirse e-posta/SMS adaptörünü de tetikler. */
export async function notifyUser(
  input: NotifyInput,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<void> {
  await tx.notification.create({
    data: {
      userId: input.userId,
      kind: input.kind ?? 'INFO',
      title: input.title,
      body: input.body ?? '',
      href: input.href ?? null,
    },
  });
  if (input.alsoSend) {
    const user = await tx.user.findUnique({
      where: { id: input.userId },
      select: { email: true, phone: true, name: true },
    });
    if (user) {
      // E-posta/SMS gönderimi asıl işlemin başarı şartı DEĞİLDİR.
      //
      // Konsol adaptörleri hiç patlamadığı için bu bugüne kadar görünmedi;
      // gerçek SMTP/Netgsm bağlandığı an sağlayıcı arızası buradan yukarı
      // fırlar ve `run()` onu genel hataya çevirir. Sonuç: randevusu oluşmuş
      // ve kaporası çekilmiş kullanıcı "Beklenmeyen bir hata oluştu" görür,
      // muhtemelen tekrar dener ve ikinci deneme çakışmaya çarpar.
      //
      // Uygulama içi bildirim yukarıda zaten yazıldı; kullanıcı randevusunu
      // /bildirimler ve /randevularim üzerinden görmeye devam eder. Kanal
      // gönderimi başarısızsa uyarı olarak loglanır ve akış kesilmez.
      try {
        await notifyChannels({
          email: user.email,
          phone: user.phone,
          name: user.name,
          subject: input.title,
          body: input.body ?? input.title,
        });
      } catch (err) {
        logSideEffectFailure(
          { action: 'notifyChannels', userId: input.userId, meta: { kind: input.kind ?? 'INFO' } },
          err,
        );
      }
    }
  }
}

/** İşletmenin sahibine + (varsa) ilgili personelin hesabına bildirim. */
export async function notifyBusiness(
  businessId: string,
  staffId: string | null,
  payload: Omit<NotifyInput, 'userId'>,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<void> {
  const targets = new Set<string>();
  const business = await tx.business.findUnique({
    where: { id: businessId },
    select: { ownerId: true },
  });
  if (business) targets.add(business.ownerId);
  if (staffId) {
    const staff = await tx.staffMember.findUnique({
      where: { id: staffId },
      select: { userId: true },
    });
    if (staff?.userId) targets.add(staff.userId);
  }
  for (const userId of targets) {
    await notifyUser({ ...payload, userId }, tx);
  }
}
