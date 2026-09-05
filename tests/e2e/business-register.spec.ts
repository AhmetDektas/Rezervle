import { test, expect } from '@playwright/test';
import { PASSWORD } from './helpers';

// Rezzerv'in arz tarafına açılan tek kapı. Bozulursa yeni işletme hiç
// kaydolamaz ve bunu kimse fark etmez: mevcut işletmeler tohumdan geldiği
// için panel, keşfet ve randevu akışı sorunsuz çalışmaya devam eder.

/** Her koşu kendi e-postasını üretir: E2E veritabanı testler arası sıfırlanmıyor. */
function benzersiz(): { email: string; ad: string } {
  const damga = Date.now().toString(36);
  return { email: `basvuru-${damga}@ornek.com`, ad: `Test Kuaför ${damga}` };
}

test.describe('işletme başvurusu', () => {
  test('boş form Türkçe hata mesajları gösterir', async ({ page }) => {
    await page.goto('/kayit/isletme');
    await page.getByRole('button', { name: 'Başvuruyu gönder' }).click();

    await expect(page.getByText('Lütfen formu kontrol edin.')).toBeVisible();
    // Seçilmemiş <select> hiç gönderilmiyor (placeholder seçeneği disabled).
    // Sunucu bunu boş dizeye çevirmezse kullanıcı Zod'un İngilizce
    // "Expected string, received null" metnini görüyordu.
    await expect(page.getByText('Kategori seçin.')).toBeVisible();
    await expect(page.getByText('Semt seçin.')).toBeVisible();
    await expect(page.getByText('Devam etmek için onay verin.')).toBeVisible();
  });

  test('başvuru sahibi panele girer, işletme onaya kadar yayında olmaz', async ({ page }) => {
    const { email, ad } = benzersiz();

    await page.goto('/kayit/isletme');
    await page.getByLabel('İşletme adı').fill(ad);
    await page.getByLabel('Kategori').selectOption('guzellik-salonu');
    await page.getByLabel('Semt').selectOption('Keçiören');
    await page.getByLabel('Açık adres').fill('Kalaba Mah. Şehit Sok. No:5');
    await page.getByLabel('Ad soyad').fill('Test Yetkili');
    await page.getByLabel('E-posta').fill(email);
    await page.getByLabel('Telefon').fill('0532 111 22 33');
    await page.getByLabel('Parola').fill(PASSWORD);
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Başvuruyu gönder' }).click();

    // Başvuru aynı zamanda kayıt: oturum açılır ve sahip panele düşer.
    await page.waitForURL(/\/panel\//, { timeout: 20_000 });
    await expect(page.getByText('Başvurunuz inceleniyor.')).toBeVisible();

    const slug = new URL(page.url()).pathname.split('/')[2];
    expect(slug).toBeTruthy();

    // Onaya kadar herkese açık sayfa yok: bağlantı gösterilmez, adres 404 verir.
    await expect(page.getByRole('link', { name: 'Sayfayı gör' })).toHaveCount(0);
    await page.goto(`/isletme/${slug}`);
    await expect(page.getByRole('heading', { name: 'Aradığınız sayfa bulunamadı' })).toBeVisible();

    // Uyarı yalnızca panoya değil, hazırlık yapılan sayfalara da düşer.
    await page.goto(`/panel/${slug}/hizmetler`);
    await expect(page.getByText('Başvurunuz inceleniyor.')).toBeVisible();
  });

  test('kayıtlı e-posta ikinci kez kabul edilmez', async ({ page }) => {
    const { email, ad } = benzersiz();

    async function basvur(isim: string) {
      await page.goto('/kayit/isletme');
      await page.getByLabel('İşletme adı').fill(isim);
      await page.getByLabel('Kategori').selectOption('guzellik-salonu');
      await page.getByLabel('Semt').selectOption('Çankaya');
      await page.getByLabel('Açık adres').fill('Kızılırmak Mah. 1450 Sok. No:2');
      await page.getByLabel('Ad soyad').fill('Test Yetkili');
      await page.getByLabel('E-posta').fill(email);
      await page.getByLabel('Telefon').fill('0532 111 22 44');
      await page.getByLabel('Parola').fill(PASSWORD);
      await page.getByRole('checkbox').check();
      await page.getByRole('button', { name: 'Başvuruyu gönder' }).click();
    }

    await basvur(ad);
    await page.waitForURL(/\/panel\//, { timeout: 20_000 });

    await page.goto('/cikis');
    await page.waitForURL('**/');

    await basvur(`${ad} 2`);
    await expect(page.getByText('Bu e-posta ile kayıtlı bir hesap zaten var.')).toBeVisible();
    await expect(page).toHaveURL(/\/kayit\/isletme/);
  });
});
