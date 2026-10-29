# Plan implementacije — mobile (Faza 3)

Plan je serija **malih commitova na aktivnoj grani** (`arena/1bfee051-boiler-control`), bez PR-ova i bez pusha prema `main` (pravilo 0a). Svaki korak je samostalno izvodiv i povratljiv. **Ovo je prijedlog, ne odobrenje za izvođenje.**

## Otvorena pitanja za vlasnika

- Redoslijed izdanja: MO2-2 (gate) mora prethoditi backend promjenama ugovora — da li je to prihvatljivo?
- Ciljne vrijednosti performansi (MO2-13) i minimalni uređaji/OS verzije za testiranje.
- Da li se `native-base` migracija (MO2-14) radi u ovom ciklusu ili se samo zamrzava?
- Store nalog i kredencijali za `eas submit` (ne smiju u repozitorij).

## Talas 0 — hitno: funkcionalnost koja ne radi

### 0.1 Ispravka CSV exporta (MO2-22 / MO-001)
- **Cilj/fajlovi:** `mobile/src/screens/analytics/AnalyticsScreen.tsx:3` → `import * as FileSystem from 'expo-file-system/legacy'`; ukloniti `const fileSystem = FileSystem as any` (`:129`) i koristiti tipizirani import; ostaviti `ensureDirectory`/`writeAsStringAsync`/`Share.share` tok.
- **Migracija/rollback, flag:** bez migracije baze; bez flaga; rollback = revert jednog commita.
- **Testovi:** unit (mock `expo-file-system/legacy`): `writeAsStringAsync` pozvan jednom s URI-jem koji završava `.csv`, `Share.share` pozvan s istim URI-jem; negativni: `meta.contentType` nije CSV → toast „unexpected format", bez pisanja; e2e (nakon 1.3): export → dijeljenje. **Skripte:** `npx tsc --noEmit -p ../scripts/audit/mobile-probe/tsconfig.json` (regresija API-ja), `scripts/test-all.sh --help` (planiran).
- **Prihvat/trud/kompatibilnost/zavisnosti:** prihvat = export funkcionalan + zelen type-check + testovi; S; bez promjene ugovora (stare verzije i dalje ne rade, ali se ne lome); zavisno od 1.3 za automatski test.

### 0.2 Deep link i cold-start notifikacija (MO2-3 / MO-002)
- **Cilj/fajlovi:** `mobile/src/services/notifications/notificationService.ts:112-143` (cilj `{screen:'Gas', params:{screen:'Readings', params:{openAddModal:true}}}`), `mobile/src/navigation/RootNavigator.tsx:28-50` (`linking.config` sa stvarnim imenima), `mobile/App.tsx:44-56` (pozvati `Notifications.getLastNotificationResponseAsync()` i proslijediti `handleDeepLink`), novi `src/navigation/screenNames.ts` (zajedničke konstante).
- **Migracija/rollback, flag:** bez flaga; tokom prelaza podržati i `myapp://` i novu shemu (MO2-2/04); rollback = revert.
- **Testovi:** unit: `handleDeepLink('myapp://gas/add-reading')` tvrdi tačan navigacijski objekt; unit: `handleDeepLink` za `dashboard`/`heating`/`gas`; statički: svaki cilj iz `linking.config` postoji u navigatorima (može u `mobile_inventory.py`); integracijski na uređaju: tap na push dok je app ugašen. **Skripte:** `python3 scripts/audit/mobile_inventory.py --help`.
- **Prihvat/trud/kompatibilnost/zavisnosti:** prihvat = 0 nepostojećih ciljeva + cold-start radi; S; backend URL ostaje isti; zavisno od 1.3 za testove.

### 0.3 Prikaz grešaka korisniku (MO2-5 / MO-018)
- **Cilj/fajlovi:** `mobile/src/services/api/error.handler.ts:95-127` (stvarni toast preko `useToast`, `console.error` samo u `__DEV__`), `:132-144` (`showErrorToast`); potrošači se ne mijenjaju (11 poziva ostaje).
- **Migracija/rollback, flag:** bez flaga; rollback = revert.
- **Testovi:** unit: `parseApiError` za 400/401/403/404/409/422/500/mrežnu grešku → očekivani `userMessage` (iz `errors.*` resursa); komponentni: `showError(new AxiosError(...))` renderuje toast; e2e: backend 500 na `PATCH /boiler/current-temp` → vidljiva poruka. **Skripte:** `scripts/test-all.sh --help` (planiran).
- **Prihvat/trud/kompatibilnost/zavisnosti:** prihvat = nijedan `showError` poziv bez vidljivog efekta; S; zavisno od 1.3 (test infra) i 2.1 (tekstovi).

