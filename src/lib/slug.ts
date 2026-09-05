import { slugify } from './utils';

/**
 * İşletme adresi (slug) adayları.
 *
 * Aynı isimde iki işletme olması Ankara'da istisna değil, kural: "Berber Ali"
 * Keçiören'de de Çankaya'da da var. `Business.slug` tekil kısıtlı olduğu için
 * ikinci kayıt veritabanı hatası alır ve kullanıcı anlamsız bir mesaj görür.
 *
 * Çözüm sıraya bağlı adaylar üretmek:
 *
 *   berber-ali-kecioren        ← semt ayırt ediciliği taşır ve URL'de anlamlı
 *   berber-ali-kecioren-2      ← aynı semtte aynı isim
 *   berber-ali-kecioren-3
 *
 * Semt slug'a baştan giriyor: zincirlerin şubeleri doğal olarak ayrışıyor ve
 * müşteri adrese bakınca hangi şube olduğunu anlıyor. Bedeli, işletme semt
 * değiştirirse slug'ın yanıltıcı kalması — o durumda yönlendirme gerekir.
 *
 * Saf fonksiyon: veritabanı bilmez. Hangi adayın boş olduğunu çağıran bulur.
 */
export function slugCandidates(name: string, district: string, max = 50): string[] {
  const base = [slugify(name), slugify(district)].filter(Boolean).join('-');
  // Ad ve semt birlikte boş slug üretirse (ör. yalnızca noktalama) geri
  // dönülebilir bir taban gerekiyor; çağıran yine de tekillik arıyor.
  const root = base || 'isletme';
  const out = [root];
  for (let i = 2; i <= max; i++) out.push(`${root}-${i}`);
  return out;
}
