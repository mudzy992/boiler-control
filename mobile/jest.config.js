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

  collectCoverageFrom: [
    'src/services/**/*.{ts,tsx}',
    'src/components/gas/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
  ],
};
