/**
 * FE2-17 — E2E smoke test: login → dashboard → logout.
 *
 * Test servira `dist/` preko `vite preview` (vidi `playwright.config.ts`).
 * Za razliku od `smoke.spec.ts`, ovaj test **stvarno** priča s API-jem: nema
 * presretanja ruta, jer je i cilj da se dokaže da backend prihvata prijavu.
 *
 * Zato se u redovnom CI-ju preskače (A2): bez `E2E_LIVE=1` nema se šta
 * dokazivati, a pad bi značio „tuđi server ne odgovara", ne „naš kod je loš".
 *
 * Kredencije dolaze iz okoline, nikad iz repozitorija:
 *   - E2E_USER_IDENTIFIER
 *   - E2E_USER_PASSWORD
 *
 * Ručno protiv živog API-ja:
 *   E2E_LIVE=1 E2E_USER_IDENTIFIER=… E2E_USER_PASSWORD=… \
 *   VITE_API_URL=https://api.boiler-control.ba101.top/api npx playwright test e2e/auth.spec.ts
 */

import { test, expect } from '@playwright/test';

const LIVE = process.env.E2E_LIVE === '1';

test.describe('Auth flow', () => {
  test.skip(
    !LIVE,
    'traži živ backend; postavite E2E_LIVE=1 i E2E_USER_IDENTIFIER/E2E_USER_PASSWORD',
  );

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
