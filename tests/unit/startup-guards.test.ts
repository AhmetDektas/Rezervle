import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { register } from '@/instrumentation';

// Açılış kontrolleri yanlış yapılandırmayı DAĞITIM sırasında durduruyor.
// Bu testler olmasa kontrollerin kendisi sessizce bozulabilir ve kimse fark
// etmezdi — koruma, koruduğunu sandığımız şeyi gerçekten koruyor mu sorusu
// her zaman ayrıca sorulmalı.

const YEDEK = { ...process.env };
const UZUN_ANAHTAR = 'k'.repeat(40);

function ortam(over: Record<string, string | undefined>) {
  for (const k of [
    'NODE_ENV',
    'AUTH_SECRET',
    'REDIS_URL',
    'DEPOSITS_ENABLED',
    'PAYMENT_PROVIDER',
  ]) {
    delete process.env[k];
  }
  process.env['NEXT_RUNTIME'] = 'nodejs';
  for (const [k, v] of Object.entries(over)) if (v !== undefined) process.env[k] = v;
}

const uretimTemel = {
  NODE_ENV: 'production',
  AUTH_SECRET: UZUN_ANAHTAR,
  REDIS_URL: 'redis://ornek:6379',
  DEPOSITS_ENABLED: 'false',
};

beforeEach(() => ortam(uretimTemel));

afterAll(() => {
  process.env = YEDEK;
});

describe('açılış kontrolleri', () => {
  it('doğru üretim yapılandırmasında geçer', async () => {
    await expect(register()).resolves.toBeUndefined();
  });

  it('geliştirmede kapora açık olsa da engellemez', async () => {
    ortam({ NODE_ENV: 'development', AUTH_SECRET: UZUN_ANAHTAR, REDIS_URL: 'redis://x' });
    await expect(register()).resolves.toBeUndefined();
  });

  it('ÜRETİMDE sahte ödeme + kapora açık ENGELLENİR', async () => {
    // En pahalı sessiz hata: müşteri "ödendi" görür, hiçbir para hareket etmez.
    ortam({ ...uretimTemel, DEPOSITS_ENABLED: undefined });
    await expect(register()).rejects.toThrow(/kapora tahsilatı açık/i);
  });

  it('üretimde REDIS_URL yoksa engellenir', async () => {
    // Hız sınırı Redis'siz sessizce devre dışı kalıyor: korumasızlığı
    // koruma sanmak.
    ortam({ ...uretimTemel, REDIS_URL: undefined });
    await expect(register()).rejects.toThrow(/REDIS_URL/);
  });

  it('üretimde örnek AUTH_SECRET engellenir', async () => {
    ortam({ ...uretimTemel, AUTH_SECRET: `degistirin-${'x'.repeat(40)}` });
    await expect(register()).rejects.toThrow(/AUTH_SECRET/);
  });

  it('kısa AUTH_SECRET engellenir', async () => {
    ortam({ ...uretimTemel, AUTH_SECRET: 'kisa' });
    await expect(register()).rejects.toThrow(/AUTH_SECRET/);
  });

  it('yazılmamış ödeme adaptörü engellenir', async () => {
    // Sessizce sahteye düşmek, para almadığını fark etmemek demekti.
    ortam({ ...uretimTemel, PAYMENT_PROVIDER: 'iyzico' });
    await expect(register()).rejects.toThrow(/adaptör yazılmadı/i);
  });

  it('nodejs dışı çalışma zamanında hiçbir şey yapmaz', async () => {
    // Edge çalışma zamanında bu değişkenlerin hepsi yok; orada patlamak
    // yanlış olurdu.
    ortam({ NODE_ENV: 'production' });
    process.env['NEXT_RUNTIME'] = 'edge';
    await expect(register()).resolves.toBeUndefined();
  });
});
