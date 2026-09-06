import { test, expect, type Page } from './fixtures';
import { login, logout, ACCOUNTS, resetRateLimits } from './helpers';

/** Rezervasyon akışını "Onay" adımına kadar götürür; saat bulunamazsa null döner. */
async function reachSummary(page: Page, slug: string): Promise<string | null> {
  await page.goto(`/isletme/${slug}/randevu`);
  await page.locator('input[name="service"]').first().check();
  await page.getByRole('button', { name: 'Devam' }).click();
  await page.getByRole('button', { name: 'Devam' }).click();

  const slots = page.locator('button').filter({ hasText: /^\d{2}:\d{2}$/ });
  const days = page.getByRole('option');
  const dayCount = await days.count();
  for (let i = 0; i < Math.min(dayCount, 8); i++) {
    await days.nth(i).click();
    await page.waitForTimeout(900);
    if ((await slots.count()) > 0) {
      const label = await slots.first().innerText();
      await slots.first().click();
      await page.getByRole('button', { name: 'Devam' }).click();
      await expect(page.getByText('Randevu özeti')).toBeVisible();
      return label;
    }
  }
  return null;
}

// Randevu hız sınırı testler arası taşmasın (bkz. helpers.resetRateLimits).
test.beforeEach(async () => {
  await resetRateLimits();
});

