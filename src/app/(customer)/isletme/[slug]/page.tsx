import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  MapPin,
  Phone,
  Globe,
  Clock3,
  Check,
  CalendarPlus,
  MessageSquareQuote,
} from 'lucide-react';
import { prisma } from '@/lib/db';
import { currentUser } from '@/server/auth';
import { nextAvailableSlots } from '@/server/discovery';
import { BusinessCover } from '@/components/business/cover';
import { FavoriteButton } from '@/components/business/favorite-button';
import { BusinessGallery } from '@/components/business/gallery';
import { Rating } from '@/components/ui/rating';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { money, duration, priceLevel, relativeDay, ago, phone as fmtPhone } from '@/lib/format';
import { hhmm } from '@/lib/time';
import { WEEKDAYS, termsFor, SECTOR_LABEL, type Sector } from '@/lib/constants';
import { jsonParse } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type Params = Promise<{ slug: string }>;

async function loadBusiness(slug: string) {
  return prisma.business.findFirst({
    where: { slug, status: 'APPROVED' },
    include: {
      category: true,
      branches: {
        where: { active: true },
        orderBy: { isPrimary: 'desc' },
        include: { hours: { orderBy: { weekday: 'asc' } } },
      },
      services: { where: { active: true }, orderBy: [{ sortOrder: 'asc' }, { price: 'asc' }] },
      staff: {
        where: { active: true },
        orderBy: { sortOrder: 'asc' },
        include: { services: { select: { serviceId: true } } },
      },
      images: { orderBy: { sortOrder: 'asc' } },
      reviews: {
        where: { status: 'PUBLISHED' },
        orderBy: { createdAt: 'desc' },
        take: 6,
        include: { user: { select: { name: true, avatarSeed: true } } },
      },
      promotions: {
        where: { active: true, startsAt: { lte: new Date() }, endsAt: { gte: new Date() } },
        take: 2,
      },
      _count: { select: { reservations: { where: { status: 'COMPLETED' } } } },
    },
  });
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const business = await prisma.business.findFirst({
    where: { slug, status: 'APPROVED' },
    select: { name: true, tagline: true, branches: { select: { district: true }, take: 1 } },
  });
  if (!business) return { title: 'İşletme bulunamadı' };
  return {
    title: business.name,
    description: `${business.tagline} · ${business.branches[0]?.district ?? 'Ankara'}. Rezzerv üzerinden online randevu alın.`,
  };
}

