# Mobile UX/UI audit — Boiler Control

Datum: 2026-11-07. Branch: `arena/456ec6f2-boiler-control`. Osnova: commit `073d654`.

Ovaj dokument je **audit**, ne izvještaj o izvršenim izmjenama. Nijedan fajl u `mobile/src` nije
promijenjen. Sve tvrdnje su provjerene čitanjem koda i `grep`/`wc` na ovom branchu; gdje navodim
broj, navodim i komandu kojom je dobiven.

Ilustracije: `docs/redesign/mobile-v2/prototype.html` (ručno napisan HTML/CSS, nije screenshot builda).

---

## 0. Metod i obim

| Stavka | Vrijednost |
|---|---|
| Ekrana u `src/screens` (bez testova) | 15 |
| LOC ekrani + komponente (bez testova) | 10 776 |
| Komponenti u `src/components` | 22 |
| UI primitiva (`components/ui`) | 4 fajla, 1 387 LOC |
| Test suite-ova u `mobile/src` | 12 |
| i18n ključeva (`locales/config.ts`) | ~1 334 linije, dva jezika (en-US, bs-BS) |

Komande korištene za brojeve u ovom dokumentu:

```bash
find src/screens src/components -name "*.tsx" ! -path "*__tests__*" | xargs wc -l | tail -1
grep -rn "useColorModeValue(" src --include=*.tsx | grep -v __tests__ | wc -l      # 228
grep -rn "accessibilityLabel" src --include=*.tsx | grep -v __tests__ | wc -l      # 15
grep -rn "#[0-9a-fA-F]\{6\}" src --include=*.tsx --include=*.ts | grep -v __tests__ | wc -l  # 156
grep -rn "shadow={" src --include=*.tsx | grep -v __tests__ | wc -l                # 35
```

Kontekst: web frontend (`frontend/`) je već prošao kroz redesign i ima dokumentovan
„instrument panel" pravac (`docs/redesign/06-design-direction.md`, `11-cockpit-ui.md`,
`frontend/src/design/tokens.css`). Mobilna aplikacija je vizuelno ostala na starom jeziku:
bijele kartice sa sjenama, NativeBase-oidne plave pločice, tri akcenta. To je glavni razlog
zašto ovaj refaktor ima smisla — cilj nije novi ukus, nego **jedan jezik kroz web i mobilni**.

---

## 1. Sažetak: šest stvari koje stvarno bole

1. **Dva tab bara jedan iznad drugog** u Plinu (`GasScreen.tsx:22`).
2. **Analitika je slijepa ulica** — nema nazad (`AnalyticsScreen.tsx`, 0 pogodaka za `goBack`).
3. **Tri ekrana su 100 % na engleskom** u bosanskoj aplikaciji (0 `t()` poziva).
4. **Fiktivne metrike** („12 % bolji od sličnih domova", „18 % poboljšanje") prikazane kao mjerenja.
5. **228 `useColorModeValue` poziva** — tema je ručno razapeta kroz svaki ekran umjesto tokena.
6. **15 `accessibilityLabel` na 10 776 LOC** — ikonografske kontrole su nijeme.

---

## 2. Nalazi

Nivoi: VISOKO = korisnik ne može obaviti zadatak ili dobija netačnu informaciju;
SREDNJE = radi, ali stvara trenje ili nedosljednost; NISKO = poliranje.

### 2.1 Navigacija i struktura

#### UX-02 · Analitika bez izlaza — VISOKO

- **Gdje:** `src/screens/analytics/AnalyticsScreen.tsx`, `DashboardStackNavigator.tsx:29`.
- **Šta:** Ekran se registruje s `options={{ headerShown: false }}` i otvara iz headera početne
  (`DashboardScreen.tsx:305` → `navigation.navigate('Analytics')`). U ekranu **nema** nijednog
  `goBack`, nema strelice nazad, a donja traka tabova ostaje vidljiva — pa ekran izgleda kao tab,
  iako je push. Na iOS-u korisnik ostaje zarobljen (nema hardverske tipke nazad).
- **Dokaz:** `grep -rn "goBack" src/screens` → 0 pogodaka.
- **Popravka:** zajednički `ScreenHeader` s nazad strelicom (vidi prototip §05), `headerShown: true`
  ili vlastiti header kroz primitive.

#### UX-03 · Dva tab bara u Plinu — VISOKO

