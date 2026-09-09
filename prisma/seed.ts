/**
 * Rezzerv tohum verisi.
 *
 * Deterministik: aynı tohum aynı veriyi üretir, böylece ekran görüntüleri ve
 * uçtan uca testler kararlı kalır. Randevular çakışma kurallarına uyularak
 * üretilir — uygulamanın kendi motoruyla aynı mantık kullanılır.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { BUSINESSES, CATEGORIES, CUSTOMER_NAMES, REVIEW_TEXTS, gorselSeti } from './seed-data';
// İkinci dalga işletmeler ve restorana özel menüler. Import'un yan etkisi
// BUSINESSES dizisini büyütmek; bu yüzden BUSINESSES okunmadan ÖNCE gelmeli.
import { MENULER } from './seed-data-wave2';
// Katalog: her sektörü 20 işletmeye tamamlıyor. Yan etkisi BUSINESSES'ı
// büyütmek, bu yüzden dizi okunmadan ÖNCE import edilmeli.
import './seed-catalog';
import { MUTFAK_MENULERI, RESTORAN_MUTFAK } from './seed-menus';
import { depositFor, type DepositPolicy } from '../src/lib/deposit';
import { CONSENT_KINDS, CONSENT_VERSION, termsFor } from '../src/lib/constants';
import { subeKoordinat } from './seed-data';
import { PLANS } from '../src/lib/plans';
import { bookingTotals } from '../src/lib/services';
import { kesilecekDonem, ayEkle, gunEkle, ODEME_VADESI_GUN } from '../src/lib/subscription';

const prisma = new PrismaClient();

export const DEMO_PASSWORD = 'Rezzerv123';

// --- deterministik rastgelelik -----------------------------------------
let state = 20260904;
function rnd(): number {
  state |= 0;
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)] as T;
const int = (min: number, max: number): number => min + Math.floor(rnd() * (max - min + 1));
const chance = (p: number): boolean => rnd() < p;

// --- tarih yardımcıları (tohum içinde bağımsız tutulur) ------------------
const TZ = 'Europe/Istanbul';
function todayStr(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
}
function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y!, m! - 1, d! + days));
  return t.toISOString().slice(0, 10);
}
function weekdayOf(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
}
/** Yerel gün + dakika → UTC anı (Türkiye UTC+3, yaz saati uygulaması yok). */
function toUtc(date: string, minutes: number): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!, Math.floor(minutes / 60), minutes % 60) - 3 * 3600_000);
}
/**
 * Rezervasyon kodu. İlk iki karakter rastgele, son üçü sıra numarasının
 * base32 karşılığıdır: kod rastgele görünür ama tohum içinde asla çakışmaz
 * (uygulama içinde kod üretimi ayrıdır ve benzersizlik kısıtıyla korunur).
 */
const CODE_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
let codeSeq = 0;
function code(): string {
  const n = codeSeq++;
  let tail = '';
  for (let i = 2; i >= 0; i--) tail += CODE_ABC[(n >> (i * 5)) & 31];
  const head =
    CODE_ABC[Math.floor(rnd() * CODE_ABC.length)]! + CODE_ABC[Math.floor(rnd() * CODE_ABC.length)]!;
  return `RZ-${head}${tail}`;
}
function slugName(name: string): string {
  const map: Record<string, string> = { ı: 'i', İ: 'i', ş: 's', Ş: 's', ğ: 'g', Ğ: 'g', ü: 'u', Ü: 'u', ö: 'o', Ö: 'o', ç: 'c', Ç: 'c' };
  return name.split('').map((c) => map[c] ?? c).join('').toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '');
}

