import { Suspense } from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthForm } from '@/components/auth/auth-form';
import { currentUser } from '@/server/auth';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = { title: 'Giriş yap' };

export default async function LoginPage() {
  const user = await currentUser();
  if (user) redirect(user.role === 'ADMIN' ? '/yonetim' : user.role === 'CUSTOMER' ? '/' : '/panel');
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <AuthForm mode="login" showDemo={process.env.NODE_ENV !== 'production'} />
    </Suspense>
  );
}
