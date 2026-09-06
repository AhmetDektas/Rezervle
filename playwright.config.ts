import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;
process.env['E2E_PORT'] = String(PORT);
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  // Rotaları önceden derletir: geliştirme sunucusu her rotayı ilk istekte
  // derliyor ve koşunun sonunda ilk kez ziyaret edilen sayfa testin süresini
  // aşabiliyordu. Bkz. tests/e2e/global-setup.ts.
  globalSetup: './tests/e2e/global-setup.ts',
  // 90 sn: takım geliştirme sunucusuna karşı koşuyor ve 20 dakikalık bir
  // koşunun sonunda sunucu belirgin şekilde yavaşlıyor. Her koşuda BAŞKA bir
  // testin gezinme zaman aşımına uğraması bundandı — sıra kime gelirse.
  // Üründe böyle bir gecikme yok: aynı sayfalar üretim derlemesinde 50-200 ms.
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  use: {
    baseURL,
    // Gezinme için ayrı ve açık bir sınır: varsayılan, test bütçesinin
    // tamamını yiyip hatayı "test timeout" diye gösteriyor ve hangi adımın
    // takıldığı kayboluyordu.
    navigationTimeout: 45_000,
    locale: 'tr-TR',
    timezoneId: 'Europe/Istanbul',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'masaustu', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobil', use: { ...devices['Pixel 7'] } },
  ],
  // Testler geliştirme sunucusuna karşı koşar; tohum verisi hazır olmalıdır.
  webServer: {
    // Turbopack DENENDI VE GERI ALINDI. Sayfa derlemesini yarıya indiriyor
    // ama profil sayfasının istemci bileşenlerini hidrate etmiyordu: buton
    // görünüyor, tıklanıyor, hiçbir şey olmuyordu. Konsolda hata yok — sessiz
    // bir kırılma. Rıza geri alma testleri bu yüzden düşüyordu (webpack ile
    // 3/3, Turbopack ile 1/3). Hız, çalışmayan bir sayfaya değmez.
    command: `npx next dev -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
