import Link from 'next/link';
import type { Metadata } from 'next';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/brand/logo';

export const metadata: Metadata = { title: 'Yetkisiz erişim' };

export default function UnauthorizedPage() {
  return (
    <main id="icerik" className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <Logo className="mb-10" />
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-danger-soft text-danger">
        <ShieldAlert size={26} aria-hidden />
      </div>
      <h1 className="mt-5 text-[22px] font-semibold">Bu sayfaya erişim yetkiniz yok</h1>
      <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-ink-2">
        Hesabınızın rolü bu bölümü görüntülemeye izin vermiyor. Yanlış hesapla giriş
        yaptıysanız çıkış yapıp tekrar deneyin.
      </p>
      <div className="mt-6 flex gap-3">
        <Button asChild variant="secondary">
          <Link href="/">Ana sayfa</Link>
        </Button>
        <Button asChild>
          <Link href="/giris">Başka hesapla gir</Link>
        </Button>
      </div>
    </main>
  );
}
