import type { Page } from '@playwright/test';

export const ACCOUNTS = {
  customer: 'demo@rezzerv.com',
  owner: 'serhat@beyazdis.com',
  staff: 'aylin.kara@beyazdispoliklinigi.com',
  admin: 'admin@rezzerv.com',
};

export const PASSWORD = 'Rezzerv123';

/** Form üzerinden gerçek giriş yapar (demo kısayolu değil). */
export async function login(page: Page, email: string): Promise<void> {
  await page.goto('/giris');
  await page.getByLabel('E-posta').fill(email);
  await page.getByLabel('Parola').fill(PASSWORD);
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/giris'), { timeout: 20_000 });
}

export async function logout(page: Page): Promise<void> {
  await page.goto('/cikis');
  await page.waitForURL('**/');
}
