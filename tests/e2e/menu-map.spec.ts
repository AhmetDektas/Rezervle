import { test, expect } from './fixtures';
import { login } from './helpers';

const RESTORAN = 'kavakli-ocakbasi';
const KUAFOR = 'studio-nar-guzellik';

test.describe('işletme sayfası', () => {
  test('konum haritası ve yol tarifi görünür', async ({ page }) => {
    await page.goto(`/isletme/${RESTORAN}`);

    // iframe ekrana girene kadar kurulmuyor (sayfanın load olayını
    // bekletmesin diye); önce oraya kaydırıyoruz.
    await page.getByRole('link', { name: /Yol tarifi/ }).scrollIntoViewIfNeeded();
    const harita = page.locator('iframe[title*="konumu"]');
    await expect(harita).toBeVisible({ timeout: 15_000 });
    // Anahtar gerektirmeyen gömme adresi: anahtarsız Embed API sessizce boş
    // bir kutu yüklerdi.
    await expect(harita).toHaveAttribute('src', /maps\.google\.com/);

    await expect(page.getByRole('link', { name: /Yol tarifi/ })).toBeVisible();
  });

  test('restoranda menü listelenir', async ({ page }) => {
    await page.goto(`/isletme/${RESTORAN}`);

    await expect(page.getByRole('heading', { name: 'Menü' })).toBeVisible();
    await expect(page.getByText('Adana kebap')).toBeVisible();
    await expect(page.getByText('Başlangıçlar')).toBeVisible();
    // Fiyatın rezervasyon tutarına girmediği açıkça yazmalı.
    await expect(page.getByText(/Rezervasyon tutarına dahil değildir/)).toBeVisible();
  });

  test('restoran DIŞINDAKİ sektörde menü bölümü yok', async ({ page }) => {
    await page.goto(`/isletme/${KUAFOR}`);
    // Kuaförün menüsü olmaz; boş bir başlık göstermek gürültü olurdu.
    await expect(page.getByRole('heading', { name: 'Menü' })).toHaveCount(0);
  });

  test('işletme sayfasında başlıkta arama kutusu YOK', async ({ page }) => {
    await page.goto(`/isletme/${RESTORAN}`);
    // Kullanıcı aramayı bitirmiş, bir yer seçmiş durumda; kutu sayfanın kendi
    // içeriğiyle yarışıyordu.
    await expect(page.locator('header input[type="search"]')).toHaveCount(0);
  });

  test('keşfet sayfasında arama kutusu KORUNUYOR', async ({ page }) => {
    await page.goto('/kesfet');
    // Aramayı işletme sayfasından kaldırmak, her yerden kaldırmak demek değil.
    //
    // Başlıkta iki kutu var: masaüstü (md:block) ve mobil (md:hidden). Hangisi
    // görünürse o geçerli; .first() mobilde gizli olanı seçip yanılıyordu.
    await expect(page.locator('header input[type="search"]:visible')).toHaveCount(1);
  });
});

test.describe('menü yönetimi', () => {
  test('restoran sahibi menüye kalem ekler', async ({ page }) => {
    await login(page, 'huseyin@kavakliocakbasi.com');
    await page.goto(`/panel/${RESTORAN}/menu`);

    await expect(page.getByRole('heading', { name: 'Menü' })).toBeVisible();
    await page.getByRole('button', { name: 'Kalem ekle' }).click();

    const benzersiz = `Test Ürün ${Date.now().toString(36)}`;
    await page.getByLabel('Bölüm').fill('Testler');
    await page.getByLabel('Ürün adı').fill(benzersiz);
    await page.getByLabel('Fiyat (TL)').fill('250');
    await page.getByRole('button', { name: 'Kaydet' }).click();

    await expect(page.locator('#icerik').getByText(benzersiz)).toBeVisible({ timeout: 15_000 });

    // Müşteri tarafında da görünmeli: panel ile vitrin aynı veriyi okumalı.
    //
    // domcontentloaded: varsayılan 'load' harita iframe'ini de bekliyor ve
    // üçüncü taraf yavaşladığında test bizim içeriğimizle ilgisiz bir sebeple
    // düşüyor. Kendi HTML'imiz hazır olduğunda doğrulama yapılabilir.
    await page.goto(`/isletme/${RESTORAN}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(benzersiz)).toBeVisible();
  });
});
