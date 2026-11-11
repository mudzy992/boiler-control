# Mobile refaktor — odluke i obim

Datum: 2026-11-07. Branch: `arena/456ec6f2-boiler-control`.
Nadovezuje se na `audit.md` i `prototype.html` (odobreno 2026-11-07).

## 1. Odluke vlasnika (obavezujuće za sve faze)

| # | Pitanje | Odluka | Posljedica |
|---|---|---|---|
| 1 | Broj tabova | **Ostaje 4** — Početna, Grijanje, Plin, Postavke | Nema novog „Sistem" taba; kotao i termostati ostaju na Početnoj |
| 2 | Default tema | **Dark**, kao na webu | `AppThemeProvider` starta na `dark`; sistem se poštuje samo ako korisnik izabere „Sistem" |
| 3 | Fiktivne metrike | **Brisati odmah u F3** | `analytics.better` / `analytics.improvement` i blok „AI Insights" izlaze iz UI-a; ključevi ostaju u `locales` dok se ne vrate sa stvarnim podacima |
| 4 | Font | **IBM Plex** (Sans + Mono), kao na webu | Self-host `ttf` u `mobile/assets/fonts` — nema mrežnog CDN-a, nema dodatne zavisnosti |
| 5 | Prijevod tri ekrana | **Odmah u ovom refaktoru** (F1) | `HomeManagement`, `ScheduleManagement`, `Profile` dobijaju ključeve u oba jezika |

## 2. Nepromjenjivo kroz sve faze

- API sloj, `services/api/*`, React Query ključevi (`services/query/keys.ts`).
- Imena ruta i deep link prefiksi (`constants/routes.ts`, `myapp://`) — instalirane verzije ih očekuju.
- Auth tok i `SecureStorage`.
- Postojeći test suite-ovi moraju ostati zeleni; novi testovi se dodaju, stari se ne prepisuju
  osim kad tvrde upravo ono što refaktor mijenja (tada se mijenja tvrdnja, uz obrazloženje u commit poruci).
- Poslovna logika (mutacije, invalidacije, validacije, limiti iz `constants/boilerLimits.ts`).

## 3. Faze

### F0 — Temelj (ovaj korak)

Cilj: nova baza postoji i radi **paralelno** sa starom. Nijedan ekran se ne mijenja.

| Fajl | Sadržaj |
|---|---|
| `src/theme/tokens.ts` | Semantički tokeni za obje teme: `canvas`, `panel`, `raised`, `line`, `lineStrong`, `ink`, `inkMuted`, `inkDim`, `signal`, `ok`, `warn`, `fault`, `info`; skala razmaka, radijusa, tipografije |
| `src/theme/fonts.ts` | `useAppFonts()` — učitava IBM Plex Sans (400/500/600/700) i Plex Mono (400/500/600) iz `assets/fonts`, vraća `{ loaded, error }`, s fallbackom na sistemske familije |
| `src/theme/AppTheme.tsx` | Default `dark` (odluka 2), `AsyncStorage` ključ `boiler.color-mode` ostaje; opcija „system" |
| `src/ui/Screen.tsx` | `Screen`, `ScreenHeader`, `Section` |
| `src/ui/Panel.tsx` | `Panel`, `HeroPanel` |
| `src/ui/Readout.tsx` | `Readout` (mono, tabularno), `Kpi` |
| `src/ui/GaugeBar.tsx` | Progres + marker cilja |
| `src/ui/Led.tsx` | Živo stanje: `on / ok / warn / off` + `StatusDot` s tekstom |
| `src/ui/Segmented.tsx` | Filter/prekidač sekcija (a11y `tab` role) |
| `src/ui/InlineBanner.tsx` | `info / ok / warn / fault`, hairline + lijeva ivica |
| `src/ui/AsyncState.tsx` | `Skeleton` po obliku, `ErrorState`, `EmptyState` |
| `src/ui/Button.tsx` | `primary / secondary / ghost / danger`, `block`, `loading`, 44px dodir |
| `src/ui/Sheet.tsx` | Ispravljen bottom sheet: bez ranog unmounta, `title` se renderuje, `keyboardBehavior` |
| `src/ui/index.ts` | Jedan ulaz: `import { Screen, Panel, Readout } from '@/ui'` |

### F1 — Navigacija i jezik

Jedan tab bar (Plin bez ugniježđenog navigatora; `Segmented` u zaglavlju), `ScreenHeader` na svim
push ekranima, naslovi iz `t()`, prijevod `HomeManagement` / `ScheduleManagement` / `Profile`,
`userInterfaceStyle: "automatic"` u `app.json`.

### Šta je F1 stvarno isporučio

| Nalaz iz audita | Šta je urađeno | Dokaz |
|---|---|---|
| UX-03 dva tab bara | `GasScreen` više nije `createBottomTabNavigator`; sekcije mijenja `Segmented` u zaglavlju (`gas-segmented-readings` / `-analysis`), prisutan u OBJE sekcije | `f1Navigation.test.tsx` |
| Deep link plina | `notificationService` šalje `params.screen` + `openAddModal` direktno na `Gas`; `linking.config` više nema pod-stablo za Gas | isti test + `routes.ts` napomena |
| UX-02 slijepa ulica | `AnalyticsScreen`, `NotificationsScreen`, `NotificationPreferencesScreen`, `Profile`, `HomeManagement`, `ScheduleManagement`, `GasAnalysis` dobili `ScreenHeader` sa nazad strelicom | `analyticsNativeWind` snimci |
| UX-05 neprevedeni naslovi | naslovi push ekrana dolaze iz `t()`, ne iz navigatora; `headerShown: false` tamo gdje ekran nosi svoj header (inače dva headera) | `SettingsStackNavigator.tsx` |
| Odluka 5 prevodi | `Profile`, `HomeManagement`, `ScheduleManagement` u potpunosti na `t()` — uključujući validaciju, toastove, placeholder-e, `Select` opcije i helper `getNextScheduledChange` (vraća ključ, ne tekst) | `profile.*`, `schedule.*`, `homeManagement.*` u oba jezika |
| UX-12 lažna dugmad | plamen na Početnoj je statusna ikona (`role="image"`), ne `Pressable` bez `onPress`; analytics/refresh dugmad imaju labelu | `dashboardNativeWind` snimci |
| iOS tema | `app.json` → `userInterfaceStyle: "automatic"` — bez toga iOS ignoriše našu tamnu temu | `f1Navigation.test.tsx` |
| 32 hardkodovane boje (dio) | `MainTabNavigator` više nema nijedan hex — boje, visina i font iz `useTokens()`, visina poštuje safe-area inset | isti test (regex na hex) |

Dva popravka koja F1 nije tražio, ali su blokirala verifikaciju:

1. **`jest.setup.js`** mockuje `@gorhom/bottom-sheet` mockom iz samog paketa. Barrel
   `src/ui/index.ts` uvozi `Sheet`, a taj paket pri importu dodiruje
   `react-native-worklets` i pada u Jest-u. Bez ovoga svaki test koji dotakne
   `src/ui` mora ponavljati isti mock.
2. **`compatibilityJSON: 'v3'` uklonjen** iz `src/locales/config.ts`. Uz i18next 23
   v3 mapira bosanski ({1}, {2-4}, {5+}) na sufiks `_plural`, koji postoji samo za
   dvojezične oblike — pa je `homeManagement.thermostatCount` vraćao goli ključ.
   V4 oblici (`_one` / `_few` / `_other`) rade na Hermesu u RN 0.88.

Provjera poslije F1 (2026-11-07):

```
npm run type-check   → 0 grešaka
npm test             → 28 suite-ova, 184 testa, 32 snapshot-a — sve zeleno
                       (26 postojećih + 2 nova: f1Navigation.test.tsx, locales/parity.test.ts)
npm run lint         → 0 grešaka
```

Snimci su ažurirani za 9 ekrana. Razlog je legitiman, ne „da test prođe":
svaki ekran sada ima `ScreenHeader` (drugi naslov, nazad strelica), Plin nema
drugi tab bar, a Početna ima statusnu ikonu umjesto lažnog dugmeta. Asertacije
na tekst su dirane samo tamo gdje se promijenio tekst: `Add Home` → `Add home`
(ključ `homeManagement.addHome`), `Home added successfully` → `Home added`, i
placeholder `e.g., Main House` → `Home Name`. Testovi su dobili
`useNavigation` mock i `SafeAreaProvider`, jer ekrani sada čitaju navigaciju
(nazad) i safe-area insete (visina tab bara).

### F2 — Glavni ekrani

Početna (hero + 3 KPI + liste), Grijanje (red-po-uređaju), Plin (red-po-očitanju), Postavke (jedna lista).

### Šta je F2 stvarno isporučio

| Nalaz iz audita | Šta je urađeno | Dokaz |
|---|---|---|
| UX-08 sjene bez hijerarhije | Početna, Grijanje, Plin (red), Postavke, `WeatherRow`, `GasReadingCard` **bez ijednog `shadow` propa** — dubinu nosi hairline ivica; uklonjeno 4 mrtve komponente (`BoilerStatusCard`, `HealthScoreCard`, `ThermostatCard`, `WeatherCard`) | `f2Screens.test.tsx` (regex po fajlu) |
| UX-09 tri akcenta u prvoj kartici | Početna: **jedan hero** (polazna voda) + **tri KPI pločice**; akcent samo na akciji i živom stanju (`Led`/`StatusDot`), ne na pločicama | `findByTestId('dashboard-hero')`, `kpi-*` |
| Dva velika broja bez glavnog | Hero nosi `Readout` xl za mjerenu vrijednost, cilj je `md` mono; `GaugeBar` nosi odnos bez trećeg broja | `dashboard-flow-actual` |
| Vrijeme ~200px za podatak koji nije odluka | `WeatherRow` — jedan red: temperatura, stanje, `68% · 2.4 m/s · 1018 hPa` u mono meti | `WeatherRow.tsx` |
| Grijanje: 4 broja + puna značka po kartici | Red po uređaju: `21.5 → 23.0 °C` u jednom `Readout`-u, gauge ka cilju, LED umjesto pune boje; 3 termostata ≈ 330px umjesto 630px | `f2Screens.test.tsx` |
| UX-11 FAB prekriva sadržaj | „Dodaj očitanje" je u zaglavlju (`ScreenHeader action`), FAB uklonjen; `keyExtractor`/`renderItem` ugovor (MO2-13) netaknut | `f2Screens.test.tsx` |
| Plin: 4 pune boje značaka | Red očitanja: brojač mono, `07.11 · 08:15 · +4.82 m³/dan`, cijena desno; značke outline, signal samo na REF; sažetak (potrošnja / broj / zadnje) iznad liste | `GasReadingCard.tsx`, `gas-summary` |
| UX-07 pun ekranski spinner | Početna i Grijanje: skeleton u istom footprintu (`Skeleton`, `SkeletonRows`) umjesto spinnera | `DashboardScreen`, `HeatingScreen` |
| UX-16 hook unutar JSX-a | Postavke: `SettingRow` bez ijednog hooka u uslovnom izrazu; šest kartica → `Section` + `Panel variant="flush"` | `SettingsScreen.tsx` |
| UX-15 devet ručnih toastova | Početna koristi `toast.show`; validacija temperature ostaje **u sheetu** (`InlineBanner`) jer toast „nije uspjelo ažuriranje" za pogrešan unos nije tačan | `DashboardScreen.tsx` |

Provjera poslije F2 (2026-11-07):

```
npm run type-check   → 0 grešaka
npm test             → 29 suite-ova, 195 testova, 32 snapshot-a — sve zeleno
                       (28 postojećih + 1 novi: f2Screens.test.tsx, 11 testova)
npm run lint         → 0 grešaka
```

Snimci su ažurirani za 4 ekrana (Početna, Grijanje, Plin, Postavke) i
`homeManagement` (uklonjena sjena sa kartice doma). Jedna asertacija je
promijenjena: `123.45 m³` se traži kroz `getAllByLabelText` jer red očitanja
razdvaja broj i jedinicu u `Readout` — ista informacija, jedan a11y čvor.
Test „submits a valid current temperature" sada traži dugme po `testID`-u
(`open-set-temp`): `Sheet` ostaje montiran (UX-14), pa se naslov pojavljuje i
prije otvaranja i `getByText` bi našao dva elementa.

### F3 — Analitika i grafovi

Uklanjanje fiktivnih metrika i bloka „AI Insights", `react-native-chart-kit` → `react-native-svg`,
tabela „vrijednost / prethodno", cilj-vs-postignuto.

### Šta je F3 stvarno isporučio

