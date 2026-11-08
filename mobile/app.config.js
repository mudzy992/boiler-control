// MO2-2: `package.json` je JEDINI izvor verzije. Ranije su postojala tri koja
// se ne slažu — `package.json` 2.0.0, `app.json` 1.0.0 i hardkodovano "2.0.0" u
// `SettingsScreen.tsx`. `version` je izbačen iz `app.json`, a postavke čitaju
// odavde.
const pkg = require('./package.json');

/**
 * Jedan izvor za EAS projectId — koristi se i u `extra.eas.projectId` i u
 * `updates.url`, pa se ne može desiti da se razilaze.
 */
const EAS_PROJECT_ID = 'c875e85d-ad10-4eb6-bdae-fa5038133ee7';

module.exports = ({ config }) => {
  // Default API URL for local development
  // Will be overridden by EAS build env vars for preview/production
  const extra = {
    EXPO_PUBLIC_API_URL: 'https://api.boiler-control.ba101.top/api',
    eas: {
      projectId: EAS_PROJECT_ID,
    },
  };

  return {
    ...config,
    name: config.name || 'Boiler Control',
    slug: config.slug || 'boiler-control',
    // Jedini izvor verzije je package.json (MO2-2). `config.version` se
    // namjerno NE koristi kao izvor — bio bi drugi, konkurentni izvor.
    version: pkg.version,
    // MO2-2 / expo-updates: OTA ispravke smiju ići samo na buildove iste
    // native verzije. `appVersion` policy znači da promjena native koda
    // (nova verzija) automatski čini stare JS bundleove nevažećim — to je
    // upravo zaštita koju version gate treba.
    runtimeVersion: config.runtimeVersion || { policy: 'appVersion' },
    updates: {
      enabled: true,
      url: `https://u.expo.dev/${EAS_PROJECT_ID}`,
      // ON_LOAD + kratak fallback: aplikacija ne čeka mrežu predugo, a
      // version gate ionako radi svoj poziv.
      checkAutomatically: 'ON_LOAD',
      fallbackToCacheTimeout: 0,
      ...(config.updates || {}),
    },
    orientation: config.orientation || 'portrait',
    icon: config.icon || './assets/new/boiler-control-icon-master.png',
    userInterfaceStyle: config.userInterfaceStyle || 'light',
    assetBundlePatterns: config.assetBundlePatterns || ['**/*'],
    splash: config.splash || {
      image: './assets/new/splash_branding.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    notification: {
      ...(config.notification || {}),
      icon: config.notification?.icon || './assets/new/ic_notification.png',
      color: config.notification?.color || '#ffffff',
    },
    scheme: config.scheme || 'myapp',
    plugins: config.plugins || [
      'expo-sharing',
      'expo-font',
      'expo-updates',
      '@react-native-community/datetimepicker',
      "expo-localization",
      /**
       * MO2-16 (MO-025): `expo-image-picker` NIJE bio naveden ovdje, pa ga je
       * Expo autolinking pokretao bez argumenata — a plugin tada po defaultu
       * dodaje `android.permission.RECORD_AUDIO`.
       *
       * Dokaz (izmjereno 2026-10-30, `expo config --type introspect --json`):
       *   android.permissions[0] = android.permission.RECORD_AUDIO
       *   modResults…uses-permission: RECORD_AUDIO, BEZ `maxSdkVersion`
       * tj. permisija je vrijedila na svim verzijama Androida.
       *
       * Aplikacija nigdje ne snima zvuk: `expo-av`/`expo-audio` nisu ni
       * instalirani, a grep po `src/` ne nalazi nijedan poziv za snimanje.
       * `microphonePermission: false` čini dvije stvari u
       * `expo-image-picker/plugin/src/withImagePicker.ts`: preskoči dodavanje
       * permisije (l. 130) I aktivno je blokira (l. 136-142), pa je ne može
       * vratiti nijedan drugi paket.
       *
       * Kamera se NAMJERNO ne dira — stvarno se koristi
       * (`launchCameraAsync` u `GasForm.tsx:144` i `GasReadingsScreen.tsx:485`),
       * pa bi `cameraPermission: false` slomio fotografisanje brojila.
       */
      [
        'expo-image-picker',
        {
          microphonePermission: false,
        },
      ],
      [
        'expo-notifications',
        {
          icon: "./assets/new/ic_notification.png",
          color: "#ffffff",
          defaultChannel: 'default',
          enableBackgroundRemoteNotifications: false,
        },
      ],
      [
        "expo-build-properties",
        {
          android: {
            /*
             * F11 (BUILD-AAR-METADATA) — zašto compileSdk/targetSdk NISU pinovani.
             *
             * Ovdje je stajalo `compileSdkVersion: 35` i `targetSdkVersion: 35`
             * („Expo 54 zadano je 36, pa pinujemo na 35"). To je vrijedilo za
             * Expo 54. Na SDK 58 / RN 0.88 build PADA, i to ne na našem kodu:
             *
             *   :react-native-screens:checkReleaseAarMetadata
             *   Dependency 'androidx.core:core:1.17.0' requires libraries and
             *   applications that depend on it to compile against version 36 or
             *   later of the Android APIs.
             *   :react-native-screens is currently compiled against android-35.
             *
             * `checkReleaseAarMetadata` poredi compileSdk SVAKE biblioteke sa
             * zahtjevom iz AAR metapodataka. Pošto je `compileSdk` bio 35, a
             * `androidx.core` 1.17 (koju povlači RN 0.88) traži 36+, build se
             * prekida prije kompajliranja ijedne naše linije. To se NE može
             * riješiti `exclude`-om ni SPLOM: prag je u biblioteci.
             *
             * Rješenje: pustiti Expo/RN da odrede vrijednosti. SDK 58 zadaje
             * `compileSdk 37` i `targetSdk 36` (vidi
             * `expo-modules-autolinking/.../ExpoRootProjectPlugin.kt`, defaulti
             * `compileSdk=37`, `targetSdk=36`), što je i ono što Play traži od
             * avgusta 2026. Pinovanje na 35 je bilo i ispod Play zahtjeva.
             *
             * `minSdkVersion` i dalje NIJE diran (Expo zadano 24 = Android 7.0),
             * jer bi viši minSdk onemogućio instalaciju na starijim uređajima.
             */

            // Najveća pojedinačna ušteda na veličini .apk-a: samo jedna ABI.
            buildArchs: ["arm64-v8a"],

            // R8/ProGuard je ISKLJUČEN po odluci vlasnika: smanjio bi APK, ali
            // obfuskacija može slomiti runtime, a stvarni APK se ne može
            // testirati u sandboxu.
            enableMinifyInReleaseBuilds: false,
            // shrinkResources zahtijeva minify, pa mora biti isključen uz njega.
            enableShrinkResourcesInReleaseBuilds: false,

            // Sigurna ušteda bez runtime rizika.
            enablePngCrunchInReleaseBuilds: true,
          },
        },
      ],
    ],
    // iOS build je ukinut — aplikacija se distribuira isključivo kao Android
    // .apk. Zato ovdje nema `ios` bloka: bio bi mrtva konfiguracija koja
    // sugerira da iOS build postoji.
    android: {
      ...(config.android || {}),
      package: config.android?.package || 'com.boilercontrol.app',
      versionCode: config.android?.versionCode || 1,
      adaptiveIcon: {
        ...(config.android?.adaptiveIcon || {}),
        foregroundImage:
          config.android?.adaptiveIcon?.foregroundImage ||
          './assets/new/ic_launcher_foreground.png',
        backgroundImage:
          config.android?.adaptiveIcon?.backgroundImage ||
          './assets/new/ic_launcher_background.png',
        monochromeImage:
          config.android?.adaptiveIcon?.monochromeImage ||
          './assets/new/ic_launcher_monochrome.png',
        backgroundColor:
          config.android?.adaptiveIcon?.backgroundColor || '#ffffff',
      },
      /*
       * `edgeToEdgeEnabled` je UKLONJEN: u SDK 58 plugin ispisuje
       * „`edgeToEdgeEnabled` customization is no longer available — Android 16
       * makes edge-to-edge mandatory". Android 16 nameće edge-to-edge, pa je
       * opcija mrtva i samo pravi šum u `prebuild` logu builda.
       */
      predictiveBackGestureEnabled: config.android?.predictiveBackGestureEnabled ?? false,
      googleServicesFile: config.android?.googleServicesFile || './assets/google-services.json',
    },
    extra: {
      ...(config.extra || {}),
      ...extra,
    },
  };
};