async function reset(): Promise<void> {
  // Sıra önemli: alt kayıtlar önce silinir (SQLite'ta cascade kapalı olabilir).
  await prisma.$transaction([
    prisma.reservationStatusHistory.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.review.deleteMany(),
    prisma.reservation.deleteMany(),
    prisma.customerTagLink.deleteMany(),
    prisma.customerTag.deleteMany(),
    prisma.customerNote.deleteMany(),
    prisma.favorite.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.promotion.deleteMany(),
    prisma.staffService.deleteMany(),
    prisma.staffBreak.deleteMany(),
    prisma.staffHour.deleteMany(),
    prisma.timeOff.deleteMany(),
    prisma.staffMember.deleteMany(),
    prisma.service.deleteMany(),
    prisma.branchHour.deleteMany(),
    prisma.branch.deleteMany(),
    prisma.businessImage.deleteMany(),
    prisma.businessStatusHistory.deleteMany(),
    prisma.business.deleteMany(),
    prisma.businessCategory.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.petProfile.deleteMany(),
    prisma.customerProfile.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}

/**
 * Şube saatleri sektöre göre değişir: klinik hafta içi mesai saatleri içinde
 * çalışır, halı saha gece yarısına kadar açıktır, restoran öğlen açılır.
 */
function branchHours(
  weekday: number,
  sector: string,
): { openMin: number; closeMin: number; closed: boolean } {
  if (sector === 'PITCH') return { openMin: 540, closeMin: 1440, closed: false };
  if (sector === 'RESTAURANT') return { openMin: 720, closeMin: 1410, closed: false };
  if (weekday === 0) return { openMin: 0, closeMin: 0, closed: true };
  if (weekday === 6) return { openMin: 600, closeMin: 1020, closed: false };
  return { openMin: 540, closeMin: 1140, closed: false };
}

/** Öğle molası yalnızca kişi bazlı sektörlerde anlamlıdır. */
function hasLunchBreak(sector: string): boolean {
  return sector !== 'PITCH' && sector !== 'RESTAURANT';
}

/** Personel hesabı yalnızca gerçekten kişi olan kaynaklar için açılır. */
function staffIsPerson(sector: string): boolean {
  return sector !== 'PITCH' && sector !== 'RESTAURANT';
}

/**
 * Tohum aboneliği.
 *
 * Dağılım kasıtlı: çoğunluk denemede (yeni platform), bir kısmı ödeyen,
 * birkaçı gecikmiş. Hepsi ACTIVE olsaydı deneme sayacı ve gecikme uyarısı
 * hiçbir ekranda görünmezdi.
 *
 * **Yalnızca abonelik alanlarını döndürür.** Bir önceki hâli `depositAddon`'u
 * da yazıyordu ve `b.deposit` ayarlarının ÜSTÜNE biniyordu: kapora paketi açık
 * olması gereken işletmeler (Estetika, Balıkçı) paketleri kapora içermediği
 * için sessizce eklentisiz kalıyor, kapora testleri düşüyordu. Paketin
 * eklentiyi açması gerçek kayıt akışının işi (`choosePlanAction`); tohumun
 * kendi kapora kurgusunu ezmesi için bir sebep yok.
 */
function abonelik(sira: number, today: string) {
  const plan = PLANS[sira % PLANS.length]!;
  const kalip = sira % 5;
  if (kalip === 0) {
    return {
      planKey: plan.key, planPrice: plan.price, planStatus: 'ACTIVE',
      trialEndsAt: toUtc(addDays(today, -60), 0),
      currentPeriodEnd: toUtc(addDays(today, 20), 0),
    };
  }
  if (kalip === 1) {
    return {
      planKey: plan.key, planPrice: plan.price, planStatus: 'PAST_DUE',
      trialEndsAt: toUtc(addDays(today, -95), 0),
      currentPeriodEnd: toUtc(addDays(today, -6), 0),
    };
  }
  // Denemede: bitişe kalan gün sayısı değişiyor ki uyarı eşikleri görünsün.
  const kalan = [3, 11, 45][kalip - 2] ?? 30;
  return {
    planKey: plan.key,
    planPrice: kalip === 2 ? 0 : plan.price, // biri paket seçmemiş
    planStatus: 'TRIAL',
    trialEndsAt: toUtc(addDays(today, kalan), 0),
  };
}

/**
 * Kampanya kodu: okunabilir ve tekil.
 *
 * Slug'ın ilk dört harfi 120 işletmede tekrar ediyor (P2002). İlk çözümüm
 * koda dizi sırasını eklemekti ama bu kodu BUSINESSES dizisindeki konuma
 * bağladı: diziye bir işletme eklendiğinde sonrakilerin kodu değişti ve
 * `ESTE15`'i sabit yazan regresyon testi düştü.
 *
 * Bunun yerine kullanılmış kodlar izleniyor: ilk gelen `ESTE15` alıyor,
 * sonrakiler `ESTE15B`, `ESTE15C` diye ilerliyor. Kod artık işletmenin kendi
 * adına bağlı ve listeye başkası eklenince değişmiyor.
 */
const kullanilanKodlar = new Set<string>();

function kampanyaKodu(slug: string): string {
  const taban = `${slug.slice(0, 4).toUpperCase()}15`;
  if (!kullanilanKodlar.has(taban)) {
    kullanilanKodlar.add(taban);
    return taban;
  }
  for (let i = 1; i < 26; i++) {
    const aday = `${taban}${String.fromCharCode(65 + i)}`; // B, C, D...
    if (!kullanilanKodlar.has(aday)) {
      kullanilanKodlar.add(aday);
      return aday;
    }
  }
  // 26 aynı önekli işletme gerçekçi değil ama sessizce çakışmaktansa patlasın.
  throw new Error(`Kampanya kodu üretilemedi: ${slug}`);
}

async function main(): Promise<void> {
  console.log('Tohum verisi hazırlanıyor…');
  await reset();
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const categories = new Map<string, string>();
  for (const c of CATEGORIES) {
    const row = await prisma.businessCategory.create({
      data: { slug: c.slug, name: c.name, sector: c.sector, icon: c.icon, blurb: c.blurb, sortOrder: c.sortOrder },
    });
    categories.set(c.sector, row.id);
  }

  const admin = await prisma.user.create({
    data: { email: 'admin@rezzerv.com', passwordHash, name: 'Rezzerv Yönetici', role: 'ADMIN', phone: '5320000000', avatarSeed: '12' },
  });

  // Demo müşteri hesabı — README'de paylaşılan giriş.
  const demoCustomer = await prisma.user.create({
    data: {
      email: 'demo@rezzerv.com',
      passwordHash,
      name: 'Elif Yıldırım',
      role: 'CUSTOMER',
      phone: '5321112233',
      avatarSeed: '3',
      customerProfile: { create: { city: 'Ankara', district: 'Çankaya' } },
    },
  });

  const customers = [demoCustomer];
  for (let i = 1; i < CUSTOMER_NAMES.length; i++) {
    const name = CUSTOMER_NAMES[i]!;
    customers.push(
      await prisma.user.create({
        data: {
          email: `${slugName(name)}@ornek.com`,
          passwordHash,
          name,
          role: 'CUSTOMER',
          phone: `5${int(30, 59)}${int(1000000, 9999999)}`,
          avatarSeed: String(i),
          customerProfile: { create: { city: 'Ankara', district: pick(['Çankaya', 'Keçiören', 'Yenimahalle', 'Mamak', 'Etimesgut']) } },
        },
      }),
    );
  }
  console.log(`  ${customers.length} müşteri hesabı`);

  const today = todayStr();
  const START = -45; // geçmiş gün sayısı
  const END = 14; // ileri gün sayısı

  type ResRow = {
    id: string; code: string; businessId: string; branchId: string; serviceId: string;
    staffId: string; customerId: string; createdById: string; date: string; startMin: number;
    endMin: number; blockEnd: number; startsAt: Date; endsAt: Date; status: string;
    channel: string; price: number; discount: number; finalPrice: number;
    note: string | null; slotKey: string | null; createdAt: Date;
    depositAmount: number; depositStatus: string;
  };
  const reservations: ResRow[] = [];
  /** Randevu kalemleri; randevularla aynı turda üretilir. */
  const reservationLines: {
    reservationId: string; serviceId: string; sortOrder: number;
    name: string; durationMin: number; bufferMin: number; price: number;
  }[] = [];
  let staffAccounts = 0;

  for (const b of BUSINESSES) {
    const owner = await prisma.user.create({
      data: { email: b.owner.email, passwordHash, name: b.owner.name, role: 'OWNER', phone: `5${int(30, 59)}${int(1000000, 9999999)}`, avatarSeed: String(int(0, 20)) },
    });

    const status = b.status ?? 'APPROVED';
    // Sıraya göre havuzdan farklı set: aynı fotoğrafın on kartta
    // tekrarlanması stok görsel kullandığımızı en çok belli eden şey.
    const gorsel = gorselSeti(b.sector, BUSINESSES.indexOf(b));
    const business = await prisma.business.create({
      data: {
        slug: b.slug, name: b.name, categoryId: categories.get(b.sector)!, ownerId: owner.id,
        tagline: b.tagline, about: b.about, brandHue: b.hue, priceLevel: b.priceLevel,
        amenities: JSON.stringify(b.amenities), status, featured: b.featured,
        ...(b.deposit
          ? {
              depositAddon: b.deposit.addon,
              depositEnabled: b.deposit.enabled,
              depositKind: b.deposit.kind,
              depositValue: b.deposit.value,
              depositMinPrice: b.deposit.minPrice,
              depositRefundHours: b.deposit.refundHours,
              // Pazaryeri tahsilatı: alt üye işyeri ve hak ediş bilgileri.
              commissionRate: 30,
              subMerchantKey: `sub_${b.slug.slice(0, 12)}`,
              payoutTitle: `${b.name} Ltd. Şti.`,
              payoutIban: `TR${String(330006100519786457841 + b.hue).slice(0, 24)}`,
              taxNumber: String(1000000000 + b.hue * 7919),
            }
          : {}),
        // Abonelik: tohum işletmeleri gerçekçi bir karışım taşıyor —
        // ödeyenler, denemede olanlar, ödemesi gecikenler. Hepsi aynı durumda
        // olsaydı deneme sayacı ve gecikme uyarısı hiçbir ekranda görünmezdi.
        ...abonelik(BUSINESSES.indexOf(b), today),
        phone: b.branches[0]!.phone, email: b.owner.email,
        website: `https://www.${b.slug.replace(/-/g, '')}.com`,
        coverUrl: gorsel.cover,
      },
    });

    // Galeri: kapak dışındaki görseller. Yüklenemezse arayüz gradient'e
    // düşüyor, yani görsel bir bağımlılık değil iyileştirme.
    await prisma.businessImage.createMany({
      data: gorsel.photos.map((url, i) => ({
        businessId: business.id,
        url,
        sortOrder: i,
      })),
    });
    await prisma.businessStatusHistory.create({
      data: { businessId: business.id, fromStatus: 'PENDING', toStatus: status, actorId: status === 'APPROVED' ? admin.id : null, reason: status === 'APPROVED' ? 'Belgeler doğrulandı' : 'Başvuru alındı' },
    });

    // Menü yalnızca restoranda anlamlı ve her restoranın kendi menüsü var:
    // balıkçıda künefe, pizzacıda Adana kebap görmek "bu veri uydurma"
    // demenin en hızlı yolu olurdu.
    // Önce işletmeye özel menü; yoksa mutfak türünün menüsü. İki dönerci
    // menüsünün birbirine benzemesi gerçekçi, menüsüz restoran değil.
    const mutfak = RESTORAN_MUTFAK[b.slug];
    const menu = MENULER[b.slug] ?? (mutfak ? MUTFAK_MENULERI[mutfak] : undefined);
    if (b.sector === 'RESTAURANT' && menu) {
      await prisma.menuItem.createMany({
        data: menu.map((m, i) => ({
          businessId: business.id,
          category: m.category,
          name: m.name,
          description: m.description ?? null,
          price: m.price,
          sortOrder: i,
        })),
      });
    }

    const branches: Awaited<ReturnType<typeof prisma.branch.create>>[] = [];
    for (const [i, br] of b.branches.entries()) {
      const branch = await prisma.branch.create({
        data: {
          businessId: business.id, name: br.name, district: br.district, address: br.address,
          phone: br.phone, isPrimary: i === 0,
          // Koordinat olmadan harita iğne göstermiyor; kullanıcı işletmenin
          // tam olarak nerede olduğunu göremiyordu. İlçe merkezinden küçük bir
          // sapma: gerçek adres değil, ilçe içinde makul bir konum.
          ...(subeKoordinat(br.district, BUSINESSES.indexOf(b) * 3 + i) ?? {}),
          hours: {
            create: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
              weekday,
              ...branchHours(weekday, b.sector),
            })),
          },
        },
      });
      branches.push(branch);
    }

    const services: Awaited<ReturnType<typeof prisma.service.create>>[] = [];
    for (const [i, s] of b.services.entries()) {
      services.push(
        await prisma.service.create({
          data: { businessId: business.id, name: s.name, description: s.description, durationMin: s.durationMin, bufferMin: s.bufferMin, price: s.price, sortOrder: i },
        }),
      );
    }

    const staff: { member: Awaited<ReturnType<typeof prisma.staffMember.create>>; serviceIdx: number[] }[] = [];
    for (const [i, st] of b.staff.entries()) {
      // Her işletmenin ikinci personeline panel girişi verilir (rol testi için).
      let userId: string | null = null;
      if (i === 1 && status === 'APPROVED' && staffIsPerson(b.sector)) {
        const u = await prisma.user.create({
          data: { email: `${slugName(st.name).replace(/^(dt|dr)\./, '')}@${b.slug.replace(/-/g, '')}.com`, passwordHash, name: st.name, role: 'STAFF', phone: `5${int(30, 59)}${int(1000000, 9999999)}`, avatarSeed: String(int(0, 20)) },
        });
        userId = u.id;
        staffAccounts++;
      }
      const member = await prisma.staffMember.create({
        data: {
          businessId: business.id, branchId: branches[i % branches.length]!.id, userId,
          displayName: st.name, title: st.title, bio: st.bio, hue: (b.hue + i * 24) % 360, sortOrder: i,
          hours: {
            create: [0, 1, 2, 3, 4, 5, 6].map((weekday) => {
              const bh = branchHours(weekday, b.sector);
              return { weekday, closed: bh.closed, startMin: bh.openMin, endMin: bh.closeMin };
            }),
          },
          breaks: hasLunchBreak(b.sector)
            ? {
                create: [1, 2, 3, 4, 5].map((weekday) => ({
                  weekday,
                  startMin: 780,
                  endMin: 840,
                  label: 'Öğle molası',
                })),
              }
            : undefined,
          services: { create: st.services.filter((idx) => services[idx]).map((idx) => ({ serviceId: services[idx]!.id })) },
        },
      });
      staff.push({ member, serviceIdx: st.services });
    }

    if (status !== 'APPROVED') continue;

    // Bir personele önümüzdeki hafta için izin: takvimde "izinli" gösterimi.
    const offStaff = staff[staff.length - 1]!.member;
    await prisma.timeOff.create({
      data: {
        staffId: offStaff.id,
        startsAt: toUtc(addDays(today, 5), 0),
        endsAt: toUtc(addDays(today, 6), 1439),
        type: b.sector === 'PITCH' || b.sector === 'RESTAURANT' ? 'BLOCK' : 'LEAVE',
        reason:
          b.sector === 'PITCH'
            ? 'Çim bakımı'
            : b.sector === 'RESTAURANT'
              ? 'Tadilat'
              : 'Yıllık izin',
      },
    });

    await prisma.customerTag.createMany({
      data: [
        { businessId: business.id, name: 'Düzenli müşteri', tone: 'green' },
        { businessId: business.id, name: 'VIP', tone: 'blue' },
        { businessId: business.id, name: 'Takip gerekli', tone: 'amber' },
      ],
    });

    await prisma.promotion.create({
      data: {
        businessId: business.id,
        code: kampanyaKodu(b.slug),
        title: 'İlk randevuya %15 indirim',
        description: 'Rezzerv üzerinden ilk randevunuzda geçerlidir.',
        kind: 'PERCENT', value: 15, minAmount: 500,
        startsAt: toUtc(addDays(today, -30), 0),
        endsAt: toUtc(addDays(today, 60), 1439),
        maxUses: 100,
      },
    });

    // --- randevular ------------------------------------------------------
    // Hafif kayıtlarda geçmiş penceresi kısa: 120 işletmenin tamamına 60
    // günlük arşiv üretmek tohumu dakikalara çıkarıyordu.
    const basla = b.light ? -14 : START;
    for (let d = basla; d <= END; d++) {
      const date = addDays(today, d);
      const wd = weekdayOf(date);
      const bh = branchHours(wd, b.sector);
      if (bh.closed) continue;
      const isPast = d < 0;
      // Halı saha akşam ve hafta sonu dolar; klinik hafta içi çalışır.
      const load =
        b.sector === 'PITCH'
          ? wd === 0 || wd === 6
            ? 0.95
            : 0.8
          : wd === 6
            ? 0.85
            : wd === 1
              ? 0.55
              : 0.7;

      for (const s of staff) {
        if (s.member.id === offStaff.id && (d === 5 || d === 6)) continue;
        let cursor = bh.openMin + int(0, 3) * 15;
        const target = Math.round(int(3, 6) * load);
        let made = 0;
        while (made < target && cursor < bh.closeMin - 30) {
          const idx = pick(s.serviceIdx);
          const service = services[idx];
          if (!service) break;
          // Randevuların bir kısmı çok hizmetli: müşteri sac kesimi + sakal
          // düzeltmeyi tek randevuda alabiliyor. Demo verisinin bunu
          // göstermesi lazım, yoksa özellik yalnızca kodda var olur.
          // Yalnızca hizmetin "işlem" olduğu sektörlerde: restoranda masa
          // boyutu, halı sahada kiralama süresi seçiliyor ve ikisini birden
          // içeren bir kayıt kendi kuralımıza aykırı olurdu.
          const ikinciIdx =
            termsFor(b.sector).multiService && chance(0.18)
              ? pick(s.serviceIdx.filter((i) => i !== idx))
              : undefined;
          const ikinci = ikinciIdx === undefined ? null : (services[ikinciIdx] ?? null);
          const kalemler = ikinci ? [service, ikinci] : [service];
          const toplam = bookingTotals(kalemler);
          const start = cursor;
          const end = start + toplam.durationMin;
          const block = end + toplam.bufferMin;
          if (end > bh.closeMin) break;
          // Öğle molasını atla (yalnızca kişi bazlı sektörlerde var)
          if (hasLunchBreak(b.sector) && start < 840 && block > 780) {
            cursor = 840;
            continue;
          }
          if (chance(0.78)) {
            const customer = customers[int(0, Math.min(customers.length - 1, 5 + Math.round((d - START) * 0.4)))]!;
            const st = isPast
              ? chance(0.82) ? 'COMPLETED' : chance(0.5) ? 'NO_SHOW' : 'CANCELLED'
              : d === 0
                ? chance(0.5) ? 'COMPLETED' : 'CONFIRMED'
                : chance(0.72) ? 'CONFIRMED' : 'PENDING';
            const discount = chance(0.12) ? Math.round(toplam.price * 0.15) : 0;
            const channel = pick(['ONLINE', 'ONLINE', 'PHONE', 'WALK_IN']);
            // Kapora yalnızca online randevularda istenir.
            // Tohum verisi platform şalterini açık varsayar: amaç kapora
            // akışının dolu göründüğü gerçekçi bir demo üretmek.
            const policy: DepositPolicy | null = b.deposit
              ? { ...b.deposit, platformEnabled: true }
              : null;
            const deposit =
              policy && channel === 'ONLINE' ? depositFor(policy, toplam.price - discount) : 0;
            const depositStatus =
              deposit === 0
                ? 'NONE'
                : st === 'NO_SHOW'
                  ? 'FORFEITED'
                  : st === 'CANCELLED'
                    ? chance(0.6) ? 'REFUNDED' : 'FORFEITED'
                    : 'PAID';
            reservations.push({
              id: randomUUID(), code: code(), businessId: business.id,
              branchId: s.member.branchId!, serviceId: service.id, staffId: s.member.id,
              customerId: customer.id, createdById: customer.id, date, startMin: start,
              endMin: end, blockEnd: block, startsAt: toUtc(date, start), endsAt: toUtc(date, end),
              status: st, channel,
              price: toplam.price, discount, finalPrice: toplam.price - discount,
              depositAmount: deposit, depositStatus,
              note: chance(0.15) ? pick(['Otoparka ihtiyacım var.', 'İlk kez geliyorum.', 'Biraz gecikebilirim.']) : null,
              slotKey: st === 'CANCELLED' ? null : `${s.member.id}:${date}:${start}`,
              createdAt: toUtc(addDays(date, -int(1, 10)), int(540, 1200)),
            });
            const resId = reservations[reservations.length - 1]!.id;
            kalemler.forEach((k, i) =>
              reservationLines.push({
                reservationId: resId, serviceId: k.id, sortOrder: i,
                name: k.name, durationMin: k.durationMin, bufferMin: k.bufferMin, price: k.price,
              }),
            );
            made++;
            cursor = block + int(0, 2) * 15;
          } else {
            cursor += 30;
          }
        }
      }
    }
  }
  console.log(`  ${BUSINESSES.length} işletme, ${staffAccounts} personel hesabı`);

  // Toplu yazım: tek tek create yerine createMany (tohum hızlı kalsın).
  for (let i = 0; i < reservations.length; i += 500) {
    await prisma.reservation.createMany({ data: reservations.slice(i, i + 500) });
  }
  for (let i = 0; i < reservationLines.length; i += 500) {
    await prisma.reservationService.createMany({ data: reservationLines.slice(i, i + 500) });
  }
  await prisma.reservationStatusHistory.createMany({
    data: reservations.map((r) => ({
      reservationId: r.id, toStatus: r.status, actorId: r.customerId,
      note: 'Rezervasyon oluşturuldu', createdAt: r.createdAt,
    })),
  });
  await prisma.payment.createMany({
    data: reservations.map((r) => {
      // Uygulamadan geçen tek tahsilat kaporadır; kalanı işletmede ödenir.
      const captured = r.depositStatus === 'NONE' ? 0 : r.depositAmount;
      const commission = captured > 0 ? Math.floor((captured * 30) / 100) : 0;
      const settlement =
        captured === 0
          ? 'NONE'
          : r.depositStatus === 'REFUNDED'
            ? 'REFUNDED'
            : r.status === 'PENDING' || r.status === 'CONFIRMED'
              ? 'HELD'
              : 'RELEASED';
      return {
        reservationId: r.id,
        method: r.channel === 'ONLINE' && r.finalPrice > 0 ? 'ONLINE' : 'AT_VENUE',
        provider: captured > 0 ? 'mock' : r.channel === 'ONLINE' && r.finalPrice > 0 ? 'mock' : 'none',
        amount: r.finalPrice,
        capturedAmount: captured,
        commissionRate: captured > 0 ? 30 : 0,
        commissionAmount: commission,
        netAmount: captured - commission,
        settlementStatus: settlement,
        releasedAt: settlement === 'RELEASED' || settlement === 'REFUNDED' ? r.endsAt : null,
        providerRef: captured > 0 ? `mock_${r.code}` : null,
        status:
          settlement === 'REFUNDED'
            ? 'REFUNDED'
            : r.status === 'COMPLETED' || captured > 0
              ? 'PAID'
              : r.status === 'CANCELLED'
                ? 'FAILED'
                : 'PENDING',
        paidAt: captured > 0 ? r.createdAt : r.status === 'COMPLETED' ? r.endsAt : null,
        refundedAt: settlement === 'REFUNDED' ? r.endsAt : null,
      };
    }),
  });
  console.log(`  ${reservations.length} randevu`);

  // --- değerlendirmeler --------------------------------------------------
  const completed = reservations.filter((r) => r.status === 'COMPLETED');
  const reviewed = new Set<string>();
  const reviews: { businessId: string; userId: string; reservationId: string; rating: number; comment: string; createdAt: Date; status: string; reportReason: string | null }[] = [];
  for (const r of completed) {
    const key = `${r.businessId}:${r.customerId}`;
    if (reviewed.has(key) || !chance(0.45)) continue;
    reviewed.add(key);
    const rating = chance(0.72) ? 5 : chance(0.7) ? 4 : chance(0.6) ? 3 : 2;
    // Bir tanesi şikayet edilmiş olsun: yönetici moderasyon ekranı boş kalmasın.
    const reported = reviews.length === 7;
    reviews.push({
      businessId: r.businessId, userId: r.customerId, reservationId: r.id, rating,
      comment: pick(REVIEW_TEXTS), createdAt: new Date(r.endsAt.getTime() + 86400000),
      status: reported ? 'REPORTED' : 'PUBLISHED',
      reportReason: reported ? 'Alakasız içerik bildirimi' : null,
    });
  }
  await prisma.review.createMany({ data: reviews });

  // İşletme puanlarını yayındaki yorumlardan hesapla.
  const businesses = await prisma.business.findMany({ select: { id: true } });
  for (const biz of businesses) {
    const agg = await prisma.review.aggregate({
      where: { businessId: biz.id, status: 'PUBLISHED' },
      _avg: { rating: true }, _count: true,
    });
    await prisma.business.update({
      where: { id: biz.id },
      data: { ratingAvg: Math.round((agg._avg.rating ?? 0) * 10) / 10, ratingCount: agg._count },
    });
  }
  console.log(`  ${reviews.length} değerlendirme`);

  // --- favoriler, notlar, bildirimler ------------------------------------
  const approved = await prisma.business.findMany({ where: { status: 'APPROVED' }, select: { id: true, name: true, slug: true } });
  for (const c of customers.slice(0, 14)) {
    for (const biz of approved) {
      if (chance(0.22)) {
        await prisma.favorite.create({ data: { userId: c.id, businessId: biz.id } }).catch(() => undefined);
      }
    }
  }

  for (const biz of approved.slice(0, 4)) {
    const recent = reservations.filter((r) => r.businessId === biz.id).slice(0, 3);
    for (const r of recent) {
      await prisma.customerNote.create({
        data: {
          businessId: biz.id, customerId: r.customerId, authorId: null,
          body: pick([
            'Randevu hatırlatması SMS ile isteniyor.',
            'Bekleme salonunda kahve ikramı sevdi, not düşüldü.',
            'Geçen seans sonrası hassasiyet bildirdi, kontrol edilecek.',
            'Sabah randevularını tercih ediyor.',
          ]),
        },
      });
    }
  }

  const upcoming = reservations
    .filter((r) => r.customerId === demoCustomer.id && r.status !== 'CANCELLED' && r.date >= today)
    .slice(0, 2);
  for (const r of upcoming) {
    const biz = approved.find((x) => x.id === r.businessId);
    await prisma.notification.create({
      data: {
        userId: demoCustomer.id, kind: 'RESERVATION',
        title: `Randevunuz yaklaşıyor — ${biz?.name ?? ''}`,
        body: `${r.date} tarihinde randevunuz var.`,
        href: `/randevularim/${r.id}`,
      },
    });
  }
  await prisma.notification.create({
    data: {
      userId: demoCustomer.id, kind: 'PROMO',
      title: 'Yeni kampanya: ilk randevuya %15 indirim',
      body: 'Rezzerv üzerinden alacağınız ilk randevuda geçerli.',
      href: '/kesfet',
    },
  });
  await prisma.notification.create({
    data: {
      userId: admin.id, kind: 'SYSTEM',
      title: 'Onay bekleyen işletme başvurusu',
      body: 'Yeni Umut Diş Polikliniği başvurusu incelenmeyi bekliyor.',
      href: '/yonetim/isletmeler',
    },
  });

  // Platform geneli kampanya
  await prisma.promotion.create({
    data: {
      code: 'REZZERV100', title: 'Rezzerv’e hoş geldin: 100 TL indirim',
      description: '750 TL ve üzeri randevularda geçerlidir.',
      kind: 'AMOUNT', value: 100, minAmount: 750,
      startsAt: toUtc(addDays(today, -10), 0), endsAt: toUtc(addDays(today, 90), 1439),
      maxUses: 0,
    },
  });

  // Hız sınırı sayaçları da bilinen duruma dönmeli. Sayaç Redis'te ve
  // pencereleri saatlerce yaşıyor: saat içinde ikinci bir E2E koşusu, ilkinden
  // kalan sayaçla işletme başvurusu sınırına takılır ve test veri yüzünden
  // değil geçmiş koşu yüzünden düşer.
  await hizSiniriSayaclariniTemizle();

  // Tohum kullanıcıları kurgusal ama uygulama onları gerçek kullanıcı gibi
  // görüyor: rıza kaydı olmayan hesap diş/veteriner randevusu alamaz. Kayıt
  // akışı rızayı createAccount içinde yazıyor, tohum kullanıcıları o yoldan
  // geçmediği için burada tamamlanıyor.
  const tumKullanicilar = await prisma.user.findMany({ select: { id: true } });
  await prisma.consent.createMany({
    data: tumKullanicilar.flatMap((u) =>
      CONSENT_KINDS.map((kind) => ({ userId: u.id, kind, version: CONSENT_VERSION })),
    ),
  });
  console.log(`  ${tumKullanicilar.length * CONSENT_KINDS.length} rıza kaydı`);

  // --- Abonelik faturaları ---------------------------------------------
  //
  // Döngünün kendisi worker'da (`abonelik-dongusu`) ama tohum verisi onu
  // beklemiyor: yönetim ekranı ilk açılışta boş görünmesin ve akış demo'da
  // görülebilsin. Aynı saf fonksiyon kullanılıyor (`kesilecekDonem`), yani
  // burada üretilen fatura işin üreteceğiyle birebir aynı.
  //
  // `src/server/subscription.ts` doğrudan çağrılamıyor: `server-only`
  // taşıyor ve tohum düz Node'da koşuyor.
  const abonelikler = await prisma.business.findMany({
    select: {
      id: true, planKey: true, planPrice: true, planStatus: true,
      trialEndsAt: true, currentPeriodEnd: true,
    },
  });

  const faturalar: {
    businessId: string; planKey: string; amount: number;
    periodStart: Date; periodEnd: Date; dueAt: Date; status: string;
    paidAt: Date | null; paidMethod: string | null; paidNote: string | null;
  }[] = [];

  for (const b of abonelikler) {
    // Ödeyen işletmelerin geçmişi: son iki dönem tahsil edilmiş görünsün.
    if (b.planStatus === 'ACTIVE' && b.currentPeriodEnd && b.planPrice > 0) {
      for (let geri = 2; geri >= 1; geri--) {
        const bas = ayEkle(b.currentPeriodEnd, -geri);
        faturalar.push({
          businessId: b.id, planKey: b.planKey, amount: b.planPrice,
          periodStart: bas, periodEnd: ayEkle(bas, 1), dueAt: gunEkle(bas, ODEME_VADESI_GUN),
          status: 'PAID', paidAt: gunEkle(bas, int(1, 5)),
          paidMethod: 'MANUAL', paidNote: `Havale ref ${int(1000, 9999)}`,
        });
      }
    }

    // Dönemi bitmiş olanlara açık fatura.
    const donem = kesilecekDonem(b, new Date());
    if (donem) {
      faturalar.push({
        businessId: b.id, planKey: b.planKey, amount: b.planPrice,
        periodStart: donem.periodStart, periodEnd: donem.periodEnd, dueAt: donem.dueAt,
        status: 'DUE', paidAt: null, paidMethod: null, paidNote: null,
      });
    }
  }

  for (let i = 0; i < faturalar.length; i += 500) {
    await prisma.subscriptionInvoice.createMany({ data: faturalar.slice(i, i + 500) });
  }
  console.log(`  ${faturalar.length} abonelik faturası`);

  const counts = {
    kullanıcı: await prisma.user.count(),
    işletme: await prisma.business.count(),
    şube: await prisma.branch.count(),
    personel: await prisma.staffMember.count(),
    hizmet: await prisma.service.count(),
    randevu: await prisma.reservation.count(),
  };
  console.log('\nTohum verisi hazır:', counts);
  console.log('\n  Demo hesaplar (parola: %s)', DEMO_PASSWORD);
  console.log('  Müşteri        demo@rezzerv.com');
  console.log('  İşletme sahibi serhat@beyazdis.com');
  console.log('  Personel       aylin.kara@beyazdispoliklinigi.com');
  console.log('  Yönetici       admin@rezzerv.com\n');
}


/** Hız sınırı sayaçlarını siler. REDIS_URL yoksa sessizce atlanır. */
async function hizSiniriSayaclariniTemizle(): Promise<void> {
  const url = process.env['REDIS_URL'];
  if (!url) return;
  const { default: IORedis } = await import('ioredis');
  const redis = new IORedis(url, { maxRetriesPerRequest: 1, lazyConnect: true });
  try {
    await redis.connect();
    const anahtarlar = await redis.keys('rl:*');
    if (anahtarlar.length) await redis.del(...anahtarlar);
    console.log(`  ${anahtarlar.length} hız sınırı sayacı temizlendi`);
  } catch {
    // Redis yoksa tohum yine de işini bitirmeli; sayaç kendi TTL'iyle ölür.
    console.log('  Redis erişilemedi: hız sınırı sayaçları temizlenmedi');
  } finally {
    redis.disconnect();
  }
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