- **Gdje:** `src/screens/gas/GasScreen.tsx:22` — `createBottomTabNavigator` unutar
  `MainTabNavigator`.
- **Šta:** Unutrašnji tab bar (Očitanja / Analiza) stoji neposredno iznad glavnog. Dvije trake
  troše ~112 px na ekranu od 800 px, a korisnik mora naučiti koja traka šta mijenja.
- **Popravka:** jedan tab bar + `Segmented` u zaglavlju ekrana (prototip §04). Imena ruta
  (`Readings`, `Analysis`) i deep linkovi se ne mijenjaju — `constants/routes.ts` ostaje izvor istine.

#### UX-05 · Naslovi hardkodirani u navigatoru — VISOKO

- **Gdje:** `src/navigation/SettingsStackNavigator.tsx:38, 46, 54, 62`.
- **Šta:** `title: 'Manage Homes'`, `'Heating Schedules'`, `'Notifications'`,
  `'Notification Preferences'` — string literali u navigatoru, van i18n sistema. Ekran ispod je
  preveden, header nije.
- **Popravka:** naslove vaditi iz `t()` na nivou ekrana (`ScreenHeader`), ne iz navigatora.

#### UX-12 · Dekorativna ikona koja izgleda kao dugme — SREDNJE

- **Gdje:** `DashboardScreen.tsx:251-259`.
- **Šta:** `<Pressable bg={headerBtnBg} rounded="full" p={2}>` s ikonom plamena **nema `onPress`**.
  Izgleda identično susjedna dva dugmeta (grafikon, refresh) koja rade. Korisnik tapne i ništa se
  ne dogodi — klasična lažna afordanca.
- **Popravka:** ili postaje prava akcija (npr. skok na Grijanje), ili prestaje biti `Pressable`.

#### UX-21 · Tri ikone istog tretmana u headeru — NISKO

Tri jednaka kruga (`p={2}`, ista pozadina) za tri različite važnosti akcija. U predlogu: jedna
primarna akcija vidljiva, ostalo u `overflow` meniju.

### 2.2 Sadržaj i tačnost

#### UX-01 · Fiktivne metrike — VISOKO

- **Gdje:** `AnalyticsScreen.tsx:712-736`.
- **Šta:** `t('analytics.better', { percent: '12' })` i `t('analytics.improvement', { percent: '18' })`.
  Brojevi su **literalni stringovi u kodu**, ne rezultat izračuna. Aplikacija tvrdi da je korisnik
  „bolji od sličnih domova" i da je ostvareno „poboljšanje 18 % u odnosu na prošlu godinu", bez
  ijednog podatka koji to podupire. U domenu grijanja i potrošnje plina to može uticati na odluke
  o temperaturi polaza i trošenju.
- **Dokaz:** `grep -rn "percent: '" src/screens/analytics` → nalaze se samo te dvije konstante.
- **Popravka:** blok se uklanja u F3. Vraća se kad backend vrati stvarnu normalizaciju
  (stepen-dani), što je već predviđeno u `docs/redesign` planu za web.

#### UX-13 · Trend strelice bez poređenja — SREDNJE

- **Gdje:** `AnalyticsScreen.tsx:399, 415, 434, 456` — `trend="down"` / `trend="up"` su string
  literali; `StatCard` ih prikazuje kao strelicu + procent.
- **Šta:** (a) Smjer trenda je **hardkodiran u kodu**, ne izračunat. (b) Kartice ispod sebe ispisuju
  `getVsLastLabel(timeRange)` → „u odnosu na prošlu sedmicu", ali ekran dohvata **samo tekući
  raspon**: `analytics-summary`, `analytics-stats`, `analytics-learning` za `dateRange`, nigdje
  drugi raspon. Dakle poređenje koje tekst tvrdi nikad se ne izvrši. (c) Za `trendValue` se
  prosljeđuje npr. `"14 ciklusa"` — broj ciklusa kao „trend".
- **Popravka:** eksplicitna tabela „Vrijednost / Prethodno" (prototip §05), bez implicitnih strelica.

#### UX-25 · Vrijeme troši 200 px — NISKO

`WeatherCard.tsx:64` — ikona od 96 px u punom krugu `accentColor`, plus tri pločice. Na Početnoj
to je najveći element nakon statusa kotla, a najmanje akcion podatak.

### 2.3 Vizuelni sistem

