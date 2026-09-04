import { test, expect, type Page } from '@playwright/test';
import { login, ACCOUNTS } from './helpers';

// Regression: BUG-001 — onay ekranı kaporayı indirimsiz fiyattan hesaplıyordu,
// sunucu ise indirimli fiyattan tahsil ediyordu. Buton "₺1.700 öde ve onayla"
// derken veritabanına ₺1.445 yazılıyordu.
// Regression: BUG-002 — kampanya kodu girildiğinde özet ekranında hiçbir şey
// değişmiyordu; müşteri kodun geçip geçmediğini ödemeden önce göremiyordu.
// Found by /qa on 2026-09-04
// Report: .gstack/qa-reports/qa-report-rezzerv-2026-09-04.md

const SLUG = 'estetika-medikal-estetik';
const PROMO = 'ESTE15'; // %15, tohum verisinde tanımlı

/** Botoks (kapora istenen pahalı hizmet) ile onay adımına kadar ilerler. */
async function reachSummary(page: Page): Promise<boolean> {
  await page.goto(`/isletme/${SLUG}/randevu`);

  const botox = page
    .locator('label')
    .filter({ hasText: 'Botoks uygulaması' })
    .locator('input[name="service"]');
  await botox.check();
  await page.getByRole('button', { name: 'Devam' }).click();
  await page.getByRole('button', { name: 'Devam' }).click();

  const slots = page.locator('button').filter({ hasText: /^\d{2}:\d{2}$/ });
  const days = page.getByRole('option');
  const dayCount = await days.count();
  for (let i = 0; i < Math.min(dayCount, 8); i++) {
    await days.nth(i).click();
    await page.waitForTimeout(900);
    if ((await slots.count()) > 0) {
      await slots.first().click();
      await page.getByRole('button', { name: 'Devam' }).click();
      await expect(page.getByText('Randevu özeti')).toBeVisible();
      return true;
    }
  }
  return false;
}

test.describe('onay ekranı tutarları', () => {
  test('kampanya kodu tüm tutarları günceller ve indirimi gösterir', async ({ page }) => {
    await login(page, ACCOUNTS.customer);
    test.skip(!(await reachSummary(page)), 'uygun saat bulunamadı');

    const main = page.locator('#icerik');
    // Kodsuz: tam fiyat üzerinden kapora.
    await expect(page.getByRole('button', { name: /₺1\.700 öde ve onayla/ })).toBeVisible();

    await page.getByLabel('Kampanya kodu').fill(PROMO);

    // Kod geçerli: indirim satırı çıkar, kapora indirimli tutardan hesaplanır.
    await expect(main.getByText('Kampanya indirimi')).toBeVisible({ timeout: 15_000 });
    await expect(main.getByText('−₺1.275')).toBeVisible();
    await expect(page.getByText(/Kod geçerli — ₺1\.275 indirim uygulandı/)).toBeVisible();

    // %20 × 7.225 = 1.445 — sunucunun tahsil edeceği tutarın aynısı.
    await expect(page.getByRole('button', { name: /₺1\.445 öde ve onayla/ })).toBeVisible();
    await expect(main.getByText('₺5.780')).toBeVisible(); // işletmede ödenecek
  });

  test('gösterilen kapora, tahsil edilen kaporayla birebir aynıdır', async ({ page }) => {
    await login(page, ACCOUNTS.customer);
    test.skip(!(await reachSummary(page)), 'uygun saat bulunamadı');

    await page.getByLabel('Kampanya kodu').fill(PROMO);
    await expect(page.getByText(/Kod geçerli/)).toBeVisible({ timeout: 15_000 });

    const label = await page.getByRole('button', { name: /öde ve onayla/ }).innerText();
    const shown = label.match(/₺([\d.]+)/)?.[1]?.replace(/\./g, '');
    expect(shown, 'butonda bir tutar yazmalı').toBeTruthy();

    await page.getByRole('button', { name: /öde ve onayla/ }).click();
    await page.waitForURL(/\/randevularim\/.+/, { timeout: 25_000 });

    // Randevu detayındaki kapora satırı butondaki tutarla aynı olmalı.
    const detail = page.locator('#icerik');
    await expect(detail.getByText('Kapora alındı')).toBeVisible();
    const body = await detail.innerText();
    const charged = body.match(/Kapora[^\n]*\n₺([\d.]+)/)?.[1]?.replace(/\./g, '');
    expect(charged, 'detayda kapora tutarı bulunmalı').toBeTruthy();
    expect(charged).toBe(shown);
  });

  test('geçersiz kod ödemeden önce uyarır ve onayı kilitler', async ({ page }) => {
    await login(page, ACCOUNTS.customer);
    test.skip(!(await reachSummary(page)), 'uygun saat bulunamadı');

    await page.getByLabel('Kampanya kodu').fill('GECERSIZKOD');
    await expect(page.getByText('Kampanya kodu geçersiz.')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /öde ve onayla/ })).toBeDisabled();
  });
});
