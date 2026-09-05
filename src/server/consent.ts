import 'server-only';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { CONSENT_VERSION, type ConsentKind, type Sector } from '@/lib/constants';

/**
 * KVKK rıza kayıtları.
 *
 * Rıza kaydı silinmiyor, `revokedAt` ile kapatılıyor: "ne zaman verildi, ne
 * zaman geri alındı" sorusunun ikisi de kanıt. Silme, geri alma anını da
 * yok ederdi.
 *
 * Yeniden rıza verildiğinde eski satır kapalı kalır ve yeni satır açılır;
 * geçmiş üzerine yazılmaz.
 */

/**
 * Açık rıza gerektiren sektörler.
 *
 * Randevunun kendisi sözleşmenin ifası, ayrı rıza istemez. Ama "diş kliniğinden
 * randevu aldı" kaydı sağlığa dair bir çıkarım taşır ve KVKK m.6 anlamında özel
 * nitelikli veri sayılır. Restoran ya da halı saha randevusu bu kapsamda değil;
 * rızayı her yerde şart koşmak gereksiz sürtünme olurdu.
 */
const SENSITIVE_SECTORS = new Set<Sector>(['DENTAL', 'VET', 'AESTHETIC']);

export function sectorNeedsConsent(sector: string): boolean {
  return SENSITIVE_SECTORS.has(sector as Sector);
}

export async function hasActiveConsent(
  userId: string,
  kind: ConsentKind,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<boolean> {
  const row = await tx.consent.findFirst({
    where: { userId, kind, revokedAt: null },
    select: { id: true },
  });
  return row !== null;
}

export type ConsentSummary = {
  kind: ConsentKind;
  version: string;
  grantedAt: Date;
  revokedAt: Date | null;
};

/** Her tür için en son kayıt: profilde "ne zaman, hangi sürüme" gösterilir. */
export async function consentSummary(userId: string): Promise<ConsentSummary[]> {
  const rows = await prisma.consent.findMany({
    where: { userId },
    orderBy: { grantedAt: 'desc' },
    select: { kind: true, version: true, grantedAt: true, revokedAt: true },
  });
  const seen = new Set<string>();
  const out: ConsentSummary[] = [];
  for (const r of rows) {
    if (seen.has(r.kind)) continue;
    seen.add(r.kind);
    out.push({
      kind: r.kind as ConsentKind,
      version: r.version,
      grantedAt: r.grantedAt,
      revokedAt: r.revokedAt,
    });
  }
  return out;
}

/** Açık rızayı geri alır. Geçmişe etkili değildir; mevcut randevular durur. */
export async function revokeConsent(userId: string): Promise<void> {
  await prisma.consent.updateMany({
    where: { userId, kind: 'ACIK_RIZA', revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** Geri alınan rızayı yeniden verir: yürürlükteki sürümle yeni satır. */
export async function grantConsent(userId: string): Promise<void> {
  if (await hasActiveConsent(userId, 'ACIK_RIZA')) return;
  await prisma.consent.create({
    data: { userId, kind: 'ACIK_RIZA', version: CONSENT_VERSION },
  });
}