#### UX-08 · Sjene i radijusi bez hijerarhije — SREDNJE

- **Dokaz:** `shadow={1}` ×8, `shadow={2}` ×23, `shadow={3}` ×3, `shadow={9}` ×1 — ukupno **35**
  mjesta (`grep -rn "shadow={" | wc -l`). Radijusi: `rounded="lg"` ×50, `"xl"` ×47, `"md"` ×39, `"full"` ×33, `"sm"` ×3
  — pet vrijednosti, bez pravila koja se koristi gdje.
- **Šta:** Sve je „kartica sa sjenom", pa ništa nije važnije od ičega. `shadow={9}` je FAB u
  `GasReadingsScreen` koji prekriva sadržaj; `_dark={{ shadow: 'none' }}` postoje na nekim karticama, ali ne na svim, pa je
  dark mode nedosljedan.
- **Popravka:** nula sjena, dubinu nosi hairline ivica (kao web instrument panel).

#### UX-09 / UX-10 · Tri akcenta, dvije nijanse branda — SREDNJE

- **Gdje:** `BoilerStatusCard.tsx` (blue.50/blue.400/blue.600 za „Preporučeno", green za „Stvarno",
  brand za akciju), `WeatherCard.tsx` (brand), `GasScreen.tsx:16-18` (hardkodiran `#f97316`
  umjesto `brand.400`).
- **Dokaz:** 156 hex literala ukupno u `src`, od toga 124 u `theme/` (to je definicija palete) i
  **32 rasutih van nje**: `GasScreen` 6, `GasAnalysisScreen` 4, `MainTabNavigator` 4, `FormInput` 4,
  `SettingsStackNavigator` 2, `DashboardStackNavigator` 2, `controls.tsx` 2, `UpdateRequiredScreen` 1,
  `AnalyticsScreen` 1, `AnimatedSplash` 1, `styles.ts` 1. `FormInput` je najgori primjer: sva četiri
  stanja (bg, border, text, placeholder) su hex, pa tema ne može da ih kontroliše.
- **Šta:** `brand.400 #ff6b3d` i `brand.500 #e85223` se koriste naizmjenično za istu ulogu
  (npr. `MainTabNavigator` koristi `#ff6b3d`, `GasScreen` `#f97316`). Nijansa se razlikuje od
  ekrana do ekrana.
- **Popravka:** `signal` token = `#ff6b3d` za sve; `#e85223` samo u gradijentu logotipa.

#### UX-20 · Tri stila mikro-labela — NISKO

Uppercase 10 px s `letterSpacing: 0.5` postoji u `HealthScoreCard`, `BoilerStatusCard`,
`WeatherCard`, `SettingsScreen` — ali s tri različite kombinacije veličine/težine/trackinga, i
miješa se s `fontSize="xs"` labelama koje nisu uppercase.

#### UX-11 · FAB prekriva sadržaj — SREDNJE

- **Gdje:** `GasReadingsScreen.tsx:848-868`.
- **Šta:** FAB `w={20} h={20}` (u ovom UI sistemu `20 × 4 = 80 px`), `shadow={9}`, `bottom={8}`, dok `FlatList` ima `paddingBottom: 32`. FAB sjedi preko zadnjeg reda liste.
- **Popravka:** primarna akcija ide u zaglavlje ekrana (`ScreenHeader` action slot).

#### UX-15 · Dva izgleda za istu potvrdu — SREDNJE

- **Dokaz:** 9 mjesta renderuje ručni toast `<Box bg="green.500" px={3} py={2} rounded="md">`
  (npr. `DashboardScreen.tsx:104`, `HeatingScreen.tsx:161`), 27 mjesta koristi
  `toast.show({ description })`.
- **Šta:** Ista poruka izgleda različito zavisno od ekrana; ručne kutije nemaju ikonu, imaju
  fiksni `bg="green.500"` i ne prate temu.

#### UX-16 · Hook unutar JSX-a — SREDNJE (bug)

- **Gdje:** `SettingsScreen.tsx:348` i `:356` — `useColorModeValue(...)` se poziva **unutar**
  `SettingItem`-ovog JSX izraza koji se renderuje uslovno (`onPress ? ... : 'transparent'`).
- **Šta:** Kršenje pravila hookova; broj hookova po renderu mijenja se sa propsima. React 19 u
  striktnom režimu to prijavljuje, a ponašanje nije garantovano.

