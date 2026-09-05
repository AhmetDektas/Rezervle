import 'server-only';
import { headers } from 'next/headers';
import { appUrl } from '@/lib/constants';

/**
 * İsteğin geldiği kaynak (şema + host).
 *
 * `NEXT_PUBLIC_APP_URL` sabitine güvenmek yetmiyor: aynı kod farklı portlarda
 * çalışabiliyor (geliştirme 3000, E2E 3100) ve sabit yanlış olduğunda ödeme
 * yönlendirmesi ile webhook çağrısı BAŞKA bir sunucuya gider. Bu sessiz bir
 * arıza: yönlendirme tarayıcıda çalışır gibi görünür ama sonuç hiç dönmez.
 *
 * Bu yüzden kaynak isteğin kendisinden okunuyor; sabit yalnızca istek
 * bağlamı olmayan yerler için son çare.
 */
export async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get('host');
  if (!host) return appUrl();
  // Ters vekil arkasında şema x-forwarded-proto ile gelir; yereldeki
  // localhost/127.0.0.1 için http varsayılıyor.
  const proto =
    h.get('x-forwarded-proto') ??
    (host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https');
  return `${proto}://${host}`;
}
