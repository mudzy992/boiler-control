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


const IS_TV = process.env.EXPO_TV === '1';

/** TV gradnja se uključuje iz okoline, nikad automatski. */
const IS_TV = process.env.EXPO_TV === '1';

/** @type {import('expo/config').ExpoConfig} */
const base = {
  name: 'Boiler Control TV',
  slug: 'boiler-control-tv',
  version: '1.0.0',
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
    versionCode: 1,
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