### 0.4 Jedan HTTP sloj i čišćenje mrtvog koda (MO2-4 / MO-013, MO-014)
- **Cilj/fajlovi:** `mobile/src/services/api/homeProfile.api.ts:78-88` i `thermostat.api.ts:28-38` → koristiti instancu iz `client.ts`; `mobile/src/api/dashboard.api.ts` spojiti u `src/services/api/dashboard.api.ts` (ažurirati import u `DashboardScreen.tsx:20`); obrisati `src/providers/BottomSheetProvider.tsx`, `src/theme/colors.ts`, 6 nekorištenih metoda `client.ts`, mrtvu invalidaciju u `NotificationsScreen.tsx:94`, no-op funkcije u `notificationService.ts:181-202`.
- **Migracija/rollback, flag:** bez flaga; rollback = revert; brisanje ide u malim commitovima po fajlu.
- **Testovi:** `npm run type-check` exit 0 (dokaz da niko ne ovisi o obrisanom); unit: mock 401 na `homeProfileApi.getAllHomeProfiles` → token obrisan i korisnik odjavljen; `grep -rn "axios.create" mobile/src` → 1. **Skripte:** `python3 scripts/audit/mobile_inventory.py --help`.
- **Prihvat/trud/kompatibilnost/zavisnosti:** prihvat = jedna instanca + zelen type-check; M; zavisno od 1.3; priprema za OpenAPI codegen (backend API-2).

### 0.5 Stvarne postavke obavijesti (MO2-6 / MO-008)
- **Cilj/fajlovi:** `mobile/src/screens/settings/SettingsScreen.tsx:37-39,56-71,250-303` (vezati na `apiClient.getNotificationPreferences`/`updateNotificationPreference` ili ukloniti prekidače), `mobile/src/services/notifications/notificationService.ts:181-202` (obrisati no-op).
- **Migracija/rollback, flag:** bez migracije; rollback = revert; bez flaga.
- **Testovi:** unit: prebacivanje poziva `updateNotificationPreference` s tipom `GAS_READING_REMINDER`; komponentni: ponovni ulazak u ekran prikazuje backend stanje, ne `true`; negativni: nepostojeći tip se ne šalje. **Skripte:** `scripts/test-all.sh --help`.
- **Prihvat/trud/kompatibilnost/zavisnosti:** prihvat = nijedan prekidač bez efekta; M; zavisno od 0.3 (poruke) i backend DTO validacije (B-010).

### 0.6 Odjava push tokena (MO2-7 / MO-003)
- **Cilj/fajlovi:** backend `src/modules/Notification/notifications.controller.ts` + servis (novi `DELETE /api/notifications/register-token`), `mobile/src/context/AuthContext.tsx:122-132` (pozvati prije brisanja lokalnog tokena), `:146-162` (razlikovati odbijenu dozvolu od mrežne greške, ponoviti pri sljedećem pokretanju).
- **Migracija/rollback, flag:** flag `PUSH_UNREGISTER_ENABLED` default off dok backend endpoint nije u produkciji; rollback = flag off (mobile nastavlja stari tok).
- **Testovi:** backend integracijski: registracija → odjava → `notifyUser` ne šalje na taj token; mobile unit: mrežni pad pri registraciji ne lomi prijavu; e2e: odbijena dozvola → objašnjenje i dugme ka sistemskim postavkama. **Skripte:** `node scripts/audit/push_registration_repro.cjs --help` (postojeća reprodukcija iz Faze 1, prilagoditi), `scripts/test-all.sh --help`.
- **Prihvat/trud/kompatibilnost/zavisnosti:** prihvat = stari korisnik ne prima push nakon odjave; M; zavisno od backend REL-6 i 1.3.

## Talas 1 — temelji

