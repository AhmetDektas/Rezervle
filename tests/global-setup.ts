import { execSync } from 'node:child_process';

/**
 * Bütünleşik testler için ayrı ve boş bir Postgres veritabanı hazırlar.
 *
 * Ayrı VERİTABANI kullanılıyor, ayrı şema değil: sıfırlama veritabanının
 * tamamını siliyor. Aynı veritabanında şema ayrımıyla çalışsaydık her test
 * koşusu geliştirme verisini de silerdi.
 *
 * MIGRATION ÜZERİNDEN KURULUYOR, `db push` ile değil.
 *
 * `db push` şemayı yalnızca `schema.prisma`dan üretiyor. Prisma'nın
 * modelleyemediği kurallar — örneğin randevu çakışmasını engelleyen
 * `Reservation_personel_cakisma` dışlama kısıtı — ham SQL migration'ında
 * tanımlı. `db push` ile kurulan test veritabanında bu kısıt HİÇ OLMUYORDU:
 * üretimde var olan bir kuralı testler görmüyor, dolayısıyla onu sınayan bir
 * test yanlış sebeple yeşil geçiyordu.
 *
 * `migrate reset` bütün migration'ları sırayla oynatıyor; test veritabanı
 * üretimdekiyle birebir aynı oluyor. Karşılığında koşu başlangıcı biraz daha
 * uzun — doğru şemaya karşı test etmenin makul bedeli.
 *
 * `docker compose up -d` ile ayağa kalkan Postgres'te `rezzerv_test`
 * veritabanının var olması gerekir (.env.example ve README'de yazılı).
 */
const TEST_DATABASE_URL =
  process.env['TEST_DATABASE_URL'] ??
  'postgresql://rezzerv:rezzerv@localhost:5432/rezzerv_test?schema=public';

export default function setup(): void {
  execSync('npx prisma migrate reset --force --skip-seed --skip-generate', {
    stdio: 'ignore',
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  });
}
