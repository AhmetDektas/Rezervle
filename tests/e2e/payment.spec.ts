import { test, expect, type Page } from './fixtures';
import { login, ACCOUNTS, resetRateLimits } from './helpers';

// Ödeme akışı asenkron: müşteri siteden ayrılıyor, sonucu webhook getiriyor.
// Bu spec o yolun uçtan uca çalıştığını doğruluyor — sahte sağlayıcı bile
// olsa akışın ŞEKLİ gerçeğiyle aynı: yönlendirme, bekleme, webhook, sonuç.

/** Kaporası açık işletme: 3DS yolu ancak kapora varsa devreye girer. */
const KAPORALI = 'gulveren-spor-tesisleri';

async function randevuAdimlari(page: Page) {
  await page.goto(`/isletme/${KAPORALI}/randevu`);
  await page.locator('input[name="service"]').first().check();
  await page.getByRole('button', { name: 'Devam' }).click();
  await page.getByRole('button', { name: 'Devam' }).click();

  const slot = page.locator('button').filter({ hasText: /^\d{2}:\d{2}$/ });
  const days = page.getByRole('option');
  const dayCount = await days.count();
  let bulundu = false;
  for (let i = 0; i < Math.min(dayCount, 8); i++) {
    await days.nth(i).click();
    await page.waitForTimeout(900);
    if ((await slot.count()) > 0) {
      bulundu = true;
      break;
    }
  }
  expect(bulundu, 'önümüzdeki günlerde en az bir uygun saat bulunmalı').toBe(true);

  await slot.first().click();
  await page.getByRole('button', { name: 'Devam' }).click();
  await expect(page.getByText('Randevu özeti')).toBeVisible();
  // Kapora varken buton "<tutar> öde ve onayla" oluyor; kaporasız işletmede
  // "Randevuyu onayla". Bu spec kaporalı işletmeyle çalışıyor.
  await page.getByRole('button', { name: /öde ve onayla/ }).click();
}

// Randevu hız sınırı testler arası taşmasın (bkz. helpers.resetRateLimits).
test.beforeEach(async () => {
  await resetRateLimits();
});

test.describe('3DS ödeme akışı', () => {
  test('onaylanan ödeme randevuyu kesinleştirir', async ({ page }) => {
    await login(page, ACCOUNTS.customer);
    await randevuAdimlari(page);

    // Kapora varsa müşteri bankaya (burada taklit sayfaya) yönlendirilir.
    await page.waitForURL(/\/odeme\/3ds/, { timeout: 25_000 });
    await expect(page.getByRole('heading', { name: '3D Secure doğrulama' })).toBeVisible();

    await page.getByRole('button', { name: 'Ödemeyi onayla' }).click();

    // Dönüş ekranı sonucu webhook'tan öğreniyor; "başarılı" yazmadan önce
    // gerçekten onay gelmiş olmalı.
    await page.waitForURL(/\/odeme\/donus/, { timeout: 25_000 });
    await expect(page.getByText('Ödemeniz alındı')).toBeVisible({ timeout: 30_000 });

    // Mobilde alt sekme çubuğu sabit duruyor ve bağlantıyı örtebiliyor;
    // önce görünür alana alıyoruz. Ardından gezinmeyi bekliyoruz —
    // toHaveURL tıklamanın gezinmeyi başlatmasını beklemiyor.
    const git = page.getByRole('link', { name: 'Randevuma git' });
    await git.scrollIntoViewIfNeeded();
    await git.click();
    await page.waitForURL(/\/randevularim\/.+/, { timeout: 25_000 });
  });

  test('reddedilen ödemede randevu oluşmaz', async ({ page }) => {
    await login(page, ACCOUNTS.customer);
    await randevuAdimlari(page);
    await page.waitForURL(/\/odeme\/3ds/, { timeout: 25_000 });

    await page.getByRole('button', { name: 'Bankadan reddedildi' }).click();

    await page.waitForURL(/\/odeme\/donus/, { timeout: 25_000 });
    // Saat serbest bırakılmalı ve kullanıcı bunu okumalı.
    await expect(page.getByText('Randevu oluşturulamadı')).toBeVisible({ timeout: 30_000 });
  });

  test('ödeme beklerken randevu HENÜZ onaylanmış görünmez', async ({ page }) => {
    await login(page, ACCOUNTS.customer);
    await randevuAdimlari(page);
    await page.waitForURL(/\/odeme\/3ds/, { timeout: 25_000 });

    // Müşteri 3DS'i tamamlamadan randevularına bakarsa, oluşmuş gibi
    // gösterilmemeli: "oluşturuldu" demek 15 dakika sonra iptal edilecek
    // bir kayıt için yanlış olurdu.
    await page.goto('/randevularim');
    await expect(page.locator('#icerik')).not.toContainText('Ödemeniz alındı');
  });
});
