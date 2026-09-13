import { describe, it, expect, vi } from 'vitest';

/**
 * Çıkış yönlendirmesi.
 *
 * Canlıda çıkış yapan herkes `https://localhost:3000/` adresine gidiyordu:
 * rota `new URL('/', request.url)` kuruyordu ve `request.url` ters vekil
 * arkasında isteğin geldiği adresi değil, Next'in kendi dinlediği adresi
 * veriyor. Çerez siliniyordu ama kullanıcı tarayıcı hata sayfasına düşüyordu.
 *
 * Test Location'ın GÖRELİ olduğunu sınıyor: mutlak bir adres üretildiği anda
 * aynı hata geri gelir, çünkü doğru mutlak adresi bilmenin güvenilir bir yolu
 * yok. Ayrıca çerezin gerçekten silindiğini de doğruluyor — yönlendirme
 * doğru olup oturum açık kalsaydı hata daha kötü olurdu.
 */

const silindi = { sayac: 0 };

vi.mock('@/server/session', () => ({
  clearSessionCookie: async () => {
    silindi.sayac += 1;
  },
}));

const { GET, POST } = await import('@/app/cikis/route');

describe('çıkış rotası', () => {
  it('GET göreli adrese yönlendirir ve oturumu siler', async () => {
    const once = silindi.sayac;
    const res = await GET();

    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/');
    expect(silindi.sayac).toBe(once + 1);
  });

  it('POST aynı şekilde davranır', async () => {
    const once = silindi.sayac;
    const res = await POST();

    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/');
    expect(silindi.sayac).toBe(once + 1);
  });

  it('yönlendirme mutlak adres İÇERMEZ', async () => {
    // Asıl kusur buydu: konak adı içeren bir Location. Hangi konak olursa
    // olsun (localhost, sabit alan adı, Host başlığından okunan) yanlış
    // ortamda yanlış yere gönderir.
    const konum = (await GET()).headers.get('location') ?? '';
    expect(konum.startsWith('/')).toBe(true);
    expect(konum).not.toMatch(/^https?:\/\//);
  });
});
