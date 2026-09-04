import type { Metadata } from 'next';
import { Search } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireRole } from '@/server/auth';
import { UserRowActions } from '@/components/admin/admin-actions';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { ago, phone as fmtPhone } from '@/lib/format';
import { ROLE_LABEL, ROLES, type Role } from '@/lib/constants';

export const metadata: Metadata = { title: 'Kullanıcılar' };
export const dynamic = 'force-dynamic';

type Search = Promise<{ q?: string; rol?: string }>;

export default async function AdminUsersPage({ searchParams }: { searchParams: Search }) {
  const [search, me] = await Promise.all([searchParams, requireRole(['ADMIN'])]);
  const q = search.q?.trim();
  const role = ROLES.includes(search.rol as Role) ? (search.rol as Role) : undefined;

  const users = await prisma.user.findMany({
    where: {
      ...(role ? { role } : {}),
      ...(q ? { OR: [{ name: { contains: q } }, { email: { contains: q } }, { phone: { contains: q } }] } : {}),
    },
    orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
    take: 120,
    select: {
      id: true, name: true, email: true, phone: true, role: true, active: true,
      createdAt: true, avatarSeed: true,
      _count: { select: { reservations: true, ownedBusinesses: true } },
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Kullanıcılar</h1>
        <p className="mt-0.5 text-[13.5px] text-ink-3">
          <span className="tnum">{users.length}</span> kayıt listeleniyor
        </p>
      </div>

      <form className="card flex flex-wrap gap-3 p-3.5" role="search">
        <div className="relative min-w-[220px] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden />
          <input
            name="q"
            defaultValue={q ?? ''}
            placeholder="Ad, e-posta veya telefon"
            aria-label="Kullanıcı ara"
            className="h-11 w-full rounded-xl border border-line-strong bg-surface pl-9 pr-3 text-[15px] text-navy placeholder:text-ink-3 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <select
          name="rol"
          defaultValue={role ?? ''}
          aria-label="Rol filtresi"
          className="h-11 rounded-xl border border-line-strong bg-surface px-3 text-[14px] text-navy"
        >
          <option value="">Tüm roller</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>{ROLE_LABEL[r]}</option>
          ))}
        </select>
        <button
          type="submit"
          className="h-11 rounded-xl bg-brand-500 px-4 text-[14px] font-medium text-white transition hover:bg-brand-600"
        >
          Filtrele
        </button>
      </form>

      {users.length === 0 ? (
        <EmptyState title="Kullanıcı bulunamadı" description="Arama ölçütlerinizi değiştirin." />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line">
            {users.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-3 p-4">
                <Avatar name={u.name} size={38} hue={Number(u.avatarSeed) * 37} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[14.5px] font-medium text-navy">{u.name}</p>
                    {!u.active ? <Badge tone="red">Kapalı</Badge> : null}
                    {u.id === me.id ? <Badge tone="blue">Siz</Badge> : null}
                  </div>
                  <p className="text-[12.5px] text-ink-3">
                    {u.email}
                    {u.phone ? ` · ${fmtPhone(u.phone)}` : ''}
                  </p>
                  <p className="tnum text-[12px] text-ink-3">
                    {ago(u.createdAt)} · {u._count.reservations} randevu
                    {u._count.ownedBusinesses > 0 ? ` · ${u._count.ownedBusinesses} işletme` : ''}
                  </p>
                </div>
                <UserRowActions userId={u.id} role={u.role} active={u.active} self={u.id === me.id} />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
