import 'server-only';
import { prisma } from '@/lib/db';
import { ACTIVE_STATUSES, SLOT_STEP_MIN } from '@/lib/constants';
import { computeSlots, type StaffAvailability, type Interval } from '@/lib/availability';
import { today, nowMinutes, weekdayOf, addDays, zonedToUtc } from '@/lib/time';
import { timeOffToInterval, ONLINE_LEAD_MIN } from './schedule';

export type NextSlot = { date: string; startMin: number } | null;

/**
 * Listelenen işletmeler için "en yakın uygun saat".
 *
 * Kart başına ayrı sorgu atmak yerine tüm veri üç sorguda toplanır ve
 * uygunluk bellekte hesaplanır; böylece liste sayfası N+1'e düşmez.
 */
export async function nextAvailableSlots(
  businessIds: string[],
  days = 3,
): Promise<Record<string, NextSlot>> {
  // Kart başına denenecek hizmet sayısı. Tamamını denemek 120 işletmede
// gereksiz iş; en kısa beşi pratikte "bu işletmede saat var mı" sorusunu
// cevaplıyor.
const HIZMET_DENEME = 5;

const out: Record<string, NextSlot> = {};
  if (businessIds.length === 0) return out;

  const start = today();
  const dates = Array.from({ length: days }, (_, i) => addDays(start, i));
  const lastDate = dates[dates.length - 1]!;

  const [branches, staff, services] = await Promise.all([
    prisma.branch.findMany({
      where: { businessId: { in: businessIds }, active: true },
      select: {
        id: true,
        businessId: true,
        hours: true,
        // ŞUBE TATİLLERİ. Randevu ekranındaki uygunluk motoru (schedule.ts)
        // bunları okuyor, kartlardaki "bugün müsait" hesabı okumuyordu: iki
        // ekran aynı işletme için farklı cevap veriyordu. Kartta müsait
        // görünen işletmeye tıklayınca hiç saat çıkmıyordu.
        timeOff: {
          where: { startsAt: { lte: zonedToUtc(lastDate, 1440) }, endsAt: { gte: zonedToUtc(start, 0) } },
          select: { startsAt: true, endsAt: true },
        },
      },
    }),
    prisma.staffMember.findMany({
      where: { businessId: { in: businessIds }, active: true },
      select: {
        id: true,
        businessId: true,
        branchId: true,
        hours: true,
        breaks: true,
        timeOff: {
          where: { startsAt: { lte: zonedToUtc(lastDate, 1440) }, endsAt: { gte: zonedToUtc(start, 0) } },
          select: { startsAt: true, endsAt: true },
        },
        services: { select: { serviceId: true } },
        reservations: {
          where: { date: { in: dates }, status: { in: [...ACTIVE_STATUSES] } },
          select: { date: true, startMin: true, blockEnd: true },
        },
      },
    }),
    prisma.service.findMany({
      where: { businessId: { in: businessIds }, active: true },
      select: { id: true, businessId: true, durationMin: true, bufferMin: true },
      orderBy: { durationMin: 'asc' },
    }),
  ]);

  const nowMin = nowMinutes();


  for (const businessId of businessIds) {
    // HİZMETLER SIRAYLA DENENİYOR, yalnızca en kısası değil.
    //
    // Önceden yalnızca en kısa süreli hizmet bakılıyordu. O hizmeti verebilen
    // personel yoksa `members` boş kalıyor ve işletme "müsait değil" sayılıyordu
    // — başka hizmetlerinde bol saat olsa bile. En kısadan başlamak yine doğru
    // (en kolay sığan), ama tek deneme olmamalı.
    const bizServices = services.filter((s) => s.businessId === businessId).slice(0, HIZMET_DENEME);
    const bizBranches = branches.filter((b) => b.businessId === businessId);
    if (bizServices.length === 0 || bizBranches.length === 0) {
      out[businessId] = null;
      continue;
    }

    let found: NextSlot = null;
    for (const date of dates) {
      const weekday = weekdayOf(date);
      for (const branch of bizBranches) {
        const bh = branch.hours.find((h) => h.weekday === weekday);
        if (!bh || bh.closed) continue;
        // Şube kapanışları personel izniymiş gibi uygulanıyor — schedule.ts
        // ile aynı yöntem, aynı sonuç.
        const branchClosures = branch.timeOff
          .map((t) => timeOffToInterval(date, t.startsAt, t.endsAt))
          .filter((x): x is Interval => x !== null);
        for (const service of bizServices) {
        const members: StaffAvailability[] = staff
          .filter(
            (s) =>
              s.businessId === businessId &&
              (s.branchId === branch.id || s.branchId === null) &&
              s.services.some((x) => x.serviceId === service.id),
          )
          .map((s) => {
            const h = s.hours.find((x) => x.weekday === weekday);
            const off = s.timeOff
              .map((t) => timeOffToInterval(date, t.startsAt, t.endsAt))
              .filter((x): x is Interval => x !== null);
            return {
              staffId: s.id,
              hours: h && !h.closed ? { startMin: h.startMin, endMin: h.endMin } : null,
              breaks: s.breaks.filter((b) => b.weekday === weekday).map((b) => ({ startMin: b.startMin, endMin: b.endMin })),
              timeOff: [...off, ...branchClosures],
              booked: s.reservations
                .filter((r) => r.date === date)
                .map((r) => ({ startMin: r.startMin, endMin: r.blockEnd })),
            };
          });
        if (members.length === 0) continue;
        const slots = computeSlots({
          branchHours: { startMin: bh.openMin, endMin: bh.closeMin },
          service: { durationMin: service.durationMin, bufferMin: service.bufferMin },
          staff: members,
          stepMin: SLOT_STEP_MIN,
          minLeadMin: ONLINE_LEAD_MIN,
          nowMin: date === start ? nowMin : null,
        });
        const first = slots[0];
        if (first && (!found || first.startMin < found.startMin)) {
          found = { date, startMin: first.startMin };
        }
        }
      }
      if (found) break;
    }
    out[businessId] = found;
  }

  return out;
}

