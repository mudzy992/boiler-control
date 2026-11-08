/**
 * F11 (BUILD-AAR-METADATA) — regresija za pad produkcijskog builda.
 *
 * Build je pao sa:
 *   :react-native-screens:checkReleaseAarMetadata
 *   androidx.core:core:1.17.0 requires ... compile against version 36 or later
 *   :react-native-screens is currently compiled against android-35
 *
 * Uzrok nije bio ni jedan ekran ni biblioteka, nego `app.config.js`, gdje je
 * `expo-build-properties` pinovao `compileSdkVersion: 35` i
 * `targetSdkVersion: 35` još iz vremena Expo 54. Na SDK 58 / RN 0.88 to je
 * ispod zahtjeva koje nose AAR metapodaci, pa se build prekida prije nego se
 * kompajlira ijedna naša linija.
 *
 * Test čita KONFIGURACIJU, ne native fajlove (njih nema u repou — CNG ih
 * generiše u build fazi), i tvrdi da:
 *  1. `compileSdkVersion`/`targetSdkVersion` nisu pinovani ispod 36;
 *  2. `edgeToEdgeEnabled` (mrtva opcija u SDK 58) se više ne postavlja;
 *  3. R8/minify odluka vlasnika je ostala netaknuta.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const appJson = require('../../app.json');
const appConfigFactory = require('../../app.config');

type BuildProps = {
  plugins: unknown[];
};

const resolveConfig = () => appConfigFactory({ config: { ...appJson.expo } });

/** Izvuče `android` blok iz `expo-build-properties` plugina. */
const buildPropertiesAndroid = (): Record<string, unknown> => {
  const { plugins } = resolveConfig() as BuildProps;
  const entry = (plugins as unknown[]).find(
    (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-build-properties',
  );
  expect(entry).toBeDefined();
  return ((entry as [string, { android: Record<string, unknown> }])[1].android ?? {}) as Record<
    string,
    unknown
  >;
};

describe('F11 — Android SDK verzije u app.config.js', () => {
  it('compileSdk nije pinovan ispod 36 (androidx.core 1.17 traži 36+)', () => {
    const android = buildPropertiesAndroid();
    // `undefined` je ISPRAVNO stanje: tada vrijedi Expo/RN default (37), koji
    // uvijek prati SDK. Pinovanje je ono što je oborilo build.
    if (android.compileSdkVersion !== undefined) {
      expect(Number(android.compileSdkVersion)).toBeGreaterThanOrEqual(36);
    }
  });

  it('targetSdk nije pinovan ispod 36', () => {
    const android = buildPropertiesAndroid();
    if (android.targetSdkVersion !== undefined) {
      expect(Number(android.targetSdkVersion)).toBeGreaterThanOrEqual(36);
    }
  });

  it('minSdk i dalje nije diran (stariji uređaji moraju moći instalirati)', () => {
    expect(buildPropertiesAndroid().minSdkVersion).toBeUndefined();
  });

  it('edgeToEdgeEnabled se ne postavlja (Android 16 ga nameće)', () => {
    const config = resolveConfig() as { android?: Record<string, unknown> };
    expect(config.android?.edgeToEdgeEnabled).toBeUndefined();
    expect(appJson.expo.android.edgeToEdgeEnabled).toBeUndefined();
  });

  it('zadržava odluku vlasnika o R8 i jednoj ABI', () => {
    const android = buildPropertiesAndroid();
    expect(android.enableMinifyInReleaseBuilds).toBe(false);
    expect(android.enableShrinkResourcesInReleaseBuilds).toBe(false);
    expect(android.buildArchs).toEqual(['arm64-v8a']);
  });
});