### 1.1 Jedan API host (MO2-1 / MO-005)
- **Cilj/fajlovi:** `mobile/src/config/api.config.ts:18-40` (dev fallback = eksplicitna greška ili `localhost`/`10.0.2.2`), `mobile/.env.example`, `mobile/docs/API_CONFIG.md` (uskladiti ili obrisati — 5.1), `mobile/eas.json` + `app.config.js` (jedan izvor).
- **Migracija/rollback, flag:** bez flaga; rollback = revert; **zahtijeva vlasničku potvrdu hosta** prije commita.
- **Testovi:** unit: bez `EXPO_PUBLIC_API_URL` → jasna greška, ne pogađanje hosta; `grep -rn "ba101.top" mobile` vraća samo potvrđeni host; `npx expo config --type public --json` pokazuje očekivani `extra`. **Skripte:** `npx expo config --type public --json`, `scripts/smoke.sh --help` (planiran).
- **Prihvat/trud/kompatibilnost/zavisnosti:** prihvat = jedna vrijednost u svim izvorima; S; zavisno od odluke o topologiji (FE-009/B-029).

### 1.2 Gate minimalne verzije i jedan izvor verzije (MO2-2 / MO-004)
- **Cilj/fajlovi:** backend: novi endpoint (npr. `GET /api/app/version`) ili polje u `/api/auth/me`; mobile: `src/services/version/versionGate.ts` + blok ekran u `RootNavigator.tsx`, `app.config.js:9,79` (verzija iz `package.json`), `SettingsScreen.tsx:368` (iz `Constants.expoConfig.version`), `eas.json` (dodati `preview`, popuniti `submit` bez kredencijala u repu), opcionalno `expo-updates`.
- **Migracija/rollback, flag:** flag `VERSION_GATE_ENABLED` default off; rollback = flag off; endpoint je aditivan (ne lomi stare verzije).
- **Testovi:** backend: contract test za oblik odgovora; mobile unit: `minSupportedVersion` > trenutna → blok ekran i onemogućena navigacija; `expo config` i postavke prikazuju istu verziju; `eas build --profile preview --dry-run`. **Skripte:** `npx expo config --type public --json`, `scripts/smoke.sh --help`.
- **Prihvat/trud/kompatibilnost/zavisnosti:** prihvat = starija verzija blokirana uz jasnu poruku; M; **preduslov za API-1/API-2/SEC-4/FEAT-7**; zavisno od 1.1.

### 1.3 Test infrastruktura, lint i branch-only CI (MO2-8 / MO-012)
- **Cilj/fajlovi:** `mobile/package.json` (devDependencies: `jest`, `jest-expo`, `@testing-library/react-native`, `eslint-config-expo`, `eslint-config-prettier`; skripte), `mobile/jest.config.js` (novi), `mobile/test/**` (novi), `.github/workflows/mobile-audit.yml` (novi, **samo** `on.push.branches: [<aktivna grana>]` + `workflow_dispatch`).
- **Migracija/rollback, flag:** ne mijenja aplikacijski kod; rollback = revert; CI se ne pokreće na `main` ni na `pull_request`.
- **Testovi:** sam CI je test: `npm run lint` (bez `--fix`, zabilježiti broj nalaza), `npm run type-check`, `npm test` — prvi testovi: `parseApiError`, `GasForm` validacija (negativan broj, prazan unos, dupli dan), `getFilteredReadings` (week/month/year/custom), `getDateRange` iz `AnalyticsScreen`, deep link mapiranje (0.2). **Skripte:** `scripts/test-all.sh --help` (planiran: backend + frontend + mobile), `scripts/dev-up.sh --help` (planiran).
- **Prihvat/trud/kompatibilnost/zavisnosti:** prihvat = zelen CI na aktivnoj grani s bar 15 testova; M; temelj za sve ostale korake.

### 1.4 Pristupačnost i `testID` (MO2-9 / MO-017)
- **Cilj/fajlovi:** `mobile/src/components/FormInput.tsx` (obavezan `accessibilityLabel`), `DashboardScreen.tsx:297-326` (tri ikonska dugmeta), `SettingsScreen.tsx:135-176` (`SettingItem` → izdvojiti iz rendera + `accessibilityRole`/`State`), `HomeManagementScreen.tsx:432-441` (uredi/obriši), `testID` na ključnim kontrolama.
- **Migracija/rollback, flag:** bez flaga; rollback = revert.
- **Testovi:** statička provjera (skripta: `Pressable` s ikonom i bez teksta mora imati labele) → 0 nalaza; snapshot testovi (nakon 1.3); ručni TalkBack/VoiceOver prolazak kroz Dashboard/Settings/Gas zabilježen u izvještaju. **Skripte:** `python3 scripts/audit/mobile_inventory.py --help`.
- **Prihvat/trud/kompatibilnost/zavisnosti:** prihvat = 0 neobilježenih kontrola + e2e selektori stabilni; M; zavisno od 1.3 i 2.1.

