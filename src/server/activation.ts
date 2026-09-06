import 'server-only';
import { prisma } from '@/lib/db';

/**
 * Kurulum kontrol listesi (T20 / S11-2).
 *
 * Başvuru formu bilinçli olarak kısa: çalışma saati, hizmet ve personel
 * sorulmuyor ki sürtünme düşük olsun. Bedeli, onaydan sonra boş bir panele
 * düşen işletme — ve boş panel arz tarafındaki en pahalı kayıp. Bu liste o
 * bedeli ödemenin yolu: eksik olanı adıyla söyleyip doğrudan oraya götürüyor.
 *
 * Tam aktivasyon sihirbazı (E4) bilinçli olarak ertelendi: gerçek sürtünmeyi
 * görmeden sihirbaz tasarlamak yanlış adımları otomatikleştirmek olurdu.
 * Liste, sihirbazın ölçülebilir ve ucuz hâli.
 */

export type ChecklistItem = {
  id: 'hizmet' | 'saat' | 'personel' | 'gorsel';
  baslik: string;
  aciklama: string;
  /** Randevu alabilmek için ŞART mı, yoksa iyileştirme mi? */
  zorunlu: boolean;
  tamam: boolean;
  href: string;
};

export type Checklist = {
  maddeler: ChecklistItem[];
  tamamlanan: number;
  toplam: number;
  /** Zorunlu maddelerin tamamı bitti mi: işletme rezervasyon alabilir mi? */
  rezervasyonaHazir: boolean;
};

export async function activationChecklist(
  businessId: string,
  slug: string,
): Promise<Checklist> {
  const [hizmet, saat, personel, gorsel] = await Promise.all([
    prisma.service.count({ where: { businessId, active: true } }),
    prisma.branchHour.count({ where: { branch: { businessId }, closed: false } }),
    prisma.staffMember.count({ where: { businessId, active: true } }),
    prisma.businessImage.count({ where: { businessId } }),
  ]);

  const maddeler: ChecklistItem[] = [
    {
      id: 'hizmet',
      baslik: 'Hizmetlerinizi ekleyin',
      aciklama: 'Süre ve fiyat olmadan müşteri randevu alamaz.',
      zorunlu: true,
      tamam: hizmet > 0,
      href: `/panel/${slug}/hizmetler`,
    },
    {
      id: 'saat',
      baslik: 'Çalışma saatlerinizi girin',
      aciklama: 'Takvim, açık saatlerinizi bilmeden boş görünür.',
      zorunlu: true,
      tamam: saat > 0,
      href: `/panel/${slug}/subeler`,
    },
    {
      id: 'personel',
      baslik: 'Personel veya kaynak tanımlayın',
      aciklama: 'Randevu bir kişiye ya da sahaya/masaya atanır.',
      zorunlu: true,
      tamam: personel > 0,
      href: `/panel/${slug}/personel`,
    },
    {
      id: 'gorsel',
      baslik: 'İşletme görseli ekleyin',
      aciklama: 'Görseli olan işletmeler keşfette belirgin şekilde daha çok tıklanıyor.',
      zorunlu: false,
      tamam: gorsel > 0,
      href: `/panel/${slug}/ayarlar`,
    },
  ];

  return {
    maddeler,
    tamamlanan: maddeler.filter((m) => m.tamam).length,
    toplam: maddeler.length,
    rezervasyonaHazir: maddeler.filter((m) => m.zorunlu).every((m) => m.tamam),
  };
}
