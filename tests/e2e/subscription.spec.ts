import { test, expect } from './fixtures';
import { login, ACCOUNTS, resetRateLimits } from './helpers';

// Abonelik döngüsü: yönetici açık faturayı görüp tahsilatı işaretliyor,
// işletme kendi panelinde borcunu ve ödeme bilgisini görüyor.
//
// Tohum verisi her koşuda 24 açık fatura üretiyor (dönemi bitmiş işletmeler),
// bu yüzden testler sabit bir işletmeye değil "listedeki ilk açık fatura"ya
// bağlanıyor: katalog değiştiğinde uygulama sağlamken düşmesin.

test.beforeEach(async () => {
  await resetRateLimits();
});

test.describe('yönetim — abonelikler', () => {
  test('açık faturalar ve gelir özeti listelenir', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await page.goto('/yonetim/abonelikler');

    await expect(page.getByRole('heading', { name: 'Abonelikler' })).toBeVisible();
    await expect(page.getByText('Aylık yinelenen gelir')).toBeVisible();
    await expect(page.getByText('Açık fatura', { exact: true })).toBeVisible();

    // Tohum verisinde dönemi bitmiş işletmeler var; liste dolu olmalı.
    await expect(page.getByRole('button', { name: 'Ödendi' }).first()).toBeVisible();
  });

  test('gezinmede abonelikler bağlantısı var', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await page.goto('/yonetim');
    await page.getByRole('link', { name: 'Abonelikler' }).first().click();
    await expect(page).toHaveURL(/\/yonetim\/abonelikler/);
  });

  test('tahsilat işaretlenince fatura listeden düşer', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await page.goto('/yonetim/abonelikler');

    const satirlar = page.locator('main ul li').filter({ has: page.getByRole('button', { name: 'Ödendi' }) });
    const onceki = await satirlar.count();
    expect(onceki).toBeGreaterThan(0);
    const isletmeAdi = (await satirlar.first().locator('a').first().innerText()).trim();

    await satirlar.first().getByRole('button', { name: 'Ödendi' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    // Not KOŞUYA ÖZGÜ: iki tarayıcı profili aynı veritabanını paylaşıyor ve
    // sabit metin kullanılınca ikinci profil kendi kaydıyla masaüstününkini
    // birlikte buluyor, locator iki eşleşmeye düşüyordu.
    const dekont = `E2E havale ${Date.now()}`;
    await page.getByLabel('Dekont / açıklama').fill(dekont);
    await page.getByRole('button', { name: 'Ödendi olarak işaretle' }).click();

    // Fatura kapandı: açık listeden düşmeli, tahsilatlarda görünmeli.
    await expect(satirlar).toHaveCount(onceki - 1, { timeout: 20_000 });
    await expect(page.getByText(dekont)).toBeVisible();
    await expect(
      page.locator('main').getByText(isletmeAdi, { exact: true }).first(),
    ).toBeVisible();
  });

  test('gerekçesiz iptal kabul edilmez', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await page.goto('/yonetim/abonelikler');

    await page.getByRole('button', { name: 'İptal' }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    // Gerekçe alanı zorunlu: boş gönderim tarayıcıda durur, fatura kapanmaz.
    await page.getByRole('button', { name: 'Faturayı iptal et' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });
});

test.describe('panel — abonelik kartı', () => {
  test('işletme paketini ve durumunu görür', async ({ page }) => {
    await login(page, ACCOUNTS.owner);
    await page.goto('/panel/beyaz-dis-poliklinigi/ayarlar');

    await expect(page.getByRole('heading', { name: 'Abonelik' })).toBeVisible();
  });

  test('borçlu işletme fatura tutarını ve ödeme bilgisini görür', async ({ page }) => {
    // Yöneticiyle borçlu bir işletme bul; panelinde aynı borç görünmeli.
    await login(page, ACCOUNTS.admin);
    await page.goto('/yonetim/abonelikler');
    const ilkSatir = page
      .locator('main ul li')
      .filter({ has: page.getByRole('button', { name: 'Ödendi' }) })
      .first();
    const link = ilkSatir.locator('a').first();
    const href = await link.getAttribute('href');
    expect(href).toBeTruthy();

    await page.goto(`${href}/ayarlar`);
    await expect(page.getByText('Ödenmemiş fatura')).toBeVisible();
    // Ödeme bilgisi tanımlı değilse uydurma hesap YAZMAMALI.
    await expect(
      page.getByText(/Havale\/EFT ile ödeyebilirsiniz|Ödeme bilgileri henüz tanımlanmadı/),
    ).toBeVisible();
    // Gecikme hizmeti kesmiyor; bu söz panelde açıkça yazmalı.
    await expect(page.getByText(/randevu almanızı engellemez/)).toBeVisible();
  });
});