export default async function BusinessPage({ params }: { params: Params }) {
  const { slug } = await params;
  const [business, user] = await Promise.all([loadBusiness(slug), currentUser()]);
  if (!business) notFound();

  const favorite = user
    ? Boolean(
        await prisma.favorite.findUnique({
          where: { userId_businessId: { userId: user.id, businessId: business.id } },
        }),
      )
    : false;

  const terms = termsFor(business.category.sector);
  const amenities = jsonParse<string[]>(business.amenities, []);
  const primary = business.branches[0];
  const nextSlots = await nextAvailableSlots([business.id], 5);
  const next = nextSlots[business.id] ?? null;

  return (
    <div className="pb-24 lg:pb-10">
      <BusinessCover
        hue={business.brandHue}
        sector={business.category.sector}
        src={business.coverUrl}
        name={business.name}
        rounded=""
        className="h-40 sm:h-56"
      />

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Kapağın mutlak konumlu katmanları, kartın üstüne taşmasın diye kart da
            konumlandırılır: aynı yığın katmanında sonra gelen kazanır. */}
        <div className="relative -mt-8 rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="blue">
                  {SECTOR_LABEL[business.category.sector as Sector] ?? business.category.name}
                </Badge>
                {business.featured ? <Badge tone="neutral">Öne çıkan</Badge> : null}
                <span className="tnum text-[13px] text-ink-3">{priceLevel(business.priceLevel)}</span>
              </div>
              <h1 className="mt-2 text-[22px] font-semibold tracking-[-0.02em] sm:text-[28px]">
                {business.name}
              </h1>
              <p className="mt-1 text-[14px] text-ink-2">{business.tagline}</p>

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-ink-2">
                {business.ratingCount > 0 ? (
                  <Rating value={business.ratingAvg} count={business.ratingCount} />
                ) : (
                  <span className="text-ink-3">Henüz değerlendirilmedi</span>
                )}
                <span className="inline-flex items-center gap-1">
                  <MapPin size={14} className="text-ink-3" aria-hidden />
                  {primary ? `${primary.district}, ${primary.city}` : 'Ankara'}
                </span>
                {business._count.reservations > 0 ? (
                  <span className="tnum text-ink-3">
                    {business._count.reservations} tamamlanan randevu
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex w-full gap-2 sm:w-auto">
              <FavoriteButton
                businessId={business.id}
                initial={favorite}
                loggedIn={Boolean(user)}
                label
                className="flex-1 sm:flex-none"
              />
              <Button asChild size="md" className="hidden flex-1 sm:inline-flex">
                <Link href={`/isletme/${business.slug}/randevu`}>
                  <CalendarPlus size={17} aria-hidden />
                  Randevu al
                </Link>
              </Button>
            </div>
          </div>

          {next ? (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-success-line bg-success-soft px-3.5 py-2.5 text-[13.5px] text-success">
              <Clock3 size={16} aria-hidden />
              En yakın uygun saat:{' '}
              <span className="font-semibold">
                {relativeDay(next.date)} {hhmm(next.startMin)}
              </span>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-line bg-sunken px-3.5 py-2.5 text-[13.5px] text-ink-3">
              Önümüzdeki 5 gün için uygun saat görünmüyor. Takvimden ileri tarihlere bakabilirsiniz.
            </div>
          )}

          {business.promotions.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {business.promotions.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-3.5 py-2.5 text-[13.5px] text-brand-700"
                >
                  <span className="font-semibold">{p.title}</span>
                  <span className="text-brand-600">·</span>
                  <span>
                    Kod: <span className="font-mono font-semibold">{p.code}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <BusinessGallery
          images={business.images.map((i) => ({ id: i.id, url: i.url, caption: i.caption }))}
        />

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="min-w-0 space-y-6">
            <section aria-labelledby="hizmetler">
              <h2 id="hizmetler" className="section-title">
                {terms.services}
              </h2>
              <ul className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
                {business.services.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-[14.5px] font-medium text-navy">{s.name}</p>
                      {s.description ? (
                        <p className="mt-0.5 line-clamp-1 text-[13px] text-ink-3">{s.description}</p>
                      ) : null}
                      <p className="tnum mt-1 text-[12.5px] text-ink-3">{duration(s.durationMin)}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="tnum text-[15px] font-semibold text-navy">
                        {s.price === 0 ? 'Ücretsiz' : money(s.price)}
                      </p>
                      <Button asChild size="sm" variant="soft" className="mt-1.5">
                        <Link href={`/isletme/${business.slug}/randevu?hizmet=${s.id}`}>Seç</Link>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section aria-labelledby="ekip">
              <h2 id="ekip" className="section-title">
                {terms.resourcePlural}
              </h2>
              <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                {business.staff.map((s) => (
                  <li key={s.id} className="card flex gap-3 p-4">
                    <Avatar name={s.displayName} size={44} hue={s.hue} src={s.avatarUrl} />
                    <div className="min-w-0">
                      <p className="text-[14.5px] font-medium text-navy">{s.displayName}</p>
                      <p className="text-[12.5px] text-brand-600">{s.title}</p>
                      {s.bio ? (
                        <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-ink-3">{s.bio}</p>
                      ) : null}
                      <p className="mt-1.5 text-[12px] text-ink-3">
                        {s.services.length} seçenek
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section aria-labelledby="hakkinda">
              <h2 id="hakkinda" className="section-title">
                Hakkında
              </h2>
              <div className="card mt-3 p-4 sm:p-5">
                <p className="whitespace-pre-line text-[14px] leading-relaxed text-ink-2">
                  {business.about}
                </p>
                {amenities.length > 0 ? (
                  <ul className="mt-4 flex flex-wrap gap-2">
                    {amenities.map((a) => (
                      <li
                        key={a}
                        className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-sunken px-3 py-1.5 text-[12.5px] text-ink-2"
                      >
                        <Check size={13} className="text-success" aria-hidden />
                        {a}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </section>

            <section aria-labelledby="yorumlar">
              <h2 id="yorumlar" className="section-title">
                Değerlendirmeler
              </h2>
              {business.reviews.length === 0 ? (
                <EmptyState
                  className="mt-3"
                  icon={<MessageSquareQuote size={20} />}
                  title="Henüz değerlendirme yok"
                  description="Randevunuz tamamlandığında ilk değerlendirmeyi siz yazabilirsiniz."
                />
              ) : (
                <ul className="mt-3 space-y-3">
                  {business.reviews.map((r) => (
                    <li key={r.id} className="card p-4">
                      <div className="flex items-center gap-3">
                        <Avatar name={r.user.name} size={36} hue={Number(r.user.avatarSeed) * 37} />
                        <div className="min-w-0 flex-1">
                          <p className="text-[14px] font-medium text-navy">{r.user.name}</p>
                          <p className="text-[12px] text-ink-3">{ago(r.createdAt)}</p>
                        </div>
                        <Rating value={r.rating} showValue={false} size={15} />
                      </div>
                      {r.comment ? (
                        <p className="mt-2.5 text-[14px] leading-relaxed text-ink-2">{r.comment}</p>
                      ) : null}
                      {r.reply ? (
                        <div className="mt-3 rounded-xl border-l-2 border-brand-300 bg-brand-50/60 px-3.5 py-2.5">
                          <p className="text-[12.5px] font-medium text-brand-700">İşletme yanıtı</p>
                          <p className="mt-0.5 text-[13.5px] text-ink-2">{r.reply}</p>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <aside className="space-y-4">
            <div className="card p-4 sm:p-5">
              <h2 className="text-[15px] font-semibold text-navy">Çalışma saatleri</h2>
              <ul className="mt-3 space-y-1.5">
                {(primary?.hours ?? []).map((h) => (
                  <li key={h.id} className="flex justify-between text-[13.5px]">
                    <span className="text-ink-2">{WEEKDAYS[h.weekday]}</span>
                    <span className={h.closed ? 'text-ink-3' : 'tnum font-medium text-navy'}>
                      {h.closed ? 'Kapalı' : `${hhmm(h.openMin)} – ${hhmm(h.closeMin)}`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="card p-4 sm:p-5">
              <h2 className="text-[15px] font-semibold text-navy">
                {business.branches.length > 1 ? `Şubeler (${business.branches.length})` : 'Adres'}
              </h2>
              <ul className="mt-3 space-y-3">
                {business.branches.map((b) => (
                  <li key={b.id} className="text-[13.5px]">
                    <p className="font-medium text-navy">{b.name}</p>
                    <p className="mt-0.5 text-ink-3">{b.address}</p>
                    {b.phone ? (
                      <a
                        href={`tel:${b.phone}`}
                        className="mt-1 inline-flex items-center gap-1.5 text-brand-600 hover:underline"
                      >
                        <Phone size={13} aria-hidden />
                        {fmtPhone(b.phone)}
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
              {business.website ? (
                <a
                  href={business.website}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-3 inline-flex items-center gap-1.5 text-[13.5px] text-brand-600 hover:underline"
                >
                  <Globe size={14} aria-hidden />
                  Web sitesi
                </a>
              ) : null}
            </div>
          </aside>
        </div>
      </div>

      {/* Mobilde her zaman erişilebilir birincil eylem. */}
      <div className="fixed inset-x-0 bottom-[var(--tabbar-h)] z-30 border-t border-line bg-surface/95 p-3 backdrop-blur sm:hidden">
        <Button asChild size="lg" full>
          <Link href={`/isletme/${business.slug}/randevu`}>
            <CalendarPlus size={18} aria-hidden />
            Randevu al
          </Link>
        </Button>
      </div>
    </div>
  );
}
