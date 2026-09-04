import { requireRole } from '@/server/auth';
import { AdminShell } from '@/components/admin/admin-shell';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Tüm /yonetim alt yolları tek kapıdan geçer.
  const user = await requireRole(['ADMIN'], '/yonetim');
  return (
    <AdminShell user={{ name: user.name, avatarSeed: user.avatarSeed }}>{children}</AdminShell>
  );
}
