import { test, expect } from './fixtures';

// Katalog 120 işletmeye çıkınca keşfetin sabit 24'lük kesiti, geri kalan 96
// işletmeyi hiçbir müşterinin ulaşamayacağı hâle getirdi: kayıt vardı,
// fotoğrafı vardı, menüsü vardı ama görünmüyordu. Bu testler o kapının
// açık kaldığını doğruluyor.

const KART = 'a[href^="/isletme/"]';

test.describe('keşfet sayfalama', () => {
  test('ilk sayfa dolu ve devamı var', async ({ page }) => {
    await page.goto('/kesfet');

    await expect(page.locator(KART)).toHaveCount(24);
    await expect(page.getByRole('link', { name: 'Daha fazla göster' })).toBeVisible();
    // İlk sayfada "Önceki" olmamalı.
    await expect(page.getByRole('link', { name: 'Önceki' })).toHaveCount(0);
  });

  test('sonraki sayfa FARKLI işletmeler gösterir', async ({ page }) => {
    await page.goto('/kesfet');
    const ilk = await page.locator(KART).first().getAttribute('href');

    await page.getByRole('link', { name: 'Daha fazla göster' }).click();
    await page.waitForURL(/sayfa=2/, { timeout: 20_000 });

    const ikinci = await page.locator(KART).first().getAttribute('href');
    // Aynı kayıtları tekrar göstermek, sayfalamanın çalışmadığını gizlerdi.
    expect(ikinci).not.toBe(ilk);
    await expect(page.getByRole('link', { name: 'Önceki' })).toBeVisible();
  });

  test('son sayfada "daha fazla" YOK', async ({ page }) => {
    await page.goto('/kesfet?sayfa=5');

    await expect(page.locator(KART).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Daha fazla göster' })).toHaveCount(0);
  });

  test('filtre sayfalamayla birlikte korunur', async ({ page }) => {
    await page.goto('/kesfet?kategori=dis-klinigi');
    const sayfa1 = await page.locator(KART).count();
    expect(sayfa1).toBeGreaterThan(0);

    // Kategori 20 işletme içeriyor: tek sayfaya sığıyor, ama filtre
    // bağlantıda kaybolmamalı.
    await expect(page).toHaveURL(/kategori=dis-klinigi/);
  });

  test('her kategoride en az 20 işletme var', async ({ page }) => {
    for (const kategori of [
      'restoran',
      'guzellik-salonu',
      'hali-saha',
      'dis-klinigi',
      'veteriner',
      'estetik-klinigi',
    ]) {
      await page.goto(`/kesfet?kategori=${kategori}`);
      const adet = await page.locator(KART).count();
      expect(adet, `${kategori} kategorisinde işletme listelenmeli`).toBeGreaterThanOrEqual(19);
    }
  });
});
