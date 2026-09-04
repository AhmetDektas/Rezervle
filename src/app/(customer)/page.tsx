import { Suspense } from 'react';
import Link from 'next/link';
import { CalendarCheck, ShieldCheck, Zap, MapPin } from 'lucide-react';
import { prisma } from '@/lib/db';
import { searchBusinesses } from '@/server/discovery';
import { BusinessCard } from '@/components/business/card';
import { CategoryRail } from '@/components/business/category-rail';
import { Section } from '@/components/shell/section';
import { SearchInput } from '@/components/shell/search-input';
import { SkeletonCards } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ANKARA_DISTRICTS } from '@/lib/constants';

export const dynamic = 'force-dynamic';

async function Categories() {
  const rows = await prisma.businessCategory.findMany({
    where: { active: true },
    orderBy: { sortOrder: 'asc' },
    select: {
      slug: true, name: true, sector: true, blurb: true,
      _count: { select: { businesses: { where: { status: 'APPROVED' } } } },
    },
  });
  return (
    <CategoryRail
      categories={rows.map((r) => ({ slug: r.slug, name: r.name, sector: r.sector, blurb: r.blurb, count: r._count.businesses }))}
    />
  );
}

/**
 * Ana sayfanın üç keşif bölümü tek yerde kurulur.
 *
 * Üç bölüm ayrı ayrı sorgulandığında aynı işletmeler tekrar tekrar çıkıyordu
 * (bir işletme üç bölümde birden görünebiliyordu), çünkü "Bugün müsait" ve
 * "Öne çıkanlar" aynı sıralamayı kullanıyor. On üç kartın beşi tekrardı; bu,
 * kataloğu olduğundan küçük gösteriyor ve üç bölümü tek bir uzun listeye
 * çeviriyordu.
 *
 * Tekrar ayıklaması sıraya bağlı: "Bugün müsait" ve "En yüksek puanlılar"
 * mutlak iddialar taşır (gerçekten bugün müsait / gerçekten en yüksek puanlı),
 * bu yüzden kendi listelerini korurlar. Genel olan "Öne çıkanlar" ise
 * diğerlerinde görünenleri atlar.
 */
async function Discovery() {
  const [today, top, featured] = await Promise.all([
    searchBusinesses({ availableToday: true, sort: 'onerilen' }, 12),
    searchBusinesses({ sort: 'puan' }, 3),
    searchBusinesses({ sort: 'onerilen' }, 24),
  ]);

  const todayItems = today.items.slice(0, 6);
  const topItems = top.items;
  const shown = new Set([...todayItems, ...topItems].map((b) => b.id));
  const featuredItems = featured.items.filter((b) => !shown.has(b.id)).slice(0, 6);

  return (
    <>
      <Section
        title="Bugün müsait"
        description="Bugün içinde randevu verilebilen işletmeler"
        href="/kesfet?bugun=1"
      >
        {todayItems.length === 0 ? (
          <p className="card p-5 text-[14px] text-ink-3">
            Bugün için uygun saat kalmadı. Yarının saatlerine{' '}
            <Link href="/kesfet" className="font-medium text-brand-600 hover:underline">buradan</Link>{' '}
            bakabilirsiniz.
          </p>
        ) : (
          <ul className="rail lg:grid lg:grid-cols-3 lg:gap-4">
            {todayItems.map((b) => (
              <li key={b.id} className="w-[85%] shrink-0 snap-start sm:w-[46%] lg:w-auto">
                <BusinessCard business={b} className="h-full" />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title="En yüksek puanlılar"
        description="Müşteri değerlendirmelerine göre"
        href="/kesfet?sirala=puan"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {topItems.map((b) => <BusinessCard key={b.id} business={b} />)}
        </div>
      </Section>

      {featuredItems.length > 0 ? (
        <Section
          title="Keşfetmediklerin"
          description="Yukarıdakilerin dışında, Ankara’da randevu alabileceğin işletmeler"
          href="/kesfet"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featuredItems.map((b) => <BusinessCard key={b.id} business={b} />)}
          </div>
        </Section>
      ) : null}
    </>
  );
}

export default function HomePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-10 sm:px-6">
      <section className="relative -mx-4 overflow-hidden bg-navy px-4 pb-8 pt-9 sm:-mx-6 sm:rounded-b-3xl sm:px-8 sm:pb-10 sm:pt-12">
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(700px 380px at 85% -10%, rgba(23,107,255,.65), transparent 62%), radial-gradient(600px 400px at 0% 110%, rgba(59,133,255,.30), transparent 60%)',
          }}
        />
        <div className="relative">
          <h1 className="max-w-lg text-[26px] font-semibold leading-[1.15] tracking-[-0.025em] text-white sm:text-[36px]">
            Randevunu al, telefonla uğraşma.
          </h1>
          <p className="mt-2.5 max-w-md text-[14.5px] leading-relaxed text-white/70 sm:text-[16px]">
            Ankara’daki diş, güzellik ve estetik işletmelerinin gerçek boş saatlerini
            gör; seçtiğin an sana ayrılsın.
          </p>

          <div className="mt-5 max-w-xl">
            <Suspense fallback={<div className="h-12 rounded-xl bg-white/10" />}>
              <SearchInput size="lg" autoFocus={false} placeholder="Diş hekimi, saç kesimi, Çankaya…" />
            </Suspense>
          </div>

          <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            <span className="inline-flex shrink-0 items-center gap-1 text-[12.5px] text-white/60">
              <MapPin size={14} aria-hidden />
              Semt:
            </span>
            {ANKARA_DISTRICTS.slice(0, 6).map((d) => (
              <Link
                key={d}
                href={`/kesfet?ilce=${encodeURIComponent(d)}`}
                className="shrink-0 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[13px] font-medium text-white/90 transition hover:bg-white/20"
              >
                {d}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <div className="mt-7">
        <Section title="Ne arıyorsunuz?" description="Kategoriye göre işletmeleri keşfedin">
          <Suspense fallback={<div className="h-24 skeleton" />}>
            <Categories />
          </Suspense>
        </Section>

        <Suspense fallback={<SkeletonCards count={6} />}>
          <Discovery />
        </Suspense>

        <section className="mt-10 rounded-2xl border border-line bg-surface p-5 sm:p-7">
          <h2 className="section-title">Rezzerv nasıl çalışır?</h2>
          <ol className="mt-4 grid gap-4 sm:grid-cols-3">
            {[
              { icon: Zap, title: 'Gerçek boş saati gör', body: 'Saatler işletmenin takviminden canlı okunur; “arayıp soralım” yok.' },
              { icon: CalendarCheck, title: 'Saniyeler içinde onayla', body: 'Hizmeti, personeli ve saati seç; randevu anında oluşur.' },
              { icon: ShieldCheck, title: 'Çakışma olmaz', body: 'Seçtiğin an sana ayrılır. Aynı saate ikinci kayıt açılamaz.' },
            ].map((s) => (
              <li key={s.title} className="flex gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <s.icon size={19} aria-hidden />
                </span>
                <div>
                  <p className="text-[14.5px] font-semibold text-navy">{s.title}</p>
                  <p className="mt-0.5 text-[13.5px] leading-relaxed text-ink-3">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button asChild><Link href="/kesfet">İşletmeleri keşfet</Link></Button>
            <Button asChild variant="secondary"><Link href="/panel">İşletme misiniz?</Link></Button>
          </div>
        </section>
      </div>
    </div>
  );
}
