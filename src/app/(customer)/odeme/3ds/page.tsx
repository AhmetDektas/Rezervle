import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { currentUser } from '@/server/auth';
import { usingMockPayments } from '@/server/providers';
import { MockThreeDSForm } from '@/components/booking/mock-3ds-form';

export const metadata: Metadata = { title: '3D Secure' };
export const dynamic = 'force-dynamic';

/**
 * Sahte 3D Secure ekranı (T17).
 *
 * Gerçekte burası bankanın sayfası; bizim sunucumuzda böyle bir ekran olmaz.
 * Taklit etmemizin sebebi, akışın **şeklinin** test edilebilmesi: müşteri
 * siteden ayrılıyor, sonuç webhook ile geliyor, arada terk edebiliyor.
 * Senkron `PAID` döndüren eski sahte sağlayıcı bu üç durumdan hiçbirini
 * üretmiyordu.
 *
 * Yalnızca sahte sağlayıcıda erişilebilir: gerçek sağlayıcı bağlandığında bu
 * adres 404 döner.
 */
export default async function MockThreeDSPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; kod?: string }>;
}) {
  // Çift kapı: sahte sağlayıcı dışında ve üretimde asla erişilemez. Taklit
  // ödeme ekranının canlıda ulaşılabilir olması, gerçek sanılabilecek bir
  // yüzey bırakmak olurdu.
  if (!usingMockPayments() || process.env.NODE_ENV === 'production') notFound();

  const { ref, kod } = await searchParams;
  if (!ref || !kod) notFound();

  // Oturum şart: başkasının ödeme referansıyla bu ekranı açmanın anlamı yok.
  const user = await currentUser();
  if (!user) notFound();

  return (
    <div className="mx-auto max-w-md px-4 py-10 sm:px-6">
      <div className="card p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <ShieldCheck size={20} aria-hidden />
          </span>
          <div>
            <h1 className="text-[18px] font-semibold tracking-[-0.01em]">3D Secure doğrulama</h1>
            <p className="text-[13px] text-ink-3">Test ortamı · gerçek kart işlemi yapılmaz</p>
          </div>
        </div>

        <p className="mt-4 text-[14px] leading-relaxed text-ink-2">
          Gerçek bir ödemede bu ekran bankanıza aittir ve telefonunuza gelen kodu
          girersiniz. Burada sonucu doğrudan seçebilirsiniz; seçiminiz webhook
          olarak sistemimize döner.
        </p>

        <MockThreeDSForm providerRef={ref} code={kod} />
      </div>
    </div>
  );
}
