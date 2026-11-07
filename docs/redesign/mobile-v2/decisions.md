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

### F3 — Analitika i grafovi

Uklanjanje fiktivnih metrika i bloka „AI Insights", `react-native-chart-kit` → `react-native-svg`,
tabela „vrijednost / prethodno", cilj-vs-postignuto.

### F4 — Završnica

Skeleton na svim ekranima, a11y labele i role, `hitSlop`, ispravke toastova, brisanje mrtvih stilova.

## 4. Status provedbe

| Faza | Status | Dokaz |
|---|---|---|
| F0 Temelj | **završeno 2026-11-07** | `src/theme/tokens.ts`, `src/theme/fonts.ts`, `src/ui/*` (11 primitiva), 34 nova testa |
| F1 Navigacija i jezik | **završeno 2026-11-07** | jedan tab bar, `Segmented` u Plinu, `ScreenHeader` na svim push ekranima, tri ekrana prevedena, 14 novih testova |
| F2 Glavni ekrani | sljedeće | — |
| F3 Analitika i grafovi | — | — |
| F4 Završnica | — | — |

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
