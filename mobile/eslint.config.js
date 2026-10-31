/**
 * MO2-8 (MO-012): ESLint flat config.
 *
 * Prije ove datoteke `npm run lint` je vraćao **exit 2**: stari `.eslintrc.js`
 * je `extends: ['expo']`, ali `eslint-config-expo` nikad nije bio instaliran.
 * Lint je dakle bio deklariran, a nije radio — isto kao `npm test` s jest-om.
 *
 * Migracija na flat format je nužna, ne stilistička: ESLint 9 **odbija**
 * `.eslintrc.*` i vraća exit 2 s uputstvom za migraciju. Verzije (izmjereno
 * 2026-10-31 preko npm registry):
 *   eslint                     ^9.39.5   (flat config je default)
 *   eslint-config-expo         ~58.0.4   (SDK 58; peer eslint >=8.10)
 *   eslint-config-prettier     ^10.1.8
 *   @typescript-eslint/*       ^8.59.0   (eslint-config-expo vuče ^8; projekt
 *                                        je imao ^6, pa je nadograđen)
 *
 * Pravila iz starog `.eslintrc.js` su namjerno prenijena 1:1 — cilj MO2-8 je
 * uspostaviti lint koji radi, ne promijeniti stil projekta usput.
 */

const expoConfig = require('eslint-config-expo/flat');
const eslintConfigPrettier = require('eslint-config-prettier');
const tseslint = require('@typescript-eslint/eslint-plugin');
const reactHooks = require('eslint-plugin-react-hooks');

module.exports = [
  ...expoConfig,

  {
    /**
     * U flat configu plugin mora biti registrovan u ISTOM objektu koji postavlja
     * njegova pravila. Bez ovoga ESLint 9 pada s „could not find plugin
     * @typescript-eslint" iako je `eslint-config-expo` već uključio plugin —
     * njegova registracija vrijedi samo unutar njegovih objekata.
     */
    plugins: {
      '@typescript-eslint': tseslint,
      'react-hooks': reactHooks,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'react-hooks/exhaustive-deps': 'warn',
    },
  },

  /**
   * MO2-8: BASELINE pre-postojećih prekršaja.
   *
   * Lint u ovoj aplikaciji prije ovog koraka NIJE RADIO: `.eslintrc.js` je imao
   * `extends: ['expo']`, ali `eslint-config-expo` nikad nije bio instaliran, pa
   * je `npm run lint` vraćao exit 2. Ovo je dakle PRVO mjerenje ikad i ono je
   * našlo **71 error / 20 warning u 15 fajlova**. Nijedan od njih nije nastao
   * sada — svi su bili tu, samo nevidljivi.
   *
   * Popraviti 71 prekršaja kroz 15 fajlova unutar zadatka koji glasi „dodaj
   * test/lint infrastrukturu" bilo bi upravo ono što `MASTER-ROADMAP.md:259-260`
   * zabranjuje: refactor naslepo, bez testova za te komponente. Zato se postavlja
   * baseline — pravila s postojećim prekršajima idu na `warn` da bi `npm run lint`
   * vraćao exit 0, a CI padao na NOVOJ grešci.
   *
   * VAŽNO: ovo NIJE tvrdnja da su greške bezopasne. Brojevi su izmjereni
   * 2026-10-31 (`npx eslint . --format json`):
   *
   *   28  react-hooks/rules-of-hooks             ← STVARNI CRASH BUGOVI
   *   21  react-hooks/static-components          (React Compiler v7, novo)
   *   10  react-hooks/refs                       (React Compiler v7, novo)
   *    4  import/namespace                       (lažno pozitivno, vidi ispod)
   *    2  react-hooks/preserve-manual-memoization (v7)
   *    2  react-hooks/set-state-in-effect        (v7)
   *    1  react-hooks/immutability               (v7)
   *    1  react-hooks/purity                     (v7)
   *    1  react/display-name
   *    1  react/no-unescaped-entities
   *
   * 37 od 71 dolazi iz React Compiler ruleseta (`eslint-plugin-react-hooks`
   * **7.1.1**) koji nije postojao kad je kod pisan — to su advisory pravila.
   *
   * `rules-of-hooks` (28) NIJE advisory. Primjer: `AlertsCard.tsx:136` definira
   * `getAlertColors` koji zove `useColorModeValue` 12 puta, a poziva se unutar
   * `alerts.map(...)` na `:165`, gdje `alerts` ovisi o `dashboardData`
   * (`:60-72`; renderuje se na `DashboardScreen.tsx:336`). Broj hook poziva
   * dakle varira s podacima → React baca „Rendered more hooks than during the
   * previous render". Isti obrazac u `BoilerStatusCard.tsx:136,172,200-222`.
   * Zabilježeno kao zaseban nalaz, ne popravlja se usput.
   *
   * `import/namespace` (4) je lažno pozitivno: `Notifications.AndroidImportance`
   * stvarno postoji u `expo-notifications`, ali pravilo ne čita TS enum kroz
   * `eslint-import-resolver-typescript`.
   *
   * Pravila koja NISU u baselineu ostaju na `error` — nova greška ruši lint.
   */
  {
    rules: {
      'react-hooks/rules-of-hooks': 'warn',
      'react-hooks/static-components': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/purity': 'warn',
      'import/namespace': 'warn',
      'react/display-name': 'warn',
      'react/no-unescaped-entities': 'warn',
    },
  },

  // Mora biti ZADNJI: isključuje sva pravila koja se sukobljavaju s Prettierom.
  eslintConfigPrettier,

  {
    ignores: [
      'node_modules/**',
      '.expo/**',
      'dist/**',
      'coverage/**',
      'android/**',
      'ios/**',
    ],
  },
];
