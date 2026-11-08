import fs from 'fs';
import path from 'path';

/**
 * F5 (Expo Go / RN 0.88) — ovaj test čuva dvije stvari koje se vide samo na
 * uređaju, pa ih nijedan snapshot ne bi uhvatio:
 *
 *  1. `Intl.PluralRules` polyfill se uvozi **prije** i18n konfiguracije i prije
 *     aplikacije. Bez njega i18next ispiše
 *     `i18next::pluralResolver: Your environment seems not to be Intl API compatible…`
 *     i padne na v3 format, u kojem bosanski plural vraća goli ključ.
 *  2. Deprecation upozorenja koja dolaze iz `react-native-css-interop`
 *     (`SafeAreaView`, `ImageBackground`) su sužena na tačan tekst, ne na
 *     cijeli `console.warn`.
 */
const mobileRoot = path.join(__dirname, '..', '..', '..');
const read = (...parts: string[]) => fs.readFileSync(path.join(mobileRoot, ...parts), 'utf8');

describe('F5 — startup polyfills', () => {
  it('index.js uvozi polyfills prije App-a', () => {
    const source = read('index.js');
    const polyfillImport = source.indexOf("'./src/polyfills'");
    const appImport = source.indexOf("'./App'");
    expect(polyfillImport).toBeGreaterThan(-1);
    expect(appImport).toBeGreaterThan(-1);
    expect(polyfillImport).toBeLessThan(appImport);
  });

  it('polyfills uvodi Intl.PluralRules za en i bs', () => {
    const source = read('src', 'polyfills.ts');
    expect(source).toMatch(/@formatjs\/intl-pluralrules\/polyfill-force/);
    expect(source).toMatch(/locale-data\/en/);
    expect(source).toMatch(/locale-data\/bs/);
  });

  it('Intl.PluralRules za bosanski daje one / few / other', () => {
    // Polyfill je već učitan kroz jest.setup.js; ovo provjerava da locale-data
    // za `bs` zaista postoji (bez nje `new Intl.PluralRules('bs')` baca).
    const rules = new Intl.PluralRules('bs-BS');
    expect([1, 3, 5].map((count) => rules.select(count))).toEqual(['one', 'few', 'other']);
  });

  it('filter upozorenja pokriva tačno ta dva deprecation teksta', () => {
    const source = read('src', 'polyfills.ts');
    const ignored = source.match(/'[^']*deprecated[^']*'/g) ?? [];
    expect(ignored).toHaveLength(2);
    expect(ignored.join(' ')).toMatch(/SafeAreaView/);
    expect(ignored.join(' ')).toMatch(/ImageBackground/);
    // Nema globalnog gušenja logova.
    expect(source).not.toMatch(/ignoreAllLogs/);
    expect(source).not.toMatch(/console\.error\s*=/);
  });

  it('console.warn propušta sve što nije na listi', () => {
    const downstream = jest.fn();
    const saved = console.warn;
    console.warn = downstream;
    try {
      // Modul se učitava u izolovanom registru da omota baš ovaj `console.warn`.
      jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('../../polyfills');
      });

      console.warn(
        'SafeAreaView has been deprecated and will be removed in a future release. Please use ...',
      );
      expect(downstream).not.toHaveBeenCalled();

      console.warn('nešto važno');
      expect(downstream).toHaveBeenCalledWith('nešto važno');
      expect(downstream).toHaveBeenCalledTimes(1);
    } finally {
      console.warn = saved;
    }
  });
});

describe('F5 — InteractionManager', () => {
  it('nijedna navigaciona zavisnost ne dolazi u verziji koja čita InteractionManager', () => {
    const packageJson = JSON.parse(read('package.json')) as {
      dependencies: Record<string, string>;
    };
    // RN 0.88 je uklonio `InteractionManager`; stack < 7.8 ga je čitao pri
    // svakom renderu kartice (invariant). Prag je zapisan namjerno.
    expect(packageJson.dependencies['@react-navigation/stack']).toBeDefined();
    const installed = JSON.parse(
      read('node_modules', '@react-navigation', 'stack', 'package.json'),
    ) as { version: string };
    const [major, minor] = installed.version.split('.').map(Number);
    // Uslov: >= 7.8 (prva verzija sa `InteractionManager.native.js` guard-om).
    expect(major === 7 ? minor : major).toBeGreaterThanOrEqual(8);

    // NativeWind 4 (react-native-css-interop) čita `SafeAreaView`/`ImageBackground`
    // iz `react-native` pri prvom renderu; to su jedina dva upozorenja.
    const guard = read(
      'node_modules',
      '@react-navigation',
      'stack',
      'lib',
      'module',
      'views',
      'InteractionManager.native.js',
    );
    // Verzija koju koristimo provjerava RN verziju prije nego dotakne API.
    expect(guard).toMatch(/reactNativeVersion/);
  });
});
