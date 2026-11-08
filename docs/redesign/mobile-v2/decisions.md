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

## 4. Status provedbe

| Faza | Status | Dokaz |
|---|---|---|
| F0 Temelj | **završeno 2026-11-07** | `src/theme/tokens.ts`, `src/theme/fonts.ts`, `src/ui/*` (11 primitiva), 34 nova testa |
| F1 Navigacija i jezik | **završeno 2026-11-07** | jedan tab bar, `Segmented` u Plinu, `ScreenHeader` na svim push ekranima, tri ekrana prevedena, 14 novih testova |
| F2 Glavni ekrani | **završeno 2026-11-07** | Početna = hero + 3 KPI + liste; Grijanje red-po-uređaju; Plin red-po-očitanju; Postavke jedna lista; 11 novih testova |
| F3 Analitika i grafovi | **završeno 2026-11-08** | jedan `TrendChart` na `react-native-svg` (chart-kit uklonjen), tabela vrijednost/prethodno iz stvarnog upita, cilj-vs-postignuto, bez fiktivnih metrika; 6 novih testova |
| F4 Završnica | **završeno 2026-11-08** | skeleton na svim ekranima sa učitavanjem, a11y labele na svim `Pressable`-ima, `Alert` i stari bottom sheet obrisani, locale bug `gas.dateRange` ispravljen; 13 novih testova |
| F5 Expo Go / RN 0.88 | **završeno 2026-11-08** | `Intl.PluralRules` polyfill, `console.warn` filter za dva NativeWind upozorenja, `@react-navigation/stack` 7.12.1 (InteractionManager); 6 novih testova |

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
