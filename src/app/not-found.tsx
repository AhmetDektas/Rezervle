import Link from 'next/link';
import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/brand/logo';

export default function NotFound() {
  return (
    <main id="icerik" className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <Logo className="mb-10" />
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
        <Compass size={26} aria-hidden />
      </div>
      <h1 className="mt-5 text-[22px] font-semibold">Aradığınız sayfa bulunamadı</h1>
      <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-ink-2">
        Bağlantı taşınmış veya süresi dolmuş olabilir. Ana sayfadan devam edebilir ya da
        işletmeleri keşfedebilirsiniz.
      </p>
      <div className="mt-6 flex gap-3">
        <Button asChild variant="secondary"><Link href="/">Ana sayfa</Link></Button>
        <Button asChild><Link href="/kesfet">İşletmeleri keşfet</Link></Button>
      </div>
    </main>
  );
}