## Talas 2 — UX i lokalizacija

### 2.1 i18n tri ekrana i čišćenje resursa (MO2-10 / MO-021, MO-022)
- **Cilj/fajlovi:** `mobile/src/locales/config.ts` (obrisati zalutali blok `:483-513`, dodati `homeProfile.*`/`schedule.*`/`profile.*` ključeve), `HomeManagementScreen.tsx`, `ProfileScreen.tsx`, `ScheduleManagementScreen.tsx`, `SettingsStackNavigator.tsx:39,47,55,63`, `constants/homeProfileEnums.ts:38-56`, `AnalyticsScreen.tsx:5` i `GasAnalysisScreen.tsx:16` (preći na `src/hooks/useTranslation`).
- **Migracija/rollback, flag:** bez flaga; resurs ključevi se samo dodaju (stari ostaju) → rollback = revert.
- **Testovi:** skripta: 0 ekrana bez `t()`, en/bs skupovi ključeva identični; snapshot u bs-BS za tri ekrana; e2e: jezik se mijenja bez ponovnog pokretanja i preživljava restart. **Skripte:** `python3 scripts/audit/mobile_inventory.py --help`, `python3 scripts/audit/mobile_selfcheck.py --help`.
- **Prihvat/trud/kompatibilnost/zavisnosti:** prihvat = bs-BS prolazak bez engleskog teksta; M; zavisno od 1.3.

### 2.2 `ProfileScreen` v2 (MO2-11 / MO-009)
- **Cilj/fajlovi:** `mobile/src/screens/profile/ProfileScreen.tsx` (React Query `['user-profile']`, mutacija za snimanje, PDV iz odgovora, `setUser` bez spreada nad `null`), backend `GET/PUT /api/user` (vratiti `gasPriceIncVat`/stopu).
- **Migracija/rollback, flag:** bez flaga; rollback = revert; backend polje je aditivno.
- **Testovi:** unit: jedan dohvat po ulasku (keš), mutacija invalidira ključ; unit: `gasPriceIncVat` prikazan bez lokalne aritmetike; e2e: bs-BS + snimanje cijene. **Skripte:** `scripts/test-all.sh --help`.
- **Prihvat/trud/kompatibilnost/zavisnosti:** prihvat = bez hardcoded PDV-a i bez ručnog `useEffect`; M; zavisno od 2.1, backend FEAT-3, FE-020.

### 2.3 Dokumentacija koja odgovara kodu (MO2-18 / MO-007)
- **Cilj/fajlovi:** `mobile/README.md` (stvarne skripte, stvarna struktura), `mobile/docs/API_CONFIG.md` (uskladiti s 1.1 ili obrisati), `mobile/PHASE_3_GUIDE.md` (ispraviti navigaciju ili arhivirati), `docs/audit/00-cleanup-log.md` (zabilježiti odluku).
- **Migracija/rollback, flag:** nema; dokumentacijski commit.
- **Testovi:** provjera: svaka komanda iz `README.md` postoji u `package.json` (skripta); `grep -rn "npm run build" mobile/README.md` → 0; struktura u README odgovara `find mobile/src -type d`. **Skripte:** `python3 scripts/audit/mobile_inventory.py --help`.
- **Prihvat/trud/kompatibilnost/zavisnosti:** prihvat = 0 tvrdnji bez pokrića u kodu; S; zavisno od 1.1.

