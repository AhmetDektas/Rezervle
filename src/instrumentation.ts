/**
 * Açılış kontrolleri.
 *
 * Next.js bu dosyayı sunucu her başladığında bir kez çalıştırıyor. Buradaki
 * kontroller bilinçli olarak HATA FIRLATIYOR: yanlış yapılandırmanın
 * dağıtım sırasında görülmesi, müşterinin randevusu sırasında görülmesinden
 * kat kat ucuz. Uyarı loglamak yeterli değil — kimse açılış logunu okumuyor.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const uretim = process.env.NODE_ENV === 'production';
  const hatalar: string[] = [];

  const secret = process.env['AUTH_SECRET'] ?? '';
  if (secret.length < 32) {
    hatalar.push('AUTH_SECRET tanımlı değil veya 32 karakterden kısa.');
  }
  if (uretim && secret.includes('degistirin')) {
    // .env.example'daki örnek anahtar: oturum çerezleri herkesçe bilinen bir
    // anahtarla imzalanmış olurdu.
    hatalar.push('AUTH_SECRET hâlâ .env.example örneği. `openssl rand -base64 48` ile üretin.');
  }

  if (uretim && !process.env['REDIS_URL']) {
    // Hız sınırı REDIS_URL yoksa sessizce devre dışı kalıyor; üretimde bu
    // "koruma var" sanılan bir korumasızlık demek.
    hatalar.push('REDIS_URL tanımlı değil: hız sınırı devre dışı kalır ve worker açılmaz.');
  }

  const saglayici = process.env['PAYMENT_PROVIDER'] ?? 'mock';
  if (saglayici !== 'mock') {
    hatalar.push(`PAYMENT_PROVIDER="${saglayici}" için adaptör yazılmadı; yalnızca "mock" var.`);
  }

  // En kritik kontrol: sahte sağlayıcı gerçek para hareketi YAPMAZ. Kapora
  // açıkken üretime çıkmak, müşteriye "ödendi" deyip hiçbir tahsilat
  // yapmamak demek.
  const kaporaAcik = process.env['DEPOSITS_ENABLED'] !== 'false';
  if (uretim && saglayici === 'mock' && kaporaAcik) {
    hatalar.push(
      'Sahte ödeme sağlayıcısıyla kapora tahsilatı açık. Gerçek sağlayıcı bağlanana kadar ' +
        'DEPOSITS_ENABLED="false" yapın; aksi halde müşteri ödediğini sanır, para hareket etmez.',
    );
  }

  if (hatalar.length > 0) {
    throw new Error(
      `Rezzerv açılış kontrolleri başarısız:\n  - ${hatalar.join('\n  - ')}\n` +
        'Ayrıntı: docs/dagitim.md',
    );
  }
}
