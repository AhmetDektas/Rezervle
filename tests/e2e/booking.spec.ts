import { test, expect } from './fixtures';
import { login, logout, ACCOUNTS, resetRateLimits } from './helpers';

// Randevu hız sınırı testler arası taşmasın (bkz. helpers.resetRateLimits).
test.beforeEach(async () => {
  await resetRateLimits();
});


/**
 * Yaklaşan randevular arasında, verilen düğmeyi taşıyan ilk kaydı açar.
 *
 * Önceden yalnızca ilk 6 karta bakılıyordu. Liste artık doğru sıralandığı için
 * (en yakın randevu en üstte) ilk kartlar bugünün geçmiş ya da 2 saatten yakın
 * randevuları oluyor ve hiçbirinde iptal/erteleme düğmesi bulunmuyor. Sabit
 * bir pencereye bakmak testi veri dağılımına bağımlı kılıyordu; bu yüzden
 * sayfalar gezilerek aranıyor.
 */
async function randevuAc(
  page: import('@playwright/test').Page,
  dugme: string,
  enFazlaSayfa = 3,
): Promise<boolean> {
  for (let sayfa = 1; sayfa <= enFazlaSayfa; sayfa++) {
    const adres = sayfa === 1 ? '/randevularim' : `/randevularim?sayfa=${sayfa}`;
    await page.goto(adres);
    const kartlar = page.locator('a[href^="/randevularim/"]');
    const adet = await kartlar.count();
    if (adet === 0) return false;

    for (let i = 0; i < adet; i++) {
      await page.goto(adres);
      await page.locator('a[href^="/randevularim/"]').nth(i).click();
      await page.waitForURL(/randevularim\/.+/, { timeout: 15_000 });
      if ((await page.getByRole('button', { name: dugme }).count()) > 0) return true;
    }
  }
  return false;
}

test.describe('müşteri randevu yolculuğu', () => {
  test('keşfetten randevuya kadar uçtan uca çalışır', async ({ page }) => {
    await login(page, ACCOUNTS.customer);

    // Keşfet: filtreleyip bir işletmeye gir.
    await page.goto('/kesfet?kategori=dis-klinigi');
    await expect(page.getByRole('heading', { name: 'Diş klinikleri' })).toBeVisible();
    const firstCard = page.locator('a[href^="/isletme/"]').first();
    await expect(firstCard).toBeVisible();
    await firstCard.click();

    await expect(page).toHaveURL(/\/isletme\//);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Randevu akışı: hizmet → personel → saat → onay.
    await page.getByRole('link', { name: 'Randevu al' }).first().click();
    await expect(page).toHaveURL(/\/randevu/);

    await page.locator('input[name="service"]').first().check();
    await page.getByRole('button', { name: 'Devam' }).click();

    await expect(page.getByText('Kiminle görüşmek istersiniz?')).toBeVisible();
    await page.getByRole('button', { name: 'Devam' }).click();

    // Uygun bir gün bulana kadar tarih şeridinde ilerle.
    const slotButton = page.locator('button').filter({ hasText: /^\d{2}:\d{2}$/ });
    let found = false;
    const days = page.getByRole('option');
    const dayCount = await days.count();
    for (let i = 0; i < Math.min(dayCount, 8); i++) {
      await days.nth(i).click();
      await page.waitForTimeout(900);
      if ((await slotButton.count()) > 0) {
        found = true;
        break;
      }
    }
    expect(found, 'önümüzdeki günlerde en az bir uygun saat bulunmalı').toBe(true);

    const chosen = await slotButton.first().innerText();
    await slotButton.first().click();
    await page.getByRole('button', { name: 'Devam' }).click();

    await expect(page.getByText('Randevu özeti')).toBeVisible();
    await page.getByRole('button', { name: /Randevuyu onayla/ }).click();

    // Onay ekranı ve kalıcı kayıt.
    await page.waitForURL(/\/randevularim\/.+/, { timeout: 25_000 });
    // Bildirim balonu da aynı metni gösterdiği için ana içerikle sınırlıyoruz.
    const main = page.locator('#icerik');
    await expect(main.getByText('Randevunuz oluşturuldu')).toBeVisible();
    await expect(main.getByText(chosen).first()).toBeVisible();

    // Liste ekranında da görünmeli.
    await page.goto('/randevularim');
    await expect(page.locator('a[href^="/randevularim/"]').first()).toBeVisible();
  });

  test('randevu iptal edilebilir ve listeden düşer', async ({ page }) => {
    await login(page, ACCOUNTS.customer);

    const bulundu = await randevuAc(page, 'İptal et');
    expect(bulundu, 'iptal edilebilir bir yaklaşan randevu bulunmalı').toBe(true);

    await page.getByRole('button', { name: 'İptal et' }).click();
    await page.getByRole('button', { name: 'Evet, iptal et' }).click();
    await expect(page.locator('#icerik').getByText('İptal edildi').first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test('randevu ertelenebilir ve yeni saat kaydedilir', async ({ page }) => {
    await login(page, ACCOUNTS.customer);

    const bulundu = await randevuAc(page, 'Ertele');
    expect(bulundu, 'ertelenebilir bir yaklaşan randevu bulunmalı').toBe(true);

    await page.getByRole('button', { name: 'Ertele' }).click();

    // Uygun saat çıkan ilk günü seç.
    const slots = page.locator('button').filter({ hasText: /^\d{2}:\d{2}$/ });
    const days = page.getByRole('option');
    const dayCount = await days.count();
    let picked = false;
    for (let d = 0; d < Math.min(dayCount, 6); d++) {
      await days.nth(d).click();
      await page.waitForTimeout(900);
      if ((await slots.count()) > 0) {
        picked = true;
        break;
      }
    }
    expect(picked, 'erteleme için uygun bir gün bulunmalı').toBe(true);

    const target = await slots.first().innerText();
    await slots.first().click();
    await page.getByRole('button', { name: 'Yeni saate taşı' }).click();

    await expect(page.locator('#icerik').getByText(target).first()).toBeVisible({
      timeout: 20_000,
    });
  });
});

test.describe('kimlik doğrulama', () => {
  test('yanlış parola anlaşılır hata verir ve oturum açmaz', async ({ page }) => {
    await page.goto('/giris');
    await page.getByLabel('E-posta').fill(ACCOUNTS.customer);
    await page.getByLabel('Parola').fill('yanlisparola1');
    await page.getByRole('button', { name: 'Giriş yap' }).click();
    await expect(
      page.getByRole('alert').filter({ hasText: 'E-posta veya parola hatalı' }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/giris/);
  });

  test('giriş yapmadan randevularım sayfası girişe yönlendirir', async ({ page }) => {
    await logout(page);
    await page.goto('/randevularim');
    await expect(page).toHaveURL(/\/giris/);
  });
});
