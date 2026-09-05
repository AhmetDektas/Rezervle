import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import IORedis from 'ioredis';
import { prisma } from '@/lib/db';
import { resetDatabase } from './fixture';
import { RATE_LIMITS } from '@/server/rate-limit';

// Modül testleri sayacın saydığını doğruluyor; bu dosya sayacın gerçekten
// EYLEMLERE bağlı olduğunu doğruluyor. İkisi ayrı sorular: kusursuz çalışan
// bir sınır, hiçbir eylem onu çağırmıyorsa hiçbir şeyi korumaz.

const KIMLIK = '203.0.113.7';

vi.mock('next/headers', () => ({
  headers: async () => new Map([['x-forwarded-for', KIMLIK]]),
}));

// setSessionCookie cookies() istiyor; hız sınırı testinde oturumun kendisi
// ilgisiz, yalnızca eylemin sınıra takılıp takılmadığına bakıyoruz.
vi.mock('@/server/session', () => ({
  setSessionCookie: async () => undefined,
  clearSessionCookie: async () => undefined,
}));

const { loginAction, registerAction } = await import('@/app/actions/auth');

const redis = new IORedis(process.env['REDIS_URL'] ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: 1,
});

async function sayaciTemizle() {
  const anahtarlar = await redis.keys(`rl:*:${KIMLIK}:*`);
  if (anahtarlar.length) await redis.del(...anahtarlar);
}

function girisFormu(email: string, password: string) {
  const fd = new FormData();
  fd.set('email', email);
  fd.set('password', password);
  return fd;
}

beforeEach(async () => {
  await resetDatabase();
  await sayaciTemizle();
});

afterAll(async () => {
  await sayaciTemizle();
  await redis.quit();
  await prisma.$disconnect();
});

describe('eylemlerde hız sınırı', () => {
  it('art arda hatalı parola denemesi sonunda kilitlenir', async () => {
    const limit = RATE_LIMITS.giris.limit;

    for (let i = 0; i < limit; i++) {
      const r = await loginAction(girisFormu('yok@ornek.com', 'YanlisParola1'));
      expect(r.ok).toBe(false);
      // Sınıra kadar normal kimlik hatası dönmeli.
      if (!r.ok) expect(r.code).toBe('BAD_CREDENTIALS');
    }

    const kilitli = await loginAction(girisFormu('yok@ornek.com', 'YanlisParola1'));
    expect(kilitli.ok).toBe(false);
    if (!kilitli.ok) {
      expect(kilitli.code).toBe('RATE_LIMITED');
      // Kullanıcı ne kadar bekleyeceğini okuyabilmeli.
      expect(kilitli.error).toMatch(/dakika|saniye/);
    }
  });

  it('BAŞARILI giriş sayacı sıfırlar', async () => {
    const email = 'gercek@ornek.com';
    const { createAccount } = await import('@/server/accounts');
    await createAccount({ name: 'Gerçek Kullanıcı', email, password: 'Rezzerv123', role: 'CUSTOMER' });

    // Sınırın bir eksiğine kadar yanlış dene.
    for (let i = 0; i < RATE_LIMITS.giris.limit - 1; i++) {
      await loginAction(girisFormu(email, 'YanlisParola1'));
    }

    const basarili = await loginAction(girisFormu(email, 'Rezzerv123'));
    expect(basarili.ok).toBe(true);

    // Sayaç sıfırlandığı için yeniden tam limit kadar hakkı olmalı: parolasını
    // hatırlayan kullanıcı önceki hatalarıyla cezalandırılmamalı.
    for (let i = 0; i < RATE_LIMITS.giris.limit; i++) {
      const r = await loginAction(girisFormu(email, 'YanlisParola1'));
      if (!r.ok) expect(r.code).toBe('BAD_CREDENTIALS');
    }
  });

  it('kayıt eylemi de sınıra bağlı', async () => {
    const limit = RATE_LIMITS.kayit.limit;

    for (let i = 0; i < limit; i++) {
      const fd = new FormData();
      fd.set('name', 'Test Kullanıcı');
      fd.set('email', `spam-${i}@ornek.com`);
      fd.set('password', 'Rezzerv123');
      fd.set('kvkk', 'on');
      const r = await registerAction(fd);
      expect(r.ok).toBe(true);
    }

    const fd = new FormData();
    fd.set('name', 'Test Kullanıcı');
    fd.set('email', 'spam-son@ornek.com');
    fd.set('password', 'Rezzerv123');
    fd.set('kvkk', 'on');
    const kilitli = await registerAction(fd);
    expect(kilitli.ok).toBe(false);
    if (!kilitli.ok) expect(kilitli.code).toBe('RATE_LIMITED');

    // Reddedilen istek hesap AÇMAMIŞ olmalı.
    const sayi = await prisma.user.count({ where: { email: 'spam-son@ornek.com' } });
    expect(sayi).toBe(0);
  });
});
