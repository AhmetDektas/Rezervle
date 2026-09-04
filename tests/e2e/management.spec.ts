import { test, expect } from '@playwright/test';
import { login, logout, ACCOUNTS } from './helpers';

const SLUG = 'beyaz-dis-poliklinigi';

test.describe('kayıt', () => {
  test('yeni müşteri hesabı oluşturulur ve oturum açılır', async ({ page }) => {
    await logout(page);
    const email = `test-${Date.now()}@ornek.com`;

    await page.goto('/kayit');
    await page.getByLabel('Ad soyad').fill('Yeni Kullanıcı');
    await page.getByLabel('E-posta').fill(email);
    await page.getByLabel('Telefon').fill('0532 000 11 22');
    await page.getByLabel('Parola').fill('Rezzerv123');
    await page.getByRole('button', { name: 'Hesap oluştur' }).click();

    await page.waitForURL((url) => !url.pathname.startsWith('/kayit'), { timeout: 20_000 });
    await page.goto('/profil');
    await expect(page.locator('#icerik')).toContainText('Yeni Kullanıcı');
    await expect(page.locator('#icerik')).toContainText(email);
  });

  test('zayıf parola sunucuda reddedilir', async ({ page }) => {
    await logout(page);
    await page.goto('/kayit');
    await page.getByLabel('Ad soyad').fill('Zayıf Parola');
    await page.getByLabel('E-posta').fill(`zayif-${Date.now()}@ornek.com`);
    await page.getByLabel('Parola').fill('kisa');
    await page.getByRole('button', { name: 'Hesap oluştur' }).click();
    await expect(page.getByText('Parola en az 8 karakter olmalı.')).toBeVisible();
    await expect(page).toHaveURL(/\/kayit/);
  });

  test('kayıtlı e-posta ile ikinci hesap açılamaz', async ({ page }) => {
    await logout(page);
    await page.goto('/kayit');
    await page.getByLabel('Ad soyad').fill('Çakışan Hesap');
    await page.getByLabel('E-posta').fill(ACCOUNTS.customer);
    await page.getByLabel('Parola').fill('Rezzerv123');
    await page.getByRole('button', { name: 'Hesap oluştur' }).click();
    await expect(
      page.getByRole('alert').filter({ hasText: 'kayıtlı bir hesap zaten var' }),
    ).toBeVisible();
  });
});

