import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { currentUser } from '@/server/auth';
import { PaymentReturn } from '@/components/booking/payment-return';

export const metadata: Metadata = { title: 'Ödeme sonucu' };
export const dynamic = 'force-dynamic';

/**
 * 3DS dönüş adresi (T19).
 *
 * Sonuç webhook ile geldiği için burada karar verilmiyor; ekran durumu
 * yokluyor. Sunucuda "ödendi mi" diye bakıp tek seferlik cevap vermek,
 * webhook birkaç saniye gecikince yanlış cevap vermek olurdu.
 */
export default async function PaymentReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ kod?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect('/giris?next=/randevularim');

  const { kod } = await searchParams;
  if (!kod) notFound();

  return (
    <div className="mx-auto max-w-md px-4 py-10 sm:px-6">
      <PaymentReturn code={kod} />
    </div>
  );
}
