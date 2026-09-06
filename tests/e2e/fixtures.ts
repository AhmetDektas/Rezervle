/* eslint-disable react-hooks/rules-of-hooks --
   Playwright fixture'ının `use` parametresi React hook'u değil; kural onu
   adından dolayı hook sanıyor. Bu dosyada React yok. */
import { test as base, expect } from '@playwright/test';

const YEREL = new Set(['127.0.0.1', 'localhost', '::1']);

/**
 * E2E test tabanı: uygulama dışı hiçbir ağ isteği yapılmaz.
 *
 * Playwright'ın `page.goto` varsayılanı `waitUntil: 'load'` ve `load` olayı
 * SAYFADAKİ TÜM alt kaynakları bekliyor. Tohum verisi kapak ve galeri
 * görsellerini Unsplash'ten, işletme haritasını Google Maps'ten çekiyor.
 * Yirmi dakikalık bir koşuda bu servislerden biri yavaşladığında (ya da aynı
 * IP'den gelen yüzlerce isteği kısmaya başladığında) gezinme bitmiyor ve o an
 * sırada olan test zaman aşımına uğruyordu. Her koşuda BAŞKA bir testin
 * düşmesinin sebebi buydu — hangi test o anda dış kaynaklı bir sayfaya
 * giderse.
 *
 * Çözüm, gezinmeyi `domcontentloaded`'a çevirmek DEĞİL: bu denendi ve çok
 * daha kötü bir hata verdi. `domcontentloaded`, JavaScript yürütülmeden
 * dönüyor; test hidrasyondan önce "Giriş yap"a bastığında React `onSubmit`'i
 * henüz bağlamamış oluyor ve tarayıcı formu doğal yoldan GET ile gönderiyor.
 * Sonuç: parola adres çubuğunda. Testler o hâliyle uygulamayı değil, kendi
 * yarattıkları yarışı ölçüyordu.
 *
 * Bunun yerine dış kaynaklar kesiliyor. `load` yalnızca uygulamanın kendi
 * yanıtlarına bağlı kalıyor, hidrasyon garanti altında ve testler üçüncü
 * taraf bir servisin o günkü hızına bağlı değil. Görsel engellendiğinde
 * `BusinessCover` kendi gradient kapağına düşüyor, harita iframe'i öğe olarak
 * yerinde duruyor — testlerin doğruladığı şey zaten uygulamanın DOM'u.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route('**/*', (route) => {
      const { hostname } = new URL(route.request().url());
      return YEREL.has(hostname) ? route.continue() : route.abort();
    });
    await use(page);
  },
});

export { expect };