test.describe('işletme yönetimi', () => {
  test('hizmet eklenir ve listede görünür', async ({ page }) => {
    await login(page, ACCOUNTS.owner);
    await page.goto(`/panel/${SLUG}/hizmetler`);

    const name = `Test hizmeti ${Date.now()}`;
    await page.getByRole('button', { name: 'Hizmet ekle' }).click();
    await page.getByLabel('Hizmet adı').fill(name);
    await page.getByLabel('Süre (dk)').fill('45');
    await page.getByLabel('Fiyat (TL)').fill('1200');
    await page.getByRole('button', { name: 'Hizmeti ekle' }).click();

    await expect(page.locator('#icerik').getByText(name)).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#icerik').getByText('₺1.200').first()).toBeVisible();
  });

  test('çalışma saatleri düzenlenebilir', async ({ page }) => {
    await login(page, ACCOUNTS.owner);
    await page.goto(`/panel/${SLUG}/subeler`);

    await page.getByRole('button', { name: 'Çalışma saatleri' }).first().click();
    await expect(page.getByRole('heading', { name: /çalışma saatleri/ })).toBeVisible();
    await page.getByLabel('Pazartesi açılış').fill('08:30');
    await page.getByRole('button', { name: 'Kaydet' }).click();

    await expect(page.locator('#icerik').getByText('08:30–19:00').first()).toBeVisible({
      timeout: 15_000,
    });

    // Eski haline geri al: sonraki testler varsayılan saatlere güvenir.
    await page.getByRole('button', { name: 'Çalışma saatleri' }).first().click();
    await page.getByLabel('Pazartesi açılış').fill('09:00');
    await page.getByRole('button', { name: 'Kaydet' }).click();
    await expect(page.locator('#icerik').getByText('09:00–19:00').first()).toBeVisible({
      timeout: 15_000,
    });
  });


  test('mevcut randevuları dışarıda bırakacak saat değişikliği reddedilir', async ({ page }) => {
    await login(page, ACCOUNTS.owner);
    await page.goto(`/panel/${SLUG}/subeler`);

    await page.getByRole('button', { name: 'Çalışma saatleri' }).first().click();
    await expect(page.getByRole('heading', { name: /çalışma saatleri/ })).toBeVisible();

    // Kapanışı 11:00'e çekmek öğleden sonraki randevuları saat dışında bırakır.
    await page.getByLabel('Pazartesi kapanış').fill('11:00');
    await page.getByRole('button', { name: 'Kaydet' }).click();

    await expect(page.getByRole('alert').filter({ hasText: 'randevu var' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('alert')).toContainText('Önce onları taşıyın veya iptal edin');

    // Saatler değişmemiş olmalı.
    await page.getByRole('button', { name: 'Vazgeç' }).click();
    await expect(page.locator('#icerik').getByText('09:00–19:00').first()).toBeVisible();
  });

  test('panelden telefon randevusu açılır', async ({ page }) => {
    await login(page, ACCOUNTS.owner);
    await page.goto(`/panel/${SLUG}/randevular`);

    await page.getByRole('button', { name: 'Randevu ekle' }).click();
    await page.getByLabel('Müşteri adı').fill('Telefonla Gelen');
    await page.getByLabel('Telefon').fill(`05${Date.now().toString().slice(-9)}`);

    const slots = page.locator('button').filter({ hasText: /^\d{2}:\d{2}$/ });
    await expect(slots.first()).toBeVisible({ timeout: 15_000 });
    await slots.first().click();
    await page.getByRole('button', { name: 'Randevuyu oluştur' }).click();

    // Masaüstü tablosu ve mobil kart listesi aynı adı içerir; görünür olanı seç.
    await expect(
      page.locator('#icerik').getByText('Telefonla Gelen').filter({ visible: true }).first(),
    ).toBeVisible({ timeout: 20_000 });
  });

  test('randevu durumu panelden güncellenir', async ({ page }) => {
    await login(page, ACCOUNTS.owner);
    await page.goto(`/panel/${SLUG}/randevular?durum=PENDING`);

    const confirm = page.getByRole('button', { name: 'Onayla' }).first();
    if ((await confirm.count()) === 0) {
      test.skip(true, 'onay bekleyen randevu yok');
    }
    await confirm.click();
    await expect(page.getByRole('status').filter({ hasText: 'Durum güncellendi' })).toBeVisible({
      timeout: 15_000,
    });
  });

  test('galeriye görsel eklenip kaldırılabilir', async ({ page }) => {
    await login(page, ACCOUNTS.owner);
    await page.goto(`/panel/${SLUG}/ayarlar`);

    await page.getByLabel('Görsel adresi').fill('https://ornek.test/salon.jpg');
    await page.getByLabel('Açıklama (isteğe bağlı)').fill('Bekleme salonu');
    await page.getByRole('button', { name: 'Galeriye ekle' }).click();

    await expect(page.locator('#icerik').getByText('Bekleme salonu')).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole('button', { name: 'Görseli kaldır' }).first().click();
    await page.getByRole('button', { name: 'Kaldır' }).click();
    await expect(page.locator('#icerik').getByText('Bekleme salonu')).toBeHidden({
      timeout: 15_000,
    });
  });

  test('http adresli görsel reddedilir', async ({ page }) => {
    await login(page, ACCOUNTS.owner);
    await page.goto(`/panel/${SLUG}/ayarlar`);
    await page.getByLabel('Görsel adresi').fill('http://guvensiz.test/a.jpg');
    await page.getByRole('button', { name: 'Galeriye ekle' }).click();
    await expect(page.getByText('Görsel adresi https ile başlamalı.')).toBeVisible();
  });
});

test.describe('platform yönetimi işlemleri', () => {
  // Bu iki test tek seferlik tohum durumunu tüketir (bekleyen işletme, şikayet edilen
  // yorum). İki tarayıcı profilinde de koşarsa ikincisi veriyi bulamaz; masaüstünde
  // koşmaları yeterli — düzen değil davranış test ediliyor.
  test.beforeEach(() => {
    test.skip(test.info().project.name !== 'masaustu', 'tek seferlik tohum verisi');
  });

  test('bekleyen işletme onaylanır ve yayına alınır', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await page.goto('/yonetim/isletmeler?durum=PENDING');

    const approve = page.getByRole('button', { name: 'Onayla' }).first();
    if ((await approve.count()) === 0) {
      test.skip(true, 'onay bekleyen işletme yok');
    }
    await approve.click();
    await expect(page.getByRole('status').filter({ hasText: 'İşletme durumu güncellendi' })).toBeVisible({
      timeout: 15_000,
    });
  });

  test('şikayet edilen değerlendirme gizlenebilir', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await page.goto('/yonetim/degerlendirmeler?durum=REPORTED');

    const hide = page.getByRole('button', { name: 'Gizle' }).first();
    if ((await hide.count()) === 0) {
      test.skip(true, 'şikayet edilen değerlendirme yok');
    }
    await hide.click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Değerlendirme gizlendi' }),
    ).toBeVisible({ timeout: 15_000 });
  });
});
