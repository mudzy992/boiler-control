/**
 * MO2-8 (MO-012): konfiguracija test runnera za mobilnu aplikaciju.
 *
 * Prije ove datoteke `npm test` je vraćao **exit 127 (`jest: not found`)** jer
 * `jest` nije bio ni deklariran u `package.json`, a `scripts.test` je već stajao
 * kao `jest`. Znači skripta je postojala, runner nije — pa nijedan test nije bio
 * izvršiv, a nekoliko zadataka (MO2-16, MO2-6) ima prihvatan test koji se nije
 * mogao pokrenuti.
 *
 * Verzije su usklađene s SDK 58 (izmjereno 2026-10-31 preko npm registry):
 *   jest-expo        ~58.0.13   (peer: jest ^29 || ^30)
 *   jest             ^30.5.2
 *   @react-native/jest-preset ^0.88.1  (poklapa react-native 0.88.1)
 *   react-server-dom-webpack 19.3.0    (peer: react ^19.3.0)
 *
 * `react-server-dom-webpack` je namjerno pinovan na **19.3.0**, ne `~19.3.0`:
 * `~19.3.0` razrješava na 19.3.1 koji traži `react ^19.3.1`, a projekt ima
 * `react 19.3.0`, pa npm pada na ERESOLVE.
 */

/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',

  // Samo čista logika i komponente — bez e2e i bez build artefakta.
  testMatch: ['**/__tests__/**/*.test.[jt]s?(x)'],

  // Mora biti `setupFiles` (ne `setupFilesAfterEnv`): `api.config.ts` računa
  // `API_CONFIG.BASE_URL` pri učitavanju modula, pa varijabla mora postojati
  // prije prvog importa.
  setupFiles: ['<rootDir>/jest.setup.js'],

  // jest-expo donosi vlastiti transformIgnorePatterns; ovo je Expo preporuka za
  // SDK 54+ jer većina ESM paketa u node_modules mora proći kroz babel.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|react-native-svg)',
  ],

  clearMocks: true,

  // Zadanih 5000 ms po testu je manje od granice na koju sami testovi čekaju.
  // `gasOpenSheets` čeka `SHEET_TIMEOUT_MS = 15_000` i lokalno traje ~3,8 s, ali
  // na opterećenom CI runneru pređe 5 s — i tada Jest ubije test **prije** nego
  // `findBy*` dođe do svoje granice, pa poruka izgleda kao da sheet nikad nije
  // montiran, a stvarno je isteklo vrijeme testa. Zato je Jest limit veći od
  // najveće granice koju testovi koriste.
  testTimeout: 20_000,

  collectCoverageFrom: [
    'src/services/**/*.{ts,tsx}',
    'src/components/gas/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
  ],
};
