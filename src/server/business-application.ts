import 'server-only';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { createAccount } from './accounts';
import { DomainError } from './errors';
import { slugCandidates } from '@/lib/slug';

/**
 * İşletme başvurusu.
 *
 * Rezzerv iki taraflı bir pazaryeri olarak tasarlandı ama uzun süre yalnızca
 * talep tarafı sisteme girebiliyordu: kayıt her zaman CUSTOMER rolü yaratıyor
 * ve Business kaydı yalnızca tohum verisinden doğuyordu. Onay durum makinesi
 * ve admin kuyruğu hazırdı; eksik olan başvurunun kendisiydi.
 *
 *   basvuru ──▶ User(OWNER) ──┐
 *                             ├─▶ Business(PENDING) ──▶ StatusHistory
 *                             └─▶ Branch(isPrimary)
 *                                      │
 *                              admin onayi ──▶ APPROVED ──▶ rezervasyon alabilir
 *
 * Tamamı tek işlemde yazılır: yarım kalmış bir başvuru (sahibi olan ama şubesi
 * olmayan işletme, ya da işletmesi olmayan OWNER hesabı) hiçbir ekranda
 * anlamlı görünmez ve elle temizlemek gerekir.
 *
 * Çalışma saatleri burada sorulmuyor (S11-2): başvuru sürtünmesi düşük
 * tutuluyor, kurulum onaydan sonra panelde rehberli olarak tamamlanıyor.
 * Bunun bedeli, onaylanmış ama henüz rezervasyon alamayan bir ara durum.
 */
export type BusinessApplication = {
  ownerName: string;
  email: string;
  phone: string;
  password: string;
  businessName: string;
  categorySlug: string;
  district: string;
  address: string;
};

export type ApplicationResult = {
  userId: string;
  businessId: string;
  slug: string;
};

/**
 * Boş olan ilk slug adayını bulur.
 *
 * Yarış durumu: iki başvuru aynı anda aynı slug'ı seçebilir. Kaybeden taraf
 * `Business.slug` tekil kısıtına çarpar; çağıran bunu P2002 olarak yakalayıp
 * yeniden dener. Adayları önceden ayırmak (rezervasyon tablosu vb.) bu ölçekte
 * gereksiz karmaşıklık olurdu.
 */
async function firstFreeSlug(
  tx: Prisma.TransactionClient,
  name: string,
  district: string,
): Promise<string> {
  const candidates = slugCandidates(name, district);
  const taken = await tx.business.findMany({
    where: { slug: { in: candidates } },
    select: { slug: true },
  });
  const used = new Set(taken.map((b) => b.slug));
  const free = candidates.find((c) => !used.has(c));
  if (!free) {
    // 50 aday da doluysa isim+semt kombinasyonu gerçekten aşırı kullanılmış
    // demektir; sessizce rastgele bir eke düşmek yerine açıkça söylüyoruz.
    throw new DomainError(
      'Bu isim ve semt için adres üretilemedi. Lütfen işletme adını biraz farklılaştırın.',
      'SLUG_EXHAUSTED',
    );
  }
  return free;
}

export async function submitBusinessApplication(
  input: BusinessApplication,
): Promise<ApplicationResult> {
  const category = await prisma.businessCategory.findUnique({
    where: { slug: input.categorySlug },
    select: { id: true, active: true },
  });
  if (!category || !category.active) {
    throw new DomainError('Seçilen kategori geçerli değil.', 'CATEGORY_INVALID');
  }

  return prisma.$transaction(async (tx) => {
    const owner = await createAccount(
      {
        name: input.ownerName,
        email: input.email,
        phone: input.phone,
        password: input.password,
        role: 'OWNER',
      },
      tx,
    );

    const slug = await firstFreeSlug(tx, input.businessName, input.district);

    const business = await tx.business.create({
      data: {
        slug,
        name: input.businessName,
        categoryId: category.id,
        ownerId: owner.id,
        phone: input.phone,
        email: input.email,
        // status varsayilani PENDING: onaya kadar musteri tarafinda gorunmez
        // ve rezervasyon alamaz (reservations.ts APPROVED kontrolu yapiyor).
        branches: {
          create: {
            name: input.businessName,
            district: input.district,
            address: input.address,
            phone: input.phone,
            isPrimary: true,
          },
        },
        statusHistory: {
          create: { fromStatus: 'NEW', toStatus: 'PENDING', reason: 'İşletme başvurusu' },
        },
      },
      select: { id: true, slug: true },
    });

    return { userId: owner.id, businessId: business.id, slug: business.slug };
  });
}
