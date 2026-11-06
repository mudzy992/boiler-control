/**
 * FE2-17 — E2E smoke test: login → dashboard → logout.
 *
 * Test servira `dist/` preko `vite preview` (vidi `playwright.config.ts`).
 * Koristi env varijable za credentials:
   - E2E_USER_IDENTIFIER (zadano: 'admin@example.com')
   - E2E_USER_PASSWORD (zadano: 'password123')
 *
 * Ovi se ne smiju commitovati u repo — za CI koriste GitHub Secrets.
 */

import { test, expect } from '@playwright/test';

test.describe('Auth flow', () => {
  const identifier = process.env.E2E_USER_IDENTIFIER ?? 'admin@example.com';
  const password = process.env.E2E_USER_PASSWORD ?? 'password123';

  test('prijava, navigacija na dashboard i odjava', async ({ page }) => {
    // 1. Otvara se login stranica
    await page.goto('/login');
    await expect(page).toHaveURL(/.*\/login/);

    // 2. Unose se kredencijali
    await page.fill('input[name="identifier"]', identifier);
    await page.fill('input[name="password"]', password);

    // 3. Submituje se forma
    await page.click('button[type="submit"]');

    // 4. Očekuje se preusmeravanje na dashboard
    await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 10000 });

    // 5. Dashboard se učitava (prenesen je header/main sadržaj)
    await expect(page.locator('text=Dashboard')).toBeVisible({ timeout: 10000 });

    // 6. Klik na Logout u MainLayout meniju
    await page.click('text=Logout');

    // 7. Očekuje se povratak na login stranicu
    await expect(page).toHaveURL(/.*\/login/, { timeout: 10000 });
  });
});
