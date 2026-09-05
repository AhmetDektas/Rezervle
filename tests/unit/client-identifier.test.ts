import { describe, it, expect, vi } from 'vitest';

// clientIdentifier hız sınırının kova anahtarını üretiyor. Sessizce sabit bir
// değer döndürmeye başlarsa TÜM kullanıcılar aynı kovaya düşer: bir kişinin
// hatalı denemeleri herkesi kilitler. Sınırın kendisi kusursuz çalışsa bile.

const baslikDeposu = { deger: new Map<string, string>() };

vi.mock('next/headers', () => ({
  headers: async () => ({ get: (k: string) => baslikDeposu.deger.get(k) ?? null }),
}));

const { clientIdentifier } = await import('@/server/rate-limit');

function basliklar(kayitlar: Record<string, string>) {
  baslikDeposu.deger = new Map(Object.entries(kayitlar));
}

describe('clientIdentifier', () => {
  it('x-forwarded-for içindeki İLK adresi alır', async () => {
    // Zincirin ilki gerçek istemci; sonrakiler aradaki vekiller. Sonuncuyu
    // almak, herkesi vekilin adresinde tek kovaya toplardı.
    basliklar({ 'x-forwarded-for': '198.51.100.9, 10.0.0.1, 10.0.0.2' });
    expect(await clientIdentifier()).toBe('198.51.100.9');
  });

  it('tek adreste boşlukları kırpar', async () => {
    basliklar({ 'x-forwarded-for': '  203.0.113.4  ' });
    expect(await clientIdentifier()).toBe('203.0.113.4');
  });

  it('x-forwarded-for yoksa x-real-ip kullanır', async () => {
    basliklar({ 'x-real-ip': '192.0.2.55' });
    expect(await clientIdentifier()).toBe('192.0.2.55');
  });

  it('x-forwarded-for boşsa x-real-ip devreye girer', async () => {
    basliklar({ 'x-forwarded-for': '', 'x-real-ip': '192.0.2.77' });
    expect(await clientIdentifier()).toBe('192.0.2.77');
  });

  it('hiçbir başlık yoksa sabit bir değere düşer', async () => {
    // Yerel geliştirmede vekil yok. Herkes aynı kovaya düşer; sınırlar bu
    // yüzden cömert seçildi.
    basliklar({});
    expect(await clientIdentifier()).toBe('yerel');
  });

  it('farklı istemciler farklı anahtar üretir', async () => {
    basliklar({ 'x-forwarded-for': '198.51.100.1' });
    const a = await clientIdentifier();
    basliklar({ 'x-forwarded-for': '198.51.100.2' });
    const b = await clientIdentifier();
    expect(a).not.toBe(b);
  });
});
