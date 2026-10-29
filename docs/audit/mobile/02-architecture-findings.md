# Mobile arhitektura i nalazi — Faza 3

Svi nalazi koriste format iz sekcije 7 prompta. Pouzdanost: `VERIFIKOVANO` = pročitano u kodu ili pokrenuto; `HIPOTEZA` = izvedeno, treba potvrdu na uređaju/produkciji.

## Otvorena pitanja za vlasnika

- Je li CSV export analitike ikad radio u izdatoj verziji aplikacije, ili je funkcija stigla s prelaskom na Expo SDK 54? (MO-001)
- Koja verzija aplikacije je trenutno kod korisnika i da li backend deep link (`myapp://gas/add-reading`) ikad radio? (MO-002)
- Smije li se API ugovor mijenjati bez verzioniranja, s obzirom na to da ne postoji provjera minimalne verzije? (MO-004)
- Koji je mjerodavni backend host? (MO-005, isto otvoreno pitanje kao FE-009/B-029)
- Treba li health score i pravila alerte preseliti u backend (jedan izvor za web i mobile)? (MO-015)

## Top 5 nalaza ovog dokumenta

1. **MO-001** — CSV export analitike ne može uspjeti (legacy `expo-file-system` API).
2. **MO-002** — push deep link cilja nepostojeći ekran; cold-start tap se ne obrađuje.
3. **MO-014** — tri paralelna HTTP sloja i dva API direktorija.
4. **MO-015** — health score i alert pragovi izračunati u klijentu, različito od weba.
5. **MO-011** — NativeBase (maintenance mode) s React 19; dva sistema stilizacije.

---

### [MO-001] CSV export analitike koristi legacy `expo-file-system` API koji u SDK 54 baca grešku — Ozbiljnost: VISOKO — Pouzdanost: VERIFIKOVANO

- **Gdje:** `mobile/src/screens/analytics/AnalyticsScreen.tsx:3` (`import * as FileSystem from 'expo-file-system'`), `:129` (`const fileSystem = FileSystem as any`), `:133-141` (`ensureDirectory` → `getInfoAsync`, `deleteAsync`, `makeDirectoryAsync`), `:167-172` (`documentDirectory`/`cacheDirectory`/`temporaryDirectory`), `:185` (`writeAsStringAsync`).
- **Šta nije u redu i zašto je bitno:** Instalirani `expo-file-system` je **19.0.22**. U toj verziji top-level modul izvozi samo `Paths`, `File`, `Directory` i skup **deprecated stubova koji bacaju grešku u runtimeu** (`build/legacyWarnings.d.ts`). Direktorijske konstante `documentDirectory`, `cacheDirectory`, `temporaryDirectory` **uopšte nisu izvezene** — one postoje samo kao `Paths.documentDirectory` itd. Zbog `as any` casta TypeScript to ne vidi (zato `npm run type-check` prolazi). Posljedica: `candidates` niz je prazan → `if (!candidates.length)` → toast „storage unavailable" → korisnik **nikad** ne dobije CSV, iako backend (`GET /api/dashboard/export`) ispravno vrati sadržaj.
- **Dokaz:** `scripts/audit/mobile-probe/filesystem_api_probe.ts` + `tsconfig.json`; pokrenuto `cd mobile && npx tsc --noEmit -p ../scripts/audit/mobile-probe/tsconfig.json` → **exit 0**, što znači da su sve tri `@ts-expect-error` direktive bile potrebne (TS prijavljuje grešku na `FileSystem.documentDirectory`, `FileSystem.cacheDirectory`, `FileSystem.temporaryDirectory`). Dodatno: `node_modules/expo-file-system/src/legacyWarnings.ts:19-24` — `errorOnLegacyMethodUse(...)` + `throw`, npr. `makeDirectoryAsync` (linije 90-95). Za kontrast, `GasReadingsScreen.tsx:6` koristi **ispravnu** podputanju `expo-file-system/legacy`.
- **Preporuka:** Zamijeniti import u `AnalyticsScreen.tsx` s `import * as FileSystem from 'expo-file-system/legacy'` (najmanja promjena, isti API koji već radi u `GasReadingsScreen`), ili migrirati na `new FileSystem.File(...)`/`Paths.documentDirectory`. Ukloniti `as any` cast da TypeScript ubuduće hvata ovaj razred greške.
- **Kako provjeriti da je riješeno:** (1) `npx tsc --noEmit -p ../scripts/audit/mobile-probe/tsconfig.json` i dalje exit 0; (2) novi unit test s mockanim `expo-file-system/legacy` koji tvrdi da je `writeAsStringAsync` pozvan tačno jednom i da je `Share.share` pozvan s URI-jem koji završava na `.csv`; (3) ručno na uređaju: export → dijeljenje → CSV se otvori.
- **Trud:** S — **Zavisnosti:** nema; testna infrastruktura iz MO-012 korak je potreban za automatski test.