### 2.4 Uklanjanje fiktivnih metrika (MO2-19 / MO-016)
- **Cilj/fajlovi:** `mobile/src/screens/analytics/AnalyticsScreen.tsx:658` (naslov „AI Insights" + objašnjenje), `:712-736` (ukloniti blok „Performance Comparison" s konstantama `'12'` i `'18'`), `mobile/src/locales/config.ts` (ključevi `analytics.better`/`analytics.improvement` ostaju ali se ne koriste dok nema stvarnih podataka).
- **Migracija/rollback, flag:** bez flaga; rollback = revert; nema promjene ugovora.
- **Testovi:** `grep -rn "percent: '" mobile/src` → 0 pogodaka; snapshot test ekrana analitike s mock backendom (bez brojeva kojih nema u odgovoru); unit: `analytics.*` tekstovi se ne renderuju bez izvora podataka. **Skripte:** `scripts/test-all.sh --help` (planiran), `python3 scripts/audit/mobile_selfcheck.py --help`.
- **Prihvat/trud/kompatibilnost/zavisnosti:** prihvat = nijedna brojčana tvrdnja bez izvora; S; stare verzije i dalje prikazuju stare brojeve (vezano na MO2-2 gate); zavisno od 1.3.

## Talas 3 — performanse, kvalitet, privatnost

### 3.1 Liste, memoizacija i polling (MO2-13 / MO-023, MO-027)
- **Cilj/fajlovi:** `GasReadingsScreen.tsx` (lista → `FlatList` s `keyExtractor`), `RecentHeatingEvents.tsx`, `HomeManagementScreen.tsx`, `AnalyticsScreen.tsx:600-630`, `React.memo` na `BoilerStatusCard`/`ThermostatCard`/`AlertsCard`, `HeatingScreen.tsx:76-92` (jedan ključ `['dashboard']`, `refetchInterval` kao funkcija s `AppState`), `src/config/api.config.ts:44` (ukloniti nekorišteni `RETRY_ATTEMPTS`).
- **Migracija/rollback, flag:** bez flaga; rollback = revert po fajlu.
- **Testovi:** benchmark s 500 sintetičkih očitanja (vrijeme prvog rendera + FPS) zabilježen **prije i poslije**; unit: `AppState` → `background` zaustavlja refetch; unit: oba ekrana dijele jedan dohvat po `staleTime` prozoru; snapshot testovi bez vizuelnih regresija. **Skripte:** `scripts/test-all.sh --help`, planirani `scripts/mobile-perf.sh --help` (mjerenje, bez tajni).
- **Prihvat/trud/kompatibilnost/zavisnosti:** prihvat = izmjereno poboljšanje + zeleni snapshoti; M; zavisno od 1.3.

### 3.2 Migracija s NativeBase (MO2-14 / MO-011)
- **Cilj/fajlovi:** cijeli `mobile/src` (NativeBase komponente → odabrani sistem), `mobile/App.tsx:5,36-42` (ukloniti `NativeBaseProvider` i `LogBox.ignoreLogs` stavke), `RootNavigator.tsx:18-20` + `MainTabNavigator.tsx:13-15` (ukloniti `BackHandler` polyfill), `babel.config.js` (NativeWind odluka), `package.json`.
- **Migracija/rollback, flag:** migracija **po ekranu** (jedan ekran = jedan commit) iza privremenog feature flaga po ekranu; rollback = flag off za pojedini ekran.
- **Testovi:** snapshot testovi za svaki ekran u light i dark modu **prije** migracije (zlatna kopija), zatim poređenje poslije; vizuelni pregled na 3 veličine ekrana; `npm ls native-base` prazno na kraju; e2e smoke kroz sve rute. **Skripte:** `scripts/test-all.sh --help`, `scripts/smoke.sh --help`.
- **Prihvat/trud/kompatibilnost/zavisnosti:** prihvat = bez NativeBase zavisnosti i bez potisnutih upozorenja; L; **1.3 je preduslov**; usput rješava dio 1.4.

