import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import IORedis from 'ioredis';
import {
  RATE_LIMITS,
  checkRateLimit,
  enforceRateLimit,
  clearRateLimit,
  resetRateLimitClient,
  type RateLimitRule,
} from '@/server/rate-limit';

// Hız sınırı sessizce çalışmayabilen bir korumadır: Redis yoksa ya da anahtar
// yanlış kuruluysa her istek geçer ve hiçbir şey hata vermez. Bu yüzden
// sayacın gerçekten saydığı ve gerçekten reddettiği ayrıca doğrulanıyor.

const redis = new IORedis(process.env['REDIS_URL'] ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: 1,
});

/** Her test kendi kuralını kullanır; testler birbirinin sayacını taşımasın. */
function kural(limit = 3, windowSec = 60): RateLimitRule {
  return { action: `test-${Math.random().toString(36).slice(2)}`, limit, windowSec };
}

beforeEach(() => {
  resetRateLimitClient();
});

afterAll(async () => {
  const anahtarlar = await redis.keys('rl:test-*');
  if (anahtarlar.length) await redis.del(...anahtarlar);
  await redis.quit();
});

describe('hız sınırı', () => {
  it('sınıra kadar izin verir, sonrasında reddeder', async () => {
    const k = kural(3);

    for (let i = 0; i < 3; i++) {
      expect((await checkRateLimit(k, '1.2.3.4')).allowed).toBe(true);
    }
    const dorduncu = await checkRateLimit(k, '1.2.3.4');
    expect(dorduncu.allowed).toBe(false);
    // Kullanıcıya ne kadar bekleyeceği söylenebilmeli.
    expect(dorduncu.retryAfterSec).toBeGreaterThan(0);
  });

  it('farklı kimlikler birbirini etkilemez', async () => {
    const k = kural(2);

    await checkRateLimit(k, 'ali');
    await checkRateLimit(k, 'ali');
    expect((await checkRateLimit(k, 'ali')).allowed).toBe(false);
    // Ayşe'nin Ali yüzünden engellenmesi sınırı işe yaramaz hâle getirirdi.
    expect((await checkRateLimit(k, 'ayse')).allowed).toBe(true);
  });

  it('farklı eylemler ayrı sayılır', async () => {
    const a = kural(1);
    const b = kural(1);

    await checkRateLimit(a, 'ortak');
    expect((await checkRateLimit(a, 'ortak')).allowed).toBe(false);
    // Giriş sınırına takılmak randevu almayı engellememeli.
    expect((await checkRateLimit(b, 'ortak')).allowed).toBe(true);
  });

  it('pencere geçince sayaç sıfırdan başlar', async () => {
    const k = kural(2, 60);
    const t0 = Date.now();

    await checkRateLimit(k, 'zaman', t0);
    await checkRateLimit(k, 'zaman', t0);
    expect((await checkRateLimit(k, 'zaman', t0)).allowed).toBe(false);

    // Saat enjekte edilebilir olmasaydı bu testin 60 saniye beklemesi gerekirdi.
    const sonraki = t0 + 61_000;
    expect((await checkRateLimit(k, 'zaman', sonraki)).allowed).toBe(true);
  });

  it('enforceRateLimit sınır aşılınca süreyi içeren hata fırlatır', async () => {
    const k = kural(1);

    await enforceRateLimit(k, 'hata');
    await expect(enforceRateLimit(k, 'hata')).rejects.toThrow(/Çok fazla deneme/);
    await expect(enforceRateLimit(k, 'hata')).rejects.toThrow(/tekrar deneyin/);
  });

  it('clearRateLimit sayacı sıfırlar (başarılı giriş sonrası)', async () => {
    const k = kural(2);

    await checkRateLimit(k, 'parolasini-hatirladi');
    await checkRateLimit(k, 'parolasini-hatirladi');
    expect((await checkRateLimit(k, 'parolasini-hatirladi')).allowed).toBe(false);

    await clearRateLimit(k, 'parolasini-hatirladi');
    expect((await checkRateLimit(k, 'parolasini-hatirladi')).allowed).toBe(true);
  });

  it('Redis erişilemezse istek GEÇER (arıza duruşu açık)', async () => {
    const onceki = process.env['REDIS_URL'];
    // Kapalı bir port: bağlantı kurulamaz.
    process.env['REDIS_URL'] = 'redis://127.0.0.1:6399';
    resetRateLimitClient();
    try {
      const k = kural(1);
      // Redis kesintisini tam site kesintisine çevirmek, sınırın önlediği
      // kötüye kullanımdan pahalı olurdu.
      for (let i = 0; i < 3; i++) {
        expect((await checkRateLimit(k, 'redis-yok')).allowed).toBe(true);
      }
    } finally {
      if (onceki === undefined) delete process.env['REDIS_URL'];
      else process.env['REDIS_URL'] = onceki;
      resetRateLimitClient();
    }
  });

  it('REDIS_URL tanımsızsa sınır devre dışı kalır ve istek geçer', async () => {
    const onceki = process.env['REDIS_URL'];
    delete process.env['REDIS_URL'];
    resetRateLimitClient();
    try {
      const k = kural(1);
      expect((await checkRateLimit(k, 'yapilandirilmamis')).allowed).toBe(true);
      expect((await checkRateLimit(k, 'yapilandirilmamis')).allowed).toBe(true);
    } finally {
      if (onceki !== undefined) process.env['REDIS_URL'] = onceki;
      resetRateLimitClient();
    }
  });

  it('gerçek kurallar makul: giriş sayacı sınırında durur', async () => {
    const kimlik = `giris-testi-${Date.now()}`;
    for (let i = 0; i < RATE_LIMITS.giris.limit; i++) {
      expect((await checkRateLimit(RATE_LIMITS.giris, kimlik)).allowed).toBe(true);
    }
    expect((await checkRateLimit(RATE_LIMITS.giris, kimlik)).allowed).toBe(false);
    await clearRateLimit(RATE_LIMITS.giris, kimlik);
  });
});
