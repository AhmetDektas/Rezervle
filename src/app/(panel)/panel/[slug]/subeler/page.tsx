import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Building2, MapPin, Phone } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireRole, requireBusinessAccess } from '@/server/auth';
import { BranchEditor } from '@/components/panel/branch-editor';
import { HoursEditor } from '@/components/panel/hours-editor';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { WEEKDAYS_SHORT } from '@/lib/constants';
import { hhmm } from '@/lib/time';
import { phone as fmtPhone } from '@/lib/format';

export const metadata: Metadata = { title: 'Şubeler' };
export const dynamic = 'force-dynamic';

type Params = Promise<{ slug: string }>;

export default async function BranchesPage({ params }: { params: Params }) {
  const [{ slug }, user] = await Promise.all([params, requireRole(['OWNER', 'STAFF', 'ADMIN'])]);
  const business = await prisma.business.findUnique({
    where: { slug },
    select: {
      id: true,
      branches: {
        orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }],
        include: {
          hours: { orderBy: { weekday: 'asc' } },
          _count: { select: { staff: true, reservations: true } },
        },
      },
    },
  });
  if (!business) notFound();
  await requireBusinessAccess(user, business.id);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Şubeler</h1>
          <p className="mt-0.5 text-[13.5px] text-ink-3">
            Şube saatleri, o şubedeki tüm randevuların dış sınırıdır.
          </p>
        </div>
        <BranchEditor slug={slug} businessId={business.id} />
      </div>

      {business.branches.length === 0 ? (
        <EmptyState icon={<Building2 size={22} />} title="Şube yok" description="En az bir şube tanımlayın." />
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {business.branches.map((b) => (
            <li key={b.id}>
              <Card className="h-full p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[15px] font-semibold text-navy">{b.name}</p>
                      {b.isPrimary ? <Badge tone="blue">Merkez</Badge> : null}
                      {!b.active ? <Badge tone="neutral">Pasif</Badge> : null}
                    </div>
                    <p className="mt-1 inline-flex items-start gap-1.5 text-[13px] text-ink-2">
                      <MapPin size={13} className="mt-0.5 shrink-0 text-ink-3" aria-hidden />
                      {b.address}, {b.district}/{b.city}
                    </p>
                    {b.phone ? (
                      <p className="tnum mt-0.5 inline-flex items-center gap-1.5 text-[13px] text-ink-3">
                        <Phone size={13} aria-hidden />
                        {fmtPhone(b.phone)}
                      </p>
                    ) : null}
                    <p className="tnum mt-1 text-[12.5px] text-ink-3">
                      {b._count.staff} personel · {b._count.reservations} randevu
                    </p>
                  </div>
                  <BranchEditor
                    slug={slug}
                    businessId={business.id}
                    trigger="edit"
                    branch={{
                      id: b.id, name: b.name, city: b.city, district: b.district,
                      address: b.address, phone: b.phone, active: b.active,
                    }}
                  />
                </div>

                <ul className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-3">
                  {b.hours.map((h) => (
                    <li
                      key={h.id}
                      className={
                        h.closed
                          ? 'rounded-lg bg-sunken px-2 py-1 text-[11.5px] text-ink-3'
                          : 'rounded-lg bg-brand-50 px-2 py-1 text-[11.5px] text-brand-700'
                      }
                    >
                      <span className="font-medium">{WEEKDAYS_SHORT[h.weekday]}</span>{' '}
                      <span className="tnum">{h.closed ? 'Kapalı' : `${hhmm(h.openMin)}–${hhmm(h.closeMin)}`}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-3">
                  <HoursEditor
                    slug={slug}
                    target="branch"
                    targetId={b.id}
                    title={b.name}
                    label="Çalışma saatleri"
                    hours={b.hours.map((h) => ({
                      weekday: h.weekday, startMin: h.openMin, endMin: h.closeMin, closed: h.closed,
                    }))}
                  />
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
