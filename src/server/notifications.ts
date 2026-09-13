import 'server-only';
import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';
import { notify as notifyChannels } from './providers';
import { pushGonder } from './push';
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

  // PUSH `alsoSend`E BAĞLI DEĞİL, uygulama içi kayda bağlı.
  //
  // `alsoSend` "e-posta/SMS de gitsin" demek ve işletme bildirimlerinde hiç
  // kullanılmıyor: işletme sahibi bugün yeni randevudan ancak paneli açınca
  // haberdar oluyor. Push'u o bloğun içine koysaydık tam olarak ihtiyaç
  // duyulan yerde çalışmazdı.
  //
  // Doğru okuma şu: uygulama içi bildirim SAKLANAN kayıt, push aynı kaydın
  // CİHAZA ULAŞTIRILMASI. İkisi aynı olayın iki yüzü, ayrı kanallar değil.
  // Kullanıcı zaten cihaz cihaz izin verdiği için gürültü riski yok.
  //
  // Bildirimlerin işlem DIŞINDA çağrıldığına güveniyoruz (bkz.
  // payment-events.ts): geri alınabilecek bir kayıt için push göndermek,
  // geri alınamayan bir bildirim olurdu.
  await pushGonder(input.userId, {
    title: input.title,
    body: input.body ?? input.title,
    ...(input.href ? { url: input.href } : {}),
    ...(input.kind ? { tag: input.kind } : {}),
  });

  if (input.alsoSend) {
    const user = await tx.user.findUnique({
      where: { id: input.userId },
      select: {
        email: true,
        phone: true,
        name: true,
        customerProfile: { select: { smsOptIn: true, emailOptIn: true } },
      },
    });
    if (user) {
      // İletişim tercihleri profilde kaydediliyordu ama burada hiç okunmuyordu:
      // "SMS ile randevu hatırlatması al" kutusunu kapatan kullanıcıya SMS
      // gitmeye devam ediyordu. Kutunun kendisi vaat, gönderim ise vaadin
      // tutulduğu tek yer.
      //
      // Profili olmayan hesaplar (işletme sahibi, personel, yönetici) için
      // tercih kaydı yok: e-posta onlara her zaman gider, operasyonel bildirim
      // almaları gerekiyor. SMS için durum farklı, hemen aşağıda.
      const prefs = user.customerProfile;
      const email = prefs && !prefs.emailOptIn ? null : user.email;

      // SMS YALNIZCA MÜŞTERİYE.
      //
      // İşletme sahibi ve personel için doğru kanal push: panel zaten açık,
      // giriş yapılmış, bildirim anında ve bedava düşüyor. SMS onlar için
      // rezervasyon başına değişken maliyet ekleyip hiçbir şey kazandırmıyor.
      //
      // Müşteride ise push SMS'in yerini ALAMAZ: iOS'ta yalnızca uygulama ana
      // ekrana eklenmişse çalışıyor ve yılda birkaç kez randevu alan bir
      // müşteri uygulamayı kurmuyor. Hatırlatma ulaşmazsa müşteri gelmiyor;
      // bu doğrudan işletmenin zararı ve panelde "Gelmedi" olarak ölçtüğümüz
      // metriğin ta kendisi.
      const musteri = Boolean(prefs);
      const phone = musteri && prefs?.smsOptIn ? user.phone : null;

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
      // İki kanal da kapalıysa sağlayıcıya hiç gitmiyoruz: gerçek SMTP/SMS
      // bağlandığında boş bir çağrı da ağ turu ve olası hata demek.
      if (!email && !phone) return;

      try {
        await notifyChannels({
          email,
          phone,
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
