import { test, expect } from './fixtures';
import { login, ACCOUNTS, resetRateLimits } from './helpers';

// Aydınlatma metni "rızanızı profil sayfanızdan geri alabilirsiniz" diyor.
// Geri alma yalnızca bir satırı kapatsaydı hiçbir şeyi değiştirmeyen bir düğme
// olurdu; bu test sözün randevu akışında gerçekten tutulduğunu doğruluyor.

/** Profildeki açık rıza düğmesini istenen duruma getirir. */
async function rizayiAyarla(page: import('@playwright/test').Page, ver: boolean) {
  await page.goto('/profil');
  const geriAl = page.getByRole('button', { name: 'Açık rızamı geri al' });
  const rizaVer = page.getByRole('button', { name: 'Açık rıza ver' });

  if (ver) {
    if ((await rizaVer.count()) > 0) {
      await rizaVer.click();
      await expect(geriAl).toBeVisible({ timeout: 15_000 });
    }
    return;
  }

  if ((await geriAl.count()) > 0) {
    await geriAl.click();
    await page.getByRole('button', { name: 'Geri al' }).click();
    await expect(rizaVer).toBeVisible({ timeout: 15_000 });
  }

  // Rıza eylemi `router.refresh()` çağırıyor ve düğme yeni durumunu
  // gösterdiğinde bu yenileme HÂLÂ uçuşta olabiliyor. Test hemen başka bir
  // sayfaya geçerse gecikmiş yenileme sayfayı /profil'e geri sürüklüyor ve
  // sıradaki adım "hizmet seçilemiyor" diye düşüyordu — mobilde, yani yavaş
  // profilde. Yenilemenin bitmesini beklemek yarışı kapatıyor.
  await page.waitForLoadState('networkidle');
}

// Randevu hız sınırı testler arası taşmasın (bkz. helpers.resetRateLimits).
test.beforeEach(async () => {
  await resetRateLimits();
});

test.describe('açık rıza', () => {
  // Rıza durumu hesapta kalıcı; sıradaki testleri etkilememesi için geri veriliyor.
  test.afterEach(async ({ page }) => {
    await rizayiAyarla(page, true);
  });

  test('profilde durum görünür ve geri alınabilir', async ({ page }) => {
    await login(page, ACCOUNTS.customer);
    await rizayiAyarla(page, true);

    // Bildirim balonu da aynı metni gösteriyor; ana içerikle sınırlıyoruz.
    const main = page.locator('#icerik');
    await expect(main.getByText('Açık rıza verildi')).toBeVisible();

    await rizayiAyarla(page, false);
    await expect(main.getByText('Açık rıza geri alındı')).toBeVisible();
    // Aydınlatma geri alınmaz; yalnızca rıza kapanır.
    await expect(page.getByRole('link', { name: 'Aydınlatma metni' })).toBeVisible();
  });

  test('rıza geri alınmışken diş kliniği randevusu oluşturulamaz', async ({ page }) => {
    await login(page, ACCOUNTS.customer);
    await rizayiAyarla(page, false);

    await page.goto('/kesfet?kategori=dis-klinigi');
    await page.locator('a[href^="/isletme/"]').first().click();
    await page.waitForURL(/\/isletme\//, { timeout: 20_000 });
    await page.getByRole('link', { name: 'Randevu al' }).first().click();
    await page.waitForURL(/\/randevu/, { timeout: 20_000 });

    await page.locator('input[name="service"]').first().check();
    await page.getByRole('button', { name: 'Devam' }).click();
    await expect(page.getByText('Kiminle görüşmek istersiniz?')).toBeVisible();
    await page.getByRole('button', { name: 'Devam' }).click();

    const slot = page.locator('button').filter({ hasText: /^\d{2}:\d{2}$/ });
    const days = page.getByRole('option');
    const dayCount = await days.count();
    let found = false;
    for (let i = 0; i < Math.min(dayCount, 8); i++) {
      await days.nth(i).click();
      await page.waitForTimeout(900);
      if ((await slot.count()) > 0) {
        found = true;
        break;
      }
    }
    expect(found, 'önümüzdeki günlerde en az bir uygun saat bulunmalı').toBe(true);

    await slot.first().click();
    await page.getByRole('button', { name: 'Devam' }).click();
    await expect(page.getByText('Randevu özeti')).toBeVisible();
    await page.getByRole('button', { name: /Randevuyu onayla/ }).click();

    // Sunucu reddediyor ve kullanıcı ne yapması gerektiğini okuyor.
    await expect(page.locator('#icerik').getByText(/açık rıza gerekiyor/i)).toBeVisible({
      timeout: 20_000,
    });
    // Onay ekranında kalınmalı: yarım randevu ekranı olmamalı.
    await expect(page).toHaveURL(/\/randevu/);
  });

  test('rıza gerektirmeyen kategori etkilenmez', async ({ page }) => {
    await login(page, ACCOUNTS.customer);
    await rizayiAyarla(page, false);

    // Halı saha randevusu sağlığa dair çıkarım taşımaz; rıza aranmaz.
    await page.goto('/kesfet?kategori=hali-saha');
    await page.locator('a[href^="/isletme/"]').first().click();
    await page.waitForURL(/\/isletme\//, { timeout: 20_000 });
    await page.getByRole('link', { name: 'Randevu al' }).first().click();
    await page.waitForURL(/\/randevu/, { timeout: 20_000 });

    // Rıza uyarısı hizmet seçmeden de görünmemeli.
    await expect(page.locator('#icerik').getByText(/açık rıza gerekiyor/i)).toHaveCount(0);
  });
});
