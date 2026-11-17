/**
 * `versionCode` u TV build-u — isti kvar kao mobilni MO2-2.
 *
 * Izmjereno 17.11.: `tv/app.config.js` je imao `version: '1.0.0'` i
 * `versionCode: 1` upisane rukom, pa je **svaki** TV build dobijao
 * `versionCode 1`. Android odbija nadogradnju sa istim brojem, a poruka ne
 * kaže da je uzrok verzija — kaže „već instalirano".
 *
 * Ovaj test čita `package.json`, mijenja mu verziju **u memoriji** i traži da
 * se `versionCode` promijeni. Time se hvata upravo taj kvar: fiksna vrijednost
 * bi ostala ista.
 */

describe('TV versionCode prati verziju', () => {
  const originalEnv = process.env.EXPO_TV;

  afterEach(() => {
    process.env.EXPO_TV = originalEnv;
    jest.resetModules();
  });

  /** Učitaj config sa lažnim `package.json`-om date verzije. */
  function configForVersion(version: string) {
    jest.resetModules();
    jest.doMock(
      '../../../package.json',
      () => ({ name: 'boiler-control-tv', version }),
      { virtual: true },
    );
    return require('../../../app.config.js');
  }

  it.each([
    ['1.0.0', 10_000],
    ['2.1.0', 20_100],
    ['2.1.3', 20_103],
  ])('verzija %s daje versionCode %i', (version, expected) => {
    const config = configForVersion(version);
    expect(config.version).toBe(version);
    expect(config.android.versionCode).toBe(expected);
  });

  it('versionCode NIJE fiksan — dvije verzije daju različit broj', () => {
    // Ovo je suština kvara: prije popravke je obje verzije davale 1.
    const first = configForVersion('1.0.0').android.versionCode;
    const second = configForVersion('1.1.0').android.versionCode;
    expect(first).not.toBe(second);
  });

  it('verzija dolazi iz package.json, ne iz koda', () => {
    const pkg = jest.requireActual('../../../package.json');
    const config = configForVersion(pkg.version);
    expect(config.version).toBe(pkg.version);
  });
});
