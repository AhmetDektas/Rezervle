import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { currentUser } from '@/server/auth';
import { BusinessRegisterForm } from '@/components/auth/business-register-form';
import { ANKARA_DISTRICTS } from '@/lib/constants';

export const metadata: Metadata = { title: 'İşletme başvurusu' };

// Kategori listesi veritabanından okunuyor; yönetim yeni kategori açtığında
// başvuru formu kendiliğinden güncellensin diye önbelleğe alınmıyor.
export const dynamic = 'force-dynamic';

export default async function BusinessRegisterPage() {
  const user = await currentUser();
  // Oturum açıkken ikinci bir hesap açılamaz: başvuru aynı zamanda kayıt.
  // İkinci işletmesini eklemek isteyen sahip panelden ilerleyecek (T-E4).
  if (user) redirect(user.role === 'CUSTOMER' ? '/' : '/panel');

  const categories = await prisma.businessCategory.findMany({
    where: { active: true },
    orderBy: { name: 'asc' },
    select: { slug: true, name: true },
  });

  return <BusinessRegisterForm categories={categories} districts={ANKARA_DISTRICTS} />;
}
