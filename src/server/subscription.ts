import 'server-only';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { DomainError } from './errors';
import { notifyBusiness } from './notifications';
import { money } from '@/lib/format';
import { planByKey } from '@/lib/plans';
import {
  kesilecekDonem,
  denemeUyarisiGerekli,
  trialUyariMetni,
  type Donem,
} from '@/lib/subscription';

/**
 * Abonelik döngüsünün veritabanı tarafı.
 *
 * Kural tek cümle: **ödenmemiş faturası olan işletme PAST_DUE'dur.**
 * `planStatus` bağımsız bir bayrak değil, faturaların TÜREVİ. İki ayrı yerde
 * elle güncellenirse er geç ayrışır ve işletme panelde "ödendi" görürken
 * yönetimde borçlu görünürdü; bu yüzden durumu yalnızca `durumuEsitle` yazar.
 *
 * Tahsilat bugün HAVALE/EFT: yönetici dekontu görüp faturayı işaretliyor.
 * Kart otomatik tahsilatı yazılamadı çünkü lisanslı ödeme kuruluşu sözleşmesi
 * yok (bkz. docs/dagitim.md 1.1) ve tekrarlayan tahsilat kart saklama
 * gerektiriyor. `paidMethod` alanı CARD'ı bekliyor: adaptör geldiğinde bu
 * modülde değişmesi gereken tek şey faturanın nasıl PAID olduğu.
 */

/** Ödenmemiş faturaya göre işletmenin abonelik durumunu yeniden yazar. */
async function durumuEsitle(
  tx: Prisma.TransactionClient,
  businessId: string,
  simdi: Date,
): Promise<void> {
  const b = await tx.business.findUnique({
    where: { id: businessId },
    select: { planStatus: true, trialEndsAt: true },
  });
  // İptal işletmenin kendi kararı: fatura durumu onu geri açmamalı.
  if (!b || b.planStatus === 'CANCELLED') return;

  const acikFatura = await tx.subscriptionInvoice.count({
    where: { businessId, status: 'DUE' },
  });

  const denemeSuruyor = b.trialEndsAt !== null && b.trialEndsAt.getTime() > simdi.getTime();
  const yeni = acikFatura > 0 ? 'PAST_DUE' : denemeSuruyor ? 'TRIAL' : 'ACTIVE';
  if (yeni !== b.planStatus) {
    await tx.business.update({ where: { id: businessId }, data: { planStatus: yeni } });
  }
}

export type DonguSonucu = {
  /** Kesilen fatura sayısı. */
  fatura: number;
  /** Gönderilen deneme uyarısı sayısı. */
  uyari: number;
  /** Paket seçmediği için fatura kesilemeyen işletme sayısı. */
  paketsiz: number;
};

/**
 * Döngüyü bir kez yürütür.
 *
 * Zamanlanmış iş bunu günde bir çağırıyor ama saatte bir çağrılsa da sonuç
 * değişmez: fatura üretimi `@@unique([businessId, periodStart])` sayesinde
 * idempotent, uyarı `trialWarnedAt` damgasıyla tek sefer. Kuyruk işleri en az
 * bir kez çalışır; "tam bir kez" varsayan bir tasarım burada çift fatura
 * üretirdi.
 */
export async function runSubscriptionCycle(simdi: Date = new Date()): Promise<DonguSonucu> {
  const isletmeler = await prisma.business.findMany({
    where: { planStatus: { not: 'CANCELLED' } },
    select: {
      id: true,
      name: true,
      slug: true,
      planKey: true,
      planPrice: true,
      planStatus: true,
      trialEndsAt: true,
      trialWarnedAt: true,
      currentPeriodEnd: true,
    },
  });

  const sonuc: DonguSonucu = { fatura: 0, uyari: 0, paketsiz: 0 };

  for (const b of isletmeler) {
    if (denemeUyarisiGerekli(b, simdi)) {
      await prisma.business.update({ where: { id: b.id }, data: { trialWarnedAt: simdi } });
      await notifyBusiness(b.id, null, {
        kind: 'SYSTEM',
        title: 'Deneme süreniz bitmek üzere',
        body: trialUyariMetni(b.trialEndsAt!, b.planPrice, simdi),
        href: `/panel/${b.slug}/ayarlar`,
      });
      sonuc.uyari += 1;
    }

    const donem = kesilecekDonem(b, simdi);
    if (!donem) {
      // Deneme bitmiş ama paket seçilmemiş: borç yazılamaz. Yönetim ekranında
      // ayrıca listeleniyor ki kimse arada kaybolmasın.
      const denemeBitti = b.trialEndsAt !== null && b.trialEndsAt.getTime() <= simdi.getTime();
      if (denemeBitti && b.planPrice <= 0) sonuc.paketsiz += 1;
      continue;
    }

    const yazildi = await faturaKes(b.id, b.planKey, b.planPrice, donem, simdi);
    if (!yazildi) continue;

    sonuc.fatura += 1;
    await notifyBusiness(b.id, null, {
      kind: 'SYSTEM',
      title: 'Abonelik faturanız oluştu',
      body: `${planByKey(b.planKey).name} paketi · ${money(b.planPrice)} · son ödeme ${donem.dueAt.toLocaleDateString('tr-TR')}`,
      href: `/panel/${b.slug}/ayarlar`,
      alsoSend: true,
    });
  }

  return sonuc;
}

