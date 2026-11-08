/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * F12: deprecation upozorenja iz `react-native/index.js` (RN 0.88).
 *
 * KORIJEN PROBLEMA (dokazan niže, ne pretpostavljen):
 * RN 0.88 definiše `DrawerLayoutAndroid`, `InputAccessoryView`,
 * `ProgressBarAndroid`, `Clipboard`, `PushNotificationIOS` i `UTFSequence` kao
 * **gettere** koji pri čitanju zovu `warnOnce`. Upozorenje dakle ne zavisi od
 * toga da li naš kod koristi simbol, nego od toga da li neko pročita sve
 * izvoze modula `react-native` odjednom. U ekosistemu se to dešava kroz
 * `import * as RN` / `export * from 'react-native'` u tuđem kodu
 * (expo/expo#39544); naš bundle ima takav import u
 * `@react-navigation/stack/.../InteractionManager.js`.
 *
 * Zato popravka ne može biti „ukloni import iz našeg koda" — tih importa
 * nema. Popravka je suženi filter u `src/polyfills.ts`, a ovaj test čuva obje
 * strane ugovora:
 *   1. naši fajlovi ne diraju te simbole (da filter ne skriva našu grešku),
 *   2. filtriranje radi tačno za te tekstove i ništa drugo ne guta.
 */

const DEPRECATED_RN_SYMBOLS = [
  'DrawerLayoutAndroid',
  'InputAccessoryView',
  'ProgressBarAndroid',
  'Clipboard',
  'PushNotificationIOS',
  'UTFSequence',
] as const;

/** Prepisano iz `node_modules/react-native/index.js` (getteri sa `warnOnce`). */
const EXPECTED_WARNING_TEXTS = [
  'DrawerLayoutAndroid is deprecated and will be removed in a future release',
  'InputAccessoryView is deprecated and will be removed in a future release',
  'ProgressBarAndroid has been extracted from react-native core',
  'Clipboard has been extracted from react-native core',
  'PushNotificationIOS has been extracted from react-native core',
  'UTFSequence has been deprecated and will be removed in a future release',
] as const;

const readSource = (relativePath: string): string =>
  require('fs').readFileSync(require('path').join(__dirname, '..', '..', relativePath), 'utf8');

describe('F12 — deprecation upozorenja RN jezgra', () => {
  /**
   * Polazište: nijedan naš fajl ne koristi te simbole. Da ovo padne, filter
   * iz `polyfills.ts` bi počeo da skriva stvarnu upotrebu u našem kodu.
   */
  it('naš kod ne koristi nijedan deprecated simbol RN jezgra', () => {
    const sources = [
      'App.tsx',
      'index.js',
      'src/ui/DeviceName.tsx',
      'src/screens/dashboard/DashboardScreen.tsx',
      'src/screens/home/HomeManagementScreen.tsx',
      'src/screens/gas/GasScreen.tsx',
    ];

    for (const file of sources) {
      const contents = readSource(file);
      for (const symbol of DEPRECATED_RN_SYMBOLS) {
        expect({ file, symbol, used: contents.includes(symbol) }).toEqual({
          file,
          symbol,
          used: false,
        });
      }
    }

    // `src/polyfills.ts` JE jedino mjesto gdje se ta imena pojavljuju, i to
    // namjerno — kao tekstovi koje filter preskače, nikad kao import.
    // Provjera je nad stvarnom `import` linijom, ne nad tekstom komentara
    // (komentar u zaglavlju namjerno citira `import * as RN from 'react-native'`).
    const polyfills = readSource('src/polyfills.ts');
    expect(polyfills).not.toMatch(/^\s*import[^\n]*'react-native'/m);
  });

  /**
   * Uzrok: upozorenje se pali čitanjem izvoza, a ne importom. Test to tvrdi
   * direktno nad stvarnim RN modulom — ako RN jednog dana prestane da emituje
   * upozorenje na čitanje, ovaj test pada i filter postaje nepotreban.
   */
  it('čitanje izvoza RN modula pali warnOnce upozorenje (uzrok)', () => {
    const reactNative = require('react-native') as Record<string, unknown>;
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      // Samo čitanje svojstva — nikakav import iz našeg koda.
      void reactNative.Clipboard;
      const emitted = warnSpy.mock.calls.map((call) => String(call[0]));
      expect(emitted.some((message) => message.includes('Clipboard has been extracted'))).toBe(
        true
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  /**
   * Popravka: `src/polyfills.ts` preskače tačno tih šest tekstova. Modul se
   * učitava u izolovanom rejestru (kao na startu aplikacije, prije `App`), pa
   * se `console.warn` stvarno zamjenjuje.
   */
  it('polyfills.ts preskače tačno šest deprecation upozorenja, a ostalo propušta', () => {
    // Spy MORA biti postavljen prije učitavanja polyfills-a: modul pri importu
    // pamti `console.warn` koji je tada bio aktivan, pa bi spy postavljen
    // poslije zamijenio sam omotač i test ne bi mjerio filter.
    const warnMock = jest.spyOn(console, 'warn').mockImplementation(() => {});

    jest.isolateModules(() => {
      require('../polyfills');
    });

    try {
      for (const text of EXPECTED_WARNING_TEXTS) {
        console.warn(text);
      }
      // Kontrolna grupa: upozorenje koje nije na spisku mora proći netaknuto.
      console.warn('Some unrelated warning that must not be swallowed');

      const forwarded = warnMock.mock.calls.map((call) => String(call[0]));
      expect(forwarded).toEqual(['Some unrelated warning that must not be swallowed']);
    } finally {
      warnMock.mockRestore();
    }
  });
});