### 3.3 Permisije, cache i privatnost (MO2-16 / MO-025, MO-020, MO-019)
- **Cilj/fajlovi:** `mobile/app.config.js` (`expo-build-properties` → eksplicitan skup permisija), `GasReadingsScreen.tsx:308-386` (brisanje nakon otvaranja), `SettingsScreen.tsx:341-378` (stvarni „Clear cache" i „Export data" → PRIV-1), `docs/audit/backend/09-improvements-backlog.md` (PRIV-1 veza).
- **Migracija/rollback, flag:** bez flaga; rollback = revert; provjera finalnog `AndroidManifest.xml` u EAS buildu.
- **Testovi:** `npx expo config --type introspect --json` bez `RECORD_AUDIO`/legacy storage; unit: nakon `openLocalFile` pozvan `deleteAsync` nad istim URI-jem; e2e: „Clear cache" prazni direktorij; „Export data" pokreće backend izvoz (kad PRIV-1 postoji). **Skripte:** `npx expo config --type introspect --json`, `scripts/smoke.sh --help`.
- **Prihvat/trud/kompatibilnost/zavisnosti:** prihvat = minimalan skup permisija + nema trajnih kopija dokumenata; M; zavisno od PRIV-1 i vlasničke odluke o Play obrascu.

### 3.4 Ispravka `BottomSheetModal` (MO2-21 / MO-006)
- **Cilj/fajlovi:** `mobile/src/components/BottomSheetModal.tsx:12` (`title` prop), `:59-65` (`useEffect` expand/close), `:67` (rani `return null`); potrošači `DashboardScreen.tsx:384`, `GasReadingsScreen.tsx:835`/`:861`, `SettingsScreen.tsx:399` (prenijeti `title` gdje nedostaje).
- **Migracija/rollback, flag:** bez flaga (vizuelna ispravka unutar komponente, javni API nepromijenjen); rollback = revert.
- **Testovi:** unit: `isOpen: true → false` ne unmountuje `BottomSheet` u istom ticku i `close` jest pozvan prije uklanjanja; snapshot: `title` se pojavljuje u izlazu i ima `accessibilityRole="header"`; regresija: otvaranje ostaje animirano. **Skripte:** `python3 scripts/audit/mobile_selfcheck.py --help`.
- **Prihvat/trud/kompatibilnost/zavisnosti:** prihvat = zatvaranje animirano na iOS i Android + naslov vidljiv; S; stare verzije zadržavaju staro ponašanje (bez promjene ugovora); zavisno od 1.3 (testovi), poželjno nakon 3.1 (a11y).

## Talas 4 — funkcionalnosti (usklađeno s backend planom)

### 4.1 Health score i alerti iz backenda (MO2-12 / MO-015)
- **Cilj/fajlovi:** backend `Dashboard` (nova polja `health`, `alerts`), `mobile/src/screens/dashboard/DashboardScreen.tsx:151-222`, `components/AlertsCard.tsx`, `components/BoilerStatusCard.tsx:88`, `components/HealthScoreCard.tsx`; paralelno web FE2-14.
- **Migracija/rollback, flag:** `CLIENT_RULES_ENABLED` default **on** (stara logika) dok backend ne servira polja; rollback = flag on.
- **Testovi:** property/golden test: 20 fiksiranih dashboard fixturea → web i mobile daju identičan score i skup alert ID-eva; e2e: isključen flag → klijent ne sadrži pragove (`grep` za `12.5`, `> 5`, `< 0.3` → 0); contract test za nova polja. **Skripte:** `node scripts/audit/dashboard_repro.cjs --help` (Faza 1), `scripts/test-all.sh --help`.
- **Prihvat/trud/kompatibilnost/zavisnosti:** prihvat = jedan izvor istine; M; zavisno od backend FEAT-8 i 1.3.

### 4.2 Preporuka i „zašto ova temperatura" (MO2-15)
- **Cilj/fajlovi:** nova `mobile/src/components/RecommendationBreakdown.tsx`, mount u `DashboardScreen.tsx`/`BoilerStatusCard.tsx`, poziv `apiClient.getRecommendations` (trenutno mrtav), granice unosa iz odgovora umjesto `DashboardScreen.tsx:32-33`.
- **Migracija/rollback, flag:** `RECOMMENDATION_BREAKDOWN_ENABLED` default off; rollback = flag off.
- **Testovi:** komponentni test po varijanti breakdowna (mock odgovor); e2e: prikaz prati backend odgovor bez klijentske rekonstrukcije; disclaimer prisutan; granice 47.9/48/55/55.1 testirane. **Skripte:** `node scripts/audit/formula_table.cjs --help` (Faza 1), `scripts/test-all.sh --help`.
- **Prihvat/trud/kompatibilnost/zavisnosti:** prihvat = korisnik vidi razlog, a ne samo broj; M; zavisno od backend FORM-1/2.x i 1.2 (stare verzije).

