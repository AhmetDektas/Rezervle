import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { join } from 'node:path';

/** Bütünleşik testler için ayrı ve boş bir SQLite veritabanı hazırlar. */
export default function setup(): void {
  const dbPath = join(process.cwd(), 'prisma', 'test.db');
  rmSync(dbPath, { force: true });
  execSync('npx prisma db push --skip-generate --accept-data-loss', {
    stdio: 'ignore',
    env: { ...process.env, DATABASE_URL: 'file:./test.db' },
  });
}
