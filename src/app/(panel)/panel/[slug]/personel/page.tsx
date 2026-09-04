import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Users } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireRole, requireBusinessAccess } from '@/server/auth';
import { StaffEditor, StaffToggle, TimeOffEditor, DeleteTimeOff } from '@/components/panel/staff-editor';
import { HoursEditor } from '@/components/panel/hours-editor';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { WEEKDAYS_SHORT, termsFor } from '@/lib/constants';
import { hhmm } from '@/lib/time';
import { longDate } from '@/lib/format';

export const metadata: Metadata = { title: 'Personel' };
export const dynamic = 'force-dynamic';

type Params = Promise<{ slug: string }>;

export default async function StaffPage({ params }: { params: Params }) {
  const [{ slug }, user] = await Promise.all([params, requireRole(['OWNER', 'STAFF', 'ADMIN'])]);
  const business = await prisma.business.findUnique({
    where: { slug },
    select: {
      id: true,
      category: { select: { sector: true } },
      branches: { where: { active: true }, select: { id: true, name: true } },
      services: { where: { active: true }, orderBy: { sortOrder: 'asc' }, select: { id: true, name: true } },
      staff: {
        orderBy: [{ active: 'desc' }, { sortOrder: 'asc' }],
        include: {
          hours: { orderBy: { weekday: 'asc' } },
          breaks: true,
          services: { select: { serviceId: true } },
          branch: { select: { name: true } },
          user: { select: { email: true } },
          timeOff: { where: { endsAt: { gte: new Date() } }, orderBy: { startsAt: 'asc' } },
          _count: { select: { reservations: true } },
        },
      },
    },
  });
  if (!business) notFound();
  await requireBusinessAccess(user, business.id);
  const terms = termsFor(business.category.sector);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em]">{terms.resourceAdminPlural}</h1>
          <p className="mt-0.5 text-[13.5px] text-ink-3">
            Çalışma saatleri ve kapalı aralıklar doğrudan uygunluğu etkiler.
          </p>
        </div>
        <StaffEditor
          slug={slug}
          businessId={business.id}
          branches={business.branches}
          services={business.services}
          resource={terms.resource}
        />
      </div>

      {business.staff.length === 0 ? (
        <EmptyState
          icon={<Users size={22} />}
          title={`Henüz ${terms.resource.toLocaleLowerCase('tr-TR')} yok`}
          description={`Randevu verebilmek için en az bir ${terms.resource.toLocaleLowerCase('tr-TR')} eklemelisiniz.`}
        />
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {business.staff.map((s) => (
            <li key={s.id}>
              <Card className="h-full p-4">
                <div className="flex items-start gap-3">
                  <Avatar name={s.displayName} size={44} hue={s.hue} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[15px] font-semibold text-navy">{s.displayName}</p>
                      {!s.active ? <Badge tone="neutral">Pasif</Badge> : null}
                      {s.user ? <Badge tone="blue">Panel erişimi</Badge> : null}
                    </div>
                    <p className="text-[13px] text-brand-600">{s.title || 'Personel'}</p>
                    <p className="mt-0.5 text-[12.5px] text-ink-3">
                      {s.branch?.name ?? 'Tüm şubeler'} · {s.services.length} seçenek ·{' '}
                      <span className="tnum">{s._count.reservations}</span> randevu
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StaffToggle slug={slug} staffId={s.id} active={s.active} />
                    <StaffEditor
                      slug={slug}
                      businessId={business.id}
                      branches={business.branches}
                      services={business.services}
                      trigger="edit"
                      resource={terms.resource}
                      staff={{
                        id: s.id,
                        displayName: s.displayName,
                        title: s.title,
                        bio: s.bio,
                        branchId: s.branchId,
                        active: s.active,
                        serviceIds: s.services.map((x) => x.serviceId),
                      }}
                    />
                  </div>
                </div>

                <ul className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-3">
                  {s.hours.map((h) => (
                    <li
                      key={h.id}
                      className={
                        h.closed
                          ? 'rounded-lg bg-sunken px-2 py-1 text-[11.5px] text-ink-3'
                          : 'rounded-lg bg-brand-50 px-2 py-1 text-[11.5px] text-brand-700'
                      }
                    >
                      <span className="font-medium">{WEEKDAYS_SHORT[h.weekday]}</span>{' '}
                      <span className="tnum">{h.closed ? 'Kapalı' : `${hhmm(h.startMin)}–${hhmm(h.endMin)}`}</span>
                    </li>
                  ))}
                </ul>

                {s.timeOff.length > 0 ? (
                  <ul className="mt-3 space-y-1.5">
                    {s.timeOff.map((t) => (
                      <li
                        key={t.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-warn-line bg-warn-soft px-2.5 py-1.5 text-[12.5px] text-warn"
                      >
                        <span className="truncate">
                          {longDate(t.startsAt.toISOString().slice(0, 10))} –{' '}
                          {longDate(t.endsAt.toISOString().slice(0, 10))}
                          {t.reason ? ` · ${t.reason}` : ''}
                        </span>
                        <DeleteTimeOff slug={slug} id={t.id} />
                      </li>
                    ))}
                  </ul>
                ) : null}

                <div className="mt-3 flex flex-wrap gap-2">
                  <HoursEditor
                    slug={slug}
                    target="staff"
                    targetId={s.id}
                    title={s.displayName}
                    hours={s.hours.map((h) => ({
                      weekday: h.weekday,
                      startMin: h.startMin,
                      endMin: h.endMin,
                      closed: h.closed,
                    }))}
                  />
                  <TimeOffEditor slug={slug} staffId={s.id} staffName={s.displayName} />
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