/** Tek fatura yazar; aynı dönem zaten varsa false döner. */
async function faturaKes(
  businessId: string,
  planKey: string,
  amount: number,
  donem: Donem,
  simdi: Date,
): Promise<boolean> {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.subscriptionInvoice.create({
        data: {
          businessId,
          planKey,
          amount,
          periodStart: donem.periodStart,
          periodEnd: donem.periodEnd,
          dueAt: donem.dueAt,
          status: 'DUE',
        },
      });
      await durumuEsitle(tx, businessId, simdi);
    });
    return true;
  } catch (err) {
    // P2002 = bu dönemin faturası zaten var. İşin ikinci kez koşması normal;
    // hata değil, "yapacak bir şey yok" demek.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return false;
    throw err;
  }
}

/**
 * Faturayı ödenmiş işaretler.
 *
 * `currentPeriodEnd` faturanın KENDİ dönem sonuna çekiliyor, "bugün + 1 ay"a
 * değil: geç ödeyen işletme bir sonraki dönemi geç başlatarak birkaç gün
 * bedava kullanmasın ve dönemler kaymasın.
 */
export async function markInvoicePaid(args: {
  invoiceId: string;
  note?: string | undefined;
  now?: Date;
}): Promise<{ businessId: string; amount: number; businessName: string }> {
  const simdi = args.now ?? new Date();

  return prisma.$transaction(async (tx) => {
    const fatura = await tx.subscriptionInvoice.findUnique({
      where: { id: args.invoiceId },
      select: {
        id: true,
        status: true,
        amount: true,
        periodEnd: true,
        businessId: true,
        business: { select: { currentPeriodEnd: true, name: true, slug: true } },
      },
    });
    if (!fatura) throw new DomainError('Fatura bulunamadı.', 'NOT_FOUND');
    if (fatura.status === 'PAID') throw new DomainError('Bu fatura zaten ödenmiş.', 'BAD_STATE');
    if (fatura.status === 'VOID') {
      throw new DomainError('İptal edilmiş fatura ödenmiş işaretlenemez.', 'BAD_STATE');
    }

    await tx.subscriptionInvoice.update({
      where: { id: fatura.id },
      data: {
        status: 'PAID',
        paidAt: simdi,
        paidMethod: 'MANUAL',
        paidNote: args.note?.trim() || null,
      },
    });

    // Geriye dönük bir fatura ödendiyse dönem sonu geri çekilmemeli.
    const mevcut = fatura.business.currentPeriodEnd;
    if (!mevcut || fatura.periodEnd.getTime() > mevcut.getTime()) {
      await tx.business.update({
        where: { id: fatura.businessId },
        data: { currentPeriodEnd: fatura.periodEnd },
      });
    }

    await durumuEsitle(tx, fatura.businessId, simdi);

    await notifyBusiness(
      fatura.businessId,
      null,
      {
        kind: 'SYSTEM',
        title: 'Abonelik ödemeniz alındı',
        body: `${money(fatura.amount)} · sonraki dönem ${fatura.periodEnd.toLocaleDateString('tr-TR')}`,
        href: `/panel/${fatura.business.slug}/ayarlar`,
      },
      tx,
    );

    return {
      businessId: fatura.businessId,
      amount: fatura.amount,
      businessName: fatura.business.name,
    };
  });
}

/** Yanlış kesilen faturayı geçersiz kılar. */
export async function voidInvoice(args: {
  invoiceId: string;
  reason: string;
  now?: Date;
}): Promise<void> {
  const simdi = args.now ?? new Date();
  if (!args.reason.trim()) throw new DomainError('İptal gerekçesi zorunlu.', 'REASON_REQUIRED');

  await prisma.$transaction(async (tx) => {
    const fatura = await tx.subscriptionInvoice.findUnique({
      where: { id: args.invoiceId },
      select: { id: true, status: true, businessId: true },
    });
    if (!fatura) throw new DomainError('Fatura bulunamadı.', 'NOT_FOUND');
    if (fatura.status === 'PAID') {
      throw new DomainError('Ödenmiş fatura iptal edilemez; önce iade süreci gerekir.', 'BAD_STATE');
    }
    await tx.subscriptionInvoice.update({
      where: { id: fatura.id },
      data: { status: 'VOID', voidReason: args.reason.trim() },
    });
    await durumuEsitle(tx, fatura.businessId, simdi);
  });
}
