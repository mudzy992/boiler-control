/* global jest */

/**
 * MO2-8 (MO-012): jest setup koji se izvršava PRIJE učitavanja test modula.
 *
 * Zašto `setupFiles`, a ne `setupFilesAfterEnv` ili `beforeAll` u testu:
 * `src/config/api.config.ts` izračunava `API_CONFIG.BASE_URL` na **top level**
 * (linija 52), dakle pri samom `import`. Ako varijabla tada nije postavljena,
 * modul baca `API_URL not configured` i cijeli test suite padne prije nego što
 * ijedna asertcija počne. `setupFiles` je jedina faza koja sigurno prethodi
 * učitavanju modula.
 *
 * Vrijednost je namjerno očigledno lažna (`test.invalid`): MO2-1 je uklonio
 * hardkodovani fallback host upravo zato što je dev saobraćaj završavao na
 * stvarnom serveru. Test ne smije dobiti host koji izgleda produkcijski.
 */

process.env.EXPO_PUBLIC_API_URL = 'https://test.invalid/api';

// F5: isti startup polyfills kao u `index.js`, da testovi i uređaj vide isti
// `Intl.PluralRules` (Node ima svoj, pa razlika ne bi bila vidljiva — ali bez
// locale podataka za `bs` test bi mjerio Node, ne ono što se šalje korisniku).
require('@formatjs/intl-pluralrules/polyfill-force');
require('@formatjs/intl-pluralrules/locale-data/en');
require('@formatjs/intl-pluralrules/locale-data/bs');

// Native modules are unavailable in Jest. Use the package-maintained mock so
// theme persistence and existing auth/storage tests share the same behavior.
jest.mock(
  '@react-native-async-storage/async-storage',
  () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// F1: `src/ui/index.ts` (barrel) uvozi `Sheet`, koji uvozi `@gorhom/bottom-sheet`.
// Taj paket pri importu dodiruje react-native-worklets i pada u Jest-u
// (`loadUnpackersWithCode`). Mock dolazi iz samog paketa, dakle ponašanje je
// autorovo, a ne naše nagađanje — i sprječava da svaki test koji dotakne
// `src/ui` mora ponavljati isti `jest.mock`.
// Namjerno se NE vraća `require('.../mock')` direktno: taj modul nema
// `__esModule`, pa bi Babel interop postavio `default` na CIJELI objekat i
// `<BottomSheet />` bi pao kao „Element type is invalid: got object".
jest.mock('@gorhom/bottom-sheet', () => {
  const mock = require('@gorhom/bottom-sheet/mock');
  return { __esModule: true, ...mock, default: mock.default };
});

// F7 (TEST-FONT): `Readout`, `MonoLabel` i ostali primitivi idu kroz `useTokens`
// → `useAppFonts` → `expo-font`, a `require('*.ttf')` u Jest-u nije asset nego
// broj („Module 1 is missing from the asset registry"). Rezultat: svaki test
// koji renderuje `Readout` pada na `FontLoader` prije nego dođe do asertacije.
// Mock vraća `[false, null]` — dakle „još nisu učitani", pa `useAppFonts` javi
// `fallback: true` i komponente koriste `systemFontFamily`. To je ISTO stanje
// koje je do sada davalo `useFonts` bez mocka, pa 22 snapshota ostaju
// nepromijenjena; razlika je samo što `require(ttf)` više ne ide u asset
// registry. `[true, null]` je iskušano i pogrešno: snapshoti bi tvrdili da su
// IBM Plex familije aktivne, a u Jest-u nijedan ttf nije učitan.
jest.mock('expo-font', () => ({
  useFonts: () => [false, null],
  isLoaded: () => true,
  loadAsync: () => Promise.resolve(),
}));
