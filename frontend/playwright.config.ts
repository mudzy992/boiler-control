import { defineConfig } from '@playwright/test';

/**
 * FE2-7 (FE-009): e2e smoke konfiguracija.
 *
 * Namjerno ODVOJENA od `vitest.config.ts` i `vite.config.ts`:
 *  - `vitest.config.ts` uključuje `src/**\/*.test.{ts,tsx}` → e2e fajlovi u
 *    `e2e/` nisu dio unit suitea;
 *  - `tsconfig.app.json` uključuje samo `src` → e2e fajlovi ne prolaze kroz
 *    `npm run type-check` (ne mogu ga ni srušiti);
 *  - `requireApiBaseUrl()` u `vite.config.ts` puca samo na `command === 'build'`,
 *    pa `vite preview` (koji koristi `command: 'serve'`) ne pada.
 *
 * Test servira VEĆ SAGRAĐEN `dist/` preko `vite preview`, jer cilj je provjeriti
 * šta je stvarno ugrađeno u bundle — ne šta izvorni kod kaže.
 */
const PORT = Number(process.env.E2E_PORT ?? 4173);

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
  webServer: {
    command: `npm run preview -- --port ${PORT} --strictPort --host 127.0.0.1`,
    // Namjerno `/`, a NE `/health`: `vite preview` servira statički `dist/` i
    // NE koristi `frontend/nginx.conf`, pa `/health` ovdje nije endpoint (vratio
    // bi index.html preko SPA fallbacka). `/health` postoji samo u nginx-u, tj.
    // u stvarnom kontejneru — to pokriva compose healthcheck, ne ovaj test.
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
