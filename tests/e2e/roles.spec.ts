import { test, expect } from '@playwright/test';
import { login, logout, ACCOUNTS } from './helpers';

test.describe('işletme paneli', () => {
  test('sahibi kendi panelini görür ve takvimi açar', async ({ page }) => {
    await login(page, ACCOUNTS.owner);
    await expect(page).toHaveURL(/\/panel/);
    await expect(page.getByRole('heading', { name: 'Bugün' })).toBeVisible();

    await page.getByRole('link', { name: 'Takvim' }).first().click();
    // Geliştirme sunucusunda bir rotanın ilk derlenmesi saniyeler sürebilir;
    // gezinme beklentisine derleme payı bırakıyoruz.
    await page.waitForURL(/\/takvim/, { timeout: 30_000 });
    await expect(page.getByRole('heading', { name: 'Takvim' })).toBeVisible();

    // Görünüm değiştirme çalışmalı.
    await page.getByRole('radio', { name: 'Ajanda' }).click();
    await expect(page).toHaveURL(/gorunum=ajanda/);
  });

  test('panelin alt sayfaları yüklenir', async ({ page }) => {
    await login(page, ACCOUNTS.owner);
    await page.goto('/panel/beyaz-dis-poliklinigi/hizmetler');
    await expect(page.getByRole('heading', { name: 'Hizmetler' })).toBeVisible();

    await page.goto('/panel/beyaz-dis-poliklinigi/personel');
    await expect(page.getByRole('heading', { name: 'Personel' })).toBeVisible();

    await page.goto('/panel/beyaz-dis-poliklinigi/raporlar');
    await expect(page.getByRole('heading', { name: 'Raporlar' })).toBeVisible();

    await page.goto('/panel/beyaz-dis-poliklinigi/musteriler');
    await expect(page.getByRole('heading', { name: 'Müşteriler' })).toBeVisible();
  });

  test('sahibi başka bir işletmenin paneline giremez', async ({ page }) => {
    await login(page, ACCOUNTS.owner);
    await page.goto('/panel/studio-nar-guzellik');
    await expect(page).toHaveURL(/\/yetkisiz/);
    await expect(page.getByText('Bu sayfaya erişim yetkiniz yok')).toBeVisible();
  });
});

test.describe('yetkilendirme', () => {
  test('müşteri işletme paneline erişemez', async ({ page }) => {
    await login(page, ACCOUNTS.customer);
    await page.goto('/panel');
    await expect(page).toHaveURL(/\/yetkisiz/);
  });

  test('müşteri yönetim paneline erişemez', async ({ page }) => {
    await login(page, ACCOUNTS.customer);
    await page.goto('/yonetim');
    await expect(page).toHaveURL(/\/yetkisiz/);
  });

  test('işletme sahibi yönetim paneline erişemez', async ({ page }) => {
    await login(page, ACCOUNTS.owner);
    await page.goto('/yonetim/isletmeler');
    await expect(page).toHaveURL(/\/yetkisiz/);
  });

  test('oturum açmamış kullanıcı yönetim paneline erişemez', async ({ page }) => {
    await logout(page);
    await page.goto('/yonetim');
    await expect(page).toHaveURL(/\/giris/);
  });
});

test.describe('platform yönetimi', () => {
  test('yönetici işletmeleri ve bekleyen başvuruları görür', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await expect(page).toHaveURL(/\/yonetim/);
    await expect(page.getByRole('heading', { name: 'Platform genel bakış' })).toBeVisible();

    await page.getByRole('link', { name: 'İşletmeler' }).first().click();
    await page.waitForURL(/\/yonetim\/isletmeler/, { timeout: 30_000 });
    await expect(page.getByRole('heading', { name: 'İşletmeler' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Onay bekliyor/ }).first()).toBeVisible();
  });

  test('yönetici moderasyon ve kategori sayfalarını açar', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await page.goto('/yonetim/degerlendirmeler');
    await expect(page.getByRole('heading', { name: 'Değerlendirme moderasyonu' })).toBeVisible();

    await page.goto('/yonetim/kategoriler');
    await expect(page.getByRole('heading', { name: 'Kategoriler' })).toBeVisible();

    await page.goto('/yonetim/kullanicilar');
    await expect(page.getByRole('heading', { name: 'Kullanıcılar' })).toBeVisible();
  });
});

test.describe('keşif', () => {
  test('ana sayfa ve arama giriş yapmadan çalışır', async ({ page }) => {
    await logout(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Randevunu al');

    await page.goto('/kesfet?q=diş');
    await expect(page.locator('a[href^="/isletme/"]').first()).toBeVisible();
  });

  test('sonuç bulunmayan arama boş durumu gösterir', async ({ page }) => {
    await page.goto('/kesfet?q=zzzzbulunamaz');
    await expect(page.getByText('Aramanıza uygun işletme bulunamadı')).toBeVisible();
  });
});

test.describe('sektöre göre terminoloji', () => {
  test('halı saha rezervasyonu "saha" der, "personel" demez', async ({ page }) => {
    await page.goto('/isletme/gulveren-spor-tesisleri');
    await expect(page.getByRole('heading', { name: 'Kiralama seçenekleri' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Sahalar' })).toBeVisible();

    await page.goto('/isletme/gulveren-spor-tesisleri/randevu');
    await expect(page.getByText('Ne kadar süre kiralamak istersiniz?')).toBeVisible();
    await page.locator('input[name="service"]').first().check();
    await page.getByRole('button', { name: 'Devam' }).click();
    await expect(page.getByText('Hangi sahayı istersiniz?')).toBeVisible();
  });

  test('restoran rezervasyonu "masa" der', async ({ page }) => {
    await page.goto('/isletme/kavakli-ocakbasi');
    await expect(page.getByRole('heading', { name: 'Rezervasyon seçenekleri' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Masalar' })).toBeVisible();

    await page.goto('/isletme/kavakli-ocakbasi/randevu');
    await expect(page.getByText('Kaç kişilik masa istersiniz?')).toBeVisible();
  });

  test('halı saha paneli gezinmede "Sahalar" gösterir', async ({ page }) => {
    await login(page, 'kemal@gulverenspor.com');
    await page.goto('/panel/gulveren-spor-tesisleri/personel');
    await expect(page.getByRole('heading', { name: 'Sahalar' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Saha ekle' })).toBeVisible();
  });

  test('ana sayfada beş ana kategori sırayla listelenir', async ({ page }) => {
    await logout(page);
    await page.goto('/');
    const rail = page.locator('a[href^="/kesfet?kategori="]');
    const labels = await rail.allInnerTexts();
    const first = labels.slice(0, 5).map((t) => t.split('\n')[0]);
    expect(first).toEqual([
      'Restoranlar',
      'Güzellik salonları',
      'Halı sahalar',
      'Diş klinikleri',
      'Veterinerler',
    ]);
  });
});
