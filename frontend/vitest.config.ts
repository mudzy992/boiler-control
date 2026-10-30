import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * FE2-11 — Vitest konfiguracija.
 *
 * Namjerno ODVOJENA od `vite.config.ts`: produkcijski config ima
 * `server.port: 80` i nema test sekciju, pa miješanje riskira da promjena
 * jednog slomi drugo. Vitest ionako čita vlastiti config prije vite-ovog.
 *
 * `environment: 'jsdom'` jer komponente koriste `document`, `navigator` i
 * `window.confirm`. `globals: false` (izričiti importi iz 'vitest') da
 * `tsc -p tsconfig.app.json --noEmit` ne zahtijeva `types: ["vitest/globals"]`.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // Antd povlači CSS; bez ovoga Vitest pokušava parsirati stylesheetove.
    css: false,
    restoreMocks: true,
  },
});
