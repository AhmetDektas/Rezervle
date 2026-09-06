import type { Page, Locator } from '@playwright/test';
import { test, expect } from './fixtures';
import { login, ACCOUNTS, resetRateLimits } from './helpers';

// Tek randevuda birden fazla hizmet: müşteri sac kesimi + sakal düzeltmeyi
// ayrı ayrı randevu almak zorunda kalmasın.
//
// Personel hizmetlerin bir ALT KÜMESINI veriyor, yani rastgele iki hizmet
// birlikte alınamayabiliyor ve bu doğru davranış. Testler bu yüzden sabit bir
// hizmet çiftine bağlanmıyor: uygun çifti arıyor, bulamazsa atlıyor. Sabit
// çift seçilseydi tohum verisi değiştiğinde uygulama sağlamken düşerdi.

test.beforeEach(async () => {
  await resetRateLimits();
});

/**
 * Güzellik salonu: hizmetler birbirinin üstüne eklenen işlemler, yani çoklu
 * seçim burada anlamlı. Restoran/halı saha KULLANILMAZ — orada hizmet aynı
 * şeyin varyantı (masa boyutu, kiralama süresi) ve seçim bilerek tekli.
 */
const SALON = 'studio-nar-guzellik';

async function hizmetAdimi(page: Page): Promise<Locator> {
  await page.goto(`/isletme/${SALON}/randevu`);
  const kutular = page.locator('input[name="service"]');
  await expect(kutular.first()).toBeVisible();
  return kutular;
}

/** Etiketlerin ilk satırı hizmetin adı. Hizmet adımındayken okunmalı. */
async function hizmetAdlari(page: Page): Promise<string[]> {
  const etiketler = await page.locator('label:has(input[name="service"])').allInnerTexts();
  return etiketler.map((m) => m.split('\n')[0]!.trim());
}

/**
 * Hizmet çiftlerini deneyip birini seçili bırakır.
 *
 * `birlikte: true` → aynı personelin verebildiği çift aranır.
 * `birlikte: false` → verilemeyen çift aranır (açıklama ekranı için).
 * Bulunan çift SEÇILI ve personel adımında bırakılır — hizmet kutuları o
 * adımda ekranda olmadığı için adlar aramadan ÖNCE okunup birlikte döner.
 */
async function ciftAra(page: Page, kutular: Locator, birlikte: boolean) {
  const adlar = await hizmetAdlari(page);
  const adet = Math.min(await kutular.count(), 5);
  const devam = page.getByRole('button', { name: 'Devam' });
  for (let i = 0; i < adet; i++) {
    for (let j = i + 1; j < adet; j++) {
      await kutular.nth(i).check();
      await kutular.nth(j).check();
      await devam.click();
      // Personel adımında "Devam" açıksa bu çifti verebilen personel var.
      if ((await devam.isEnabled()) === birlikte) return { i, j, adlar };
      await page.getByRole('button', { name: 'Geri' }).click();
      await kutular.nth(i).uncheck();
      await kutular.nth(j).uncheck();
    }
  }
  return null;
}

/** İlk uygun günü ve saati seçer. */
async function uygunSaatSec(page: Page): Promise<boolean> {
  const saatler = page.locator('button').filter({ hasText: /^\d{2}:\d{2}$/ });
  const gunler = page.getByRole('option');
  const gunSayisi = await gunler.count();
  for (let i = 0; i < Math.min(gunSayisi, 8); i++) {
    await gunler.nth(i).click();
    await page.waitForTimeout(900);
    if ((await saatler.count()) > 0) {
      await saatler.first().click();
      return true;
    }
  }
  return false;
}