export type BusinessFilters = {
  q?: string | undefined;
  category?: string | undefined;
  district?: string | undefined;
  city?: string | undefined;
  minRating?: number | undefined;
  maxPriceLevel?: number | undefined;
  availableToday?: boolean | undefined;
  sort?: 'onerilen' | 'puan' | 'fiyat' | 'yeni' | undefined;
};

export type BusinessCardData = Awaited<ReturnType<typeof searchBusinesses>>['items'][number];

/** Keşfet ve kategori listelerinin tek veri kaynağı. */
/**
 * Vitrin araması.
 *
 * `skip` sayfalama için: katalog 120 işletmeye çıkınca sabit 24'lük kesit,
 * geri kalan 96 işletmeyi hiçbir müşterinin ulaşamayacağı hâle getiriyordu.
 * Kayıt vardı, fotoğrafı vardı, menüsü vardı ama keşfetten görünmüyordu.
 */
export async function searchBusinesses(filters: BusinessFilters, take = 24, skip = 0) {
  const q = filters.q?.trim();
  const rows = await prisma.business.findMany({
    where: {
      status: 'APPROVED',
      ...(filters.category ? { category: { slug: filters.category } } : {}),
      ...(filters.minRating ? { ratingAvg: { gte: filters.minRating } } : {}),
      ...(filters.maxPriceLevel ? { priceLevel: { lte: filters.maxPriceLevel } } : {}),
      ...(filters.district || filters.city
        ? {
            branches: {
              some: {
                active: true,
                ...(filters.district ? { district: filters.district } : {}),
                ...(filters.city ? { city: filters.city } : {}),
              },
            },
          }
        : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { tagline: { contains: q } },
              { about: { contains: q } },
              { category: { name: { contains: q } } },
              { services: { some: { name: { contains: q }, active: true } } },
              { branches: { some: { district: { contains: q } } } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      slug: true,
      name: true,
      tagline: true,
      brandHue: true,
      priceLevel: true,
      ratingAvg: true,
      ratingCount: true,
      featured: true,
      coverUrl: true,
      createdAt: true,
      category: { select: { name: true, slug: true, sector: true } },
      branches: {
        where: { active: true },
        select: { district: true, city: true, isPrimary: true },
        orderBy: { isPrimary: 'desc' },
      },
      services: {
        where: { active: true },
        select: { price: true, name: true },
        orderBy: { price: 'asc' },
        take: 3,
      },
      _count: { select: { branches: { where: { active: true } } } },
    },
    // SIRALAMA SORGUDA. Fiyat sıralaması eskiden sayfa çekildikten sonra
    // bellekte yapılıyordu; en ucuz işletme sonraki sayfada kalabiliyordu.
    // Her sıralamanın sonunda `id` var: eşit değerlerde sayfalar arası sıra
    // kaymasın diye kararlı bir ikinci anahtar.
    orderBy:
      filters.sort === 'puan'
        ? [{ ratingAvg: 'desc' }, { ratingCount: 'desc' }, { id: 'asc' }]
        : filters.sort === 'yeni'
          ? [{ createdAt: 'desc' }, { id: 'asc' }]
          : filters.sort === 'fiyat'
            ? [{ minPrice: 'asc' }, { id: 'asc' }]
            : [{ featured: 'desc' }, { ratingAvg: 'desc' }, { id: 'asc' }],
    take: take + 1, // bir fazlası: "daha var mı" sorusunu ek sorgu olmadan cevaplar
    skip,
  });

  const dahaVar = rows.length > take;
  const sayfa = dahaVar ? rows.slice(0, take) : rows;
  const availability = await nextAvailableSlots(sayfa.map((r) => r.id), filters.availableToday ? 1 : 3);
  let items = sayfa.map((r) => ({ ...r, nextSlot: availability[r.id] ?? null }));

  if (filters.availableToday) {
    const t = today();
    items = items.filter((i) => i.nextSlot?.date === t);
  }
  // `dahaVar` filtrelemeden ÖNCEki sayıdan geliyor: "bugün müsait" filtresi
  // bu sayfadaki her kaydı elese bile sonraki sayfada uygun kayıt olabilir.
  return { items, total: items.length, dahaVar };
}
