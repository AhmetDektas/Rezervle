import { Suspense } from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthForm } from '@/components/auth/auth-form';
import { currentUser } from '@/server/auth';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = { title: 'Kayıt ol' };

export default async function RegisterPage() {
  const user = await currentUser();
  if (user) redirect('/');
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <AuthForm mode="register" showDemo={false} />
    </Suspense>
  );
}
