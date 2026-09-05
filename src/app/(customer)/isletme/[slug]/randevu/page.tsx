import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { currentUser } from '@/server/auth';
import { depositPolicyFor } from '@/server/deposit-policy';
import { BookingFlow, type BookingBusiness } from '@/components/booking/booking-flow';

export const dynamic = 'force-dynamic';

type Params = Promise<{ slug: string }>;
type Search = Promise<{ hizmet?: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const business = await prisma.business.findUnique({ where: { slug }, select: { name: true } });
  return { title: business ? `${business.name} — Randevu` : 'Randevu' };
}

export default async function BookingPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const [{ slug }, search, user] = await Promise.all([params, searchParams, currentUser()]);

  const row = await prisma.business.findFirst({
    where: { slug, status: 'APPROVED' },
    select: {
      id: true,
      slug: true,
      name: true,
      brandHue: true,
      category: { select: { sector: true } },
      depositAddon: true,
      depositEnabled: true,
      depositKind: true,
      depositValue: true,
      depositMinPrice: true,
      depositRefundHours: true,
      branches: {
        where: { active: true },
        orderBy: { isPrimary: 'desc' },
        select: { id: true, name: true, district: true, address: true },
      },
      services: {
        where: { active: true },
        orderBy: [{ sortOrder: 'asc' }, { price: 'asc' }],
        select: { id: true, name: true, description: true, durationMin: true, price: true },
      },
      staff: {
        where: { active: true },
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          displayName: true,
          title: true,
          hue: true,
          branchId: true,
          services: { select: { serviceId: true } },
        },
      },
    },
  });
  if (!row) notFound();

  const business: BookingBusiness = {
    ...row,
    sector: row.category.sector,
    deposit: depositPolicyFor(row),
    staff: row.staff.map((s) => ({
      id: s.id,
      displayName: s.displayName,
      title: s.title,
      hue: s.hue,
      branchId: s.branchId,
      serviceIds: s.services.map((x) => x.serviceId),
    })),
  };

  const requested = search.hizmet;
  const initialServiceId = business.services.some((s) => s.id === requested) ? requested : undefined;

  return (
    <BookingFlow business={business} loggedIn={Boolean(user)} initialServiceId={initialServiceId} />
  );
}