### 4.3 Weather v2 (MO2-17)
- **Cilj/fajlovi:** `mobile/src/components/WeatherCard.tsx` (WMO mapiranje, starost), novi dijeljeni modul `weatherCodes.ts` (isti za web i mobile), `types/Weather.ts` (generisan iz OpenAPI), opciono novi ekran iza `DashboardStackNavigator`.
- **Migracija/rollback, flag:** `WEATHER_UI_V2` default off (isti flag kao FE2-9); legacy oblik ostaje dok backend tranzicija ne završi.
- **Testovi:** contract test s fixtureom iz `scripts/audit/fixtures/`; unit: WMO kod → ikona/tekst u bs i en; e2e: podaci stariji od dogovorenog praga → oznaka; ekran/kartica ne puca na `weather: null`. **Skripte:** `node scripts/audit/openmeteo_fixture_replay.cjs --help` (Faza 1), `node scripts/audit/weather_repro.cjs --help`.
- **Prihvat/trud/kompatibilnost/zavisnosti:** prihvat = tačna ikona i vidljiva starost; L; zavisno od backend FEAT-1/W-001–W-003, 1.2, 1.3.

### 4.4 Čist ugovor za profile domova (MO2-20 / MO-026)
- **Cilj/fajlovi:** backend `src/modules/HomeProfile/home.profile.service.ts:14-66` (DTO/serializer bez `// Mobile app expected fields`, `location: null`, side effect iz `findAll` premješten u `PATCH :id/activate`), `mobile/src/screens/home/HomeManagementScreen.tsx:364-386` (`??` umjesto `||`), `mobile/src/services/api/homeProfile.api.ts` (tipovi iz generisanog ugovora).
- **Migracija/rollback, flag:** flag `HOME_PROFILE_DTO_V2` default off; stari oblik odgovora ostaje dok web i mobile ne pređu; rollback = flag off.
- **Testovi:** backend contract test: `GET /api/home-profiles` **ne mijenja** `user.activeHomeProfileId` (assert prije/poslije); test: profil s `location: null` → mobilna forma prikazuje prazno polje; test: `numberOfResidents: 0` i `hasFloorHeating: false` ostaju svoje vrijednosti pri uređivanju (ne postaju default). **Skripte:** `scripts/test-all.sh --help`, `python3 scripts/audit/mobile_inventory.py --help`.
- **Prihvat/trud/kompatibilnost/zavisnosti:** prihvat = GET bez side effecta i bez placeholder teksta; M; zavisno od 1.2 (gate), FE-017 (web forma), MO2-8.

## Sljedivost svih backlog stavki prema planu

| Backlog ID | Korak(ovi) |
|---|---|
| MO2-1 | 1.1 |
| MO2-22 | 0.1 |
| MO2-2 | 1.2 |
| MO2-3 | 0.2 |
| MO2-4 | 0.4 |
| MO2-5 | 0.3 |
| MO2-6 | 0.5 |
| MO2-7 | 0.6 |
| MO2-8 | 1.3 |
| MO2-9 | 1.4 |
| MO2-10 | 2.1 |
| MO2-11 | 2.2 |
| MO2-12 | 4.1 |
| MO2-13 | 3.1 |
| MO2-14 | 3.2 |
| MO2-15 | 4.2 |
| MO2-16 | 3.3 |
| MO2-17 | 4.3 |
| MO2-18 | 2.3 |
| MO2-19 | 2.4 |
| MO2-20 | 4.4 |
| MO2-21 | 3.4 |

## Katalog pomoćnih skripti

**Postojeće audit skripte ne mijenjaju aplikaciju. Planirane skripte ne postoje — navedene komande su njihove buduće specifikacije.**

