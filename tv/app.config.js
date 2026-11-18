/**
 * Konfiguracija TV aplikacije.
 *
 * **Zašto `app.config.js`, a ne `app.json`.** Tri stvari se moraju izračunati
 * ili usloviti, a JSON to ne može:
 *
 * 1. `EXPO_TV=1` mora uključiti TV plugin pri `prebuild` — bez toga se
 *    generiše obična Android aplikacija koja se **ne pojavljuje** na Android
 *    TV početnom ekranu (nema `LEANBACK_LAUNCHER`).
 * 2. `projectId` za push je statički vezan za TV EAS projekat jer dinamični
 *    config CLI ne može sam zapisati tu vrijednost.
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
 * Statički EAS ID je potreban jer `eas credentials` ne učitava `.env` prije
 * nego što poveže dinamičku konfiguraciju sa EAS projektom. ID nije tajna.
 */
const EAS_PROJECT_ID = '5e53f78e-129d-4505-94f5-880fde2867cc';

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
  backgroundColor: '#05070b',
  // JavaScript/UI nadogradnje se preuzimaju i primjenjuju tiho kroz aplikaciju.
  // Native promjene i dalje zahtijevaju novi store/build instalacijski paket.
  updates: {
    url: `https://u.expo.dev/${EAS_PROJECT_ID}`,
    enabled: true,
    checkAutomatically: 'ON_LOAD',
    fallbackToCacheTimeout: 0,
  },
  runtimeVersion: { policy: 'appVersion' },
  scheme: 'boilercontrol',
  // Ista aplikacijska ikonica kao mobilna, uz iste Android adaptive layers.
  icon: './assets/boiler-control-icon-master.png',
  splash: {
    backgroundColor: '#05070b',
    resizeMode: 'contain',
    image: './assets/boiler-control-icon-master.png',
  },
  android: {
    package: 'com.boilercontrol.tv',
    adaptiveIcon: {
      foregroundImage: './assets/ic_launcher_foreground.png',
      backgroundImage: './assets/ic_launcher_background.png',
      monochromeImage: './assets/ic_launcher_monochrome.png',
      backgroundColor: '#ffffff',
    },
    // Izvedeno iz `pkg.version`, nikad fiksno (v. komentar iznad).
    versionCode: versionCodeFromVersion(pkg.version),
    // Firebase Android app mora biti registrovan baš kao com.boilercontrol.tv.
    // Build skripta provjerava package_name prije native builda.
    googleServicesFile: './assets/google-services.json',
    // Bez ovoga TV se ne može instalirati sa Play prodavnice za TV uređaje.
    // Plugin doda `LEANBACK_LAUNCHER` kategoriju u manifest.
    softwareKeyboardLayoutMode: 'pan',
  },
  plugins: [
    'expo-updates',
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
      // TV ima svoj slug (`boiler-control-tv`) i svoj EAS project ID,
      // različit od mobilnog. Mora biti statičan zbog dynamic app config:
      // `eas credentials` ga ne može upisati automatski.
      projectId: EAS_PROJECT_ID,
    },
  },
};

module.exports = base;
