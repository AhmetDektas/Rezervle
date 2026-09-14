import { describe, it, expect, afterEach } from 'vitest';
import { pushHedefiDogrula, pushHedefiGuvenli } from '@/lib/push-endpoint';

/**
 * Push uç noktası doğrulaması.
 *
 * Asıl kusur şuydu: uç nokta yalnızca `z.string().url()` ile doğrulanıyor,
 * sonra sunucu o adrese kendi ağından istek atıyordu. Aşağıdaki "reddedilmeli"
 * vakalarının HEPSİ eski kodda geçiyordu.
 */

afterEach(() => {
  delete process.env['PUSH_ALLOWED_HOSTS'];
});

describe('kabul edilenler', () => {
  const gecerli = [
    'https://fcm.googleapis.com/fcm/send/abc123',
    'https://updates.push.services.mozilla.com/wpush/v2/gAAAA',
    'https://web.push.apple.com/QK7f...',
    'https://db5p.notify.windows.com/w/?token=xyz',
    'https://android.googleapis.com/gcm/send/legacy',
  ];
  for (const u of gecerli) {
    it(`kabul: ${new URL(u).hostname}`, () => {
      expect(pushHedefiDogrula(u)).toEqual({ ok: true });
    });
  }
});

describe('SSRF hedefleri reddedilir', () => {
  const kotu: [string, string][] = [
    ['https://127.0.0.1:8443/private', 'loopback'],
    ['https://localhost/push', 'localhost adı'],
    ['https://169.254.169.254/latest/meta-data/', 'bulut metadata adresi'],
    ['https://10.0.0.5/internal', 'özel ağ'],
    ['https://192.168.1.1/admin', 'ev ağı'],
    ['https://[::1]/push', 'IPv6 loopback'],
    ['http://fcm.googleapis.com/fcm/send/x', 'şifresiz http'],
    ['https://fcm.googleapis.com:8443/fcm/send/x', 'standart dışı port'],
    ['https://evil.com/fcm/send/x', 'izinli listede olmayan host'],
  ];
  for (const [u, ne] of kotu) {
    it(`reddeder: ${ne}`, () => {
      expect(pushHedefiGuvenli(u)).toBe(false);
    });
  }

  it('benzer görünen alan adı geçmez', () => {
    // Düz `endsWith` kullanılsaydı bu host ".notify.windows.com" ile
    // eşleşirdi. Saldırgan kendi alan adını böyle adlandırabilir.
    expect(pushHedefiGuvenli('https://evil-notify.windows.com/w/')).toBe(false);
    expect(pushHedefiGuvenli('https://fcm.googleapis.com.evil.net/x')).toBe(false);
  });

  it('kimlik bilgisi taşıyan adres geçmez', () => {
    expect(pushHedefiGuvenli('https://user:pass@fcm.googleapis.com/fcm/send/x')).toBe(false);
  });

  it('bozuk adres geçmez', () => {
    expect(pushHedefiGuvenli('bu bir url degil')).toBe(false);
  });
});

describe('ek host listesi', () => {
  it('ortam değişkeniyle host eklenebilir', () => {
    process.env['PUSH_ALLOWED_HOSTS'] = 'push.kendi-sunucum.com';
    expect(pushHedefiGuvenli('https://push.kendi-sunucum.com/x')).toBe(true);
  });

  it('eklenen host da IP ve port kurallarına tabi', () => {
    // Liste genişletildiğinde ikinci katman devrede kalmalı.
    process.env['PUSH_ALLOWED_HOSTS'] = '10.1.2.3';
    expect(pushHedefiGuvenli('https://10.1.2.3/x')).toBe(false);
  });
});