| Nalaz iz audita | Šta je urađeno | Dokaz |
|---|---|---|
| AN-01 fiktivne metrike („12 % bolji od sličnih domova", „18 % poboljšanje") | Ekran **ne sadrži** nijednu tvrdnju o poređenju sa drugim domovima; uklonjen i blok „AI Insights". Ključevi `analytics.better`/`improvement` su već bili obrisani iz `locales` (MO2-19), pa nema ni mrtvih stringova | `f3Analytics.test.tsx` (regex po UI stablu i po izvoru) |
| AN-04 hardkodiran trend + „u odnosu na prošlu sedmicu" bez upita | Novi `analyticsApi.getPreviousSummary` sa rasponom pomaknutim unazad za tačno trajanje perioda; tabela prikazuje **stvarne** brojeve oba perioda i procentualnu razliku koja se računa iz njih | `getAllByText('-20.0%')`, a11y label reda, `getPreviousSummary` mock |
| AN-03 `react-native-chart-kit` + `Dimensions.get('window')` | `react-native-chart-kit` **uklonjen iz `package.json`**; jedan `TrendChart` na `react-native-svg` (već instaliran), širina iz `onLayout`, isprekidana ciljna linija, tačka na zadnjoj vrijednosti. Isti graf koristi i analiza plina | `f3Analytics.test.tsx` (source contract), `gas-analysis-chart` |
| Nedostatak tabele poređenja | `analytics-summary-table`: kolone „Vrijednost / Prethodno", delta u `MonoMeta` (zeleno = manje, žuto = više, sivo = bez promjene) | `analytics-summary-table` |
| Cilj se ne vidi na grafovima | `TrendChart target` + prosječan cilj iz `avgTargetTemp`; „Cilj vs postignuto" sekcija sa `GaugeBar` po termostatu iz `getDashboard` | `analytics-target-panel` |
| UX-18 tri vizuelna jezika grafova | Jedan komponent (`TrendChart` + `TrendSummary`) za oba ekrana; `TrendSummary` daje min/prosj./max u mono meta redu umjesto tooltipa | `src/ui/TrendChart.tsx` |

Boje delte su namjerne: **manje sati grijanja je bolje** (zato `-20 %` zeleno),
a tabela nikad ne boji procent ako prethodni period nema podataka — tada je
ćelija `—` i sekcija nosi `analytics.noPreviousData`.

Provjera poslije F3 (2026-11-08):

```
npm run type-check   → 0 grešaka
npm test             → 30 suite-ova, 201 test, 32 snapshot-a — sve zeleno
                       (29 postojećih + 1 novi: f3Analytics.test.tsx, 6 testova)
npm run lint         → 0 grešaka
```

Snimci analitike su regenerisani (light + dark): ekran je u potpunosti
prepisan, pa je razlika strukturna, ne kozmetička — KPI pločice umjesto
kartica sa ikonama, `Segmented` umjesto selecta, jedan graf umjesto dva,
tabela poređenja umjesto pasusa. Dvije asertacije u
`analyticsNativeWind.test.tsx` su promijenjene jer tvrde upravo ono što faza
mijenja: (1) period se bira klikom na `analytics-range-month` u `Segmented`
traci, a ne `combobox` + tekst opcije; (2) prosječna sobna temperatura se traži
po `testID`-u `kpi-avg-indoor`, jer se ista vrijednost sada legitimno pojavljuje
i u tabeli poređenja — `getByText('21.5')` bi našao dva elementa. Umjesto
`0 analytics.samples` (stari hardkodirani tekst) test traži `analytics-model`
sekciju. `package-lock.json` je promijenjen isključivo uklanjanjem
`react-native-chart-kit` i njegovih tranzitivnih paketa.

### F4 — Završnica

Skeleton na svim ekranima, a11y labele i role, `hitSlop`, ispravke toastova, brisanje mrtvih stilova.

### Šta je F4 stvarno isporučio

