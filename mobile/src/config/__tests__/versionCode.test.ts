/**
 * `versionCode` u APK-u — izmjereni kvar (16.11.) i njegova straža.
 *
 * **Šta je bilo.** `app.config.js` je imao `versionCode: config.android?.versionCode
 * || 1`, a `app.json` polje `versionCode` ne sadrži. Znači je svaki build dobijao
 * `1`:
 *
 *   stari EAS autoIncrement davao: 1, 2, 3, 4, 5 …
 *   stari app.config.js davao:     1, 1, 1, 1, 1
 *
 * Verzija EAS remote source-a je kasnije pokazala drugi problem: EAS brojač
 * `22 → 23` nije pratio formulu `20200 → 20201`. Production sada koristi
 * local source bez EAS autoIncrementa, tako da i Gradle i EAS čitaju isti broj
 * iz semvera.
 *
 * **Zašto je to važno i kad nijedan današnji ekran ne čita `buildNumber`.**
 * Android traži strogo veći `versionCode` za nadogradnju. `expo-updates` na
 * `appVersion` runtime policy koristi `expo.version` (semver), odvojeno od tog
 * internog Android broja. Pogrešan/ponovljen `versionCode` može blokirati
 * instalaciju nadogradnje.
 */

const pkg = require('../../../package.json');
// Dynamic Expo config is CommonJS and must be invoked with the current test env.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const appConfigFactory = require('../../../app.config.js');

/** Isti račun kao u `app.config.js` i kao `buildNumberFromVersion` u backendu. */
function versionCodeFromVersion(version: string): number {
  const [major = 0, minor = 0, patch = 0] = String(version)
    .split('.')
    .map((n) => Number.parseInt(n, 10));
  return major * 10_000 + minor * 100 + patch;
}

describe('versionCode iz verzije', () => {
  it('daje jedinstven, rastući broj za svaku semver verziju', () => {
    expect(versionCodeFromVersion('2.0.0')).toBe(20_000);
    expect(versionCodeFromVersion('2.0.1')).toBe(20_001);
    expect(versionCodeFromVersion('2.1.0')).toBe(20_100);
    expect(versionCodeFromVersion('3.0.0')).toBe(30_000);
  });

  it('strogo raste sa svakom promjenom verzije (uslov Androida)', () => {
    const versions = ['1.9.9', '2.0.0', '2.0.1', '2.1.0', '2.9.9', '3.0.0'];
    const codes = versions.map(versionCodeFromVersion);
    for (let i = 1; i < codes.length; i += 1) {
      expect(codes[i]).toBeGreaterThan(codes[i - 1]);
    }
  });

  it('app.config prati package.json bez hardkodovanja trenutne verzije', () => {
    const config = appConfigFactory({ config: {} });
    expect(config.version).toBe(pkg.version);
    expect(config.android.versionCode).toBe(versionCodeFromVersion(pkg.version));
  });

  it('app.config EAS/local Android versionCode ostaje formula, ne remote override', () => {
    const oldValue = process.env.APP_VERSION_CODE;
    process.env.APP_VERSION_CODE = '23';
    try {
      const config = appConfigFactory({ config: {} });
      expect(config.android.versionCode).toBe(versionCodeFromVersion(pkg.version));
    } finally {
      if (oldValue === undefined) delete process.env.APP_VERSION_CODE;
      else process.env.APP_VERSION_CODE = oldValue;
    }
  });

  it('NE vraća 1 za novu verziju (stari kvar)', () => {
    expect(versionCodeFromVersion('2.0.1')).not.toBe(1);
  });
});
