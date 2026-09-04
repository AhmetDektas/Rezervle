import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Scissors } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireRole, requireBusinessAccess } from '@/server/auth';
import { ServiceEditor, ServiceToggle } from '@/components/panel/service-editor';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { money, duration } from '@/lib/format';

export const metadata: Metadata = { title: 'Hizmetler' };
export const dynamic = 'force-dynamic';

type Params = Promise<{ slug: string }>;

export default async function ServicesPage({ params }: { params: Params }) {
  const [{ slug }, user] = await Promise.all([params, requireRole(['OWNER', 'STAFF', 'ADMIN'])]);
  const business = await prisma.business.findUnique({
    where: { slug },
    select: {
      id: true,
      services: {
        orderBy: [{ active: 'desc' }, { sortOrder: 'asc' }],
        include: {
          staffLinks: { select: { staffId: true } },
          _count: { select: { reservations: true } },
        },
      },
      staff: { where: { active: true }, orderBy: { sortOrder: 'asc' }, select: { id: true, displayName: true } },
    },
  });
  if (!business) notFound();
  await requireBusinessAccess(user, business.id);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Hizmetler</h1>
          <p className="mt-0.5 text-[13.5px] text-ink-3">
            Süre ve tampon, takvimde ayrılan bloğu belirler.
          </p>
        </div>
        <ServiceEditor slug={slug} businessId={business.id} staff={business.staff} />
      </div>

      {business.services.length === 0 ? (
        <EmptyState
          icon={<Scissors size={22} />}
          title="Henüz hizmet eklenmemiş"
          description="Müşterilerin randevu alabilmesi için en az bir hizmet tanımlayın."
        />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line">
            {business.services.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[14.5px] font-medium text-navy">{s.name}</p>
                    {!s.active ? <Badge tone="neutral">Pasif</Badge> : null}
                    {s.staffLinks.length === 0 ? (
                      <Badge tone="amber">Personel atanmamış</Badge>
                    ) : null}
                  </div>
                  {s.description ? (
                    <p className="mt-0.5 line-clamp-1 text-[13px] text-ink-3">{s.description}</p>
                  ) : null}
                  <p className="tnum mt-1 text-[12.5px] text-ink-3">
                    {duration(s.durationMin)}
                    {s.bufferMin > 0 ? ` + ${s.bufferMin} dk tampon` : ''} ·{' '}
                    {s.staffLinks.length} personel · {s._count.reservations} randevu
                  </p>
                </div>
                <p className="tnum w-24 text-right text-[15px] font-semibold text-navy">
                  {s.price === 0 ? 'Ücretsiz' : money(s.price)}
                </p>
                <div className="flex items-center gap-2">
                  <ServiceToggle slug={slug} serviceId={s.id} active={s.active} />
                  <ServiceEditor
                    slug={slug}
                    businessId={business.id}
                    staff={business.staff}
                    trigger="edit"
                    service={{
                      id: s.id,
                      name: s.name,
                      description: s.description,
                      durationMin: s.durationMin,
                      bufferMin: s.bufferMin,
                      price: s.price,
                      active: s.active,
                      staffIds: s.staffLinks.map((x) => x.staffId),
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
