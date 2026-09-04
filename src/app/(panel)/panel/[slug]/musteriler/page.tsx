import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { UserRound, Search } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireRole, requireBusinessAccess } from '@/server/auth';
import { businessCustomers } from '@/server/panel';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { money, relativeDay, phone as fmtPhone } from '@/lib/format';

export const metadata: Metadata = { title: 'Müşteriler' };
export const dynamic = 'force-dynamic';

type Params = Promise<{ slug: string }>;
type Search = Promise<{ q?: string }>;

export default async function CustomersPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const [{ slug }, search, user] = await Promise.all([
    params,
    searchParams,
    requireRole(['OWNER', 'STAFF', 'ADMIN']),
  ]);
  const business = await prisma.business.findUnique({ where: { slug }, select: { id: true } });
  if (!business) notFound();
  await requireBusinessAccess(user, business.id);

  const customers = await businessCustomers(business.id, search.q);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Müşteriler</h1>
        <p className="mt-0.5 text-[13.5px] text-ink-3">
          <span className="tnum">{customers.length}</span> müşteri · randevu geçmişine göre sıralı
        </p>
      </div>

      <form className="card relative p-3.5" role="search">
        <Search size={16} className="pointer-events-none absolute left-6 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden />
        <input
          name="q"
          defaultValue={search.q ?? ''}
          placeholder="Ad veya telefon ile ara"
          aria-label="Müşteri ara"
          className="h-11 w-full rounded-xl border border-line-strong bg-surface pl-9 pr-3 text-[15px] text-navy placeholder:text-ink-3 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
      </form>

      {customers.length === 0 ? (
        <EmptyState
          icon={<UserRound size={22} />}
          title="Müşteri bulunamadı"
          description="Randevu oluşturulduğunda müşteri kartı otomatik açılır."
        />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line">
            {customers.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/panel/${slug}/musteriler/${c.id}`}
                  className="flex flex-wrap items-center gap-3 p-4 transition hover:bg-sunken/50"
                >
                  <Avatar name={c.name} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[14.5px] font-medium text-navy">{c.name}</p>
                      {c.completed >= 5 ? <Badge tone="green">Düzenli</Badge> : null}
                      {c.noShow >= 2 ? <Badge tone="red">{c.noShow} kez gelmedi</Badge> : null}
                      {c.nextVisit ? <Badge tone="blue">{relativeDay(c.nextVisit)} randevusu var</Badge> : null}
                    </div>
                    <p className="tnum mt-0.5 text-[12.5px] text-ink-3">
                      {c.phone ? fmtPhone(c.phone) : c.email}
                      {c.lastVisit ? ` · son ziyaret ${relativeDay(c.lastVisit)}` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="tnum text-[14px] font-semibold text-navy">{money(c.spend)}</p>
                    <p className="tnum text-[12px] text-ink-3">{c.completed} tamamlanan</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
