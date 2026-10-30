/**
 * FE2-4 (FE-004) — regresijski čuvar code-splittinga.
 *
 * Ovi testovi NE mjere bundle (to radi `npm run build`); oni čuvaju **uzrok**
 * malog početnog čipa, jer je regresija ovdje nevidljiva: ako neko doda
 * `import { NovaStranica } from './pages/NovaStranica'` u `App.tsx`, build i
 * dalje prođe, aplikacija i dalje radi — a početni čip ponovo naraste.
 *
 * Izmjereno 2026-10-30 (Vite build, 21 čip):
 *   - inicijalni JS (ono što `dist/index.html` referencira): 1.434,19 kB / gzip 451,87 kB
 *   - prije izmjene (jedan čip):                             2.975,35 kB / gzip 906,26 kB
 *   - `vendor-plots` (1.467,02 kB) se sada dohvaća tek na dashboardu.
 *
 * Sadržaj fajlova se čita preko Vite-ovog `?raw` sufiksa, a ne preko `node:fs`:
 * u jsdom okruženju `import.meta.url` nije `file:` URL, pa `new URL(…,
 * import.meta.url)` baca `TypeError: The URL must be of scheme file`.
 */
import { describe, expect, it } from 'vitest';
import appSource from '../App.tsx?raw';
import viteConfig from '../../vite.config.ts?raw';

/**
 * Sadržaj svih stranica, učitan pri kompilaciji. `import.meta.glob` je
 * Vite-ova transformacija — radi i u Vitest-u.
 */
const pageModules = import.meta.glob('../pages/*.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const pageNames = Object.keys(pageModules).map((p) => p.split('/').pop() as string);

/**
 * Statički import stranice: `… from './pages/X'`.
 * Dinamički import izgleda `import('./pages/X')` — bez `from`.
 */
const staticPageImports = (source: string): string[] =>
  Array.from(source.matchAll(/import\s+[^;]*?from\s+['"](\.\/pages\/[^'"]+)['"]/g)).map(
    (m) => m[1]
  );

const dynamicPageImports = (source: string): string[] =>
  Array.from(source.matchAll(/import\(\s*['"](\.\/pages\/[^'"]+)['"]\s*\)/g)).map((m) => m[1]);

describe('FE2-4: App.tsx dijeli stranice po ruti', () => {
  it('ne importuje nijednu stranicu statički', () => {
    // Ovo je srž nalaza FE-004: statički import stranice vraća je u početni čip.
    expect(staticPageImports(appSource)).toEqual([]);
  });

  it('svaku stranicu iz src/pages/ učitava dinamički (React.lazy)', () => {
    expect(pageNames.length, 'očekuje se 10 stranica').toBe(10);
    const lazy = dynamicPageImports(appSource);
    const uncovered = pageNames
      .map((f) => `./pages/${f.replace(/\.tsx$/, '')}`)
      .filter((p) => !lazy.includes(p));
    // Nova stranica bez lazy() tiho povećava početni čip — test mora pasti.
    expect(uncovered).toEqual([]);
  });

  it('ima Suspense boundary oko ruta', () => {
    expect(appSource).toContain('Suspense');
    expect(appSource).toContain('fallback=');
  });

  it('Suspense fallback ne vuče antd (da početni čip ostane mali)', () => {
    // Fallback je namjerno običan <div>; antd dolazi s prvom stranicom koja ga treba.
    const fallback = appSource.match(/function RouteFallback[\s\S]*?\n}/);
    expect(fallback, 'RouteFallback mora postojati').not.toBeNull();
    expect(fallback![0]).not.toMatch(/<(Spin|Skeleton|Button)\b/);
  });
});

describe('FE2-4: vite.config.ts grupiše vendor pakete u stabilne čipove', () => {
  it('definiše manualChunks', () => {
    // Namjerno regex s granicom, ne `toContain`: podstring bi preživio
    // preimenovanje u `manualChunksX` i test bi lažno prolazio.
    expect(viteConfig).toMatch(/manualChunks\s*[:(]/);
  });

  it.each([
    // [naziv čipa koji funkcija vraća, citirani obrazac putanje koji ga bira]
    ['vendor-plots', '@ant-design/plots'],
    ['vendor-antd', '/antd/'],
    ['vendor-react', '/react/'],
    // FE2-7: icons je NAMJERNO u istom čipu kao antd, ne u vlastitom. FE2-4 ga
    // je izdvojio u `vendor-icons`, što je stvorilo kružan odnos među čipovima
    // (antd → icons → rc-util → vendor-antd) i srušilo evaluaciju bundlea.
    ['vendor-antd', '@ant-design/icons'],
  ])('grupa %s se stvarno vraća za %s', (chunk, pattern) => {
    // Citirani oblici: `toContain('react')` bi preživjelo i u `react-router`,
    // pa bi asertcija bila prazna.
    expect(viteConfig).toContain(`return '${chunk}'`);
    expect(viteConfig).toContain(`'${pattern}'`);
  });

  it('plots se provjerava PRIJE icons (oba počinju s @ant-design/)', () => {
    // Tražimo `id.includes(...)` pozive, NE goli podstring: ime paketa se
    // pojavljuje i u komentarima iznad, pa bi `indexOf` mjerio komentar.
    const iPlots = viteConfig.indexOf("id.includes('@ant-design/plots')");
    const iIcons = viteConfig.indexOf("id.includes('@ant-design/icons')");
    expect(iPlots, 'mora postojati provjera za plots').toBeGreaterThan(-1);
    expect(iIcons, 'mora postojati provjera za icons').toBeGreaterThan(-1);
    expect(iPlots, 'plots mora biti ispred icons').toBeLessThan(iIcons);
  });
});

describe('FE2-4: @ant-design/plots ostaje izolovan na dashboardu', () => {
  it('samo DashboardPage importuje @ant-design/plots', () => {
    // Da neka druga stranica počne koristiti grafikone, `vendor-plots`
    // (1.467 kB) bi se vratio u inicijalno učitavanje za tu rutu.
    const users = pageNames.filter((f) => pageModules[`../pages/${f}`].includes('@ant-design/plots'));
    expect(users).toEqual(['DashboardPage.tsx']);
  });
});