#### UX-17 · Sistem dark mode se ignoriše — SREDNJE

- **Gdje:** `app.json:7` → `"userInterfaceStyle": "light"`, dok `AppThemeProvider` ima punu dark
  paletu i prekidač u Postavkama.
- **Šta:** Korisnik s uključenim sistem dark modom dobija svijetlu aplikaciju; `<StatusBar style="auto" />`
  u `App.tsx:78` onda računa na pogrešnu pozadinu.
- **Popravka:** `"automatic"` + tema u tri stanja (Svijetla / Tamna / Sistem).

#### UX-18 · Grafovi — SREDNJE

`GasAnalysisScreen.tsx:20-22`: `require('react-native-chart-kit')` u `try/catch`, a širina iz
`Dimensions.get('window')` (`:248`). Sopstveni vizuelni jezik (plava linija), bez osa, jedinica i
tooltipa; ne prati rotaciju ni promjenu veličine.

### 2.4 Stanja podataka

#### UX-07 · Pun ekranski spinner na 7 ekrana — SREDNJE

`DashboardScreen:176`, `HeatingScreen:187`, `GasReadingsScreen:624`, `GasAnalysisScreen:232`,
`NotificationsScreen:138`, `NotificationPreferencesScreen:66`, `ScheduleManagementScreen:271`.

Svaki od njih radi `if (isLoading) return <spinner + tekst>`, dakle cijeli ekran nestaje i
vraća se — layout shift pri svakom hladnom učitavanju. Skeleton postoji (`Skeleton` u
`components/ui/primitives.tsx`) ali se koristi samo u `AnalyticsScreen` (20 pojava).

#### UX-24 · Prazna stanja bez „šta dalje" — NISKO

`HeatingScreen` (nema termostata) i `ScheduleManagementScreen` prikazuju poruku bez akcije;
`GasAnalysisScreen` traži 2 očitanja ali ne nudi dugme „dodaj očitanje".

#### UX-19 · `Alert.alert` — NISKO

`GasReadingsScreen.tsx:503` — jedini sistemski dijalog u aplikaciji, dok sve ostale potvrde idu
kroz bottom sheet. Dva jezika dijaloga.

#### UX-14 · Bottom sheet — SREDNJE

- **Gdje:** `components/BottomSheetModal.tsx`.
- **Šta:** (a) `if (!isOpen) return null` (`:69`) uklanja sheet iz stabla **prije** nego
  `@gorhom/bottom-sheet` odigra animaciju zatvaranja — zatvaranje „nestane", otvaranje se animira.
  (b) `title` prop je deklarisan (`:12`) i potrošači ga prosljeđuju (`DashboardScreen:346`,
  `GasReadingsScreen:868`, `SettingsScreen`), ali se **nikad ne renderuje** — zaglavlje je prazno
  i nema `accessibilityRole="header"`. (c) nema `keyboardBehavior`, pa tastatura prekriva
  dugmad u formama.

### 2.5 Lokalizacija

#### UX-04 · Tri ekrana bez ijednog prijevoda — VISOKO

| Fajl | LOC | `t('` pojava |
|---|---:|---:|
| `screens/home/HomeManagementScreen.tsx` | 1 073 | 0 |
| `screens/schedule/ScheduleManagementScreen.tsx` | 487 | 0 |
| `screens/profile/ProfileScreen.tsx` | 264 | 0 |

Primjeri iz koda: „No Thermostats Found", „No thermostat devices are configured for your account.",
„Heating Schedule", „View current thermostat program intervals by day. Read-only display from device."
Korisnik koji je izabrao bosanski dobija engleski ekran na trećini navigacije. Uz to,
`SettingsStackNavigator` daje engleske naslove (UX-05), pa se miješanje vidi i prije ulaska u ekran.

**Napomena o obimu:** prijevod tri ekrana je najveći pojedinačni tekstualni posao u refaktoru —
potrebno je dodati ~150–200 novih ključeva u oba jezika. Predlažem to u F1, prije vizuelnih izmjena,
jer je nezavisno od dizajna.

### 2.6 Pristupačnost

#### UX-06 · 15 labela na 10 776 LOC — VISOKO

- **Dokaz:** `grep -rn "accessibilityLabel" src --include=*.tsx | grep -v __tests__ | wc -l` → 15
  (od toga nekoliko u spinnerima). `testID` → 0.