test.describe('kapora — müşteri tarafı', () => {
  test('kapora açık işletmede tutar ve politika özet ekranında görünür', async ({ page }) => {
    await login(page, ACCOUNTS.customer);
    const slot = await reachSummary(page, 'gulveren-spor-tesisleri');
    test.skip(slot === null, 'uygun saat bulunamadı');

    const main = page.locator('#icerik');
    await expect(main.getByText('Kapora: ₺300')).toBeVisible();
    await expect(main.getByText('Şimdi ödenecek kapora')).toBeVisible();
    await expect(main.getByText('İşletmede ödenecek')).toBeVisible();
    await expect(main.getByText(/24 saat öncesine kadar iptal ederseniz kapora iade edilir/)).toBeVisible();
    await expect(page.getByRole('button', { name: /₺300 öde ve onayla/ })).toBeVisible();
  });

  test('kapora kapalı işletmede kapora hiç görünmez', async ({ page }) => {
    await login(page, ACCOUNTS.customer);
    const slot = await reachSummary(page, 'beyaz-dis-poliklinigi');
    test.skip(slot === null, 'uygun saat bulunamadı');

    await expect(page.locator('#icerik').getByText('Kapora')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Randevuyu onayla' })).toBeVisible();
  });

  test('kapora ödenen randevu detayında tutar ve kalan gösterilir', async ({ page }) => {
    await login(page, ACCOUNTS.customer);
    const slot = await reachSummary(page, 'gulveren-spor-tesisleri');
    test.skip(slot === null, 'uygun saat bulunamadı');

    await page.getByRole('button', { name: /öde ve onayla/ }).click();

    // Kapora asenkron tahsil ediliyor (T2): müşteri önce 3DS'e gidiyor,
    // randevu ancak webhook geldikten sonra kesinleşiyor. Eskiden bu adım
    // yoktu ve test doğrudan randevu detayına düşüyordu.
    await page.waitForURL(/\/odeme\/3ds/, { timeout: 25_000 });
    await page.getByRole('button', { name: 'Ödemeyi onayla' }).click();
    await page.waitForURL(/\/odeme\/donus/, { timeout: 25_000 });
    await expect(page.getByText('Ödemeniz alındı')).toBeVisible({ timeout: 30_000 });
    await page.getByRole('link', { name: 'Randevuma git' }).click();
    await page.waitForURL(/\/randevularim\/.+/, { timeout: 25_000 });

    const main = page.locator('#icerik');
    await expect(main.getByText('Kapora alındı')).toBeVisible();
    await expect(main.getByText('İşletmede ödenecek')).toBeVisible();
    await expect(main.getByText(/Saatiniz size ayrıldı/)).toBeVisible();
  });
});

test.describe('kapora — işletme paneli', () => {
  test('paketi olan işletme kapora ayarlarını görür ve önizleme hesaplanır', async ({ page }) => {
    await login(page, 'kemal@gulverenspor.com');
    await page.goto('/panel/gulveren-spor-tesisleri/ayarlar');

    await expect(page.getByRole('heading', { name: 'Kapora' })).toBeVisible();
    await expect(page.getByLabel('Online randevularda kapora iste')).toBeChecked();
    await expect(page.getByText(/müşteriden .*₺300.* kapora istenir/)).toBeVisible();

    // Sabit tutarı değiştirince önizleme de değişmeli.
    await page.getByLabel('Tutar (TL)').fill('450');
    await expect(page.getByText(/müşteriden .*₺450.* kapora istenir/)).toBeVisible();
  });

  test('paketi olmayan işletmede kapora kilitli görünür', async ({ page }) => {
    await login(page, ACCOUNTS.owner);
    await page.goto('/panel/beyaz-dis-poliklinigi/ayarlar');
    await expect(page.getByText('Kapora paketi kapalı')).toBeVisible();
    await expect(page.getByLabel('Online randevularda kapora iste')).toHaveCount(0);
  });

  test('raporlarda kapora bölümü görünür', async ({ page }) => {
    await login(page, 'kemal@gulverenspor.com');
    await page.goto('/panel/gulveren-spor-tesisleri/raporlar');
    await expect(page.getByRole('heading', { name: 'Kapora ve hak ediş' })).toBeVisible();
  });
});

test.describe('onay öncesi takvim bakışı', () => {
  test('onay bekleyen randevuda günün programı açılır ve onaylanır', async ({ page }) => {
    await login(page, ACCOUNTS.owner);
    await page.goto('/panel/beyaz-dis-poliklinigi/randevular?durum=PENDING');

    const review = page.getByRole('button', { name: 'Takvimde gör' }).first();
    test.skip((await review.count()) === 0, 'onay bekleyen randevu yok');
    await review.click();

    await expect(page.getByRole('heading', { name: 'Onay öncesi gün bakışı' })).toBeVisible();
    await expect(page.getByText('← onaylanacak')).toBeVisible();
    await expect(page.getByText(/programı \(\d+ randevu\)/)).toBeVisible();
    // Öncesi/sonrası bağlamı yazılmalı.
    await expect(page.getByText(/randevu|boşluk/).first()).toBeVisible();

    await page.getByRole('button', { name: 'Onayla' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Randevu onaylandı' })).toBeVisible({
      timeout: 15_000,
    });
  });
});

test.describe('kapora paketi — platform yönetimi', () => {
  test('yönetici paketi açıp kapatabilir', async ({ page }) => {
    test.skip(test.info().project.name !== 'masaustu', 'tek profilde yeterli');
    await logout(page);
    await login(page, ACCOUNTS.admin);
    await page.goto('/yonetim/isletmeler?durum=APPROVED');

    const give = page.getByRole('button', { name: 'Kapora paketi ver' }).first();
    await expect(give).toBeVisible();
    await give.click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Kapora paketi etkinleştirildi' }),
    ).toBeVisible({ timeout: 15_000 });

    // Geri kapat: sonraki koşular için başlangıç durumu korunsun.
    await page.getByRole('button', { name: 'Kapora paketi açık' }).first().click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Kapora paketi kapatıldı' }),
    ).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('komisyon ve hak ediş', () => {
  test('işletme raporlarında hak ediş dağılımı görünür', async ({ page }) => {
    await login(page, 'kemal@gulverenspor.com');
    await page.goto('/panel/gulveren-spor-tesisleri/raporlar');

    await expect(page.getByRole('heading', { name: 'Kapora ve hak ediş' })).toBeVisible();
    await expect(page.getByText('Hesabınıza geçen')).toBeVisible();
    await expect(page.getByText('Bloke bekleyen')).toBeVisible();
    await expect(page.getByText('Platform komisyonu', { exact: true })).toBeVisible();
    await expect(page.getByText('Müşteriye iade')).toBeVisible();
    await expect(page.getByText(/Rezzerv müşteri parasını|ödeme kuruluşunda tutulur/)).toBeVisible();
  });

  test('hak ediş hesabı kaydedilir, hatalı IBAN reddedilir', async ({ page }) => {
    await login(page, 'kemal@gulverenspor.com');
    await page.goto('/panel/gulveren-spor-tesisleri/ayarlar');

    await expect(page.getByRole('heading', { name: 'Hak ediş hesabı' })).toBeVisible();
    await expect(page.getByText(/₺300 kaporada ₺90 komisyon/)).toBeVisible();

    await page.getByLabel('IBAN').fill('TR12');
    await page.getByRole('button', { name: 'Hak ediş hesabını kaydet' }).click();
    await expect(page.getByText(/IBAN "TR" ile başlamalı/)).toBeVisible();

    await page.getByLabel('IBAN').fill('TR330006100519786457841326');
    await page.getByRole('button', { name: 'Hak ediş hesabını kaydet' }).click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Hak ediş hesabı güncellendi' }),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('yönetici komisyon gelirini işletme kırılımıyla görür', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await page.goto('/yonetim/komisyon');

    await expect(page.getByRole('heading', { name: 'Komisyon geliri' })).toBeVisible();
    await expect(page.getByText('Aracılık edilen tutar')).toBeVisible();
    await expect(page.getByText(/Platform müşteri parasını hiçbir zaman kendi hesabında tutmaz/)).toBeVisible();
    await expect(page.getByText('Gülveren Spor Tesisleri')).toBeVisible();
  });

  test('kapora paketi olmayan işletmede hak ediş hesabı istenmez', async ({ page }) => {
    await login(page, ACCOUNTS.owner);
    await page.goto('/panel/beyaz-dis-poliklinigi/ayarlar');
    await expect(page.getByRole('heading', { name: 'Hak ediş hesabı' })).toHaveCount(0);
  });
});