---

### [MO-002] Deep link iz push notifikacije cilja nepostojeći ekran; cold-start tap se ne obrađuje — Ozbiljnost: VISOKO — Pouzdanost: VERIFIKOVANO (kod) / HIPOTEZA (ponašanje na uređaju)

- **Gdje:** `backend/src/modules/Schedule/gas.reminder.service.ts:64,116,177` (`deepLink: 'myapp://gas/add-reading'`); `mobile/src/services/notifications/notificationService.ts:112-143` (`handleDeepLink`, posebno `:121-129`); `mobile/src/navigation/RootNavigator.tsx:28-50` (`linking` konfiguracija); `mobile/src/screens/gas/GasScreen.tsx:37-58` (stvarna imena ekrana); `mobile/src/screens/gas/GasReadingsScreen.tsx:66-70` (`openAddModal` param).
- **Šta nije u redu i zašto je bitno:** `handleDeepLink` poziva `navigationRef.navigate('Main', { screen: 'Gas', params: { screen: 'GasReadings', params: { openAddModal: true } } })`. Gas tab navigator registruje ekrane pod imenima **`Readings`** i **`Analysis`** — `GasReadings` ne postoji, pa React Navigation ne može riješiti cilj (upozorenje/„not handled"), a `openAddModal` parametar nikad ne stiže do `GasReadingsScreen`. Isti nesklad je u `linking.config` (`'add-reading': 'add-reading'`, `GasReadings: 'readings'`, `GasAnalysis: 'analysis'` — sva tri cilja su nepostojeća imena ekrana). Dodatno, `Notifications.getLastNotificationResponseAsync()` se **nikad ne poziva** (`grep` po `src` i `App.tsx`: 0 pogodaka), pa tap na notifikaciju dok je aplikacija ugašena ne pokreće navigaciju — obrađuju se samo notifikacije pristigle dok aplikacija radi.
- **Dokaz:** `grep -rn "getLastNotificationResponseAsync" src App.tsx` → „NOT USED". `grep -n "Tab.Screen" mobile/src/screens/gas/GasScreen.tsx` → `name="Readings"`, `name="Analysis"`. Backend: `grep -rn "deepLink" backend/src` → 3 pogotka, svi `myapp://gas/add-reading`.
- **Preporuka:** (1) Ispraviti cilj u `notificationService.ts` na `{ screen: 'Gas', params: { screen: 'Readings', params: { openAddModal: true } } }`; (2) uskladiti `linking.config` sa stvarnim imenima (`Gas: { screens: { Readings: 'readings', Analysis: 'analysis' } }`) i ukloniti `add-reading` granu ili je mapirati na `Readings` s parametrom; (3) u `App.tsx` pri mountu pozvati `Notifications.getLastNotificationResponseAsync()` i proslijediti rezultat istom `handleDeepLink`; (4) uvesti konstantu imena ekrana koju dijele navigator i servis, da se ovo ne ponovi.
- **Kako provjeriti da je riješeno:** Unit test nad `handleDeepLink` s lažnim `navigationRef` (tvrdi tačan objekt navigacije); test koji mapira svaki ekran iz `linking.config` na registrovana imena (može u `scripts/audit/mobile_inventory.py`); na uređaju: tap na push dok je app ugašen → otvara se ekran očitanja s otvorenim modalom.
- **Trud:** S — **Zavisnosti:** backend ne treba mijenjati (URL ostaje isti); testna infrastruktura MO-012.

---

### [MO-010] `SecureStorage` na web platformi tiho pada na nešifrirani AsyncStorage; `Platform.OS` nije provjera dostupnosti — Ozbiljnost: SREDNJE — Pouzdanost: VERIFIKOVANO (kod) / HIPOTEZA (uticaj)

- **Gdje:** `mobile/src/services/storage/SecureStorage.ts:13` (`private isSecureStoreAvailable = Platform.OS !== 'web'`), `:17-22`, `:31-35`, `:44-48`.
- **Šta nije u redu i zašto je bitno:** Jedini kriterij je operativni sistem. Na webu (a `npx expo config` potvrđuje da je `web` u `platforms`) JWT se upisuje u `AsyncStorage` (localStorage) nešifriran — isti razred rizika kao FE-002 na web frontendu. Također, na Android uređaju bez podrške za Keystore (stariji/jeftiniji uređaji, neki emulatori) `SecureStore` baca grešku koja se hvata i **proguta** (`getToken` vraća `null` → korisnik je iznenada odjavljen; `setToken` baca → login padne bez jasne poruke). Nema fallbacka ni dijagnostike.
- **Dokaz:** Kod na navedenim linijama; `console.warn('SecureStore not available, falling back to AsyncStorage')` na liniji 20 je jedini signal. `npx expo config --type public --json` → `"platforms":["ios","android","web"]`.
- **Preporuka:** (1) Izbaciti `web` iz `platforms` dok se ne odluči da li se web izdanje uopšte podržava (web već postoji kao zaseban frontend); (2) umjesto `Platform.OS` koristiti stvarnu provjeru (`SecureStore.isAvailableAsync()` gdje je dostupno) i eksplicitno odbiti prijavu uz jasnu poruku ako sigurno skladište nije dostupno; (3) ne gutati grešku u `getToken`.
- **Kako provjeriti da je riješeno:** Unit test: mock `SecureStore.setItemAsync` koji baca → `login` odbija uz jasnu poruku, token se ne upisuje u AsyncStorage; assert da `AsyncStorage.setItem` nije pozvan s ključem `boiler_auth_token`.
- **Trud:** S — **Zavisnosti:** odluka vlasnika o web izdanju; usklađeno s FE2-2 (httpOnly cookie + refresh).

---

### [MO-011] NativeBase (maintenance mode) uz React 19 i dva sistema stilizacije — Ozbiljnost: SREDNJE — Pouzdanost: VERIFIKOVANO

- **Gdje:** `mobile/package.json` (`native-base ^3.4.28`, `react 19.1.0`, `nativewind ^4.0.0`, `tailwindcss ^3.4.0` u devDependencies); `mobile/App.tsx:5,36-42` (`NativeBaseProvider` + `LogBox.ignoreLogs`); `mobile/babel.config.js` (`jsxImportSource: 'nativewind'` + `nativewind/babel`); `mobile/src/navigation/RootNavigator.tsx:18-20` i `MainTabNavigator.tsx:13-15` (ručni `BackHandler` polyfill).
- **Šta nije u redu i zašto je bitno:** NativeBase 3 je u održavanju i ne podržava React 19 — `npm ci` to eksplicitno upozorava („Conflicting peer dependency: react@17.0.2 … from @react-types/tabs@3.0.0-alpha.2"). Aplikacija to zaobilazi tako što **potiskuje dva upozorenja** u `LogBox` (`SafeAreaView has been deprecated…`, `SSRProvider is not necessary…`) i ručno zakrpljuje `BackHandler.removeEventListener` na dva mjesta. Istovremeno je NativeWind konfigurisan u Babelu, ali u repozitoriju **ne postoji `tailwind.config.js`** (`ls mobile` to potvrđuje), pa je nejasno da li se ijedna Tailwind klasa stvarno primjenjuje — plaća se cijena dva sistema stilizacije bez jasne koristi od drugog.
- **Dokaz:** Izlaz `npm ci` (sačuvan u `/tmp/mobile_npm_ci.log` tokom audita); `App.tsx:36-42`; `find mobile -name 'tailwind.config*'` → nema rezultata.
- **Preporuka:** Odlučiti jedan sistem. Realan put: (1) izmjeriti koliko NativeBase komponenti se stvarno koristi (inventar u `01-inventory.md` pokazuje da su to uglavnom layout primitivi + `useColorModeValue` + `useToast` + `Select`/`Modal`/`Slider`); (2) zamijeniti ih `@gluestack-ui` ili čistim RN komponentama po ekranu, uz vizuelne snapshot testove; (3) ukloniti NativeWind iz Babela ako se ne koristi, ili dodati `tailwind.config.js` i prebaciti styling dosljedno. U međuvremenu: ne dodavati nove NativeBase komponente.
- **Kako provjeriti da je riješeno:** `npm ls native-base` vraća prazno; `LogBox.ignoreLogs` više ne sadrži NativeBase upozorenja; `BackHandler` polyfill uklonjen; snapshot testovi po ekranu prolaze u oba moda.
- **Trud:** L — **Zavisnosti:** MO-012 (testovi/snapshoti moraju postojati prije migracije), MO-017 (a11y se rješava usput).

---

### [MO-012] Lint i test skripte su deklarisane ali ne rade; nema nijednog testa — Ozbiljnost: SREDNJE — Pouzdanost: VERIFIKOVANO (pokrenuto)

- **Gdje:** `mobile/.eslintrc.js:2` (`extends: ['expo', 'prettier']`); `mobile/package.json:10` (`"test": "jest"`), `devDependencies` (nema `eslint-config-expo`, `eslint-config-prettier`, `jest`, `jest-expo`, `@testing-library/react-native`).
- **Šta nije u redu i zašto je bitno:** `npm run lint` → **exit 2**: „ESLint couldn't find the config "expo" to extend from". `npm test` → **exit 127**: „sh: 1: jest: not found". Nema `jest.config.js`, nema `__tests__`, nema `*.test.*` fajlova. To znači da nijedna od 27 nalaza u ovom auditu nema regresijsku zaštitu, a CI za mobile (za razliku od backend branch-only workflowa) ne postoji.
- **Dokaz:** Stvarni izlazi komandi iz tabele „Testovi i izvođenje" u `01-inventory.md`; `grep -c jest mobile/package.json` → 1 (samo skripta).
- **Preporuka:** Dodati `jest-expo`, `jest`, `@testing-library/react-native`, `eslint-config-expo`, `eslint-config-prettier` u `devDependencies`; `jest.config.js` s `preset: 'jest-expo'`; prve testove napisati za čistu logiku koja ne traži native module: `error.handler.parseApiError`, `GasForm` validacija, filteri u `GasReadingsScreen.getFilteredReadings`, `getDateRange` iz `AnalyticsScreen`, deep link mapiranje (MO-002). Lint pokrenuti bez `--fix` i zabilježiti broj nalaza prije bilo kakvog automatskog ispravljanja.
- **Kako provjeriti da je riješeno:** `npm run lint` i `npm test` exit 0 u branch-only CI koraku; izvještaj o pokrivenosti za `src/services` i `src/components/gas`.
- **Trud:** M — **Zavisnosti:** odluka o CI workflowu (MO-005, korak 1.1 plana).

---

### [MO-013] Mrtav kod: provider bez upotrebe, 9 nekorištenih API metoda, nepostojeći query ključ — Ozbiljnost: NISKO — Pouzdanost: VERIFIKOVANO

- **Gdje:** `mobile/src/providers/BottomSheetProvider.tsx` (cijeli fajl); `mobile/src/theme/colors.ts` (cijeli fajl); `mobile/src/services/api/client.ts` → `getLatestGasReading`, `addGasReading`, `addGasReadingPayload`, `getBoilerHistory`, `getRecommendations`, `getDashboardHeatingStatus`; `mobile/src/api/dashboard.api.ts` → `getHeatingEvents`, `getHeatingStats`, `getLearningTrends`; `mobile/src/services/api/thermostat.api.ts` → `getDeviceById`, `updateDevice`; `mobile/src/services/notifications/notificationService.ts:32` (`setNavigationRef`), `:181-202` (deprecated no-op funkcije); `mobile/src/screens/notifications/NotificationsScreen.tsx:94` (invalidacija ključa `notifications-unread-count` koji nigdje ne postoji).
- **Šta nije u redu i zašto je bitno:** `BottomSheetProvider` duplicira `GestureHandlerRootView` koji već postoji u `App.tsx:78`, a niko ga ne importira. Nekorištene API metode sugeriraju funkcionalnosti koje ne postoje (npr. `getRecommendations` → mobile nikad ne prikazuje preporuke, iako backend ima `GET /api/recommendations`). Invalidacija nepostojećeg ključa je bezopasna, ali signalizira kopirani kod s weba.
- **Dokaz:** `grep -rn "\.getRecommendations(\|\.getBoilerHistory(\|\.getLatestGasReading(\|\.addGasReading(\|\.addGasReadingPayload(\|\.getDashboardHeatingStatus(" src App.tsx` (bez `client.ts`) → 0 pogodaka; `grep -rn "BottomSheetProvider" src App.tsx` → samo definicija; `grep -rn "notifications-unread-count" src` → samo `NotificationsScreen.tsx:94`.
- **Preporuka:** Obrisati `BottomSheetProvider.tsx` i `theme/colors.ts`; ukloniti nekorištene metode ili ih stvarno upotrijebiti (preporuke su smislena funkcionalnost — vidjeti MO-015 i plan 4.x); ukloniti mrtvu invalidaciju; deprecated no-op funkcije zamijeniti stvarnom implementacijom ili obrisati (Settings prekidač koji ih poziva je MO-008).
- **Kako provjeriti da je riješeno:** `npm run type-check` exit 0 nakon brisanja (dokaz da niko ne ovisi o njima); lint pravilo `no-unused-vars` (nakon MO-012) ne prijavljuje nove slučajeve.
- **Trud:** S — **Zavisnosti:** MO-012.

---

### [MO-014] Tri paralelna HTTP sloja i dva API direktorija — Ozbiljnost: SREDNJE — Pouzdanost: VERIFIKOVANO

- **Gdje:** `mobile/src/services/api/client.ts:12-20` (axios instanca + interceptori); `mobile/src/services/api/homeProfile.api.ts:78-88` (`getClient()` pravi **novu** axios instancu pri svakom pozivu); `mobile/src/services/api/thermostat.api.ts:28-38` (isto); `mobile/src/api/dashboard.api.ts` (četvrti sloj, u drugom direktoriju).
- **Šta nije u redu i zašto je bitno:** Samo `client.ts` ima 401 interceptor koji čisti token i `Authorization` interceptor. `homeProfile.api.ts` i `thermostat.api.ts` čitaju token ručno pri svakom pozivu i **nemaju 401 obradu** — istek tokena na tim ekranima (`HomeManagementScreen`, `ScheduleManagementScreen`, `AnalyticsScreen`) ne odjavljuje korisnika nego prikazuje sirovu grešku. Nova instanca po pozivu znači i novi spoj po zahtjevu (bez keep-alive dijeljenja) te dupliranje timeout/logike. `src/api/` uz `src/services/api/` ruši konvenciju i otežava generisanje tipova iz OpenAPI-ja.
- **Dokaz:** `grep -n "axios.create" mobile/src -r` → 3 pogotka (`client.ts:16`, `homeProfile.api.ts:80`, `thermostat.api.ts:30`); `grep -n "interceptors" mobile/src -r` → samo `client.ts:24,38`.
- **Preporuka:** Sve pozive prebaciti na jednu instancu iz `client.ts` (ili na budući generisani OpenAPI klijent), spojiti `src/api/dashboard.api.ts` u `src/services/api/`, ukloniti ručno čitanje tokena. Kao privremenu mjeru dodati 401 interceptor u preostale dvije instance.
- **Kako provjeriti da je riješeno:** `grep -rn "axios.create" mobile/src` vraća tačno 1 rezultat; test: mock odgovor 401 na `homeProfileApi.getAllHomeProfiles` → token je obrisan i korisnik odjavljen.
- **Trud:** M — **Zavisnosti:** MO-012; usklađeno s FE2-8 (OpenAPI codegen) i backend korakom 0.4.

---

### [MO-015] Health score i pravila za alerte izračunati u klijentu, različito od weba — Ozbiljnost: SREDNJE — Pouzdanost: VERIFIKOVANO

- **Gdje:** `mobile/src/screens/dashboard/DashboardScreen.tsx:32-33` (`MIN/MAX_CURRENT_FLOW_TEMP = 48/55`), `:151-222` (`clamp` + `calculateSystemHealthMetrics` s težinama 35/25/…/15 i `flowDelta * 12.5`); `mobile/src/components/AlertsCard.tsx:29-56` (pragovi `tempDiff > 5` critical / `> 2` warning), `:66-92` (`lastSeen` 24 h / 1 h), `:100-110` (`avgConfidence < 0.3`); `mobile/src/components/BoilerStatusCard.tsx:88` (`tempDiff <= 2` = optimalno).
- **Šta nije u redu i zašto je bitno:** Isti „zdravlje sistema" broj i isti alerti postoje i na webu (FE-010) s **drugačijim granicama** (web `DashboardPage` koristi 46–55, `BoilerPage` 48–55). To znači da dva klijenta mogu prikazati različitu ocjenu za iste podatke, a svaka promjena formule zahtijeva sinhronizaciju na tri mjesta. Težine (35/25/15) i množilac 12.5 nemaju dokumentovano fizikalno značenje niti test.
- **Dokaz:** Kod na navedenim linijama; poređenje s `docs/audit/frontend/02-architecture-findings.md` (FE-010) i `04-ux-quality.md`.
- **Preporuka:** Preseliti izračun u backend (`GET /api/dashboard` već vrača `system.boiler` i `learningIntervals` — dodati `health: { score, confidence, components[] }` i `alerts: []`), a klijente svesti na prikaz. Do tada: izdvojiti formulu u jedan dijeljeni modul s golden-file testovima (isti ulaz → isti izlaz na webu i mobilnom) i uskladiti granice 48–55 na svim mjestima.
- **Kako provjeriti da je riješeno:** Property test: za 20 fiksiranih dashboard fixturea web i mobile daju identičan score i identičan skup alert ID-eva; nakon prebacivanja u backend — klijentski kod ne sadrži numeričke pragove (`grep` za `12.5`, `> 5`, `< 0.3` vraća 0).
- **Trud:** M — **Zavisnosti:** backend dashboard koraci (Faza 1 plan 5.x), FE2-14; MO-012.

---

### [MO-026] Backend oblikuje odgovor prema mobilnom klijentu; `GET /api/home-profiles` ima side effect — Ozbiljnost: NISKO — Pouzdanost: VERIFIKOVANO

- **Gdje:** `backend/src/modules/HomeProfile/home.profile.service.ts:38-66` (mapiranje s komentarom `// Mobile app expected fields`, uključujući `name`, `isActive`, `thermostats`, `location` s fallbackom `'No location set'`), `:29-36` (`prisma.user.update` unutar `findAll`); potrošač: `mobile/src/screens/home/HomeManagementScreen.tsx:171-175,364-386`.
- **Šta nije u redu i zašto je bitno:** (1) API ugovor je spregnut s jednim klijentom — `name` i `homeName` su duplirana polja, `location` može biti doslovni string `'No location set'`, koji mobilna forma pri uređivanju može **upisati nazad u bazu** kao stvarnu lokaciju (`openEditModal` uzima `home.location || ''`). (2) `findAll` (GET) upisuje `user.activeHomeProfileId` ako je `null` — čitanje liste mijenja stanje, što je iznenađujuće i onemogućuje sigurno keširanje. (3) `openEditModal` koristi `home.X || default` pa legitimna `false`/`0` vrijednost postaje default (npr. `hasFloorHeating: false` → `false`, ali `numberOfResidents: 0` → `2`).
- **Dokaz:** Kod na navedenim linijama; `grep -n "Mobile app expected fields" backend/src -r`.
- **Preporuka:** (1) Uvesti eksplicitan DTO/serializer umjesto ad-hoc mapiranja i ukloniti duplikat `name`/`homeName`; (2) `location` vratiti kao `null` umjesto placeholder teksta; (3) side effect premjestiti u `PATCH /api/home-profiles/:id/activate` ili u migraciju; (4) u mobilnoj formi koristiti `?? ` umjesto `||`.
- **Kako provjeriti da je riješeno:** Contract test: `GET /api/home-profiles` ne mijenja `user.activeHomeProfileId` (assert prije/poslije); test: profil s `location: null` → forma prikazuje prazno polje, a ne „No location set".
- **Trud:** M — **Zavisnosti:** backend plan (Faza 1), FE-017 (web forma), MO-012.

---

### [MO-027] Polling bez pauze u pozadini i dupliranje istog endpointa pod dva ključa — Ozbiljnost: NISKO — Pouzdanost: VERIFIKOVANO

- **Gdje:** `mobile/src/screens/heating/HeatingScreen.tsx:76-92` (`queryKey: ['dashboard-heating']`, `refetchInterval: 60_000`); `mobile/src/screens/dashboard/DashboardScreen.tsx:57-62` (`queryKey: ['dashboard']`, isti `apiClient.getDashboard`); `mobile/App.tsx:22-31` (globalni `staleTime` 5 min, `refetchOnWindowFocus: false`).
- **Šta nije u redu i zašto je bitno:** `refetchInterval` u React Query v5 nastavlja raditi i kad aplikacija ode u pozadinu (nema `AppState` integracije — `grep -rn "AppState" src App.tsx` → 0 pogodaka), što troši bateriju i podatke. Isti endpoint `/dashboard` dohvata se pod dva različita ključa, pa se keš ne dijeli i dva ekrana mogu prikazati različite podatke. `API_CONFIG.RETRY_ATTEMPTS = 2` (`api.config.ts:44`) se nikad ne koristi — stvarni retry je samo React Query `retry: 2`.
- **Dokaz:** Kod na navedenim linijama; `grep -rn "AppState\|NetInfo" src App.tsx` → nema pogodaka.
- **Preporuka:** Jedan query ključ `['dashboard']` za oba ekrana; `refetchInterval` kao funkcija koja vraća `false` kad `AppState.currentState !== 'active'`; ukloniti nekorišteni `RETRY_ATTEMPTS` ili ga stvarno primijeniti u axios interceptoru.
- **Kako provjeriti da je riješeno:** Test s mockanim `AppState`: prelazak u `background` zaustavlja refetch; test brojanja poziva: oba ekrana dijele jedan dohvat po `staleTime` prozoru.
- **Trud:** S — **Zavisnosti:** MO-012.
