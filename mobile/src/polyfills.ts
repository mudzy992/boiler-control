/**
 * Startup polyfills i šum iz trećeg sloja (F5 — Expo Go / RN 0.88).
 *
 * Zašto poseban modul i zašto se importuje iz `index.js` **prije** `App`:
 *
 *  1. `Intl.PluralRules` — Hermes u RN 0.88 ga nema u svim buildovima.
 *     i18next ga traži pri svakom pluralnom ključu; bez njega ispiše
 *     `i18next::pluralResolver: Your environment seems not to be Intl API
 *     compatible…` i padne na v3 format, gdje bosanski ({1}, {2-4}, {5+})
 *     traži sufiks `_plural` koji ne postoji — pa `homeManagement.thermostatCount`
 *     vraća goli ključ. `@formatjs/intl-pluralrules` je već bio u
 *     `package.json`, ali se nikad nije importovao: zavisnost je stajala
 *     neiskorištena, a greška se vidjela samo na uređaju.
 *     `polyfill-force` je namjerno odabran umjesto `polyfill`: potonji ne radi
 *     ništa kad je `Intl.PluralRules` prisutan ali **nepotpun** (npr. bez
 *     locale podataka za `bs`), što je upravo slučaj koji nam je pravio problem.
 *
 *  2. Deprecation upozorenja dolaze iz `react-native-css-interop` (NativeWind 4),
 *     koji pri prvom JSX renderu uveze `runtime/components.js` i tom prilikom
 *     pročita `react-native.SafeAreaView` i `react-native.ImageBackground` da
 *     bi im dodao `className` podršku. Naš kod te komponente ne koristi
 *     (`SafeAreaView` dolazi iz `react-native-safe-area-context`), pa je jedina
 *     radnja koju možemo preduzeti — filtriranje tih dvaju upozorenja.
 *
 *     VAŽNO: `LogBox.ignoreLogs` ovdje **nije dovoljan**. LogBox hvata samo
 *     poruke koje idu kroz `console.warn`, ali ih i dalje prosljeđuje dalje
 *     (`originalConsoleWarn`), pa se u Metro terminalu i u Expo Go konzoli
 *     vide i dalje. Zato se `console.warn` omotava: tačan tekst se preskače,
 *     a svako drugo upozorenje ide nepromijenjeno. Filter je namjerno sužen na
 *     dva stringa; logovi se ne guše u cjelini.
 */

import '@formatjs/intl-pluralrules/polyfill-force';
import '@formatjs/intl-pluralrules/locale-data/en';
import '@formatjs/intl-pluralrules/locale-data/bs';

/** Upozorenja koja dolaze iz NativeWind runtime-a, ne iz našeg koda. */
const IGNORED_WARNINGS = [
  'SafeAreaView has been deprecated and will be removed in a future release',
  'ImageBackground is deprecated and will be removed in a future release',
] as const;

const originalWarn = console.warn.bind(console);

console.warn = (...args: unknown[]) => {
  const first = args[0];
  if (
    typeof first === 'string' &&
    IGNORED_WARNINGS.some((ignored) => first.includes(ignored))
  ) {
    return;
  }
  originalWarn(...args);
};