| Nalaz iz audita | Šta je urađeno | Dokaz |
|---|---|---|
| UX-07 pun ekranski spinner (7 ekrani) | Svi preostali spinneri zamijenjeni skeletonima u footprintu sadržaja: Očitanja (`SkeletonRows`), Analiza plina (redovi + graf), Obavijesti, Postavke obavijesti (`SkeletonPanel` + redovi), Profil, Rasporedi, Upravljanje domovima. Analiza plina **zadržava zaglavlje sa nazad** i dok se čita — prije je cijeli ekran nestajao | `f4Polish.test.tsx` (nijedan ekran nema `<Spinner>`) |
| UX-06 15 labela na 10 776 LOC | Svaki `Pressable` u ekranima ima `accessibilityLabel`; ikonografske kontrole dobile `hitSlop` ≥ 8 i `accessibilityState`; `FormInput` veže labelu na polje (`accessibilityLabel ?? placeholder`), pa čitač ekrana ne kaže samo „tekstualno polje" | `f4Polish.test.tsx` (statistički prolaz kroz sve `Pressable` tagove) |
| UX-19 jedini `Alert.alert` | Akcije za sliku brojila idu kroz `ui/Sheet` — ista gramatika kao sve ostale potvrde, isti jezik, ista a11y pravila | `gas-meter-image-sheet` |
| UX-14 dva bottom sheeta u Plinu | `components/BottomSheetModal.tsx` **obrisan**; Očitanja koriste `ui/Sheet` (naslov u zaglavlju, animirano zatvaranje, X sa labelom iz `t()` — `closeLabel` prop, jer je prije bio hardkodovan „Zatvori") | `gas-add-sheet`, `gas-date-range-sheet` |
| UX-24 prazna stanja bez „šta dalje" | Grijanje bez termostata → `EmptyState` sa akcijom ka Rasporedima (jedina postojeća ruta, bez izmišljenog ekrana); Analiza plina bez podataka → akcija „Idi na očitanja" | `noThermostatsAction`, `gas.analysisNoDataAction` |
| UX-23 splash 2,5 s fiksno | Splash se sklanja kad su jezik i fontovi spremni, uz minimum 600 ms (bez bijelog bljeska) i maksimum 2,5 s (spor disk ne zadržava korisnika) | `App.tsx` |
| UX-16 hook u JSX-u (preostalo) | `GasForm` (tri `useColorModeValue` u grani) i `RecentHeatingEvents` (hook u `renderEventItem`) — boje se računaju na vrhu komponente | `eslint` — 0 `rules-of-hooks` |
| Bug u locale fajlu (`gas.dateRange`) | Ključevi Postavki (`accountSection`, `appearanceSection`, `notificationsSection`, `homesSection`, `dataPrivacySection`, `aboutSection`, `languageEnglish`, `languageBosnian`) i `units.dailyGasReminderTime` bili su fizički u `gas.*`, sa **bosanskim vrijednostima u engleskom bloku**. Sada su u `settings.*` u oba jezika, a `gas.dateRange`/`gas.units` sadrže samo svoje ključeve | `f4Polish.test.tsx` (5 locale testova), `parity.test.ts` proširen na `gas`/`settings`/`notifications`/`analytics` |
| Mrtav kod | `console.error` bez radnje u `ProfileScreen` (odjava je lokalna), nekorišteni importi i `useColorModeValue` vrijednosti u ekranima koji su prešli na tokene (`Spinner`, `Center`, `accentColor`, `bgColor`, `spinnerColor`) | `tsc` sa `noUnusedLocals` |

Provjera poslije F4 (2026-11-08):

```
npm run type-check   → 0 grešaka
npm test             → 31 suite, 222 testa, 32 snapshot-a — sve zeleno
                       (30 postojećih + 1 novi: f4Polish.test.tsx, 13 testova)
npm run lint         → 0 grešaka, 50 upozorenja (sva postojeća u starom sloju)
```

Snimci su regenerisani za 6 ekrana (Prijava, Registracija, Profil, Obavijesti,
Postavke, Upravljanje domovima, Očitanja plina) — razlika je posljedica dvije
sistemske promjene, ne kozmetike: (1) `FormInput` sada nosi `accessibilityLabel`
i `accessibilityState` na polju; (2) `Pressable`-i nose `accessibilityLabel`/
`accessibilityRole`. Nijedna asertacija nije mijenjana; u tri testa je uklonjen
`jest.mock('../../components/BottomSheetModal')` jer modul više ne postoji.

### F5 — Expo Go / RN 0.88 (nakon F4)

Pokretanje u Expo Go otkrilo je četiri stvari koje se **ne vide u testovima ni u
`expo export`**: tri su iz trećeg sloja, jedna je bila neiskorištena zavisnost.

| Simptom | Uzrok | Šta je urađeno |
|---|---|---|
| `i18next::pluralResolver: Your environment seems not to be Intl API compatible…` | Hermes u RN 0.88 nema `Intl.PluralRules`; `@formatjs/intl-pluralrules` je bio u `package.json` ali se **nikad nije importovao** | Novi `src/polyfills.ts` (uveden iz `index.js` prije `App`): `polyfill-force` + locale-data `en` i `bs`. `polyfill-force` je namjeran izbor — obični `polyfill` ne radi ništa kad je API prisutan ali bez `bs` podataka, a to je bio slučaj |
| `SafeAreaView has been deprecated…` / `ImageBackground is deprecated…` | `react-native-css-interop` (NativeWind 4) pri prvom JSX renderu uveze `runtime/components.js` i pročita ta dva gettera iz `react-native` da bi im dodao `className`. Naš kod ih ne koristi | `console.warn` filter u `polyfills.ts`, sužen na tačan tekst. `LogBox.ignoreLogs` sam ne pomaže — RN ga i dalje prosljeđuje u Metro terminal (`originalConsoleWarn`), pa je omotač oko `console.warn` jedino mjesto gdje se poruka zaista zaustavi |
| `[Invariant Violation: InteractionManager has been removed from react-native core]` ×3 | `@react-navigation/stack` 7.7.2 čita `InteractionManager` pri svakom renderu kartice; RN 0.88 ga je uklonio. Riješeno u 7.8+ (`InteractionManager.native.js` provjerava `Platform.constants.reactNativeVersion` prije pristupa) | `@react-navigation/stack` 7.7.2 → **7.12.1**, uz `native` 7.5.1, `bottom-tabs` 7.21.0, `material-top-tabs` 7.8.1 (+ `elements` 2.9.45). API navigacije se ne mijenja: rute, `navigationRef` i deep link prefiksi ostaju isti |

Uz to: `nativewind` je pri prvom pokretanju generisao `nativewind-env.d.ts` i
dopunio `tsconfig.json` — ta dva `className` tipa su sada commitovana, pa
`npm run type-check` ne zavisi od toga da je neko lokalno pokrenuo Expo.

### `InteractionManager` — druga runda (shim)

Nakon nadogradnje navigacije greška se **vratila u Expo Go**, iako bundle
građen iz istog koda nije sadržavao nijedno čitanje `InteractionManager`-a
(provjereno `grep`-om po izvezenom dev bundle-u). Dva su moguća uzroka i oba
su pokrivena:

1. **Metro cache / stari bundle.** `expo start` drži transformisani modul;
   `@react-navigation/stack` se učitava jednom i ostaje u kešu i poslije
   `npm install`-a. Zato je potreban `npx expo start -c`.
2. **Neka druga zavisnost** (koju ovaj sandbox bundle ne uključi, npr. drugi
   lockfile na uređaju) čita `react-native.InteractionManager`.

Da greška ne bi zavisila od toga ko je u pravu, `src/polyfills.ts` sada
**zamjenjuje getter ispravnom implementacijom** istog API-ja
(`runAfterInteractions` sa `cancel`, `createInteractionHandle`,
`clearInteractionHandle`, `setDeadline`), umjesto da samo gasi poruku:

- getter u RN 0.88 je `configurable: true`, pa se može zamijeniti; ako neka
  buduća verzija vrati pravi `InteractionManager`, shim ga **ne dira**
  (provjerava `typeof runAfterInteractions === 'function'`);
- posao se izvršava kroz `requestIdleCallback` kad postoji, inače
  `setTimeout(…, 0)` — dakle isto ponašanje koje RN 0.88 preporučuje;
- greška u jednom pozivaocu ne prekida ostale, a `cancel()` uklanja posao.

Ovo je jedina izmjena koja dira ponašanje biblioteke, i namjerno je minimalna:
shim implementira API, ne potiskuje invariant.

Provjera (2026-11-08):

```
npm run type-check   → 0 grešaka
npm test             → 33 suite-a, 233 testa, 32 snapshot-a — sve zeleno
                       (31 postojeći + f5Runtime.test.ts 6 + interactionManagerShim.test.ts 5)
npm run lint         → 0 grešaka
npx expo export --platform android → bundle se gradi; dev bundle sadrži shim
```

Regenerisan je jedan snapshot (`navigationNativeWind`): novija verzija
`react-native-screens`/navigacije renderuje `pointerEvents="box-none"` na
`ScreenStack` i po jedan `false` u `style` nizu tab ikone. To je izlaz
biblioteke, ne naša promjena stilova — nijedna asertacija nije dirana.

### F6 — ono što Expo Go još prijavljuje, i šest dorada

Pokretanje u Expo Go dalo je još dvije greške, a uz njih je traženo šest
dorada: jezik u Postavkama, WCAG 2.2 AA audit, redoslijed na Početnoj,
tipografija i spacing, te **detaljan** prolaz kroz Plin i sve ekrane Postavki.

| Simptom / zahtjev | Dokazani uzrok | Šta je urađeno |
|---|---|---|
| `ERROR Text strings must be rendered within a <Text> component.` | `createTextInstance` u `ReactFabric-dev.js` baca kad `hostContext.isInAParentText` nije postavljen — dakle goli string je dijete `View`-a. Locirano brace-aware AST skeniranjem `src/` (babel parser, ne regex): `Badge` (`src/components/ui/controls.tsx`) je u `<Text>` omotavao sadržaj **samo kad je `children` primitiv**, a `#{program.orderIndex + 1}` je niz od tri čvora (string, broj, ništa) | `isPlainContent()` u `Badge`-u propušta kroz `<Text>` i nizove primitiva; poziv u `ScheduleManagementScreen` je uz to eksplicitan (`{\`#${…}\`}`), da se ista klasa greške ne vrati kroz isti poziv |
| `WARN [Reanimated] Dependencies should only be used on the web…` | `react-native-reanimated` 4.7.1, `hook/*.native.js`: `logger.warnOnce` kad se proslijedi `deps`. Naš `src/` nema nijedan `useAnimatedStyle`/`useDerivedValue`/`useAnimatedReaction` (`grep` = 0) → pozivalac je `@gorhom/bottom-sheet` | Provjereno i na **5.2.14** (`npm pack` + `grep`): `useAnimatedReaction(..., [_providedAnimatedPosition, topInset])` je i dalje tu, pa upgrade **ne** rješava upozorenje i nije urađen. Tekst je dodan u postojeći `IGNORED_WARNINGS` filter, uz komentar koji imenuje biblioteku i kaže da je upozorenje tačno |
| Jezik se ne mijenja u Postavkama | `i18n.init` je imao `lng` + `fallbackLng` bez `supportedLngs`, pa su `bs`, `en`, `en-GB` prolazili kao podržani i tiho padali na engleski; uz to je `handleLanguageChange` prvo pisao u storage, pa mijenjao jezik, bez ijedne povratne informacije | `supportedLngs: ['en-US','bs-BS']`, `load: 'currentOnly'`, `returnEmptyString: false`; redoslijed obrnut (prvo UI, pa perzistencija), a neuspjelo spremanje se prijavi toastom `settings.languageChangeFailed` |
| Trenutno vrijeme mora biti **ispod** statusa kotla | Vrijeme je stajalo na dnu Početne, ispod preporuke i liste termostata | Blok premješten direktno poslije `boiler.status`; `RecommendationBreakdown` (objašnjenje preporuke) sada je ispod liste termostata. Čuva ga test redoslijeda u stabilu (`dashboard-hero` prije `weather-row`), ne snimka |

**WCAG 2.2 AA (cijeli mobilni UI).** Prvi i najvažniji korak je paleta, jer se
kroz nju provlači svaki ekran. Izmjereno na sve tri podloge (`panel`, `canvas`,
`raised`):

| Token | Prije | Odnos | Sada | Odnos |
|---|---|---|---|---|
| dark `inkDim` | `#6b7788` | 4,22 / 4,43 / 3,95 ✗ | `#828d9e` | 5,71 / 6,00 / 5,34 |
| light `signal` | `#e85223` | 3,71 / 3,46 / 3,34 ✗ | `#c2410c` | 5,18 / 4,84 / 4,66 |
| light `ok` | `#16a34a` | 3,30 / 3,08 / 2,97 ✗ | `#15803d` | 5,02 / 4,69 / 4,51 |
| light `fault` | `#dc2626` | 4,83 / 4,51 / 4,35 ✗ | `#b91c1c` | 6,47 / 6,04 / 5,82 |
| light `info` | `#0284c7` | 4,10 / 3,83 / 3,69 ✗ | `#0369a1` | 5,93 / 5,54 / 5,34 |
| light `inkDim` | `#6b7280` | 4,83 / 4,52 / 4,35 ✗ | `#59616e` | 6,25 / 5,84 / 5,63 |

`ink` i `inkMuted` su već bili AAA (≥ 7:1) i nisu dirani; `dark.signal` ostaje
web brand `#ff6b3d` (6,78:1). Kontrast se više ne mjeri ručno — čuva ga
`src/ui/__tests__/a11yContrast.test.ts` (24 testa: svaki tekstualni token ×
svaka podloga ≥ 4,5:1, `onSignal` na boji ≥ 4,5:1, `ink` ≥ 7:1, `MIN_TOUCH` ≥
44 pt po SC 2.5.8, razmaci djeljivi sa 4).

**Tipografija i spacing.** Novi `src/utils/format.ts` je jedina tačka za brojeve
i datume: `formatNumber`/`formatInteger`/`formatDate`/`formatShortDate`/
`formatTime`/`formatDateRange`, svi kroz `Intl` po jeziku iz i18n-a. Prije je
`toFixed(2)` svuda davao tačku i bez razdvajača hiljada, a datumi su u **istom
ekranu** bili i `dayjs.format('DD.MM.YYYY')` i `toLocaleDateString('en-US', …)`.

**Plin — detaljan prolaz (GAS-01…GAS-11).**

| ID | Nalaz | Popravka |
|---|---|---|
| GAS-01 | Isti period ispisan dvaput („Analysis Window" na vrhu i „Analysis Period" na dnu) | jedan `AnalysisPeriodRow` u sažetku |
| GAS-02 | `toFixed` + hardkodiran `en-US` datum | `utils/format.ts`, test `src/utils/__tests__/format.test.ts` (9 testova) |
| GAS-03 | Četiri obojene kutije, 13 `useColorModeValue` poziva, boje van palete | `Panel`/`InlineBanner`/`Led` iz `src/ui` |
| GAS-04 | Tri metrike u `HStack` bez `flex` — treća kolona se lomila na 360 dp | `Kpi` pločice i `flush` panel sa redovima |
| GAS-05 | Rast potrošnje obojen **zeleno** (`bg="green.500"`) — najgorši scenario izgledao kao dobra vijest | `Led state={warn}` za rast, `ok` za pad, `off` za stabilno |
| GAS-06 | „min/avg/max" bez definicije uzorka | podnaslovi `analysisDailyStatsHint` / `analysisEfficiencyHint` / `analysisCostHint` |
| GAS-07 | `px={5} py={5}` ručno, drugi ritam od Očitanja | `ScreenBody` (16 px, isti svuda) |
| GAS-08 | Mrežna greška padala na „nema podataka" → savjet „dodaj dva očitanja" iako očitanja postoje | `InlineBanner tone="fault"` sa „Pokušaj" (`gas.analysisLoadError*`) |
| GAS-09 | Filter chipovi visoki ~27 px (ispod SC 2.5.8 i `MIN_TOUCH`) | `minHeight: MIN_TOUCH` + `HIT_SLOP` |
| GAS-10 | Prazno stanje samo tekst, bez ijedne akcije | `EmptyState` sa „Dodaj očitanje", a kad filter sakrije sve — „Sve" |
| GAS-11 | Podrazumijevani filter „zadnja sedmica" skriva sva očitanja korisniku koji brojilo mjeri mjesečno | default je `all`; test u `f6Gas.test.tsx` |

Ukinuto je i **36 mrtvih** `|| 'English fallback'` izraza u
`GasReadingsScreen` — svi ključevi postoje u oba jezika, pa je fallback bio
kod koji nikad ne radi, a sakriva pravi nedostatak prijevoda.


**Postavke — detaljan prolaz (SET-02…SET-13).** Prošao sam kroz glavni ekran
Postavki i kroz svih šest ekrana koje otvara (Profil, Upravljanje domovima,
Rasporedi, Obavijesti, Postavke obavijesti, te sheete za jezik, lozinku i
odjavu).

| ID | Nalaz | Popravka |
|---|---|---|
| SET-02 | `SettingRow` je bila komponenta **definirana unutar** `SettingsScreenContent` — svaki render je stvarao novi tip, pa je React remountovao cijelu listu; prekidači su gubili stanje, animacija je kretala iz početka | `SettingRow` je sada na nivou modula, sa `SettingRowProps` |
| SET-03 | Dodirna zona je bila `minHeight: 44` na unutrašnjem `View`-u, dok je `PanelRow` imao svoj padding — stvarna zona je zavisila od sadržaja | cijeli red nosi `minHeight: MIN_TOUCH` |
| SET-04 | Boje su bile hardkodirane (`#8a93a3`, `#6b7788`) — nisu pratile temu ni AA paletu iz F6c | `useTokens()` |
| SET-05 | Redovi „Pomoć i podrška" i „Uslovi i privatnost" bili su **inertni** (bez `onPress`), a izgledali su kao navigacija (ikona + chevron). U repou ne postoji nijedna takva stranica, ni na webu | redovi **uklonjeni** umjesto linkovanja na izmišljeni URL; vraćaju se kad stranice postoje, kao `Linking.openURL` sa obrađenom greškom |
| SET-06 | Odjava je bila jedan dodir, bez potvrde | `Sheet` sa potvrdom (`settings.logoutTitle`/`logoutBody`), isti obrazac kao sve destruktivne radnje (bez sistemskog `Alert`-a) |
| SET-07 | Tokom izvoza red je gubio `onPress` — izgledao je kao običan red bez chevrona, pa korisnik nije znao da je dodir namjerno blokiran | eksplicitan `isDisabled` (0,5 opacity + `accessibilityState`) uz postojeći podnaslov „Pripremam izvoz…" |
| SET-08 | `NotificationPreferencesScreen`: 12 `useColorModeValue` poziva i šest nijansi van palete | `Panel`, `InlineBanner`, `MonoLabel` |
| SET-09 | Prekidači u Postavkama obavijesti **nisu imali `accessibilityLabel`** — šest identičnih prekidača, čitač ekrana izgovara samo „uključeno/isključeno" | labela je naziv tipa obavijesti + `testID` po tipu |
| SET-10 | Greška učitavanja i greška `PATCH`-a bile su nevidljive: prekidač se vrati na staro stanje i korisnik ne zna je li dodir promašio | `InlineBanner tone="fault"` sa „Pokušaj" + toast na `onError` |
| SET-11 | Datum „zadnje promjene" hardkodiran (`DD.MM.YYYY HH:mm`) | `utils/format` |
| SET-12 | Profil: `toFixed(4)` za cijenu i `toLocaleDateString()` **bez argumenta** (jezik sistema, ne aplikacije) | `formatNumber(x, 4)` / `formatDate()` |
| SET-13 | Obavijesti: `dayjs(...).format('HH:mm')` | `formatTime()` |

Stavke iz listinga koje nisu bile greške, ali su provjerene: `languageLabel` i
`handleLanguageChange` (popravljeni u F6a), `handleDailyGasReminderToggle`
(optimistično stanje + rollback), `handleClearCache` i `handleExportData`
(stvarni pozivi sa obradom svih ishoda), `version` (stvarna vrijednost iz
`expo-application`, sa fallbackom). Nijedna od njih nije dirana.

Provjera: `npx jest` 38 suite-ova, **281 test**, 32 snapshot-a zeleno;
`npx tsc --noEmit` 0; `npx eslint src` 0 grešaka; `CI=1 npx expo export
--platform android --dev` prolazi.


**Tipografija i spacing (TYPO-01, A11Y-14).** Skala je imala `label: 9` i
`meta: 10` px. `MonoLabel`/`MonoMeta` su najčešći elementi u aplikaciji (svaki
panel, svaki KPI, svaki red liste), pa su mikro-labele bile najveći pojedinačni
problem čitljivosti — a WCAG 2.2 1.4.4 (Resize text) na 9 px praktično nije
zadovoljen.

| Token | Prije | Sada |
|---|---|---|
| `label` | 9 | 11 |
| `meta` | 10 | 12 |
| `body` | 12 | 13 |
| `bodyLg` | 13 | 15 |
| `section` | 14 | 16 |
| `title` | 21 | 22 |
| `readoutLg` | 26 | 28 |
| `readoutXl` | 40 | 40 |

Odnosi su ostali isti (skala nije linearna), pa se hijerarhija ne mijenja —
samo je osnova podignuta. Uveden je `lineHeightFor()` (1,35 × veličina) i
`Text` ga sada primjenjuje uvijek: bez eksplicitne visine reda tekst pri 200%
uvećanja se preklapa u uskim kolonama. Ručni `fontSize: 9` u `Screen.tsx`,
`InlineBanner.tsx` i `AsyncState.tsx` zamijenjen je tokenima, da sljedeća
izmjena skale ne zaobiđe te fajlove. `typography.test.ts` (5 testova) drži
minimalnu veličinu 11 px, strogo rastuću skalu, odnos visine reda ≥ 1,3 i
razmake 4/8/12/16/24/32.


**WCAG 2.2 AA — ostatak audita (A11Y-15, A11Y-16).** Uz paletu (F6c) i
tipografiju (F6f) provjereno je ostalo iz listinga:

| Kri­terij (WCAG 2.2) | Stanje prije | Sada |
|---|---|---|
| 2.3.3 Animation from Interactions / 2.2.2 | Splash (`AnimatedSplash`, jedina animacija u aplikaciji: 650 + 350 + 300 ms) puštao se bez obzira na sistemsku postavku | `AccessibilityInfo.isReduceMotionEnabled()` + `reduceMotionChanged` listener; kad je uključeno, splash se prikaže statično i odmah preda dalje (`f6A11y.test.tsx`, 2 testa) |
| 1.3.1 Info and Relationships | Naslovi sekcija u Obavijestima („Danas", „Jučer", „Ranije") bili su samo podebljani tekst | `accessibilityRole="header"` |
| 4.1.2 Name, Role, Value | Postavke obavijesti: prekidači bez labele (SET-09) | labela = naziv tipa |
| 2.5.8 Target Size (Minimum) | Filter chipovi na Plinu ~27 px (GAS-09) | `minHeight: MIN_TOUCH` |
| 1.4.3 Contrast (Minimum) | šest tokena ispod 4,5:1 (F6c) | svi ≥ 4,5:1, primarni tekst ≥ 7:1 |
| 1.4.4 Resize Text | mikro-labele 9/10 px (F6f) | minimum 11 px, visina reda iz skale |

Provjereno i **u redu**: touch targeti definirani u `src/ui` (>= 44 pt), role na
svim `Pressable` elementima iz `src/ui` (default `button`), `accessibilityState`
na prekidačima i tabovima, `accessibilityLiveRegion="polite"` na toastovima,
`hitSlop` na svim malim ikonama, kontrast svih tokena u obje teme.

**Verifikacija (2026-11-08):**

```
npx tsc --noEmit                        → 0 grešaka
npx jest                                → 40 suite-ova, 288 testova, 32 snapshot-a — zeleno
npx eslint src App.tsx index.js         → 0 grešaka (49 postojećih warninga)
CI=1 npx expo export --platform android → bundle se gradi
```

Snimke: `npx jest -u` je ažurirao 22 snimke. Razlika je posljedica (a) novih
vrijednosti tokena i (b) prelaska Gas ekrana na `src/ui` primitive — nijedna
asertacija u postojećim testovima nije ublažena; jedina izmijenjena asertacija
(`tokens.test.ts`, `lightTokens.signal`) prati novu, izmjerenu boju uz
obrazloženje u komentaru.

### F7 — ono što se na uređaju nije otvaralo, i Gas kao glavni ekran

Korisnik je poslije F6 prijavio dvije klase problema: (a) dodiri koji ne rade
ništa („Set current temp", „+ " na Plinu, promjena jezika), i (b) ekrane koji
se ne čitaju (Gas, alerti, „Recommendation reason" na dark temi). F7 je zato
krenula od **uzroka**, ne od simptoma.

**Korijen tri „mrtva" dodira — `src/ui/Sheet.tsx` (SHEET-01).** `BottomSheet` je
bio dijete ekrana (unutar `ScreenStack` kartice), ne korijen, a otvaranje je
zavisilo isključivo od imperativnog `snapToIndex(0)` uz fiksni `index={-1}`.
`handleSnapToIndex` u gorhomu ima rani `return` dok `isLayoutCalculated` nije
izračunat, pa je list tiho ostajao na `-1`: state se mijenjao, sheet se nije
prikazivao. Popravka: RN `Modal` kao host (`transparent`, `animationType="none"`,
`statusBarTranslucent`, `onRequestClose`) + **deklarativni** `index={isOpen ? 0 : -1}`.
Isti popravak rješava i promjenu jezika, jer se do `changeLanguage` nije dolazilo
— lista jezika se nije otvarala.

| Nalaz | Prije | Sada | Dokaz |
|---|---|---|---|
| SHEET-01 | sheet se ne prikazuje (set temp, dodaj očitanje, jezik) | `Modal` + deklarativni `index` | `gasOpenSheets.test.tsx` (2), `primitives.test.tsx` 25/25 |
| SET-LANG | F6a je tvrdila da radi; lista se nije otvarala | stvarna reprodukcija: otvori → izaberi → UI preveden → `app.language` sačuvan | `settings/__tests__/language.test.tsx` (2) |
| HOME-05 | hero je isticao klijentsku vrijednost, 11 `dashboard.*` ključeva nije postojalo | istaknut `targetFlow` (`xl`, `signal`), polaz sekundaran, svi pozivi na `boiler.*` | `keys.test.ts` (3), dashboard snapshot |
| I18N-KEYS | sirovi ključevi na Početnoj (`dashboard.outdoor`…) | source-contract test: svaki `t('…')` postoji u **oba** jezika, paritet 777/777 | `keys.test.ts` |
| HOME-03 | nije postojala kartica potrošnje | `GasConsumptionCard`: ukupno m³ + cijena, riješena i nula (nema očitanja ⇒ nema tvrdnje „0") | `components/__tests__/GasConsumptionCard.test.tsx` (2) |
| HOME-04 | alerti su bili soft ploče (`red.100`/`orange.100`) sa 9 parova boja | `Panel`/`PanelRow` + `Led` + semantički `fault`/`warn`/`info`, tekst nosi značenje | `AlertsCard.tsx` |
| HOME-05b | „Recommendation reason" crni font na dark temi | `Panel`/`PanelRow`/`Readout`, jedinica u istom tekstualnom čvoru (`51,1 °C`) | `RecommendationBreakdown.test.tsx` (4) |
| GAS-TABS | traka se nije prepoznavala kao tab meni; segment 36 px | `raised` traka, segment 44 px, aktivni: podloga + 2 px `signal` + semibold | snapshot +
`Segmented.tsx` |
| GAS-FILTER | pet pilula, izgledale kao drugi red tabova, ~150 px visine | `FilterMenuTrigger` (jedan red, „Period: Sve ⌄") + `Sheet` sa radio listom 48 px | `ui/__tests__/filterMenu.test.tsx` (2), `gasOpenSheets.test.tsx` |
| GAS-LIST | redovi zalepljeni za ivicu, `borderBottom` bez boje (crna linija u obje teme) | kartica sa `marginHorizontal: space.lg`, radijus 4, hairline `line` | `GasReadingCard.tsx` |
| GAS-ACTIONS | akcije u sheetu 16 px ikona / 13 px tekst | red 44 px, ikona 20 px, tekst `bodyLg` | `GasReadingCard.tsx` |
| HEAT-01 | status grijanja bez okvira, tri signala u jednoj liniji | `StatusPill` (tekst + ivica), temperatura u svom redu | heating snapshot |
| SHEET-02 | `Modal` bi sklonio list u istom frejmu kad `isOpen` padne — nema animacije zatvaranja | `visible={isOpen \|\| mounted}`; `mounted` pada na `onChange(-1)` ili poslije 400 ms | `primitives.test.tsx` (26) |

**Test-infrastruktura (TEST-FONT).** `Readout` ide kroz `useTokens` →
`useAppFonts` → `expo-font`, a `require('*.ttf')` u Jest-u nije asset nego broj
(„Module 1 is missing from the asset registry"). `jest.setup.js` sada mocka
`expo-font` sa `useFonts: () => [false, null]` — to je **isto** stanje koje je
mock prije davao (fontovi nisu učitani ⇒ sistemski fallback), pa 22 snapshota
ostaju nepromijenjena, a testovi koji renderuju primitives više ne padaju.

**Verifikacija (2026-11-07):**

```
npx tsc --noEmit                        → 0 grešaka
npx jest                                → 45 suite-ova, 300 testova, 32 snapshota — zeleno
npx eslint src                          → 0 grešaka (38 postojećih warninga)
CI=1 npx expo export --platform android --dev → bundle se gradi
```

`npx jest -u` je ažurirao 6 snimki: 3 ekrana (Početna: novi hero red + nova
kartica potrošnje; Plin: meni umjesto pilula + kartice redova; Grijanje: status
pilula) i 3 ekrana koja dijele `Segmented` (Analitika, Postavke, Obavijesti —
novi `raised` izgled trake). Nijedna asertacija nije ublažena; dvije su
**prevedene na novi tok** (period se sada bira iz menija, `f6Gas.test.tsx` i
`gasNativeWind.test.tsx`), uz komentar na mjestu izmjene.

### F8 — Sheet bez gorhom-a, i Početna po korisnikovom rasporedu

Korisnik poslije F7: „i dalje — set current temp, + na Plin, promjena jezika ne
otvaraju ništa (čak mi se čini da aplikacija zabaguje)". F7 je popravila
deklarativni `index`, ali primitiv je i dalje zavisio od tri native sloja.
F8 zato **uklanja** tu zavisnost.

**SHEET-03 — `Sheet` je sada RN `Modal` + ugrađeni `Animated`.** Nema
`@gorhom/bottom-sheet`, nema Reanimated workleta, nema gesture-handler pan
obrade, nema mjerenja layouta. List klizi odozdo (`translateY` + fade) preko
`Animated.Value`, `onRequestClose` pokriva Android back, backdrop je
`Animated.View` + puni `Pressable` koji zatvara. Zatvaranje se animira
(`mounted` se sklanja tek kad animacija javi `finished`). Time nestaju oba
načina da se pojavi prijavljeni simptom: tiho odustajanje snap-a i zarobljeni
dodiri nad ekranom.

**BUG-CRASH — greška više ne ruši ekran.** `showError` je za 401 bez
`customMessage` predavao `description: undefined` toastu, a NativeWind je tada
padao iznad ekrana — korisnik to vidi kao „zabaguje". Poruka sada nikad nije
prazna (pada na prevedeni status), a cijeli poziv je u `try/catch`.

| Nalaz | Prije | Sada | Dokaz |
|---|---|---|---|
| SHEET-03 | sheet zavisi od gorhom + Reanimated + gesture-handler; tiho se ne otvori ili zarobi dodire | RN `Modal` + `Animated`, bez tih zavisnosti | `primitives.test.tsx` (27, uključujući otvaranje iz state-a i zatvaranje na backdrop) |
| BUG-CRASH | 401 bez poruke ⇒ toast sa `undefined` ⇒ pad ekrana | poruka nikad prazna + `try/catch` | `error.handler.test.ts` (19) |
| GAS-TABS-2 | traka 44 px, tekst 11 px — „treba malo veći format" | 52 px, tekst 13 px semibold, aktivna opcija sa svjetlijom podlogom | gas snapshot |
| GAS-LIST-2 | očitanja uz samu ivicu ekrana | kartica sa `marginHorizontal: space.lg` i 10 px razmaka između | gas snapshot |
| HOME-04 | alerti kao zaseban blok između KPI pločica i termostata | unutar sekcije „Status kotla", ispod hero ploče | dashboard snapshot |
| HOME-05 | stanje vremena sa backenda („Cloudy") stajalo engleski u bs UI | mapa poznatih stanja → `weather.condition*`; nepoznato se prikazuje kako je stiglo | `weatherCondition.test.tsx` (3) |
| HOME-05b | — | „osjećaj" uz trenutnu temperaturu u kartici vremena | `weatherCondition.test.tsx` |
| HOME-06 | treća KPI pločica bila „Vani" (duplikat vremena) | trenutna temperatura termostata + ime uređaja | `f2Screens.test.tsx`, dashboard snapshot |
| HOME-07 | „Mode: FULL · interval: …" u zasebnom bloku na dnu | u redu termostata, uz traku | `dashboardNativeWind.test.tsx` |

**Redoslijed Početne (korisnikov zahtjev, F8):**
1. Status kotla (unutar njega aktivni alerti)
2. Trenutno vrijeme (sa „osjećajem", prevedeno stanje)
3. Tri pločice: termostat sada · zdravlje · termostati
4. Termostati (sa mode/interval kontekstom)
5. Očitanja plina
6. Razlog preporuke

**Verifikacija (2026-11-07):**

```
npx tsc --noEmit                              → 0 grešaka
npx jest                                      → 46 suite-ova, 306 testova, 32 snapshota — zeleno
npx eslint src                                → 0 grešaka (38 warninga)
CI=1 npx expo export --platform android --dev → bundle se gradi
```


### F9 — Plin, cijeli ekran iznova (samo taj ekran)

Korisnik: „Sada je sve u redu osim ekrana GAS (Plin). Posveti se samo tom ekranu
i refaktoriši ga da sve funkcioniše kako treba." Plin je bio jedini ekran koji je
još miješao **dva UI sloja**: `src/ui` primitive i stari NativeWind sloj
(`FormControl`, `Switch`, `Spinner`, `Actionsheet`, `useColorModeValue`,
`brand.*` boje). Zato je izgledao i ponašao se drugačije od ostatka aplikacije.

**Zajednički uzrok većine prijava** nije bio izgled: stari sloj je imao drugu
semantiku stanja. `Actionsheet.Item` nije primao `disabled`, `Switch` je mijenjao
`brand` boju koja ne postoji u tokenima, a `FormInput` je vraćao tekst koji je
parser čitao samo sa tačkom.

| Nalaz | Prije | Sada | Dokaz |
|---|---|---|---|
| GAS-12 unos | „1234,56" (bosanski zarez) padao kao neispravan broj | `parseFloat(value.replace(',', '.'))` + `inputMode="decimal"`, `GasNumberField` (24 px mono) | `gasRefactor.test.tsx` |
| GAS-13 duplikat | provjera je čekala mrežni krug, pa se poruka gubila u toastu | provjera PRIJE mreže, poruka u `InlineBanner` iznad polja | `gasRefactor.test.tsx` |
| GAS-14 forma | stari sloj: `FormControl`/`Switch`/`brand.*`, dvije labelе za datum | `Panel`/`PanelRow`/`Button`: datum i vrijeme su jedno pitanje („Sada" / „Izaberi") | `GasForm.tsx` |
| GAS-15 akcije | `Actionsheet` bez animacije, bez `disabled`, 20 px redovi | `Sheet` + redovi 52 px sa razdjelnikom, strelicom i `disabled` stanjem | `gasRefactor.test.tsx` |
| GAS-16 raspon | „Sačuvaj" nije primjenjivao raspon, a filter je već bio aktivan | „Sačuvaj" primjenjuje raspon i onemogućen je dok raspon nije potpun; „Očisti" vraća na „Sve" | `GasReadingsScreen.tsx` |
| GAS-17 sažetak | tri kolone istog ranga, nije se vidjelo koji broj je glavni | potrošnja kao `Readout` lg u signalnoj boji, broj i datum kao meta; upozorenje kad je samo jedno očitanje | `gasRefactor.test.tsx` |
| GAS-18 toastovi | četiri ručno sastavljene zelene kutije | `toast.show({ description })` — ista gramatika kao Početna | `GasReadingsScreen.tsx` |
| SHEET-04 | `setMounted` iz callbacka animacije ⇒ `act(...)` upozorenja i nedeterminističko stanje | sklanjanje preko `setTimeout` iste dužine, briše se pri svakoj promjeni | `primitives.test.tsx` |

Tokovi koji su sada pokriveni testovima: otvaranje forme preko „+" u zaglavlju,
unos sa zarezom, odbijanje duplikata, akcije očitanja u sheetu, promjena perioda
kroz meni i prikaz potrošnje u periodu.

**Verifikacija (2026-11-07):** `tsc` 0 · `jest` 47 suite-ova / 310 testova / 32
snapshota · `eslint src` 0 grešaka (45 warninga) · `expo export --platform
android --dev` prolazi.


### F9 — drugi krug: šta su korisnikove snimke stvarno pokazale

Korisnik je poslao tri snimke (lista očitanja, sheet „Dodaj očitanje", sheet „Akcije
očitanja") i rekao „pa ti vidi je li to uredu". Defekti su izgledali kao tri
nepovezana problema na Plinu; zapravo su bila **dva kvara u primitivima** i jedan
u i18n resursima. Zato je popravka otišla u `src/ui`, a ne u ekran.

**1. `Pressable` je gubio stil na uređaju (PRESS-01) — glavni uzrok.**
`style` se predavao kao funkcija (`({ pressed }) => [...]`) da bi se dobilo stanje
pritiska. NativeWind 4 preslikava `style` kroz `cssInterop`, a funkcijski stil se
ne može izračunati pri preslikavanju, pa je na Androidu propadao **cijeli** stil:
`flexDirection: 'row'`, `minHeight`, `backgroundColor`, `borderWidth`, `padding`,
`marginHorizontal`. Posljedice vidljive na snimkama:

| Snimka | Simptom | Objašnjenje |
|---|---|---|
| Dodaj očitanje | „Izaberi sliku"/„Uslikaj" kao goli tekst, bez okvira i visine | `Button` je `Pressable` → nestali `minHeight`, `borderWidth`, `backgroundColor` |
| Dodaj očitanje | nema dugmeta „Dodaj očitanje" | isto, dugme je bilo tu ali bez pozadine i bez visine (nije se videlo) |
| Akcije očitanja | ikona, pa tekst, pa `›` — svaki u svom redu | nestao `flexDirection: 'row'` na roditelju, `chevron` je pao u novi red |
| Lista očitanja | broj i chipovi odsječeni lijevo, kartica izlazi iz ekrana | nestali `marginHorizontal`/`padding`/`borderRadius` + nema `minWidth: 0` na lijevoj koloni |

Popravka: `cssInterop={false}` na RN `Pressable` (zvanični izlaz iz NativeWind-a
za element koji ne koristi `className`) i zadržan funkcijski stil radi `pressed`
stanja. Ekran Plina nije dobio nijedan „layout hack". Uz to: širinu u redovima
sada nosi `View` sa `flex: 1`/`minWidth: 0`, a dugme je `block` — dakle raspored
ne zavisi od toga kako se `style` preslikava.

**2. Traka Očitanja | Analiza (GAS-TABS-3).** Na snimci se čitalo
„OČITANJAANALIZA" bez razmaka. Uzrok nije bio razmak između segmenata, nego
`flex: 1` bez `flexBasis: 0` (širina se dijelila po sadržaju riječi) uz
`letterSpacing: 0.8` na 13 px mono velikim slovima. Sada: `flexBasis: 0`,
`letterSpacing: 0.4`, aktivni segment `panel` + podvlaka 3 px + semibold,
neaktivni `inkMuted`, hairline razdjelnik između segmenata. Tri nezavisna
signala stanja (podloga, linija, težina) → vidljivo i bez boje.

**3. `gas.readingCount` kao sirovi ključ (I18N-PLURAL).** i18next u runtime-u
bez plural pravila za dati broj traži **bazni** ključ; postojali su samo
`_one`/`_few`/`_other`, pa je vraćen sam ključ. Dodat bazni `readingCount` u oba
jezika kao sigurnosna mreža (i18next uvijek pada na bazni ključ). i18n test to
nije hvatao jer je provjeravao samo sufiksirane oblike — sada to pokriva
`gasDeviceLayout.test.tsx`.

**4. Forma i sheet.**
- Primarna akcija „Dodaj očitanje" je sada puna širina, 52 px, iznad „Otkaži"
  (prije je bila u tijesnom redu pored „Otkaži" i gubila se).
- „Izaberi sliku"/„Uslikaj" i par datum/vrijeme: širina na `View`, dugme `block`.
- `snapPoints` za dodavanje: `['62%', '88%']` umjesto `['85%']` — prije je ispod
  kratke forme ostajalo ~40% prazne površine, a sada sheet kreće nisko i može se
  povući kad je tastatura otvorena.

**5. Kartice očitanja (GAS-ROW).** Lijeva kolona dobila `minWidth: 0` (bez toga
`flex: 1` u redu sa `space-between` ne dopušta djetetu da se skupi ispod svoje
intrinsic širine i sadržaj izlazi van kartice), desna `flexShrink: 0`, cijena
prebačena na `size="meta"` sa `numberOfLines={1}`.

**Nalaz za ostatak aplikacije.** Budući da je kvar bio u `src/ui/Pressable`, isti
simptom su imali svi ekrani koji koriste taj primitiv. Popravka je centralna, pa
su 18 snapshotova ažurirani (`jest -u`) — to nije novo ponašanje, to je prvi put
ispravno prenesen stil.

**Testovi.** `src/screens/gas/__tests__/gasDeviceLayout.test.tsx` (4 testa) tvrdi
uzroke, ne piksele: `style` na `Pressable` nije funkcija i `flatten` vidi
`minHeight`/`flexDirection`/`borderWidth`; `Button` ima okvir, visinu ≥ 44 i
netransparentnu podlogu; segment ima `flexBasis: 0`; `gas.readingCount` nikad ne
vraća ključ i bazni ključ postoji u resursima.

### F10 — Moji domovi, forma doma, Raspored grijanja, Analitika, tranzicija Plina

Korisnik je poslije F9 tražio pet stvari: (1) „Moji domovi", izmjenu doma i
„Raspored grijanja" prilagoditi temi; (2) naziv uređaja **obavezno velikim
slovima**; (3) tranzicija Očitanja ↔ Analiza nije fluidna; (4) karticu
„Potrošnja plina" na Analitici podesiti temi. Sve četiri su bile isti korijen:
ti ekrani nikad nisu prešli na `src/ui` sloj.

**1. Nova tri primitiva (`src/ui/Field.tsx`).** Forma doma nije imala čime da
se sastavi bez starog sloja, pa su dodati `Field` (tekstualno polje, 52 px,
`raised` podloga, hairline ivica), `FieldGroup` (labela + obavezno + greška) i
`Toggle` (52 px red sa `role="switch"`). Uz njih `SliderField` — klizač sa
vidljivom vrijednošću, min/maks oznakama i `accessibilityRole="adjustable"`.
Nijedna hex vrijednost nije u ekranu; sve dolazi iz `useTokens()`.

**2. `HomeManagementScreen` prepisan (23 KB → jedna forma).** Prije: dva gotovo
identična `Modal`-a („Dodaj" i „Uredi") sa po ~330 linija JSX-a, razlika dva
polja — i zato je polje „Lokacija" nedostajalo u formi za izmjenu, iako ga
backend prima. Sada je jedna `Sheet` forma za oba režima. Uz to:
- greška validacije je `InlineBanner` **u formi** (`home-form-error`), ne toast
  koji nestane za 3 s i nije vezan za polje;
- `NumberField` čuva lokalni tekst, pa kucanje „2," ne briše zarez (isti kvar
  kao GAS-02 na Plinu);
- `ChoiceField`: do 3 opcije `Segmented`, više od 3 `Sheet` sa radio listom —
  umjesto `Select`-a koji je na 360 px bio siva kutija bez oznake;
- akcije („Uredi", „Obriši") su u svom redu ispod hairline-a. Prije su visjele
  uz desnu ivicu kartice, 10 px od glavnog dodira koji **mijenja aktivan dom** —
  dva suprotna ishoda jedan uz drugi;
- prazno stanje ima akciju („Dodaj dom"), a „Dodaj" je i u zaglavlju.

**3. `ScheduleManagementScreen` prepisan.** `gray.50`/`dark.900` podloga,
`blue.50` info kutija, `green.50` „aktivno" kutija i `orange.400` ivica su
zamijenjeni `Panel`/`PanelRow`, `InlineBanner`-om i `Readout`-om. Izbor
termostata je red koji otvara `Sheet` (prije `Select` koji nije imao mjesta za
„Boiler Living Room (Tuya)"). Logika (`getCurrentActiveInterval`,
`getNextScheduledChange`, grupisanje po danu) je **nepromijenjena**.

**4. Naziv uređaja velikim slovima (`src/ui/DeviceName.tsx`).** Traženo je
„obavezno", pa je pravilo jedno, na jednom mjestu, i primijenjeno na Početnoj,
Grijanju, Analitici, Rasporedu i karticama domova. Koristi se
`textTransform: 'uppercase'`, **ne** `toUpperCase()`: podatak ostaje netaknut,
čitač ekrana izgovara „Boiler Living Room" (a ne slovkanje), pretraga radi bez
obzira na veličinu slova, a kopiranje daje ono što piše u bazi. `numberOfLines`
+ `flexShrink` sprječavaju da dug naziv razbije red.

**5. `GasAnalyticsCard` („Potrošnja plina" na Analitici).** Bila je jedina
kartica na tom ekranu sa starim slojem: `shadow={2}`, `rounded="xl"`,
`orange.500` ikona i četiri sive pločice (`gray.50`/`dark.700`). Sada `Panel`
bez sjene, `Kpi` za četiri brojke, `PanelRow` sa hairline-om za listu i
`formatNumber` (decimalni zarez u bs-BS). Računanje potrošnje nepromijenjeno.

**6. Tranzicija Očitanja ↔ Analiza (`GasScreen`).** Prije se cijelo stablo
**zamjenjivalo** u istom frame-u (`view === 'readings' ? <A/> : <B/>`). Dvije
posljedice, obje vidljive kao skok: (a) `GasAnalysisScreen` u tom frame-u
učitava svoje upite, pa se prvo vidi skeleton pa sadržaj — dva skoka; (b)
`Segmented` je bio dio `headerSlot`-a svakog ekrana, pa se pri zamjeni
demontirao i montirao iznova (treptanje, gubitak fokusa, kratka promjena
visine na Androidu).

Sada su **oba panela stalno u stablu**, a `display: 'none'` bira vidljivi — pa
upiti počinju pri prvom otvaranju ekrana, ne pri prelasku. Panel koji ulazi
animira se 180 ms (`opacity` 0→1 i 8 px pomak u smjeru kretanja,
`useNativeDriver`); panel koji izlazi je već skriven, pa ne učestvuje u layout-u.
Poštuje se `AccessibilityInfo.isReduceMotionEnabled` (bez pomaka, trenutna
zamjena). Skriveni panel je `accessibilityElementsHidden` +
`importantForAccessibility="no-hide-descendants"`, a traku dobija **samo
vidljivi** panel — da je dobiju oba, u stablu bi bila dva elementa sa istim
`testID`-om i istom a11y labelom.

**Testovi.** `src/screens/__tests__/f10Theme.test.tsx` (11 testova): naziv
velikim slovima u oba režima i nepromijenjen podatak; `Field` uzima **tačno**
`raised` iz `tokensFor(mode)` i različit je u light/dark; `Toggle` je
`role="switch"` sa 52 px; `SliderField` reaguje na akciju čitača ekrana;
Raspored ne sadrži nijednu paletu starog sloja (`#e2e8f0`, `gray.50`,
`dark.900`, `blue.50`, `brand.500`, `orange.400`); oba Plin panela su u stablu
prije dodira i prelazak ne montira ekran iznova.

Prilagođeni testovi (uz komentar na mjestu izmjene, bez slabljenja tvrdnji):
`homeManagementNativeWind` (novi `testID`-ovi kontrola + novi test da greška
ostaje u formi), `scheduleNativeWind` (sheet umjesto select-a + test za
`textTransform`).

### F11 — pad produkcijskog Android builda (AAR metadata)

Korisnikov `eas build --profile production --platform android --local` pao je
poslije 9 m 35 s, i to ne na našem kodu:

```
:react-native-screens:checkReleaseAarMetadata
androidx.core:core:1.17.0 requires libraries and applications that depend on it
to compile against version 36 or later of the Android APIs.
:react-native-screens is currently compiled against android-35.
```

**Uzrok:** `app.config.js` je kroz `expo-build-properties` pinovao
`compileSdkVersion: 35` i `targetSdkVersion: 35`. Komentar na tom mjestu je
govorio „Expo 54 zadano je 36, pa pinujemo na 35" — vrijedilo je za Expo 54.
Na SDK 58 / RN 0.88 isti pin je ispod praga koji nose AAR metapodaci
(`androidx.core` 1.17), pa `checkReleaseAarMetadata` prekida build prije
kompajliranja. To se ne rješava `exclude`-om ni dependency constraintom: prag
je zapisan u samoj biblioteci.

Pin je bio i ispod Play zahtjeva — od avgusta 2026 Play traži `targetSdk 36`.

**Popravka:** vrijednosti se više ne pinuju, nego ih određuju Expo/RN defaulti
(`compileSdk 37`, `targetSdk 36`, prema `ExpoRootProjectPlugin.kt`). Time
`compileSdk` uvijek prati SDK i ne može ponovo zaostati za bibliotekama.
`minSdkVersion` i dalje nije diran (Expo zadano 24 = Android 7.0), kao ni
odluka vlasnika o R8 (`enableMinifyInReleaseBuilds: false`,
`enableShrinkResourcesInReleaseBuilds: false`) i jedna ABI (`arm64-v8a`).

Uzrok je uklonjen i iz `app.json`/`app.config.js` za `edgeToEdgeEnabled`:
u SDK 58 plugin ispisuje da opcija više ne postoji jer Android 16 nameće
edge-to-edge.

**Dokaz:** `npx expo prebuild --platform android` više ne ispisuje upozorenje za
`edgeToEdgeEnabled`; novi `src/__tests__/buildConfig.test.ts` (5 testova) čita
`app.config.js` i tvrdi da `compileSdk`/`targetSdk` nisu pinovani ispod 36, da
`minSdk` nije diran, da `edgeToEdgeEnabled` ne postoji i da su R8/ABI odluke
netaknute. Native folderi nisu u repou (CNG), pa test čita konfiguraciju, a ne
`android/gradle.properties`.

### F12 — deprecation upozorenja RN jezgra na startu

Na startu aplikacije (Expo Go, SDK 58 / RN 0.88.1) ispisivalo se šest upozorenja:

```
WARN  DrawerLayoutAndroid is deprecated and will be removed in a future release. ...
WARN  InputAccessoryView is deprecated and will be removed in a future release.
WARN  ProgressBarAndroid has been extracted from react-native core ...
WARN  Clipboard has been extracted from react-native core ...
WARN  PushNotificationIOS has been extracted from react-native core ...
WARN  UTFSequence has been deprecated and will be removed in a future release ...
```

**Uzrok (dokazan, ne pretpostavljen):** RN 0.88 u `react-native/index.js` definiše
svih šest izvoza kao **getter** koji pri čitanju zove `warnOnce(...)`
(`node_modules/react-native/index.js`: 46, 79, 107, 243, 329, 399). Upozorenje
dakle ne zavisi od toga da li simbol koristimo — pali se **čitanjem svojstva**.
Nijedan fajl u `src/`, `App.tsx` ni `index.js` ne pominje tih šest imena
(grep: 0 hitova; tvrdi ga i novi test). Pali ih tuđi kod koji pročita sve izvoze
modula `react-native` odjednom, tipično kroz `import * as RN from 'react-native'`
ili `export * from 'react-native'`. Isti mehanizam je prijavljen u Expo repou
kao expo/expo#39544 („Wildcard imports/exports of react-native cause runtime
crash"); u našem `expo export` bundle-u takav import postoji na jednom mjestu —
`@react-navigation/stack/lib/module/views/InteractionManager.js`
(`import * as ReactNative from 'react-native'`), a Reanimated i
`react-native-gesture-handler` i sami u komentarima navode da `import * as RN`
pod Metro-om čita **svaki** izvoz.

Zato popravka ne može biti „ukloni import iz našeg koda": takvog importa nema.
`react-native-css-interop` (NativeWind) čita samo `SafeAreaView` i
`ImageBackground` — ta dva su filtrirana još u F5 i **nisu** dio ovih šest.

**Popravka:** u `src/polyfills.ts` dodat je zaseban niz `RN_CORE_DEPRECATIONS`
sa šest tačnih tekstova (prva rečenica poruke, jer je stabilna kroz verzije) i
spojen sa postojećim `IGNORED_WARNINGS` u `SUPPRESSED_WARNINGS`. `console.warn`
se i dalje samo **djelimično** preskače — svako drugo upozorenje prolazi
nepromijenjeno, `ignoreAllLogs` se ne koristi, `console.error` se ne dira.
`warnOnce` znači da RN ta upozorenja emituje jednom po sesiji, pa filter ne
može sakriti naknadnu stvarnu upotrebu: prvo čitanje ionako dolazi iz tuđeg
koda pri startu. Ako neka buduća verzija RN-a ukloni taj `warnOnce` i upozorenje
počne da se ponavlja, to je signal da se provjeri da li je neki naš fajl počeo
da koristi simbol.

**Dokaz:** novi `src/__tests__/rnWarnings.test.ts` (3 testa):
(1) nijedan naš fajl ne sadrži tih šest imena, a `polyfills.ts` ih pominje samo
kao tekstove, nikad kao `import`; (2) uzrok — čitanje `require('react-native')
.Clipboard` stvarno pali `warnOnce` upozorenje; (3) popravka — u izolovanom
registru se učita `src/polyfills.ts`, svih šest tekstova se preskoči, a
kontrolno upozorenje prođe. Test (3) je provjeren i mutacijom: kad se iz
`SUPPRESSED_WARNINGS` ukloni `RN_CORE_DEPRECATIONS`, pada; sa popravkom prolazi.
Postojeći F5 test („tačno tri upozorenja biblioteka") preveden je na novi tok:
asertacija i dalje traži **tačno tri** stringa u `IGNORED_WARNINGS`, ali čita
samo taj blok, pa F12 grupa ne mijenja njegov smisao.

**Provjera poslije F12 (2026-11-08):**

```
npx tsc --noEmit   → 0 grešaka
npx jest           → 51 suite, 335 testova, 32 snapshot-a — sve zeleno
npx eslint src     → 0 grešaka (45 upozorenja, isti baseline kao F11)
npx expo export --platform android --dev → prolazi
```

### F13 — šest stvari iz korisnikovog izvještaja (2026-11-19)

Korisnik je poslao šest zahtjeva; tri su bile funkcionalne greške, jedna
nedostatak, jedna jezik, jedna nova funkcionalnost.

**1. Crtice u „Historiji dnevnih zapisa".** U tabeli je za jučer stajalo 4
ciklusa, za danas 3 + jedan aktivan, a aplikacija je za Cikluse/Rad prikazivala
„—". Uzrok nije bio prikaz: `cycles` se punio **isključivo** iz serije uzoraka
(`ThermostatObservation`, bucket 5 min), a `outcomeAt` ostaje `null` kad serija
za dan nije pokrivena ≥ 80 %. Ciklusi su u isto vrijeme **postojali** kao
`HeatingEvent` redovi — ista polling petlja ih upisuje. Popravka: kad serija
nije dovoljna, `DailyOutcomeService.fillHome` broji cikluse iz `HeatingEvent`
(`cyclesFromEvents`) i upisuje **samo** cikluse i medijanu trajanja, sa
`outcomeVersion = 'outcome-events-1'`. Mjerna polja koja nijesu mjerena ostaju
`null` — nikad nula. Potpuna serija i dalje ima prednost.

**2. Donja granica polazne 48 vs. predlog 46.** Motor je računao npr. 46 °C (i to
je fizički izvodljivo), a unos je bio zaključan na 48, pa je predlog bio
neupotrebljiv. Granica je sada **po domu** (`HomeProfile.minHeatingFlowC`, novi
stupac + migracija) sa zadanim 48; `BoilerService.flowTempRange()` je jedini
izvor, a klijent ga čita sa `GET /api/boiler/flow-range` umjesto da nosi svoju
kopiju broja. Motor klampa na `max(46, dom.min)`–`min(55, dom.max)`.

**3. Preporuka se mijenjala iz ciklusa u ciklus.** Motor (`calculateFlowTemp`)
radi na svakom pollingu i svaki put vraća novi broj. Sada je mjerodavan
**jutarnji predlog** za dan (`DailyRecord.proposedFlowTemp`, piše ga
`DailyRecordWriter` u 06:00 lokalno). `anchorDailyFlow()` (`morning-anchor.ts`)
odlučuje koji broj važi: jutarnji, osim kad je **izmjeren** manjak preko
tolerancije — tada ide gore, i to samo gore. Formula ostaje u `currentFlowTemp`
kao informacija. Dashboard vraća `system.dailyFlow` sa `basis` (`MORNING` /
`CHANGED` / `FORMULA` / `NONE`), a Početna uz broj ispisuje „postavljeno jutros"
ili razlog izmjene.

**4. Prijevod mjerenja na kartici vremena.** `WeatherV2Card` je mjerenja držao u
pločicama sa sirovim ključevima; sada su redovi (`WeatherMetricRow`) sa bs/en
nazivima („Osjećaj", „Stanje", „Vlažnost", „Brzina vjetra", „Pritisak", „Danas
min/max"). Pet WMO ključeva preimenovano na backend imena, a novi
`locales/__tests__/weatherConditionKeys.test.ts` poredi skupove sa
`backend/src/modules/Weather/wmo.ts` — dodavanje koda na backendu bez prijevoda
sada pada test.

**5. Suvišni savjeti.** Tri odvojena reda objašnjenja uz trake svedena su na dva
(vlasnikov tekst): boje trake ciklusa i šta traka polazne mjeri.

**Provjera poslije F13:** `mobile` `npx tsc --noEmit` → 0; `npx jest` → 57
suite, 402 testa, 32 snapshot-a; `backend` `npx jest src/modules/DailyRecord` →
zeleno (novi testovi: `morning-anchor.spec.ts` 9, prošireni
`daily-outcome.service.spec.ts` 12).

### F14 — jedna polazna za cijeli dan

Izdvojeno iz F13 tačke 3 jer je odluka, ne popravka: korisnik postavlja
temperaturu **ručno, jednom ujutro**, pa se broj ne smije mijenjati tokom dana.
Pravilo „izmjena usred dana samo uz mjereni dokaz" živi u `morning-anchor.ts` i
pokriveno je testom; spuštanje usred dana nije dozvoljeno ni sa dokazom, jer bi
značilo da kuća hladi dok je dan još pred nama.

### F15 — objava verzije kroz admin dashboard

Do sada je `latestVersion` bio konstanta (`2.0.0`) u env-u, a klijent je nudio
Play Store. Sada:

- nova tabela `AppRelease` (migracija `20261120100000_app_release`), `version`
  UNIQUE;
- `POST /api/app-releases` (ADMIN) prima APK, **čita verziju iz
  `assets/app.config`** unutar ZIP-a i traži ručnu korekciju kad čitanje ne
  uspije; verzija mora biti veća od posljednje objavljene;
- `GET /api/app-releases/:id/apk` je **javan** download sa našeg servera — gate
  blokira i login, pa autentifikovani download ne bi imao izlaz;
- `GET /api/app/config` sada vraća i `latestRelease`, a `latestVersion` čita iz
  baze (env ostaje rezerva);
- mobilni: `checkVersionGate()` razlikuje `mustUpdate` (blokada, postojeći
  `UpdateRequiredScreen` sa uputstvom za „nepoznati izvor") od `updateAvailable`
  (trajna traka `UpdateAvailableBanner`, bez „×" i bez samozatvaranja);
- web: `/app-releases` ekran (vidljiv samo `ADMIN` u meniju; server provjerava
  `RolesGuard`).

**Odluka o skrivenoj verziji (vlasnik, 2026-11-20):** „Sakrij" **povlači**
verziju — skriveni build se ne nudi korisnicima, ali ostaje u historiji. To je
jedini smisao te kontrole: sakriti loš build znači prestati ga dijeliti.
Zabrana pri uploadu zato gleda **najvišu ikad** objavljenu verziju (i skrivene):
da gleda samo vidljive, admin bi nakon povlačenja 1.6.0 mogao objaviti 1.5.0, a
korisnici koji su 1.6.0 već dobili nikad više ne bi dobili obavijest. Pravilo
„nudenje gleda vidljivost, istorija gleda sve" zaključano je sa 4 testa.

**Regresija pri prvom stvarnom uploadu (2026-11-20):** korisnik odabere APK,
a server vrati `400 "Nedostaje APK fajl"`. Uzrok nije bio forma nego dijeljena
axios instanca: ima default `Content-Type: application/json`, a `axios@1.20.0`
u `transformRequest` za `FormData` radi
`hasJSONContentType ? JSON.stringify(formDataToJSON(data)) : data` — fajl se
serijalizuje u `{}` i nestane. Popravka je `apiClient.upload()` koji postavlja
`Content-Type: undefined` (axios tada sam postavi `multipart/form-data` sa
granicom). Test `services/__tests__/apiUpload.test.ts` propušta `FormData`
kroz stvarni `transformRequest` i traži da izađe kao `FormData`, a ne kao
string — grep nad izvorom bi prošao i kad bi se greška vratila drugom putanjom.
Uz to: dugme se zove „Pošalji APK" (a ne „Objavi verziju", što je zvučalo kao
da je posao obavljen), a ispod inputa piše **koja je datoteka odabrana i koliko
je velika**; poruka servera o nedostajućem fajlu sada kaže i da zahtjev nije
bio `multipart/form-data`.

**Drugi krug (2026-11-20, snimka ekrana):** na ekranu je i dalje stajalo dugme
„Objavi verziju" i sirov ključ `appReleases.fileSelected`. To je značilo da
**bundle nije bio nov**, ali je otkrilo dvije stvarne greške koje bi se inače
ponovile:

1. **Izmjena prijevoda je tiho promašila.** Prettier je `locales/config.ts`
   preveo na dvostruke navodnike, a izmjena je tražila jednostruke — `python`
   `str.replace` nije našao ništa i nije se požalio. Zato sada postoji
   `locales/__tests__/appReleasesKeys.test.ts`: čita **stvarni ekran**, vadi
   svaki `t("…")` literal i traži ga u oba jezika. Test je provjeren mutacijom
   (uklonjen `fileSelected` → padaju 2 testa).
2. **Popravka uploada je provjerena u oba adaptera, ne samo u Node-u.** Stub
   `XMLHttpRequest`-a pokazuje da u browseru axios **ne pošalje**
   `Content-Type` (jedino `Accept`), pa granicu dodaje browser; lokalni HTTP
   server potvrđuje da u Node-u stigne `multipart/form-data; boundary=…` sa
   `filename="a.apk"`. Zato test **ne** tvrdi da je zaglavlje
   `'multipart/form-data'` — tvrdi da je `undefined` i da `FormData` izađe iz
   `transformRequest` kao `FormData`.

Uz to dvije stvari koje je snimka odala:

- **`GET /api/auth/csrf-token` je 404 na svaki POST.** Backend taj endpoint nema
  (0 hitova), pa ga je klijent pitao uzalud. Sada se 404 pamti
  (`validateStatus`), pa nema novog zahtjeva do sljedeće prijave.
- **Web je još nosio granicu 48–55.** `frontend/src/constants/boilerLimits.ts`
  je tvrdio 48, dok backend sada prima 30–55 i poštuje granicu doma. Web sada
  čita `GET /api/boiler/flow-range` (`TempDialog` prima `range`), a test
  pariteta poredi DTO sa **apsolutnim** granicama, ne sa domaćim.

**Podsjetnik za deploy:** promjena u `frontend/src` ne postoji dok se ne napravi
nova slika/bundle. Ako ekran i dalje pokazuje staro dugme, build nije objavljen
— to nije greška u kodu.

**Treći krug (2026-11-21, druga snimka):** bundle je ovaj put bio nov (dugme
„Pošalji APK", `Odabrano: build-1794342462408.apk (45.6 MB)`), a upload je i
dalje vraćao `400 Nedostaje APK fajl`. Time je pala i teorija „stari bundle" i
teorija „`Content-Type: undefined` je dovoljno". Uzrok je nađen mjerenjem, a ne
rasuđivanjem — test pušta **pravi** `express` + `multer` (`multer().single('apk')`,
isti middleware koji `FileInterceptor('apk')` koristi) i propušta kroz njega
stvarni `apiClient`:

| poziv | `content-type` na serveru | `req.file` | odgovor |
|---|---|---|---|
| `apiClient.post('/app-releases', form)` | `application/json` | **nema** | **400 Nedostaje APK fajl** |
| `apiClient.upload('/app-releases', form)`, 45 MB | `multipart/form-data; boundary=--------------------------16…` | ima, `47185920 B`, `build-1794342462408.apk` | 201 |

Prvi red je korisnikov `400`. Dijeljena instanca ima
`Content-Type: application/json`, pa axios 1.20 u `transformRequest` radi
`JSON.stringify(formDataToJSON(data))`: `File` postane `{}`, a multipart tijelo
nestane. Zato `upload()` **ne** ide kroz tu instancu, nego kroz syrov
`XMLHttpRequest` bez ijednog `Content-Type` zaglavlja — browser tada sam postavi
granicu koja stvarno stoji u tijelu (izmjereno `delimiterMatches: true`).

Uz to dvije stvari koje su se pokazale mjerenjem, a prije su bile pretpostavke:

- **`Content-Type: undefined` u jsdom-u protiv pravog multera prolazi** (`201`,
  granicu dodaje jsdom). Ne treba se na to oslanjati: u axiosu
  `dispatchRequest` poslije transformacije radi
  `headers.setContentType('application/x-www-form-urlencoded', false)`, pa je
  ponašanje zavisno od adaptera. Syrov XHR nema tu dvosmislenost.
- **`post()`/`put()`/`patch()` sada preusmjeravaju `FormData` na `upload()`.**
  Popravak na jednom ekranu ne štiti sljedeći koji zaboravi `upload()`; ovako
  greška ne može ponovo nastati ni na jednom ekranu. Običan JSON POST je
  netaknut (test to tvrdi: `post('/nepostojeca-ruta', {a:1})` → 404, ne
  multipart).

Dokazi su u `frontend/src/services/__tests__/apiUploadMulter.test.ts` (3 testa
protiv pravog multera, uključujući 45 MB fajl) i `apiUpload.test.ts` (5 testova
na stubu XHR-a: nijedan `Content-Type`, `Authorization`/`X-CSRF-Token` ručno,
`FormData` ide u `send()`, `400` nosi poruku servera).

**Četvrti krug (2026-11-21, treća snimka): korisnik ne vidi tri od šest
popravki.** Snimke su pokazale: (a) Ciklusi su i dalje crtice, (b) granica je i
dalje „48 °C do 55 °C" i unos 47 se odbija, (c) na Početnoj stoji sirov
`WMO_80` i duga oznaka se lomi, (d) uz alert „Dugi ciklusi grijanja" stoji
bosanska rečenica. Uzrok nije bio prikaz ni keš — svaki slučaj je bio
**popravka koja nije stigla do mjesta gdje se koristi**:

1. **Ciklusi — pisac gleda 7 dana, tabela 20.** `DailyOutcomeService` popunjava
   samo `OUTCOME_LOOKBACK_DAYS = 7` dana unazad. Za starije dane `cycles` je
   zauvijek ostajao `null`, iako `HeatingEvent` redovi postoje od prve verzije
   aplikacije. Popravka je zato u **čitanju** (`DailyRecord/history-page.ts`):
   za stranu koja se prikazuje uzmu se događaji tog prozora i popune se samo
   crtice. Red koji već ima cikluse se **ne dira** (serija uzoraka mjeri i rad i
   cikluse iz istog izvora). Izvor se vidi u tabeli — `cyclesSource` je
   `SERIES` / `EVENTS` / `NONE`, a web uz broj piše „(iz događaja)". Bez te
   oznake dva različita mjerenja izgledaju isto.

2. **Granica 48 — polje nije bilo upisivo.** `HomeProfile.minHeatingFlowC`,
   migracija, `flowTempRange()` i `GET /api/boiler/flow-range` su postojali, ali
   **nijedna forma nije slala to polje**: DTO nije imao `minHeatingFlowC`, pa je
   granica za svakog korisnika ostala zadana 48. Dodato je u `Create/Update`
   DTO i u web formu profila doma. Pravilo „dom sužava, nikad ne proširuje" je
   izdvojeno iz servisa u `Boiler/flow-range.ts` — unutar servisa se nije moglo
   izvršiti nijedan test (traži `PrismaService`).

3. **`WMO_80` — stari put nije imao tabelu kodova.** `WeatherV2Card` koristi
   `conditionI18nKey` sa backenda, ali Početna u ovom režimu ide kroz stari
   `WeatherRow`, koji je imao samo tabelu engleskih naziva. `WMO_80` se
   normalizovalo u `wmo80`, nije nađeno i otišlo na ekran. Novi
   `mobile/src/utils/wmo.ts` prevodi WMO prefiks, a nepoznat kod daje
   „Nepoznato stanje" — sirov identifikator više ne može doći do korisnika.
   Test poredi tabelu sa **backendovim** `wmo.ts`.

4. **Duga oznaka iznad broja.** „Trenutna prognoza vremena" se lomila u tri reda
   iznad 10 °C. Nova oznaka je `weather.currentShort` („Trenutno" / „Now").

5. **Bosanska rečenica na engleskom.** `AlertsCard` je ispisivao `message` iz
   backend-a, a taj tekst je bosanski (web ga tako i prikazuje) i uz to ponavlja
   naslov („Dugi ciklusi grijanja / Detektovano 2 dugih ciklusa grijanja (> 90
   min)"). Backend sada uz `message` šalje **brojeve** (`count`, `threshold`,
   `valueC`), a klijent sastavlja rečenicu iz `healthWarningDetail.*`. Broj se
   nikad ne parse-uje iz rečenice — to bi bio isti kvar jedan sloj niže.

Dokazi po tački:

| šta | test | broj |
|---|---|---|
| ciklusi iz događaja | `DailyRecord/tests/event-cycles.spec.ts` | 7 |
| strana historije + izvor | `DailyRecord/tests/history-page.spec.ts` | 5 |
| raspon po domu | `Boiler/tests/boiler-flow-range.spec.ts` | 6 |
| WMO → ključ | `mobile/src/utils/__tests__/wmo.test.ts` | 4 |
| `WMO_80` na ekranu | `mobile/.../weatherCondition.test.tsx` | 5 |
| alert na engleskom | `healthAlerts.test.ts` + `heating-health.spec.ts` | 7 + 25 |
| polje u web formi | `frontend/.../flow-bounds-fields.test.ts` | 4 |

Mutacijom je provjereno da testovi stvarno drže kod: izmijenjen
`resolveFlowTempRange` (zanemarena donja granica doma) ruši 3 od 6 testova;
uklonjen `minHeatingFlowC` iz payloada forme ruši 1 od 4.

**Podsjetnik za deploy (ponovo):** sve četiri stvari su u `mobile/` i
`frontend/` — dok se ne napravi nova slika frontenda i novi APK, snimka će
pokazivati staro stanje. Migracije `20261119100000_min_heating_flow` i
`20261120100000_app_release` moraju biti primijenjene prije nego se forma za
donju granicu uopšte pojavi.

**Peti krug (2026-11-21, četvrta snimka): dvije stvari, obje poučne.**

1. **Savjeti nijesu bili uklonjeni, samo skraćeni.** Prvi krug ih je sveo sa tri
   reda na dva, drugi im je prepisao tekst — a na snimci su i dalje stajala dva
   reda između trake i dugmeta („Zeleno do predviđenog vremena…", „Traka: gdje
   je polazna…"). Uzrok nije bio dužina nego mjesto: objašnjenje je stajalo tamo
   gdje korisnik donosi odluku. Sada su **uklonjeni** i sa Početne i sa ekrana
   Grijanje (isti tekst je bio na oba). Raspon uz skalu („46 — 55") ostaje, jer
   to nije savjet nego vrijednost. Ključevi u `locales` ostaju — brisanje teksta
   iz UI-a i brisanje prijevoda su dvije odluke.

2. **Predlog koji se ne može prihvatiti.** Snimka: „PREDLOŽENA 47.7 °C", a unos
   47 odbijen sa „mora biti između 48 i 55". To nije bila greška korisnika ni
   zaostali bundle: motor izlaz klampa na **46–55**, a zadana granica unosa je
   bila **48**. Svaki predlog između 46 i 48 bio je ponuda koju sistem sam
   odbija. Popravka: zadana granica se sada **izvodi iz granice motora**
   (`SYSTEM_MIN_CURRENT_FLOW_TEMP = SYSTEM_MIN_FLOW_C`), pa se dva broja ne
   mogu razići ni kad se motor promijeni. Isto u oba klijenta (rezerva 46–55) i u
   `TempDialog`-u.

   Namjerno **nije** urađeno: spuštanje apsolutne granice u
   `DailyRecord/flow-bounds.ts` sa 30 — ona ostaje kako jeste. Mijenjala se samo
   *zadana* granica unosa, koja mora biti jednaka onome što motor stvarno vraća.
   Dom i dalje može podići donju granicu (kotao koji ne radi dobro na 46).

Dokazi: `boiler-flow-range.spec.ts` 8 (uključujući „predlog od 47.7 prolazi"),
`mobile/src/constants/__tests__/boilerLimits.test.ts` 22 (uključujući 45.9 pada,
46 i 47.7 prolaze), `heatingPolicy.test.ts` 14, `dialogs.test.tsx` (TempDialog
prihvata 47.7). Mutacija: vraćena 48 u `mobile/src/constants/boilerLimits.ts`
rušila je 5 testova u 3 fajla.

**Šesti krug (2026-11-21): granica polazne je podatak, ne konstanta.**

Nalaz: „i dalje smo fiksni na 48 min (isto i na web)" — i, tačnije, na **46**,
za *svaki* kotao. Gornja granica je od početka išla kroz katalog
(`effectiveCeilingC({ systemMaxC, family })` = `min(55, profil, model)`), a donja
je bila dvije tvrde konstante (`SYSTEM_MIN_FLOW_C = 46` u motoru i ista vrijednost
kao zadana granica unosa u `flow-range.ts`). Katalog za potvrđene modele navodi
stvarni pod — Vaillant ecoTEC `30`, Bosch Condens 7000 WP `30` — pa je 46 bila
**nedosljednost, ne odluka**.

Popravka ide u tri sloja, svaki sa svojim dokazom:

1. **`effectiveFloorC({ systemMinC, family, fallbackC })`** u
   `BoilerCatalog/boiler-catalog.ts` — ogledalo `effectiveCeilingC`:
   `max(30, pod iz kataloga, ručni unos)`. Pod iz kataloga ulazi **samo** kad je
   `specStatus === 'VERIFIED_MANUAL'` i broj postoji (`verifiedFloorOf`);
   `TO_VERIFY`/`PARTIAL` ne nose brojeve, pa ne mogu postati granica.
2. **`resolveFlowTempRange(home)`** sada prima i `boilerCatalogId` i obje strane
   izvodi iz kataloga. Novi izvor `source: 'BOILER'` kaže da je granica iz
   priručnika — bez njega bi ekran pripisao 30 °C korisniku. Kad dom upiše svoju
   granicu, izvor ostaje `HOME` (korisnik je konkretniji od porodice).
3. **Ručni unos kao fallback**: modela nema u katalogu (`boilerCatalogId == null`)
   ili model nije potvrđen → granicu daje `HomeProfile.minHeatingFlowC`, a bez nje
   motor (46). Time modularnost ne zaključava nikoga.

Uslov koji je vlasnik postavio uz zahtjev — **ne smije uticati na formulu i
learning** — provjerava se mjerenjem, ne tvrdnjom: `ProfileStrategy.calculate()`
se poziva sa istim ulazom dok se raspon mijenja (katalog, ručni 30–55, ručni
51–55) i `finalTemp` mora biti **identičan**. `base.strategy.ts` nije mijenjan.

Oba klijenta sada imaju polja granica u formi doma: web
(`flowBoundsForFamily` u `features/home-profile/lib/boiler-catalog.ts`) i mobilni
(`flowBoundsForFamily` + `flowBoundChoices` u `screens/home/boilerCatalog.ts`),
sa istim pravilima i istim tekstom („Katalog za ovaj kotao navodi 30–55 °C" /
„nema potvrđene vrijednosti — upišite granice sami"). Kartica na Početnoj web
verzije više ne ispisuje konstante 46–55 nego raspon sa servera.

Dokazi: `boiler-flow-range.spec.ts` **19** (8 starih + 11 novih, uključujući
„raspon ne dira motor"), `boiler-catalog.test.ts` (web) **26**,
`boilerCatalog.test.ts` (mobilni) — `flowBoundsForFamily` 3 nova,
`heatingPolicy.test.ts` 16, `boilerLimits.test.ts` (mobilni) — `BOILER` izvor.

**CI je dio posla, ne detalj.** Tri propusta su bila otvorena; sva tri su
popravljena i run `a1c12ec` je **zelen u oba workflow-a** (`Frontend CI`,
`Backend build` — i `build` i `test` job, na pravom PostgreSQL-u):

1. `42920655959` — `DailyHistoryService` (9 testova / 2 suite-a). Nije bila
   logika: **stub je ostao na starom obliku servisa** poslije `F13` (servis čita
   i `HeatingEvent` i zonu doma). Stub dopunjen (`heatingEvent.findMany`,
   `weatherTimezone`, `user.timezone`) → 29/29, commit `13c8c61`.
2. `42925651049` — `apiUploadMulter.test.ts` je importovao
   `backend/node_modules/{express,multer}` apsolutnom putanjom, a CI instalira
   samo `frontend/`. Iste verzije (`express 5.2.1`, `multer 2.5.0`) su sada
   **lokalne devDependencies** frontenda; test prolazi i bez `backend/node_modules`
   (dokazano premještanjem tog direktorija), commit `b40ab46`.
3. `42981488213` — `DashboardService` stub nije imao `prisma.user` ni
   `prisma.dailyRecord`, koje je uveo `F14` (`homeDailyFlow`). Dopunjen stub →
   7/7, commit `a1c12ec`.

Uz to je `backend-build.yml` dobio `'arena/**'` u `push.branches` — prije je
pokrivao samo `main` i jednu arhiviranu granu, pa se pad backenda otkrio tek
poslije merge-a (commit `6b58533`).

Pouka za dalje: poslije svake izmjene servisa provjeriti sve
`new *Service(prisma as never)` stubove (`grep "as never"`).

**A11Y nalaz (2026-11-21): web je tvrdio AA, a mjerio ga je samo mobilni.**

Na pitanje „da li aplikacija posjeduje pri buildu provjeru kontrasta" odgovor je
bio **djelimično**: mobilni ima `src/ui/__tests__/a11yContrast.test.ts` (paleta ×
tri podloge, AA 4,5:1, AAA 7:1 za `ink`), a web je imao samo `axe` sken sa
**isključenim** `color-contrast` pravilom (jsdom nema layout). Mjerenje pokazuje
da je to bio stvarni propust, ne formalnost — u svijetloj temi:

| token | bilo | kako se koristi | odnos |
|---|---|---|---|
| `--signal` | `255 107 61` | `text-signal`, badge | **2,55:1** |
| `--ok` | `34 197 94` | `text-ok` | **2,05:1** |
| `--warn` | `245 165 36` | `text-warn` | **1,84:1** |
| `--info` | `56 189 248` | `text-info` | **1,93:1** |
| `--fault` | `239 68 68` | `text-fault`, greška polja | **3,39:1** |
| `--ink-dim` | `107 114 128` | meta, jedinice | **4,35:1** |
| `--btn-danger` | `239 68 68` + bijeli tekst | brisanje | **3,76:1** |

Popravka: iste vrijednosti koje mobilni već koristi (`--signal` `180 58 12`,
`--ok` `20 110 52`, `--warn` `158 72 8`, `--fault` `185 28 28`, `--info`
`3 105 161`, `--ink-dim` `89 97 110`, `--btn-danger` `185 28 28`) — plus
tamnjenje u mobilnom tamo gdje je mjerenje na **vlastitoj 10% podlozi**
(`okSoft`, `warnSoft`, `signalSoft`) davalo 4,07–4,19:1: `signal` `#b43a0c`,
`ok` `#146e34`, `warn` `#9e4808`, dark `fault` `#f87171`.

Novi mjerni test, `frontend/src/design/__tests__/contrast.test.ts` (12 testova):
čita `tokens.css` kao izvor istine (ne kopiju brojeva), mjeri AA na `panel`/
`canvas`/`raised`, tekst na vlastitom tintu (`bg-fault/10 text-fault`), sve
varijante dugmadi, placeholder, AAA za primarni tekst — i **poredi web paletu sa
mobilnom**, pa se dvije aplikacije više ne mogu razići o tome šta je
„pristupačno".

## 4. Status provedbe

| Faza | Status | Dokaz |
|---|---|---|
| F0 Temelj | **završeno 2026-11-07** | `src/theme/tokens.ts`, `src/theme/fonts.ts`, `src/ui/*` (11 primitiva), 34 nova testa |
| F1 Navigacija i jezik | **završeno 2026-11-07** | jedan tab bar, `Segmented` u Plinu, `ScreenHeader` na svim push ekranima, tri ekrana prevedena, 14 novih testova |
| F2 Glavni ekrani | **završeno 2026-11-07** | Početna = hero + 3 KPI + liste; Grijanje red-po-uređaju; Plin red-po-očitanju; Postavke jedna lista; 11 novih testova |
| F3 Analitika i grafovi | **završeno 2026-11-08** | jedan `TrendChart` na `react-native-svg` (chart-kit uklonjen), tabela vrijednost/prethodno iz stvarnog upita, cilj-vs-postignuto, bez fiktivnih metrika; 6 novih testova |
| F4 Završnica | **završeno 2026-11-08** | skeleton na svim ekranima sa učitavanjem, a11y labele na svim `Pressable`-ima, `Alert` i stari bottom sheet obrisani, locale bug `gas.dateRange` ispravljen; 13 novih testova |
| F5 Expo Go / RN 0.88 | **završeno 2026-11-08** | `Intl.PluralRules` polyfill, `console.warn` filter za dva NativeWind upozorenja, `@react-navigation/stack` 7.12.1 (InteractionManager); 6 novih testova |
| F6 Greške + šest dorada | **završeno 2026-11-08** | „Text strings" (`Badge`), Reanimated `deps` filter, jezik u Postavkama, WCAG AA paleta + `a11yContrast.test.ts`, vrijeme ispod statusa, `utils/format.ts`, detaljan prolaz kroz Plin (GAS-01…GAS-11) i Postavke (SET-02…SET-13); tipografska skala ≥ 11 px; reduced motion za splash; 55 novih testova |
| F9 Plin iznova | **završeno 2026-11-07** | Plin više ne miješa dva UI sloja: `GasForm` i akcioni meni na `src/ui`; unos sa decimalnim zarezom, duplikat prije mreže, funkcionalan raspon datuma, sažetak sa istaknutom potrošnjom; 4 nova testa |
| F8 Sheet bez gorhom-a + raspored | **završeno 2026-11-07** | `Sheet` = RN `Modal` + `Animated` (nema gorhoma, Reanimated workleta ni gesture-handlera); greška više ne ruši ekran (`undefined` toast); Početna po korisnikovom redoslijedu, alerti u status kotla, termostat-mode u kartici termostata, prevedena stanja vremena; 5 novih testova |
| F7 Mrtvi dodiri + Gas | **završeno 2026-11-07** | `Sheet` na RN `Modal` sa deklarativnim `index` (rješava set-temp, dodaj očitanje, promjenu jezika); jezik dokazan reprodukcijom; Početna: istaknut `targetFlow` + kartica potrošnje + alerti i „Recommendation reason" u temi; Gas: meni perioda, tab traka, kartice očitanja, 44 px akcije; 13 nalaza; 12 novih testova |
| F11 Produkcijski Android build | **završeno 2026-11-08** | pin `compileSdk`/`targetSdk` uklonjen (`checkReleaseAarMetadata`), `edgeToEdgeEnabled` uklonjen; `buildConfig.test.ts` (5 testova) |
| F12 RN deprecation upozorenja | **završeno 2026-11-08** | filter za šest `warnOnce` tekstova iz `react-native/index.js` (uzrok: `import * as RN` u tuđem kodu, expo/expo#39544); `rnWarnings.test.ts` (3 testa) |

### Šta je F0 stvarno isporučio

| Fajl | Sadržaj |
|---|---|
| `src/theme/tokens.ts` | 22 semantička tokena × 2 teme, skala razmaka/radijusa/tipografije, `tokensFor()` s fail-safe na dark |
| `src/theme/fonts.ts` | `useAppFonts()` — IBM Plex Sans 400/500/600/700 + Plex Mono 400/500/600 iz `assets/fonts`, fallback na sistemske familije bez blokiranja UI-a |
| `src/theme/AppTheme.tsx` | default **dark**, `systemColorMode()`, ključ `boiler.color-mode` ostaje |
| `src/ui/Screen.tsx` | `Screen`, `ScreenBody`, `ScreenHeader` (nazad/naslov/akcija), `Section` |
| `src/ui/Panel.tsx` | `Panel`, `HeroPanel`, `PanelRow`, `PanelDivider` — bez sjene |
| `src/ui/Readout.tsx` | `Readout` (mono, tabularno), `Kpi` |
| `src/ui/Text.tsx` | `Text`, `MonoLabel`, `MonoMeta`, `Heading` |
| `src/ui/Pressable.tsx` | role + hitSlop + jedan pressed stil |
| `src/ui/Button.tsx` | `Button` (4 varijante), `IconButton` (obavezna labela) |
| `src/ui/GaugeBar.tsx` | progres + marker cilja, `role="progressbar"` |
| `src/ui/Led.tsx` | `Led`, `StatusDot` — živo stanje bez pune obojene pločice |
| `src/ui/Segmented.tsx` | zamjena za drugi tab bar (`tab` role, `selected` state) |
| `src/ui/InlineBanner.tsx` | info/ok/warn/fault, ne renderuje se kad nema sadržaja |
| `src/ui/AsyncState.tsx` | `AsyncState`, skeletoni, `ErrorState`, `EmptyState`, stale-while-error |
| `src/ui/Sheet.tsx` | ispravljen bottom sheet: bez ranog unmounta, `title` vidljiv, `keyboardBehavior` |
| `src/ui/index.ts` | jedan ulaz za potrošače |
| `assets/fonts/` | 7 ttf + `OFL.txt` (SIL OFL 1.1) |

Provjera poslije F0 (2026-11-07):

```
npm run type-check   → 0 grešaka
npm test             → 26 suite-ova, 170 testova, 32 snapshot-a — sve zeleno
                       (24 postojeća + 2 nova: tokens.test.ts, primitives.test.tsx)
npm run lint         → 0 grešaka (2 upozorenja o require() unutar jest.mock)
```

Nijedan ekran nije izmijenjen u F0, pa su svi postojeći NativeWind testovi ostali
netaknuti. Novi sloj radi paralelno sa starim (`components/ui/nativewind.ts`).

## 5. Provjera nakon svake faze

```bash
cd mobile
npm run type-check   # mora proći
npm test             # postojeći suite-ovi zeleni
npm run lint         # bez novih upozorenja
```

Ručno: 360 px i 430 px, obje teme, `bs` i `en`.

## 6. Pravila imenovanja

- Tokeni su **semantički**, ne vizuelni: `canvas`, `panel`, `ink`, `signal`. Nema `gray800`, nema `brand400`
  u novom kodu. Stari `theme/palette.ts` ostaje dok ga F2/F4 ne isprazne.
- Komponente iz `src/ui` ne primaju boju kao prop; primaju varijantu (`variant="primary"`) ili ništa.
  Boja je odluka teme, ne ekrana.
- Nijedna brojčana tvrdnja u UI bez izvora iz API-ja (odluka 3).
