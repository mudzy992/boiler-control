/**
 * Konfiguracija TV aplikacije.
 *
 * **Zašto `app.config.js`, a ne `app.json`.** Tri stvari se moraju izračunati
 * ili usloviti, a JSON to ne može:
 *
 * 1. `EXPO_TV=1` mora uključiti TV plugin pri `prebuild` — bez toga se
 *    generiše obična Android aplikacija koja se **ne pojavljuje** na Android
 *    TV početnom ekranu (nema `LEANBACK_LAUNCHER`).
 * 2. `projectId` za push dolazi iz okoline (EAS), ne iz repoa.
 * 3. `android.softwareKeyboardLayoutMode` mora biti `pan`: TV prikazuje
 *    tastaturu preko cijelog ekrana i bez ovoga polje za kod ostane ispod nje.
 *
 * **Izmjereno, ne pretpostavljeno:** `@react-native-tvos/config-tv` je *config
 * plugin* (`createRunOncePlugin`), tj. ide u `plugins` niz sa `isTV` opcijom.
 * Prvi pokušaj ga je zvao kao funkciju nad config objektom — to pada tek na
 * `prebuild`, odnosno na gradle build-u u CI-ju, a ne pri `expo start`.
 */

// Jedini izvor verzije je `package.json` (isto pravilo kao mobilna, MO2-2).
// Ranije je ovdje pisalo `version: '1.0.0'` i `versionCode: 1` — pa bi svaki
// TV build nosio ISTI versionCode, a Android odbija nadogradnju sa istim
// brojem. Isti kvar je mobilna imala 16.11. i popravljen je izvođenjem broja.
const pkg = require('./package.json');

/** TV gradnja se uključuje iz okoline, nikad automatski. */
const IS_TV = process.env.EXPO_TV === '1';

/**
 * `major*10000 + minor*100 + patch` — **ista formula** kao mobilna
 * (`mobile/app.config.js`) i backend (`buildNumberFromVersion`), da broj u APK-u
 * i broj koji server izvede budu isti.
 */
const versionCodeFromVersion = (version) => {
  const [major = 0, minor = 0, patch = 0] = String(version)
    .split('.')
    .map((n) => Number.parseInt(n, 10));
  return major * 10_000 + minor * 100 + patch;
};

/** @type {import('expo/config').ExpoConfig} */
const base = {
  name: 'Boiler Control TV',
  slug: 'boiler-control-tv',
  version: pkg.version,
  orientation: 'landscape',
  // TV nema status bar ni navigaciju — `hidden` je jedini ispravan izbor.
  userInterfaceStyle: 'dark',
  backgroundColor: '#0B1418',
  scheme: 'boilercontrol',
  icon: './assets/icon.png',
  splash: {
    backgroundColor: '#0B1418',
    resizeMode: 'contain',
    image: './assets/icon.png',
  },
  android: {
    package: 'com.boilercontrol.tv',
    // Izvedeno iz `pkg.version`, nikad fiksno (v. komentar iznad).
    versionCode: versionCodeFromVersion(pkg.version),
    // Bez ovoga TV se ne može instalirati sa Play prodavnice za TV uređaje.
    // Plugin doda `LEANBACK_LAUNCHER` kategoriju u manifest.
    softwareKeyboardLayoutMode: 'pan',
  },
  plugins: [
    'expo-notifications',
    /*
     * TV plugin se dodaje SAMO kad je `EXPO_TV=1`. Bez uslova bi običan
     * `expo start` na telefonu dobio TV manifest — a ovaj repo ima i mobilnu
     * aplikaciju, pa se `prebuild` mora ponašati različito u zavisnosti od
     * okoline.
     */
    ...(IS_TV ? [['@react-native-tvos/config-tv', { isTV: true }]] : []),
  ],
  extra: {
    eas: {
      // Isti EAS projekat kao mobilna aplikacija: push tokeni idu na isti
      // račun, pa `getExpoPushTokenAsync` radi bez nove konfiguracije.
      projectId: process.env.EAS_PROJECT_ID ?? '',
    },
  },
};

module.exports = base;
