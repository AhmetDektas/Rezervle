import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthForm } from '@/components/auth/auth-form';
import { currentUser } from '@/server/auth';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = { title: 'Kayıt ol' };

export default async function RegisterPage() {
  const user = await currentUser();
  if (user) redirect('/');
  return (
    <>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <AuthForm mode="register" showDemo={false} />
      </Suspense>
      {/* Buradaki form müşteri hesabı açar. İşletme başvurusu ayrı bir yol:
          aynı formda rol seçtirmek, randevu almaya gelen kullanıcıya anlamsız
          bir karar sorusu sormak olurdu. */}
      <p className="mt-6 border-t border-line pt-4 text-center text-[13.5px] text-ink-2">
        İşletme sahibi misiniz?{' '}
        <Link
          href="/kayit/isletme"
          className="font-medium text-brand-600 underline-offset-4 hover:underline"
        >
          İşletmenizi ekleyin
        </Link>
      </p>
    </>
  );
}
