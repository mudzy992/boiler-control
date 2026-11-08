/**
 * Startup polyfills i šum iz trećeg sloja (F5 — Expo Go / RN 0.88).
 *
 * Zašto poseban modul i zašto se importuje iz `index.js` **prije** `App`:
 *
 *  1. `Intl.PluralRules` — Hermes u RN 0.88 ga nema u svim buildovima.
 *     i18next ga traži pri svakom pluralnom ključu; bez njega ispiše
 *     `i18next::pluralResolver: Your environment seems not to be Intl API
 *     compatible…` i padne na v3 format, gdje bosanski ({1}, {2-4}, {5+})
 *     traži sufiks `_plural` koji ne postoji — pa `homeManagement.thermostatCount`
 *     vraća goli ključ. `@formatjs/intl-pluralrules` je već bio u
 *     `package.json`, ali se nikad nije importovao: zavisnost je stajala
 *     neiskorištena, a greška se vidjela samo na uređaju.
 *     `polyfill-force` je namjerno odabran umjesto `polyfill`: potonji ne radi
 *     ništa kad je `Intl.PluralRules` prisutan ali **nepotpun** (npr. bez
 *     locale podataka za `bs`), što je upravo slučaj koji nam je pravio problem.
 *
 *  2. Deprecation upozorenja dolaze iz `react-native-css-interop` (NativeWind 4),
 *     koji pri prvom JSX renderu uveze `runtime/components.js` i tom prilikom
 *     pročita `react-native.SafeAreaView` i `react-native.ImageBackground` da
 *     bi im dodao `className` podršku. Naš kod te komponente ne koristi
 *     (`SafeAreaView` dolazi iz `react-native-safe-area-context`), pa je jedina
 *     radnja koju možemo preduzeti — filtriranje tih dvaju upozorenja.
 *
 *     VAŽNO: `LogBox.ignoreLogs` ovdje **nije dovoljan**. LogBox hvata samo
 *     poruke koje idu kroz `console.warn`, ali ih i dalje prosljeđuje dalje
 *     (`originalConsoleWarn`), pa se u Metro terminalu i u Expo Go konzoli
 *     vide i dalje. Zato se `console.warn` omotava: tačan tekst se preskače,
 *     a svako drugo upozorenje ide nepromijenjeno. Filter je namjerno sužen na
 *     tačne stringove; logovi se ne guše u cjelini.
 *
 *  3. Deprecation upozorenja iz `react-native/index.js` (RN 0.88) — vidi
 *     `RN_CORE_DEPRECATIONS` niže. To NISU naši importi: nijedan fajl u
 *     `src/` ne čita te simbole. Upozorenja se pale jer RN izvoz definiše kao
 *     **getter** koji zove `warnOnce`, a nekoliko mjesta u ekosistemu pročita
 *     sve izvoze modula `react-native` odjednom. Isti mehanizam je prijavljen
 *     i u Expo repou (expo/expo#39544 — „Wildcard imports/exports of
 *     react-native cause runtime crash\"): `import * as RN from 'react-native'`
 *     ili `export * from 'react-native'` u **bilo kojoj** zavisnosti pusti sve
 *     gettere. Naš bundle (provjereno u `expo export`) takav import ima na
 *     jednom mjestu — `@react-navigation/stack/lib/module/views/
 *     InteractionManager.js` (`import * as ReactNative`, potom
 *     `ReactNative.InteractionManager`), a Reanimated/gesture-handler i sami
 *     dokumentuju da `import * as RN` pod Metro-om čita sve izvoze.
 *     Popravka na našoj strani ne postoji: to je u bibliotekama i u RN-u, pa
 *     se tiho preskaču tačni tekstovi. Ništa se ne gasi u cjelini, a ako neki
 *     budući kod zaista upotrijebi neki od tih simbola, upozorenje ionako ne
 *     bi bilo vidljivo jer ga RN emituje `warnOnce` — jednom po sesiji.
 */

import '@formatjs/intl-pluralrules/polyfill-force';
import '@formatjs/intl-pluralrules/locale-data/en';
import '@formatjs/intl-pluralrules/locale-data/bs';

/** Upozorenja koja dolaze iz NativeWind runtime-a, ne iz našeg koda. */
const IGNORED_WARNINGS = [
  'SafeAreaView has been deprecated and will be removed in a future release',
  'ImageBackground is deprecated and will be removed in a future release',
  // @gorhom/bottom-sheet 5.x prosljeđuje `deps` u `useAnimatedReaction`, što
  // Reanimated 4 na native-u ignoriše (i sam kaže da je relevantno samo za web).
  // Upozorenje je tačno i bezopasno, ali se ponavlja pri svakom montiranju
  // sheeta; nema načina da se popravi bez patcha biblioteke.
  'Dependencies should only be used on the web and are always ignored on native',
] as const;

