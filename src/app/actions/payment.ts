'use server';

import { prisma } from '@/lib/db';
import { run, DomainError, type ActionResult } from '@/server/errors';
import { requireUserAction } from '@/server/auth';
import { paymentProvider, mockSignature, type WebhookEvent } from '@/server/providers';
import { requestOrigin } from '@/server/request';

/**
 * Ödeme durumu sorgusu ve sahte 3DS tetikleyicisi.
 */

export type PaymentState = {
  /** PENDING: webhook bekleniyor · PAID · FAILED · NONE (kapora yok) */
  depositStatus: string;
  reservationId: string | null;
  cancelled: boolean;
};

/**
 * Dönüş ekranının okuduğu durum (T19).
 *
 * Yalnızca kendi randevusunu sorgulayabiliyor: kod tahmin edilebilir olmasa da
 * yetki kontrolünü tahmin edilemezliğe bırakmak doğru değil.
 */
export async function paymentStateAction(code: string): Promise<ActionResult<PaymentState>> {
  return run(async () => {
    const user = await requireUserAction();
    const r = await prisma.reservation.findUnique({
      where: { code },
      select: { id: true, customerId: true, status: true, depositStatus: true },
    });
    if (!r || r.customerId !== user.id) {
      throw new DomainError('Randevu bulunamadı.', 'NOT_FOUND');
    }
    return {
      depositStatus: r.depositStatus,
      reservationId: r.id,
      cancelled: r.status === 'CANCELLED',
    };
  }, { action: 'paymentStateAction' });
}

/**
 * Sahte 3DS sonucunu webhook olarak geri gönderir (T17).
 *
 * Doğrudan `applyPaymentEvent` çağırmıyor, bilerek HTTP üzerinden gerçek
 * webhook rotasına gidiyor: imza doğrulaması, idempotens ve rota sözleşmesi
 * de böylece her testte çalışıyor. Kısayol, tam da korumak istediğimiz
 * yüzeyi atlamak olurdu.
 */
export async function simulateThreeDSAction(input: {
  providerRef: string;
  code: string;
  outcome: 'paid' | 'failed';
}): Promise<ActionResult<undefined>> {
  return run(async () => {
    const provider = paymentProvider();
    if (provider.name !== 'mock') {
      throw new DomainError('Bu işlem yalnızca test sağlayıcısında kullanılabilir.', 'FORBIDDEN');
    }
    const user = await requireUserAction();
    const r = await prisma.reservation.findUnique({
      where: { code: input.code },
      select: { customerId: true },
    });
    if (!r || r.customerId !== user.id) {
      throw new DomainError('Randevu bulunamadı.', 'NOT_FOUND');
    }

    const event: WebhookEvent = {
      // Gerçek sağlayıcı olay kimliğini kendi üretir; burada referanstan
      // türetiyoruz ki aynı sonucun iki kez gönderilmesi idempotens yolunu
      // gerçekten sınasın.
      id: `mock_evt_${input.providerRef}_${input.outcome}`,
      type: input.outcome === 'paid' ? 'payment.paid' : 'payment.failed',
      providerRef: input.providerRef,
      reference: input.code,
      ...(input.outcome === 'failed' ? { reason: 'Banka işlemi reddetti.' } : {}),
    };
    const body = JSON.stringify(event);

    const res = await fetch(new URL('/api/odeme/webhook', await requestOrigin()).toString(), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-rezzerv-signature': mockSignature(body),
      },
      body,
    });
    if (!res.ok) {
      throw new DomainError('Ödeme sonucu işlenemedi. Lütfen tekrar deneyin.', 'WEBHOOK_FAILED');
    }
    return undefined;
  }, { action: 'simulateThreeDSAction' });
}
