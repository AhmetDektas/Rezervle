import { execSync } from 'node:child_process';

/**
 * Bütünleşik testler için ayrı ve boş bir Postgres veritabanı hazırlar.
 *
 * Ayrı VERİTABANI kullanılıyor, ayrı şema değil: `prisma db push --force-reset`
 * Postgres'te veritabanının tamamını sıfırlıyor. Aynı veritabanında şema
 * ayrımıyla çalışsaydık her test koşusu geliştirme verisini de silerdi.
 *
 * `docker compose up -d` ile ayağa kalkan Postgres'te `rezzerv_test`
 * veritabanının var olması gerekir (.env.example ve README'de yazılı).
 */
const TEST_DATABASE_URL =
  process.env['TEST_DATABASE_URL'] ??
  'postgresql://rezzerv:rezzerv@localhost:5432/rezzerv_test?schema=public';

export default function setup(): void {
  execSync('npx prisma db push --skip-generate --force-reset', {
    stdio: 'ignore',
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  });
}
