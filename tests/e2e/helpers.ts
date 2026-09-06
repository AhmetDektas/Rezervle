import type { Page } from '@playwright/test';

export const ACCOUNTS = {
  customer: 'demo@rezzerv.com',
  owner: 'serhat@beyazdis.com',
  staff: 'aylin.kara@beyazdispoliklinigi.com',
  admin: 'admin@rezzerv.com',
};

export const PASSWORD = 'Rezzerv123';

/** Form üzerinden gerçek giriş yapar (demo kısayolu değil). */
export async function login(page: Page, email: string): Promise<void> {
  await page.goto('/giris');
  await page.getByLabel('E-posta').fill(email);
  await page.getByLabel('Parola').fill(PASSWORD);
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/giris'), { timeout: 20_000 });
}

export async function logout(page: Page): Promise<void> {
  // domcontentloaded: `/cikis` ana sayfaya yönlendiriyor ve varsayılan `load`
  // beklemesi oradaki tüm görsellerin inmesini bekliyordu. Çıkış yapmak için
  // kendi HTML'imizin hazır olması yeterli.
  await page.goto('/cikis', { waitUntil: 'domcontentloaded' });
  await page.waitForURL('**/');
}

/**
 * TÜM hız sınırı sayaçlarını temizler.
 *
 * Sınırlar gerçek kullanıcı için fazlasıyla cömert (randevu 15/saat, işletme
 * başvurusu 10/saat) ama E2E takımı aynı hesap ve aynı IP üzerinden onlarca
 * kayıt ve randevu üretiyor: koruma çalıştığı için test düşüyor, üründe bir
 * sorun olduğu için değil.
 *
 * Önce yalnızca randevu sayacı temizleniyordu; işletme başvurusu sınırı
 * gözden kaçmıştı ve takım saat içinde ikinci kez koşturulduğunda kayıt
 * testleri düşüyordu. Sebebi bulmak zor çünkü her koşuda BAŞKA bir test
 * düşüyor — kotayı önce hangisi tüketirse.
 *
 * Sınırı gevşetmek yanlış olurdu: üretimdeki korumayı testin rahatlığı için
 * zayıflatmak demekti. Bunun yerine testler arası durum temizleniyor; diğer
 * her yerde (veritabanı fixture'ı, tohum) izlenen yol da bu.
 */
export async function resetRateLimits(): Promise<void> {
  const url = process.env['REDIS_URL'] ?? 'redis://localhost:6379';
  const { default: IORedis } = await import('ioredis');
  const redis = new IORedis(url, { maxRetriesPerRequest: 1, lazyConnect: true });
  try {
    await redis.connect();
    const anahtarlar = await redis.keys('rl:*');
    if (anahtarlar.length) await redis.del(...anahtarlar);
  } catch {
    // Redis yoksa sınır zaten devre dışı; temizlenecek bir şey de yok.
  } finally {
    redis.disconnect();
  }
}
