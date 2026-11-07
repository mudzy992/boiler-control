# 03 — Baseline

Datum: 2026-11-06. Radni direktorij: `frontend/`. Produkcijski kod nije mijenjan. `npm ci` nije pokrenut.

`node_modules` postoji, ali ne prati lockfile:

- `node_modules/eslint/package.json` → `8.57.1`
- lock `node_modules/eslint` → `9.39.5`
- `node_modules/vitest` ne postoji
- `node_modules/eslint-plugin-react-hooks` ne postoji
- `node_modules/vite` i `node_modules/typescript` postoje

## Komande

### 1. Typecheck

```
npm run type-check
```

Skripta: `tsc -p tsconfig.app.json --noEmit`. Exit **2**.

```
src/components/MainLayout.tsx(159,13): error TS17002
src/components/MainLayout.tsx(165,11): error TS17002
src/components/MainLayout.tsx(166,9): error TS17002
src/components/MainLayout.tsx(248,7): error TS17002
src/features/dashboard/pages/DashboardPage.tsx(937,9): error TS17002
src/features/dashboard/pages/DashboardPage.tsx(940,8): error TS17008
src/features/dashboard/pages/DashboardPage.tsx(1010,12): error TS1381
src/features/dashboard/pages/DashboardPage.tsx(1011,11): error TS17015
src/features/dashboard/pages/DashboardPage.tsx(1011,14): error TS1382
src/features/dashboard/pages/DashboardPage.tsx(1014,7): error TS1005
src/features/dashboard/pages/DashboardPage.tsx(1015,7): error TS2657
src/features/dashboard/pages/DashboardPage.tsx(1100,7): error TS2657
src/features/dashboard/pages/DashboardPage.tsx(1149,5): error TS1128
src/features/dashboard/pages/DashboardPage.tsx(1150,3): error TS1109
src/features/dashboard/pages/DashboardPage.tsx(1151,1): error TS1128
```

`npx tsc -p tsconfig.app.json --showConfig` exit 0. Efektivni `jsx` je `react-jsx`, `strict` je uključen. Dva `compilerOptions` ključa u fajlu su spojena.

### 2. Lint

```
npm run lint
```

Exit **2**. ESLint koji se pokrenuo je **8.57.1**.

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'eslint-plugin-react-hooks'
imported from frontend/eslint.config.mjs
```

Konfiguracija `frontend/eslint.config.mjs` je flat config i importa `eslint-plugin-react-hooks`. Paket nije instaliran. Broj warninga se ne može izmjeriti.

### 3. Testovi

```
npm test
```

Skripta: `vitest run`. Exit **1**.

```
'vitest' is not recognized as an internal or external command,
operable program or batch file.
```

Na disku postoje Vitest fajlovi (npr. `src/components/__tests__/ProtectedRoute.test.tsx`, `src/services/__tests__/authTokenStorage.test.ts`) i Playwright `frontend/e2e/auth.spec.ts`, `frontend/e2e/smoke.spec.ts`. Nijedan nije pokrenut jer binarni `vitest` nije instaliran. E2E nije pokretan.

### 4. Produkcijski build

```
$env:VITE_API_URL='https://api.boiler-control.ba101.top/api'
npm run build
```

Exit **2**. Skripta je `tsc -p tsconfig.app.json --noEmit && vite build`. `vite build` se nije pokrenuo. Isti tsc ispis kao u tački 1.

Bundle veličina: **nema**. `dist/` iz ovog pokretanja ne postoji jer je lanac stao na `tsc`.

### 5. Lighthouse, Web Vitals, console

**I7 update (2026-11-07):** login baseline — Perf 100 / A11y 88 / BP 96 / SEO 82. Vidi `10-lighthouse-i7.md`. Protected ruta nije mjerena (nema sesije).

## Poslije `npm ci` (isti dan)

`npm ci --no-audit --no-fund` u `frontend/`: exit 0, 671 paket, oko 1 min. Instalirani ESLint je sada 9.39.5. Vitest 3.2.4 se pokreće.

Upozorenje: `esbuild@0.21.5` postinstall nije odobren (`allow-scripts`). Vitest je ipak izvršio testove, pa Vite u ovom pokretanju radi.

### Lint

`npm run lint` — exit 1. ESLint 9.39.5. **20 grešaka, 36 upozorenja.**

Greške su parse (`MainLayout.tsx:159`, `DashboardPage.tsx:937`) i `react/jsx-no-undef` za `Button`, `Card`, `InputNumber` na boiler, gas analytics, heating, notifications i reports stranicama. Upozorenja su uglavnom `any`, nekorišteni antd importi i `react-refresh/only-export-components`.

### Testovi

`npm test` (`vitest run`) — exit 1.

| | Broj |
|---|---:|
| fajlovi prošli | 8 |
| fajlovi pali | 4 |
| testovi prošli | 54 |
| testovi pali | 4 |

Padovi:

- `GasForm.test.tsx`, `GasReadingCard.test.tsx`, `components/__tests__/accessibility.test.tsx` — ne razrješavaju `./Input` i `./Button` iz `features/gas/components`.
- `RecommendationBreakdown.test.tsx` — 4 testa, `useTranslation is not defined` u `RecommendationBreakdown.tsx:32`.

`ProtectedRoute` (4) i shadcn a11y testovi (6) prolaze. Axe u jsdom ispisuje stderr da `HTMLCanvasElement.getContext` nije implementiran. To nije pad testa.

E2E i dalje nije pokretan. Typecheck i build nisu ponovo pokretani: i dalje ovise o istom JSX-u, ne o nedostajućim paketima.

## Sažetak brojeva

| Mjera | Prije `npm ci` | Poslije `npm ci` |
|---|---|---|
| typecheck | fail, 15 dijagnostika, 2 fajla | nije ponovo pokretan |
| lint | fail prije analize (ESLint 8.57.1) | exit 1, 20 grešaka, 36 upozorenja |
| unit testovi | nisu izvršeni | 54 prošla, 4 pala, 4 fajla nisu učitana |
| e2e | nisu pokretani | nisu pokretani |
| production build | fail prije Vite-a | nije ponovo pokretan |
| JS bundle | nema artefakta | nema artefakta |
| Lighthouse | nije pokrenut | nije pokrenut |