| Skripta | Status, svrha | Način / korak |
|---|---|---|
| `scripts/audit/mobile_inventory.py` | **Postoji (Faza 3):** read-only inventar `mobile/src` + provjera markera u `01-inventory.md` (ekrani, komponente, navigatori, API metode, i18n pokrivenost, deep link ciljevi). | `python3 scripts/audit/mobile_inventory.py --help`; koraci 0.2, 0.4, 1.4, 2.1, 2.3 |
| `scripts/audit/mobile_selfcheck.py` | **Postoji (Faza 3):** provjera formalnih markera u 7 mobilnih dokumenata i crosswalk backlog↔plan. | `python3 scripts/audit/mobile_selfcheck.py --help`; samoprovjera faze |
| `scripts/audit/mobile-probe/filesystem_api_probe.ts` + `tsconfig.json` | **Postoji (Faza 3):** tipki dokaz da `expo-file-system` 19.x ne izvozi direktorijske konstante (MO-001). | `cd mobile && npx tsc --noEmit -p ../scripts/audit/mobile-probe/tsconfig.json`; korak 0.1 |
| `scripts/test-all.sh` | PLAN: nepopravljajući lint + type-check + testovi za backend, frontend i mobile; izlaz != 0 na padu. | `scripts/test-all.sh --help`; svaki korak |
| `scripts/dev-up.sh` | PLAN: izolovani test PostgreSQL/Redis + mock backend za mobilne e2e testove; bez tajni u izlazu. | `scripts/dev-up.sh --help`; 1.3, 3.1 |
| `scripts/smoke.sh` | PLAN: build/provjera osnovnog toka (login → dashboard → unos očitanja) nad mock backendom. | `scripts/smoke.sh --help`; 1.2, 3.2, 3.3 |
| `scripts/mobile-perf.sh` | PLAN: mjerenje render vremena i FPS-a za zadati ekran s sintetičkim podacima (MO2-13). | `scripts/mobile-perf.sh --help`; 3.1 |
| `scripts/audit/push_registration_repro.cjs`, `dashboard_repro.cjs`, `formula_table.cjs`, `weather_repro.cjs`, `openmeteo_fixture_replay.cjs` | **Postoje (Faza 1):** offline reprodukcije backend ponašanja; koriste se kao kontekst/regresija. | `node <skripta> --help`; koraci 0.6, 4.1, 4.2, 4.3 |

## Registar rizika i rollout/rollback

| Rizik | Utjecaj | Vjerovatnoća | Ublažavanje |
|---|---|---|---|
| MO2-2 kasni, a backend mijenja ugovor → stare verzije pucaju | VISOK | SREDNJA | Gate je prvi korak talasa 1; backend promjene ugovora blokirane dok flag `VERSION_GATE_ENABLED` nije potvrđen u produkciji |
| MO2-14 (NativeBase) uvodi vizuelne regresije na 26 ekrana/komponenti | VISOK | SREDNJA | Snapshot testovi prije migracije, migracija po ekranu s flagom, e2e smoke svih ruta |
| MO2-1 (host) pogrešno postavljen → aplikacija u produkciji gađa dev backend | VISOK | NISKA | Vlasnička potvrda prije commita; bez env varijable aplikacija pada s jasnom greškom umjesto da pogodi |
| MO2-3 (deep link) promijeni shemu pa stari push linkovi ne rade | SREDNJE | SREDNJA | Dualni periodi (`myapp://` + nova shema), backend mijenja string tek nakon potvrde |
| MO2-13 (FlatList/memo) promijeni ponašanje scrolla i osvježavanja | SREDNJE | SREDNJA | Mjerenje prije/poslije, snapshot testovi, rollback po fajlu |
| MO2-16 (permisije) ukloni permisiju koju neki tok ipak koristi | SREDNJE | NISKA | Provjera finalnog `AndroidManifest.xml` i ručni test kamere/galerije/PDF pickera na uređaju |
| MO2-6/0.6 (postavke/token) promijene ponašanje pusha za postojeće korisnike | SREDNJE | NISKA | Flag `PUSH_UNREGISTER_ENABLED`, backend aditivan endpoint, test prije uključivanja |
| Nedostatak uređaja/emulatora u audit okruženju | SREDNJE | VISOKA | Sve što zahtijeva native modul označeno kao HIPOTEZA i prebačeno na ručnu provjeru vlasnika; nijedan takav nalaz nije predstavljen kao potvrđen |

**Rollout/rollback:** svaki korak je zaseban commit (ili mala serija) na aktivnoj grani; koraci s flagom se gase bez reverzije koda; talasi se izvode redom 0 → 1 → 2 → 3 → 4 uz navedene zavisnosti; ništa se ne deployuje u produkciju u okviru ovog plana — izdanje (EAS/store) ostaje vlasniku. **Plan nije odobrenje za aplikacijske izmjene.**