- **Konkretne rupe:**
  - `DashboardScreen.tsx:251-288` — tri ikonografska dugmeta bez labele.
  - `FormInput.tsx` — labela je odvojeni `Text` iznad polja, bez programske veze.
  - `SettingsScreen.tsx:341-379` `SettingItem` — `Pressable` bez `accessible`/`accessibilityRole`.
  - `HomeManagementScreen` — akcije „uredi"/„obriši" su gole ikone.
- **Popravka:** obavezna labela na svakoj ikonografskoj kontroli, `hitSlop` ≥ 44×44,
  `accessibilityRole="button"` na redovima lista, `accessibilityState` za prekidače.

### 2.7 Performanse i osjećaj brzine

#### UX-23 · Splash traje fiksno 2,5 s — NISKO

`App.tsx:68-74`: `setTimeout(..., 2500)` bez veze sa stvarnom spremnošću (i18n, token). Na uređaju
gdje je token već učitan, korisnik čeka 2,5 s bez razloga. `expo-splash-screen` se ne koristi.

---

## 3. Šta je dobro i ne treba dirati

Da refaktor ne pokvari ono što radi:

- **`constants/routes.ts`** — jedinstveni izvor imena ruta, s komentarom zašto je nastao. Ostaje.
- **Deep link prefiksi `myapp://`** — instalirane verzije ih očekuju. Ostaju.
- **Query keys i polling** (`services/query/keys.ts`, `polling.ts`) — `dashboardRefetchInterval`
  svjesno ne polla u pozadini (MO2-13). Ostaje.
- **Error handling** (`services/api/error.handler.ts`) — `showError` s i18n fallbackom. Ostaje,
  samo dobija bolji vizuelni okvir.
- **`Skeleton` primitiv** — već postoji i već se koristi u Analitici; samo se širi.
- **12 test suite-ova** — NativeWind testovi provjeravaju da ekrani koriste primitive. Refaktor
  mora ih zadržati zelenim; to je i najbolja zaštita od regresije.

---

## 4. Predloženi pravac (detalji u prototipu)

1. **jedan jezik s webom** — canvas/panel/line/ink/signal/ok/warn/fault, dvije teme, hex samo u `tokens.ts`;
2. **nula sjena, hairline ivice, radijus 2–4 px**;
3. **brojevi mono i tabularni** (`Readout`), tekst sistemski sans;
4. **brand signal samo za akciju, fokus i živo stanje** — ne za ukras;
5. **jedna traka tabova**, `ScreenHeader` na svakom push ekranu;
6. **skeleton po obliku sadržaja** na svih 7 ekrana sa spinnerom;
7. **nijedna brojčana tvrdnja bez izvora podataka**.

---

## 5. Plan (F0–F4)

Detaljna tabela je u prototipu (§10). Kratko:

| Faza | Obim | Rizik |
|---|---|---|
| **F0** Temelj | `tokens.ts` + 11 UI primitiva, paralelno sa starim komponentama | nizak |
| **F1** Navigacija i jezik | jedan tab bar, `ScreenHeader`, 3 ekrana prevedena, naslovi iz `t()` | nizak |
| **F2** Glavni ekrani | Početna, Grijanje, Plin, Postavke | srednji |
| **F3** Analitika i grafovi | fiktivne metrike van, chart-kit → `react-native-svg` | srednji |
| **F4** Završnica | skeleton svuda, a11y, `userInterfaceStyle`, sheet, čišćenje | nizak |

Provjera nakon svake faze: `npm run type-check`, `npm test`, `npm run lint`, ručno na 360/430 px
u obje teme i oba jezika.

---

## 6. Odluke koje tražim od tebe prije F1

1. **Broj tabova:** ostaje 4 (Početna, Grijanje, Plin, Postavke) ili ide 5 s „Sistem"
   (kotao + termostati + rasporedi)?
2. **Default tema:** dark kao na webu, ili pratiti sistem uz mogućnost izbora?
3. **Fiktivne metrike:** brisati odmah u F3, ili ostaviti dok backend ne vrati normalizaciju?
4. **Font:** sistemski sans + mono (nula dodatnih kB i nula kašnjenja), ili `IBM Plex` kao na webu?
5. **Obim F1:** da li prijevod tri ekrana (~150–200 ključeva) ide u ovaj refaktor ili kao odvojen zadatak?
