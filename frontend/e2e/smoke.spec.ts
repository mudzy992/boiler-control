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
 * Backend NIJE potreban: svi pozivi na API host se presreću (vidi `beforeEach`),
 * pa test ne ovisi ni o mreži ni o stvarnom serveru.
 */

const API_BASE = (process.env.VITE_API_URL ?? '').trim();

// Računamo jednom, sigurno: ako je base prazan, `new URL('')` bi bacio i
// sakrio pravu grešku (koju test 1 ionako hvata jasnijom porukom).
const API_ORIGIN = API_BASE ? new URL(API_BASE).origin : '';

test.describe('FE2-7 smoke: sagradjeni bundle', () => {
  /**
   * CI runneri imaju izlaz na internet, pa bi nepresretnut poziv na
   * `api.boiler-control.ba101.top` otišao na STVARNU produkciju. To je loše iz
   * dva razloga: smoke test bi ovisio o tome da li tuđi server odgovara, i
   * cross-origin zahtjev iz `http://127.0.0.1:4173` bi bio blokiran CORS-om
   * (backend origin je fiksni `https://boiler-control.ba101.top`).
   *
   * Testovi koji trebaju specifičan odgovor registruju svoju rutu NAKON ove —
   * Playwright poštuje obrnuti redoslijed registracije, pa njihova pobjeđuje.
   */
  test.beforeEach(async ({ page }) => {
    if (!API_ORIGIN) return;
    await page.route(`${API_ORIGIN}/**`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ authRefreshEnabled: false }),
      })
    );
  });

  test('VITE_API_URL je proslijedjen test procesu (inače je provjera bezvrijedna)', () => {
    // Bez ovoga bi testovi ispod prolazili nad praznim base-om i dokazivali ništa.
    expect(API_BASE, 'pokrenite e2e s VITE_API_URL=<isti kao u build koraku>').not.toBe('');
  });

  test('SPA se pokrene i prikaze login formu', async ({ page }) => {
    await page.goto('/');

    // `LoginPage.tsx` renderuje `<h1>🔥 Boiler Control</h1>` i antd dugme s
    // tekstom iz `t('auth.signIn')` — 'Sign In' (en) ili 'Prijava' (bs).
    // `LoginPage` je lazy (FE2-4), pa čekanje na heading istovremeno dokazuje da
    // se odloženi čip zaista dohvatio i izvršio.
    await expect(page.getByRole('heading', { name: /Boiler Control/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Sign In|Prijava/i })).toBeVisible();
    await expect(page.locator('input#identifier')).toBeVisible();
  });

  test('API poziv ide na konfigurisani base, a NE na localhost:3020', async ({ page }) => {
    const configCalls: string[] = [];
    const allRequests: string[] = [];

    page.on('request', (request) => allRequests.push(request.url()));

    // Registrirano NAKON beforeEach rute, pa ima prednost i bilježi URL-ove.
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
    const assetStatuses: number[] = [];
    page.on('response', (response) => {
      if (response.url().includes('/assets/')) assetStatuses.push(response.status());
    });

    const response = await page.goto('/');
    expect(response, 'glavni dokument mora imati odgovor').not.toBeNull();
    expect(response!.status()).toBe(200);

    // Namjerno NE `waitForLoadState('networkidle')`: to bi čekalo da svi
    // vanjski zahtjevi utihnu, pa bi ishod testa ovisio o mreži umjesto o
    // bundleu. Čekanje na heading je determinističko i dokazuje da se odloženi
    // čip izvršio.
    await expect(page.getByRole('heading', { name: /Boiler Control/ })).toBeVisible();

    const scripts = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLScriptElement>('script[src]')).map((s) => s.src)
    );
    expect(scripts.length, 'index.html mora referencirati barem jedan JS čip').toBeGreaterThan(0);

    expect(
      assetStatuses.length,
      'barem jedan /assets/ zahtjev mora biti zabilježen, inače test ne dokazuje ništa'
    ).toBeGreaterThan(0);
    const failed = assetStatuses.filter((status) => status !== 200);
    expect(failed, `assets koji nisu vratili 200: ${failed.join(', ')}`).toEqual([]);
  });
});