test.describe('çoklu hizmet seçimi', () => {
  test('iki hizmet birlikte seçili kalır', async ({ page }) => {
    await login(page, ACCOUNTS.customer);
    const kutular = await hizmetAdimi(page);

    await kutular.nth(0).check();
    await kutular.nth(1).check();

    // Asıl kusur buydu: ikinciyi seçmek birincinin seçimini düşürüyordu.
    await expect(kutular.nth(0)).toBeChecked();
    await expect(kutular.nth(1)).toBeChecked();
    await expect(page.getByText('2 hizmet ·')).toBeVisible();
  });

  test('seçim kaldırılabilir', async ({ page }) => {
    await login(page, ACCOUNTS.customer);
    const kutular = await hizmetAdimi(page);

    await kutular.nth(0).check();
    await kutular.nth(1).check();
    await kutular.nth(0).uncheck();

    await expect(kutular.nth(0)).not.toBeChecked();
    await expect(kutular.nth(1)).toBeChecked();
  });

  test('özet ekranı hizmetlerin ikisini de listeler', async ({ page }) => {
    await login(page, ACCOUNTS.customer);
    const kutular = await hizmetAdimi(page);

    const cift = await ciftAra(page, kutular, true);
    test.skip(cift === null, 'birlikte alınabilen hizmet çifti yok');
    const ilkAd = cift!.adlar[cift!.i]!;
    const ikinciAd = cift!.adlar[cift!.j]!;

    await page.getByRole('button', { name: 'Devam' }).click();
    expect(await uygunSaatSec(page), 'iki hizmete yetecek saat bulunmalı').toBe(true);
    await page.getByRole('button', { name: 'Devam' }).click();

    await expect(page.getByText('Randevu özeti')).toBeVisible();
    const ozet = page.locator('dl').first();
    await expect(ozet.getByText(ilkAd, { exact: true })).toBeVisible();
    await expect(ozet.getByText(ikinciAd, { exact: true })).toBeVisible();
  });

  test('oluşturulan randevu iki hizmeti de saklar', async ({ page }) => {
    await login(page, ACCOUNTS.customer);
    const kutular = await hizmetAdimi(page);

    const cift = await ciftAra(page, kutular, true);
    test.skip(cift === null, 'birlikte alınabilen hizmet çifti yok');
    const ikinciAd = cift!.adlar[cift!.j]!;

    await page.getByRole('button', { name: 'Devam' }).click();
    expect(await uygunSaatSec(page)).toBe(true);
    await page.getByRole('button', { name: 'Devam' }).click();
    await page.getByRole('button', { name: /Randevuyu onayla/ }).click();

    await page.waitForURL(/\/randevularim\/.+/, { timeout: 25_000 });
    const main = page.locator('#icerik');
    // Kayıt gerçekten iki kalem taşımalı; yalnızca ilki yazılsaydı ikinci
    // hizmetin adı burada hiç görünmezdi.
    await expect(main.getByText('Hizmetler')).toBeVisible();
    await expect(main.getByText(ikinciAd, { exact: true }).first()).toBeVisible();
  });

  test('restoranda seçim tekli kalır', async ({ page }) => {
    // "2 kişilik masa + 4 kişilik masa" diye bir rezervasyon yok: hizmet
    // burada işlem değil, aynı şeyin varyantı.
    await login(page, ACCOUNTS.customer);
    await page.goto('/isletme/kavakli-ocakbasi/randevu');
    const kutular = page.locator('input[name="service"]');
    await expect(kutular.first()).toBeVisible();

    await kutular.nth(0).check();
    await kutular.nth(1).check();

    await expect(kutular.nth(0)).not.toBeChecked();
    await expect(kutular.nth(1)).toBeChecked();
    await expect(page.getByText('Birden fazla hizmet seçebilirsiniz')).toHaveCount(0);
  });

  test('birlikte verilemeyen hizmetlerde sebep açıklanır', async ({ page }) => {
    await login(page, ACCOUNTS.customer);
    const kutular = await hizmetAdimi(page);

    const cift = await ciftAra(page, kutular, false);
    test.skip(cift === null, 'her hizmet çifti birlikte alınabiliyor');

    // Kullanıcı sebepsiz devre dışı bir düğmeyle baş başa kalmamalı: sorunun
    // şube değil hizmet birleşimi olduğu yazmalı ve geri dönüş yolu olmalı.
    await expect(page.getByText('Seçtiğiniz hizmetleri birlikte veren kimse yok')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Hizmetleri değiştir' })).toBeVisible();
  });
});
