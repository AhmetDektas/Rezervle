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
    // Bütünleşik testler aynı SQLite dosyasına yazar; sıralı çalışmalı.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    globalSetup: ['./tests/global-setup.ts'],
    // Testler üretim/geliştirme verisine dokunmaz; kendi dosyasını kullanır.
    env: { DATABASE_URL: 'file:./test.db', AUTH_SECRET: 'test-secret-en-az-otuz-iki-karakter-uzunlugunda' },
  },
});
