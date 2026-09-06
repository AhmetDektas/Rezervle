/* eslint-disable react-hooks/rules-of-hooks --
   Playwright fixture'ının `use` parametresi React hook'u değil; kural onu
   adından dolayı hook sanıyor. Bu dosyada React yok. */
import { test as base, expect } from '@playwright/test';

/**
 * Uygulamanın çağırdığı üçüncü taraf adresler; testlerde kesiliyor.
 *
 * NEDEN: `page.goto` varsayılanı `waitUntil: 'load'` ve `load` olayı sayfadaki
 * TÜM alt kaynakları bekliyor. Tohum verisi kapak ve galeri görsellerini
 * Unsplash'ten, işletme haritasını Google Maps'ten çekiyor. Uzun bir koşuda bu
 * servislerden biri yavaşladığında (ya da aynı IP'den gelen yüzlerce isteği
 * kısmaya başladığında) gezinme bitmiyordu.
 *
 * DENENIP VAZGEÇILEN — gezinmeyi `domcontentloaded`'a çevirmek. Çok daha
 * kötüsünü yaptı: JavaScript yürütülmeden dönüyor, test hidrasyondan önce
 * "Giriş yap"a basıyor, React `onSubmit`'i henüz bağlamadığı için tarayıcı
 * formu GET ile gönderiyor ve parola adres çubuğuna düşüyordu.
 *
 * Uygulamaya yeni bir dış kaynak eklenirse buraya da eklenmeli.
 */
const DIS_KAYNAKLAR = [
  'https://images.unsplash.com/**',
  'https://maps.google.com/**',
  'https://www.google.com/**',
];

/** Sunucunun yeniden ayağa kalkması için tanınan süre. */
const SUNUCU_BEKLEME_MS = 30_000;

/**
 * Geliştirme sunucusunun kendini yeniden başlatması bir testi düşürmesin.
 *
 * Next'in geliştirme sunucusunda bellek gözcüsü var ve öbek sınırına
 * yaklaşınca sunucuyu KENDİ BAŞINA yeniden başlatıyor:
 *
 *     ⚠ Server is approaching the used memory threshold, restarting...
 *
 * O anda uçuşta olan gezinme ölüyor. Uzun bir koşuda bu bir-iki kez mutlaka
 * yaşanıyor ve hangi testi vurduğu tamamen şansa kalıyor: "her koşuda BAŞKA
 * bir test düşüyor" davranışının kalan sebebi buydu. Yeşil biten koşularda da
 * oluyordu, sadece iki testin arasına denk geliyordu.
 *
 * Denenip vazgeçilen: `--max-old-space-size=4096`. Yeniden başlatmayı
 * engellemedi, üstelik daha erken tetikledi (47. test, öncekinde 112.).
 *
 * Bu ÜRÜNDE olmayan bir davranış — `next start` derlemiyor, böyle bir gözcüsü
 * de yok. Yani düşen test uygulamayı değil, test ortamını raporluyordu.
 *
 * Tekrar KOŞULSUZ: gezinme düştüğünde sebebin yeniden başlatma mı yoksa
 * uygulamanın takılması mı olduğu güvenilir şekilde ayırt edilemiyor —
 * zaman aşımı 45 saniye sürüyor ve sunucu o arada çoktan ayağa kalkmış
 * oluyor. Bunun yerine her tekrar loga yazılıyor: uygulama gerçekten
 * takılıyorsa ikinci deneme de düşüyor, kararsızsa da logda görünüyor.
 *
 * Playwright'ın `retries` ayarı bunu da çözerdi ama TESTIN TAMAMINI tekrar
 * ederdi; gerçekten kararsız bir uygulama davranışı da sessizce yeşile
 * dönerdi. Burada yalnızca GEZİNME, yalnızca BİR kez ve yalnızca sunucunun
 * yanıt vermediği doğrulandıktan sonra tekrarlanıyor. Uygulama takılıyorsa
 * ikinci deneme de düşer ve hata görünür kalır.
 */
async function sunucuyuBekle(taban: string): Promise<void> {
  const bitis = Date.now() + SUNUCU_BEKLEME_MS;
  while (Date.now() < bitis) {
    try {
      await fetch(taban, { redirect: 'manual' });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
}

export const test = base.extend({
  page: async ({ page, baseURL }, use) => {
    for (const desen of DIS_KAYNAKLAR) {
      await page.route(desen, (route) => route.abort());
    }

    const asilGoto = page.goto.bind(page);
    page.goto = (async (url: string, opts?: Parameters<typeof asilGoto>[1]) => {
      try {
        return await asilGoto(url, opts);
      } catch {
        // Tekrar SESSİZ DEĞİL: koşu logunda görünüyor. Sessiz bir tekrar,
        // kararsız bir gezinmeyi yeşile boyayıp saklardı; böyle, kaç kez
        // olduğu ve hangi adreste olduğu okunabiliyor.
        console.warn(`[e2e] gezinme düştü, sunucu bekleniyor: ${url}`);
        if (baseURL) await sunucuyuBekle(baseURL);
        return await asilGoto(url, opts);
      }
    }) as typeof page.goto;

    await use(page);
  },
});

export { expect };

// Spec'ler Page/Locator tiplerini bu modülden alıyor. Playwright'tan doğrudan
// almak da mümkün ama tek giriş noktası, fixture'ı atlayıp ham `test`i içe
// aktarmayı kolaylaştırırdı — o da dış istek engelini devre dışı bırakırdı.
export type { Page, Locator } from '@playwright/test';
