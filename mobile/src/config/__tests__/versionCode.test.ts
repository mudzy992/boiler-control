/**
 * `versionCode` u APK-u — izmjereni kvar (16.11.) i njegova straža.
 *
 * **Šta je bilo.** `app.config.js` je imao `versionCode: config.android?.versionCode
 * || 1`, a `app.json` polje `versionCode` ne sadrži. Znači je svaki build dobijao
 * `1`:
 *
 *   EAS bi upisao (`autoIncrement: true`):  1, 2, 3, 4, 5 …
 *   app.config.js je stvarno davao:         1, 1, 1, 1, 1
 *
 * `eas.json` postavka je bila mrtva jer je `app.config.js` pregazi.
 *
 * **Zašto je to važno i kad nijedan današnji ekran ne čita `buildNumber`.**
 * Android traži strogo veći `versionCode` za nadogradnju iste `version`, a
 * `expo-updates` na `appVersion` runtime policy ga koristi da razlikuje buildove
 * iste verzije. Sa stalnim 1 drugi APK se odbija kao „već instalirano".
 */

const pkg = require('../../../package.json');

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

  it('odgovara stvarnoj verziji iz package.json (2.0.0 → 20000)', () => {
    // `package.json` je jedini izvor verzije (MO2-2). Ako se verzija podigne,
    // ovaj test pada dok se ne ažurira očekivani broj — namjerno: to je
    // trenutak kad se provjeri da `versionCode` zaista raste.
    expect(pkg.version).toBe('2.0.0');
    expect(versionCodeFromVersion(pkg.version)).toBe(20_000);
  });

  it('NE vraća 1 za novu verziju (stari kvar)', () => {
    expect(versionCodeFromVersion('2.0.1')).not.toBe(1);
  });
});
