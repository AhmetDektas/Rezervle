import { NextResponse } from 'next/server';
import { clearSessionCookie } from '@/server/session';

/**
 * Çıkış: oturum çerezi silinir ve ana sayfaya dönülür.
 *
 * Yönlendirme GÖRELİ ("/"), mutlak değil.
 *
 * Önceden `NextResponse.redirect(new URL('/', request.url))` yazıyordu.
 * `request.url` ters vekil arkasında isteğin geldiği adresi DEĞİL, Next'in
 * kendi dinlediği adresi veriyor: canlıda çıkış yapan herkes
 * `https://localhost:3000/` adresine gönderiliyordu. Çerez siliniyordu ama
 * kullanıcı tarayıcı hata sayfasına düşüyordu.
 *
 * Göreli Location (RFC 7231 §7.1.2) tarayıcıda isteğin kendi kaynağına göre
 * çözülüyor: hangi alan adından gelirse gelsin doğru yere gidiyor. Ayrıca
 * Host başlığına hiç bakmadığı için sahte Host ile başka siteye yönlendirme
 * ihtimalini de kapatıyor — `requestOrigin()` yerine bunu seçme sebebi bu.
 */
function anaSayfayaDon(): NextResponse {
  return new NextResponse(null, { status: 303, headers: { Location: '/' } });
}

export async function POST(): Promise<NextResponse> {
  await clearSessionCookie();
  return anaSayfayaDon();
}

export async function GET(): Promise<NextResponse> {
  await clearSessionCookie();
  return anaSayfayaDon();
}
