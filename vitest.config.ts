import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: [{ find: /^server-only$/, replacement: new URL('./tests/server-only-stub.ts', import.meta.url).pathname }],
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    globals: false,
    // Bütünleşik testler aynı veritabanına yazar; sıralı çalışmalı.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    globalSetup: ['./tests/global-setup.ts'],
    // Testler geliştirme verisine dokunmaz; ayrı bir veritabanı kullanır.
    // global-setup.ts her koşuda bu veritabanını sıfırlar.
    env: {
      DATABASE_URL:
        process.env['TEST_DATABASE_URL'] ??
        'postgresql://rezzerv:rezzerv@localhost:5432/rezzerv_test?schema=public',
      AUTH_SECRET: 'test-secret-en-az-otuz-iki-karakter-uzunlugunda',
    },
  },
});
