import { expect, test } from '@playwright/test';

/**
 * FE2-7 (FE-009): e2e smoke nad SAGRAĐENIM bundleom.
 *
 * Cilj nije pokrivanje funkcionalnosti — to rade Vitest testovi — nego dokaz da
 * `dist/` koji nastane iz build argova stvarno radi u browseru i da NE sadrži
 * uklonjeni dev fallback.
 *
 * Konkretna regresija koju ovo brani: `api.ts` je imao
 * `import.meta.env.VITE_API_URL || 'http://localhost:3020/api'`, a
 * `frontend/Dockerfile` ima `ARG VITE_API_URL` bez defaulta. Build bez arga bi
 * prošao, a deployovana aplikacija bi tiho zvala korisnikov vlastiti localhost.
 * Test ispod pada čim se tako nešto ponovo ugradi u bundle.
 *
 * Backend NIJE potreban: `GET {base}/app/config` (koji `AuthContext` zove na
 * mount preko `apiClient.detectAuthMode()`) se presreće i vraća stub.
 */

const API_BASE = (process.env.VITE_API_URL ?? '').trim();

test.describe('FE2-7 smoke: sagradjeni bundle', () => {
  test('VITE_API_URL je proslijedjen test procesu (inače je provjera bezvrijedna)', () => {
    // Bez ovoga bi testovi ispod prolazili nad praznim base-om i dokazivali ništa.
    expect(API_BASE, 'pokrenite e2e s VITE_API_URL=<isti kao u build koraku>').not.toBe('');
  });

  test('SPA se pokrene i prikaze login formu', async ({ page }) => {
    await page.goto('/');

    // `LoginPage.tsx` renderuje `<h1>🔥 Boiler Control</h1>` i antd dugme s
    // tekstom iz `t('auth.signIn')` — 'Sign In' (en) ili 'Prijava' (bs).
    await expect(page.getByRole('heading', { name: /Boiler Control/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Sign In|Prijava/i })).toBeVisible();
    await expect(page.locator('input#identifier')).toBeVisible();
  });

  test('API poziv ide na konfigurisani base, a NE na localhost:3020', async ({ page }) => {
    const configCalls: string[] = [];
    const allRequests: string[] = [];

    page.on('request', (request) => allRequests.push(request.url()));

    // Presrećemo backend poziv da test ne ovisi o mreži ni o stvarnom serveru.
    await page.route('**/app/config*', async (route) => {
      configCalls.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ authRefreshEnabled: false }),
      });
    });

    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Boiler Control/ })).toBeVisible();
    // `detectAuthMode()` se zove u `useEffect` na mount; čekamo da stigne.
    await expect.poll(() => configCalls.length, { timeout: 10_000 }).toBeGreaterThan(0);

    // 1. poziv mora ići na ugrađeni base — dokaz da je build arg zaista u bundleu
    for (const url of configCalls) {
      expect(
        url.startsWith(API_BASE),
        `očekivano da ${url} počinje s ${API_BASE}`
      ).toBe(true);
    }

    // 2. NIJEDAN zahtjev ne smije ići na uklonjeni dev fallback
    const leaked = allRequests.filter((url) => url.includes('localhost:3020'));
    expect(leaked, `curenje dev fallbacka u bundle: ${leaked.join(', ')}`).toEqual([]);
  });

  test('staticki assets se servisiraju s 200', async ({ page }) => {
    // FE2-4: početni čip i vendor čipovi moraju biti dostupni, inače SPA ostaje
    // prazan a login forma se nikad ne renderuje.
    const response = await page.goto('/');
    expect(response, 'glavni dokument mora imati odgovor').not.toBeNull();
    expect(response!.status()).toBe(200);

    await page.waitForLoadState('networkidle');

    const scripts = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLScriptElement>('script[src]')).map((s) => s.src)
    );
    expect(scripts.length, 'index.html mora referencirati barem jedan JS čip').toBeGreaterThan(0);
  });
});
