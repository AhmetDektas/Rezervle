import Link from 'next/link';
import { Logo } from '@/components/brand/logo';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex flex-col px-5 py-6 sm:px-8">
        <Link href="/" className="inline-flex w-fit rounded-xl focus-visible:ring-2">
          <Logo />
        </Link>
        <main id="icerik" className="flex flex-1 items-center justify-center py-8">
          <div className="w-full max-w-[400px]">{children}</div>
        </main>
        <p className="text-center text-xs text-ink-3">
          Devam ederek{' '}
          <Link href="/sozlesme" className="underline hover:text-ink-2">
            kullanım koşullarını
          </Link>{' '}
          kabul etmiş olursunuz.
        </p>
      </div>

      {/* Sağ sütun yalnızca masaüstünde: markanın nefes aldığı alan. */}
      <aside className="relative hidden overflow-hidden bg-navy lg:block">
        <div
          aria-hidden
          className="absolute inset-0 opacity-90"
          style={{
            backgroundImage:
              'radial-gradient(900px 500px at 80% 10%, rgba(23,107,255,.55), transparent 60%), radial-gradient(700px 500px at 10% 90%, rgba(59,133,255,.35), transparent 60%)',
          }}
        />
        <div aria-hidden className="absolute inset-0 opacity-[.07]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
        <div className="relative flex h-full flex-col justify-end p-12 text-white">
          <p className="max-w-md text-[28px] font-semibold leading-tight tracking-[-0.02em]">
            Boş saati görmek için telefon etmeye gerek yok.
          </p>
          <p className="mt-3 max-w-md text-[15px] leading-relaxed text-white/70">
            Rezzerv, işletmenin takvimini canlı okur. Gördüğünüz saat gerçekten
            boştur; seçtiğiniz anda size ayrılır.
          </p>
          <div className="mt-8 flex gap-8 text-sm text-white/60">
            <div>
              <p className="text-2xl font-semibold text-white">9</p>
              <p>Ankara’da işletme</p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-white">54</p>
              <p>Hizmet</p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-white">7/24</p>
              <p>Randevu</p>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