/**
 * Deprecation upozorenja iz RN 0.88 koja se pale **čitanjem** izvoza, a ne
 * našim kodom (vidi tačku 3 u zaglavlju modula).
 *
 * Tekstovi su prepisani iz `node_modules/react-native/index.js` (getteri
 * `DrawerLayoutAndroid`, `InputAccessoryView`, `ProgressBarAndroid`,
 * `Clipboard`, `PushNotificationIOS`, `UTFSequence`) i skraćeni na prvu
 * rečenicu, koja je dovoljna da bude jedinstvena. Puna poruka sadrži i
 * preporuku zamjenskog paketa, ali ona se mijenja s verzijom RN-a — prva
 * rečenica je stabilna.
 */
const RN_CORE_DEPRECATIONS = [
  'DrawerLayoutAndroid is deprecated and will be removed in a future release',
  'InputAccessoryView is deprecated and will be removed in a future release',
  'ProgressBarAndroid has been extracted from react-native core',
  'Clipboard has been extracted from react-native core',
  'PushNotificationIOS has been extracted from react-native core',
  'UTFSequence has been deprecated and will be removed in a future release',
] as const;

const SUPPRESSED_WARNINGS: readonly string[] = [
  ...IGNORED_WARNINGS,
  ...RN_CORE_DEPRECATIONS,
];

const originalWarn = console.warn.bind(console);

console.warn = (...args: unknown[]) => {
  const first = args[0];
  if (
    typeof first === 'string' &&
    SUPPRESSED_WARNINGS.some((ignored) => first.includes(ignored))
  ) {
    return;
  }
  originalWarn(...args);
};

/**
 * `InteractionManager` (RN 0.88 ga je uklonio, biblioteke ga još traže).
 *
 * RN 0.88 u `react-native/index.js` definiše getter koji **baca** `Invariant
 * Violation` čim se polje pročita. Neke navigacione/bottom-sheet verzije ga
 * čitaju pri renderu, pa ekran pada iako njihov rad (runAfterInteractions)
 * nije neophodan — u RN 0.88 sve ionako ide kroz `requestIdleCallback`-ekvivalent.
 *
 * Ovaj shim ne „gasi" grešku: on **zamjenjuje getter ispravnom implementacijom**
 * istog API-ja (`runAfterInteractions`, `createInteractionHandle`,
 * `clearInteractionHandle`, `setDeadline`), pa pozivaoci dobiju funkcionalno
 * ponašanje umjesto pada. Ako neka buduća verzija RN-a vrati pravi
 * `InteractionManager`, shim ga ne dira.
 *
 * `configurable: true` je ključan: RN getter je takav, pa se može zamijeniti.
 * Ako iz bilo kojeg razloga nije, shim tiho odustaje i ostavlja original.
 */
function installInteractionManagerShim(): void {
  // `require` umjesto `import`: modul se mijenja u mjestu, a ESM binding bi bio
  // read-only. Ovaj modul ionako radi prije i18n-a i render-a (vidi `index.js`).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const reactNativeModule = require('react-native') as Record<string, unknown>;
  const descriptor = Object.getOwnPropertyDescriptor(reactNativeModule, 'InteractionManager');
  if (!descriptor || !descriptor.configurable) return;

  // Već postoji prava implementacija — ništa ne diramo.
  try {
    const existing = reactNativeModule.InteractionManager as { runAfterInteractions?: unknown };
    if (existing && typeof existing.runAfterInteractions === 'function') return;
  } catch {
    // Getter baca — to je slučaj koji rješavamo.
  }

  const queue: (() => void)[] = [];
  let scheduled = false;

  const flush = () => {
    scheduled = false;
    // Kopija: callback može zakazati novi posao.
    const pending = queue.splice(0, queue.length);
    for (const task of pending) {
      try {
        task();
      } catch {
        // Greška u tuđem callback-u ne smije srušiti flush petlju.
      }
    }
  };

  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    const idle = (globalThis as { requestIdleCallback?: (cb: () => void) => unknown })
      .requestIdleCallback;
    if (typeof idle === 'function') idle(flush);
    else setTimeout(flush, 0);
  };

  const shim = {
    runAfterInteractions(task?: (() => void) | { run: () => void }) {
      const callback =
        typeof task === 'function' ? task : () => task?.run?.();
      queue.push(callback);
      schedule();
      return {
        then: (resolve?: () => void) => {
          Promise.resolve().then(() => resolve?.());
          return Promise.resolve();
        },
        done: (resolve?: () => void) => {
          resolve?.();
        },
        cancel: () => {
          const index = queue.indexOf(callback);
          if (index >= 0) queue.splice(index, 1);
        },
      };
    },
    createInteractionHandle() {
      return 0;
    },
    clearInteractionHandle() {
      // Bez brojanja referenci: `runAfterInteractions` u RN 0.88 ionako ide
      // kroz idle callback, pa „interakcija u toku" nema šta da odloži.
    },
    setDeadline() {
      // Namjerno prazno: shim ne odgađa posao po vremenu.
    },
  };

  Object.defineProperty(reactNativeModule, 'InteractionManager', {
    configurable: true,
    enumerable: true,
    get: () => shim,
  });
}

installInteractionManagerShim();
