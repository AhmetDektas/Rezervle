import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Store } from 'lucide-react';
import { requireRole, accessibleBusinesses } from '@/server/auth';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/brand/logo';

export const dynamic = 'force-dynamic';

/** Panel girişi: erişilebilen ilk işletmeye yönlendirir. */
export default async function PanelIndex() {
  const user = await requireRole(['OWNER', 'STAFF', 'ADMIN'], '/panel');
  const businesses = await accessibleBusinesses(user);
  const first = businesses[0];
  if (first) redirect(`/panel/${first.slug}`);

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center px-6">
      <Logo className="mb-8" />
      <EmptyState
        icon={<Store size={22} />}
        title="Henüz bir işletmeniz yok"
        description="Hesabınız bir işletmeye bağlı değil. İşletmenizi başvuru formundan ekleyebilir, personelseniz işletme sahibinden sizi eklemesini isteyebilirsiniz."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild><Link href="/kayit/isletme">İşletmenizi ekleyin</Link></Button>
            <Button asChild variant="secondary"><Link href="/">Müşteri uygulamasına dön</Link></Button>
          </div>
        }
      />
    </div>
  );
}
