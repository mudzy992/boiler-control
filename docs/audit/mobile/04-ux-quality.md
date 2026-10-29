# Mobile UX, lokalizacija i kvalitet koda — Faza 3

## Otvorena pitanja za vlasnika

- Trebaju li Settings prekidači za obavijesti biti stvarni (vezani na `NotificationPreference`) ili ih ukloniti? (MO-008)
- Koja je stvarna PDV stopa i treba li je backend vraćati umjesto hardcoded 17 %? (MO-009)
- Treba li `ProfileScreen` pratiti jezik aplikacije? (MO-021)
- Da li se „AI Insights" i komparacije s drugim domovima mogu prikazivati bez stvarnih podataka? (MO-016)
- Koji su minimalni zahtjevi pristupačnosti (TalkBack/VoiceOver) za ovo izdanje? (MO-017)

### [MO-006] `BottomSheetModal`: `if (!isOpen) return null` gasi komponentu prije animacije zatvaranja; `title` prop prihvaćen ali nikad renderovan — Ozbiljnost: NISKO — Pouzdanost: VERIFIKOVANO

- **Gdje:** `mobile/src/components/BottomSheetModal.tsx:67` (`if (!isOpen) return null;`), `:59-65` (`useEffect` koji na `!isOpen` poziva `bottomSheetRef.current?.close()`), `:12` (`title?: string;`). Potrošači: `DashboardScreen.tsx:384`, `GasReadingsScreen.tsx:835` i `:861`, `SettingsScreen.tsx:399`.
- **Šta nije u redu i zašto je bitno:** (1) `useEffect` na promjenu `isOpen` u `false` poziva `close()`, ali ista promjena stanja istovremeno uzrokuje rani `return null` pri renderu — `BottomSheet` se ukloni iz stabla **prije** nego što `@gorhom/bottom-sheet` stigne odigrati animaciju zatvaranja. Rezultat: list se zatvara trenutno ("nestane") bez `enablePanDownToClose`/backdrop tranzicije, dok se otvaranje animira. Efekat je nekonzistentan i u `GasReadingsScreen` (gdje su dva lista uzastopno) djeluje kao trzaj. (2) `title` je deklarisan kao prop i potrošači ga prosljeđuju, ali se nigdje u fajlu ne renderuje — zaglavlje lista je prazno, a korisnik gubi kontekst šta lista predstavlja (a11y: bez naslova nema ni `accessibilityRole="header"`, v. MO-017).
- **Dokaz:** Kod na navedenim linijama; `grep -n "title" mobile/src/components/BottomSheetModal.tsx` vraća **samo** liniju 12 (deklaraciju), nijedno korištenje.
- **Preporuka:** (1) Ukloniti rani `return null` i umjesto toga držati `BottomSheet` montiranim dok traje `onClose`/`onDismiss`, ili koristiti `BottomSheetModal` + `present()`/`dismiss()` API biblioteke umjesto `BottomSheet` s `expand()`/`close()`; alternativno renderovati samo kad je `isOpen || isClosing`. (2) Renderovati `title` u `BottomSheet` header slot (`BottomSheetView` + `Heading`) s `accessibilityRole="header"`, ili ukloniti prop da potrošači ne misle da radi.
- **Kako provjeriti da je riješeno:** Test: render lista s `isOpen: true → false` ne unmountuje `BottomSheet` u istom ticku (assert da `close` jest pozvan prije uklanjanja); snapshot test da se `title` pojavljuje u renderovanom izlazu; vizuelno: zatvaranje ima animaciju na Android i iOS.
- **Trud:** S — **Zavisnosti:** MO-011 (NativeBase vs. NativeWind za stilizaciju headera), MO-017 (a11y role).

---

### [MO-007] Splash traje fiksno 2500 ms preko `setTimeout`, bez koordinacije sa `expo-splash-screen` ni sa stvarnom spremnošću aplikacije — Ozbiljnost: NISKO — Pouzdanost: VERIFIKOVANO

- **Gdje:** `mobile/App.tsx:34` (`const [showAnimatedSplash, setShowAnimatedSplash] = useState(true);`), `:68-74` (`useEffect` s `setTimeout(() => setShowAnimatedSplash(false), 2500)`), `:83-85` (`<AnimatedSplash visible={showAnimatedSplash} onFinished={...} />`).
- **Šta nije u redu i zašto je bitno:** (1) Trajanje splasha je **konstanta**, ne signal spremnosti — korisnik čeka punih 2,5 s i na uređaju gdje je token već učitan i gdje bi ekran bio spreman za ~200 ms. To je direktno mjerljiv gubitak percepcije brzine na svakom pokretanju. (2) Ne koristi se `expo-splash-screen` (`preventAutoHideAsync`/`hideAsync`) — u `App.tsx` nema nijednog importa tog paketa (`grep -n "SplashScreen" mobile/App.tsx` → 0 pogodaka), pa native splash (`app.json:12-13` `./assets/new/splash_branding.png`) i JS `AnimatedSplash` nisu usklađeni: može se vidjeti bijeli/preskočeni kadar između native splasha i `AnimatedSplash`. (3) `onFinished` callback postoji (`App.tsx:85`) ali `setTimeout` ga može prestići, pa dva izvora istine odlučuju o kraju animacije.
- **Dokaz:** Kod na navedenim linijama; `grep -n "expo-splash-screen\|SplashScreen" mobile/App.tsx` → 0 pogodaka.
- **Preporuka:** (1) Vezati kraj splasha na stvarnu spremnost: `await Promise.all([i18n.init, SecureStorage token, prvi kritični query])` pa `setShowAnimatedSplash(false)`, uz `AnimatedSplash` animaciju kao minimalno trajanje (npr. 400 ms) umjesto 2500 ms; (2) koristiti `SplashScreen.preventAutoHideAsync()` + `hideAsync()` iz `expo-splash-screen` da native i JS sloj budu jedan kontinuum; (3) ukloniti `setTimeout` kao izvor istine.
- **Kako provjeriti da je riješeno:** Test: splash se zatvara kada su obećanja spremnosti riješena, a ne nakon fiksnog vremena (fake timers + assert da se `setShowAnimatedSplash(false)` ne desi prije resolve-a); mjerenje: vrijeme do prvog interaktivnog ekrana < 1 s na hladnom startu s keširanim tokenom.
- **Trud:** S — **Zavisnosti:** MO-010 (SecureStorage fallback mora biti pouzdan da bi "spremnost" bila mjerljiva), MO-024 (konfiguracija `app.json`).

---

## Top 5 nalaza ovog dokumenta

1. **MO-018** — centralni handler grešaka ništa ne prikazuje korisniku.
2. **MO-008** — Settings prekidači ne rade ništa i ne perzistiraju.
3. **MO-021** — tri ekrana bez ijedne prevedene riječi.
4. **MO-017** — 3 `accessibilityLabel` u cijeloj aplikaciji, 0 `testID`.
5. **MO-016** — fiktivne metrike prikazane kao stvarne.

---

### [MO-008] Settings prekidači za obavijesti nemaju efekta i ne perzistiraju — Ozbiljnost: VISOKO — Pouzdanost: VERIFIKOVANO

- **Gdje:** `mobile/src/screens/settings/SettingsScreen.tsx:37-39` (`notificationsEnabled`, `pushEnabled`, `dailyGasReminder` kao `useState(true)`), `:56-64` (`handleDailyGasReminderToggle` → deprecated no-op), `:66-71` (`useEffect` koji na mount ponovo „zakaže" podsjetnik), `:250-303` (tri `Switch` komponente).
- **Šta nije u redu i zašto je bitno:** Tri prekidača izgledaju kao funkcionalne postavke, ali: (1) stanje je lokalni `useState` koji se **resetuje na `true` pri svakom ulasku u ekran** i ne upisuje se ni u `AsyncStorage` ni na backend; (2) `scheduleDailyGasReadingReminder` i `cancelDailyGasReadingReminder` su deprecated funkcije koje samo loguju „reminders are now sent from backend" (`notificationService.ts:181-202`) — dakle prebacivanje ne mijenja ništa; (3) stvarne preferencije postoje na `NotificationPreferencesScreen` (`PATCH /api/notifications/preferences`), pa korisnik ima dva mjesta s kontradiktornim informacijama. Posljedica: korisnik isključi „Push obavijesti", uvjeren je da ih je isključio, a backend i dalje šalje.
- **Dokaz:** Kod na navedenim linijama; `grep -n "scheduleDailyGasReadingReminder" -A 8 mobile/src/services/notifications/notificationService.ts` pokazuje tijelo bez ijednog `Notifications.schedule*` poziva.
- **Preporuka:** (1) Ukloniti `pushEnabled` i `dailyGasReminder` prekidače ili ih vezati na stvarne `NotificationPreference` tipove (`GAS_READING_REMINDER`, …) preko `apiClient.updateNotificationPreference`; (2) `notificationsEnabled` vezati na stvarnu dozvolu (`Notifications.getPermissionsAsync`) i ponuditi dugme koje vodi u sistemske postavke; (3) obrisati deprecated no-op funkcije (MO-013); (4) ukloniti `useEffect` koji na mount poziva no-op.
- **Kako provjeriti da je riješeno:** Test: prebacivanje prekidača poziva `updateNotificationPreference` s ispravnim tipom; ponovni ulazak u ekran prikazuje stanje s backenda, ne `true`.
- **Trud:** M — **Zavisnosti:** MO-012; backend `PATCH /api/notifications/preferences` (bez validacije DTO-a — B-010/Faza 1).

---

### [MO-009] `ProfileScreen` bez i18n-a, bez React Query i s hardcoded PDV-om — Ozbiljnost: SREDNJE — Pouzdanost: VERIFIKOVANO

- **Gdje:** `mobile/src/screens/profile/ProfileScreen.tsx:1-262`; posebno `:21` (`const VAT_RATE = 0.17`), `:200` (hardcoded tekst „17%"), `:42-67` (`useEffect` + `apiClient.getUserProfile`), `:88-91` (`setUser({ ...user, ...updatedProfile })`), `:136-257` (svi naslovi: „Profile", „Account", „Gas Price", „Appearance", „Save Profile", „Sign Out").
- **Šta nije u redu i zašto je bitno:** (1) Ekran nema nijedan `t()` poziv — bosanski korisnik vidi engleski ekran usred prevedene aplikacije. (2) Dohvat profila je ručni `useEffect` bez keša: svaki ulazak u ekran je novi mrežni poziv, a `AuthContext.user` i lokalno stanje mogu se razići. (3) `setUser({ ...user, ...updatedProfile })` — ako je `user` `null`, spread daje `{}` i tip `User` postaje lažan (bez `id`/`email`). (4) PDV je hardcoded na 17 % na dva mjesta, iako backend ima `gasPriceIncVat` i `gasPriceSource` (`AuthContext.User` već deklariše ta polja) — promjena stope traži novo izdanje aplikacije (povezano s MO-004).
- **Dokaz:** `grep -c "t('" mobile/src/screens/profile/ProfileScreen.tsx` → 0; kod na navedenim linijama.
- **Preporuka:** (1) Prevesti ekran (ključevi `profile.*`); (2) prebaciti na `useQuery({ queryKey: ['user-profile'] })` i `useMutation` za snimanje, uz invalidaciju `AuthContext` stanja; (3) `setUser` graditi iz potpunog odgovora, ne spreadom nad mogućim `null`; (4) stopu PDV-a čitati iz odgovora backenda (`gasPriceIncVat`/nova postavka), a ne hardkodirati.
- **Kako provjeriti da je riješeno:** Test: jezik bs-BS → svi tekstovi ekrana prevedeni; test: `updateUserProfile` pozvan jednom, `getUserProfile` keširan; test: `gasPriceIncVat` s backenda prikazan bez lokalne aritmetike.
- **Trud:** M — **Zavisnosti:** MO-012; backend `GET/PUT /api/user`; FE-020 (isti hardcoded PDV na webu).

---

### [MO-016] Fiktivne metrike prikazane kao stvarne — Ozbiljnost: SREDNJE — Pouzdanost: VERIFIKOVANO

- **Gdje:** `mobile/src/screens/analytics/AnalyticsScreen.tsx:712-736` (blok „Performance Comparison": `t('analytics.better', { percent: '12' })` i `t('analytics.improvement', { percent: '18' })`, uz strelice i boje); naslov „AI Insights" (`:658`).
- **Šta nije u redu i zašto je bitno:** Brojevi 12 % i 18 % su **konstante u kodu**, ne rezultat mjerenja — aplikacija tvrdi da je korisnik „bolji od sličnih domova" i da je ostvareno „poboljšanje 18 %" u odnosu na prošlu godinu, bez ijednog podatka koji to podupire. U domenu grijanja i potrošnje plina ovo može direktno uticati na odluke korisnika. Sekcija „AI Insights" prikazuje statistiku modela (`avgConfidence`, `samples`) pod marketinškim nazivom, bez objašnjenja šta broj znači ni upozorenja da nije savjet.
- **Dokaz:** Kod na navedenim linijama — vrijednosti su literalni stringovi `'12'` i `'18'` proslijeđeni kao interpolacijski parametri; nigdje u `src` ne postoji izračun koji ih proizvodi (`grep -rn "'12'\|'18'" mobile/src/screens/analytics`).
- **Preporuka:** (1) Ukloniti blok „Performance Comparison" dok backend ne servira stvarnu komparaciju (npr. normalizacija po stepen-danima — Faza 1, `06-formulas.md`); (2) preimenovati „AI Insights" u neutralan naziv i dodati objašnjenje confidence-a; (3) dodati pravilo u review: nijedna brojčana tvrdnja u UI bez izvora podataka.
- **Kako provjeriti da je riješeno:** `grep -rn "percent: '" mobile/src` → 0; e2e: ekran analitike s mock backendom ne prikazuje komparacijske brojeve koji ne dolaze iz odgovora.
- **Trud:** S — **Zavisnosti:** backend (stvarna komparacija), MO-012.

---

### [MO-017] Pristupačnost: 3 `accessibilityLabel`, 0 `accessible`, 0 `testID` — Ozbiljnost: SREDNJE — Pouzdanost: VERIFIKOVANO

- **Gdje:** cijeli `mobile/src`; `grep -rn "accessibilityLabel" src` → 3 pogotka (uključujući `AnalyticsScreen.tsx` spinner); `grep -rn "accessible\b" src` → 0; `grep -rn "testID" src` → 0. Konkretne rupe: `components/FormInput.tsx:16-33` (bez `accessibilityLabel`/`accessibilityHint`, labela je odvojeni `Text` iznad), `DashboardScreen.tsx:297-326` (tri `Pressable` dugmeta samo s ikonom, bez teksta i bez labele), `SettingsScreen.tsx:139-176` (`SettingItem` = `Pressable` + `HStack` bez `accessible`/`role`), `HomeManagementScreen.tsx:432-441` (akcije „uredi"/„obriši" su gole ikone).
- **Šta nije u redu i zašto je bitno:** Korisnik čitača ekrana (TalkBack/VoiceOver) čuje „button" bez ikakvog opisa za ikonografske kontrole; polja nemaju programsku vezu s vidljivom labelom. Nedostatak `testID` također onemogućuje stabilne e2e testove (Maestro/Detox/Appium), što je preduslov za MO-012.
- **Dokaz:** Rezultati `grep`-a iznad; kod na navedenim linijama.
- **Preporuka:** (1) `FormInput` proširiti obaveznim `accessibilityLabel` propom i povezati ga s labelom (`nativeID`/`htmlFor` ekvivalent); (2) svako ikonografsko dugme dobiti `accessibilityLabel` (postoji i18n tekst koji se može iskoristiti); (3) `SettingItem` označiti kao `accessible` s `accessibilityRole="button"` i `accessibilityState={{ disabled }}`; (4) uvesti `testID` konvenciju (`<screen>.<element>`) na ključnim kontrolama kao dio MO-012.
- **Kako provjeriti da je riješeno:** Statička provjera (skripta: svaki `Pressable` s ikonom i bez teksta mora imati `accessibilityLabel`) vraća 0 nalaza; ručni TalkBack prolazak kroz Dashboard/Settings/Gas; e2e test pronalazi kontrole po `testID`.
- **Trud:** M — **Zavisnosti:** MO-012, MO-021 (tekstovi za labele).

---

### [MO-018] Centralni handler grešaka samo loguje — korisnik nikad ne vidi poruku — Ozbiljnost: VISOKO — Pouzdanost: VERIFIKOVANO

- **Gdje:** `mobile/src/services/api/error.handler.ts:95-127` (`useErrorHandler().showError` → jedino `console.error('[API Error]', …)`, uz zakomentarisani toast na `:109-123`), `:132-144` (`showErrorToast` vraća string koji većina pozivalaca ignoriše); potrošači: `DashboardScreen.tsx:65-69,93-95`, `GasReadingsScreen.tsx:96-99` i svi `onError` callbacki, `HeatingScreen.tsx`, `AnalyticsScreen` (ne koristi ga).
- **Šta nije u redu i zašto je bitno:** Deset ekrana se oslanja na `showError` da prikaže grešku (uključujući neuspjelo postavljanje temperature kotla, brisanje očitanja, upload fakture). Funkcija **ništa ne renderuje** — korisnik vidi samo da se ništa nije dogodilo. Time je cijeli sloj obrade grešaka prividno prisutan (i prolazi type-check), a funkcionalno mrtav. `parseApiError` je dobro napisan, ali se njegov `userMessage` nigdje ne prikazuje.
- **Dokaz:** `sed -n '95,127p' mobile/src/services/api/error.handler.ts` — tijelo funkcije sadrži isključivo `console.error`; `grep -rn "showError(" mobile/src` → 11 poziva.
- **Preporuka:** Implementirati `showError` preko NativeBase `useToast` (ili `Toast` iz budućeg UI sistema) s `parseApiError(error).userMessage`, uključujući poseban slučaj za mrežnu grešku (`isNetworkError`) i 401 (povezano s MO-010/MO-014). Tekstove prevesti (`errors.*` namespace već postoji u oba jezika). Zadržati `console.error` samo u `__DEV__`.
- **Kako provjeriti da je riješeno:** Komponentni test: `showError(new AxiosError(...))` renderuje toast s očekivanim tekstom; e2e: backend vraća 500 na `PATCH /boiler/current-temp` → korisnik vidi poruku.
- **Trud:** S — **Zavisnosti:** MO-012; MO-021 (tekstovi).

---

### [MO-019] `SettingsScreen`: akcije bez funkcije, komponenta definisana unutar rendera, hookovi u JSX callbackovima — Ozbiljnost: NISKO — Pouzdanost: VERIFIKOVANO

- **Gdje:** `mobile/src/screens/settings/SettingsScreen.tsx:341-378` (`onPress={() => console.log('Export data')}`, `console.log('Clear cache')`, `console.log('Help')`, `console.log('Terms')`), `:368` (`subtitle="2.0.0"`), `:135-176` (`SettingItem` definisan **unutar** tijela komponente), `:158` i `:166` (`useColorModeValue(...)` pozvan unutar JSX izraza).
- **Šta nije u redu i zašto je bitno:** (1) Četiri stavke menija nemaju funkciju — korisnik dobije tap feedback i ništa se ne dogodi; „Izvezi podatke" je pritom GDPR-relevantna funkcionalnost (Faza 1, PRIV-1). (2) `SettingItem` se redefiniše pri svakom renderu, pa React cijeli podstab smatra novom komponentom i **remontuje ga** — pri otvorenom bottom sheetu to znači ponovno kreiranje inputa i gubitak fokusa. (3) `useColorModeValue` unutar JSX-a je poziv hooka izvan tijela komponente (ovdje tehnički prolazi jer se `SettingItem` ponaša kao komponenta, ali je krhko i krši konvenciju).
- **Dokaz:** Kod na navedenim linijama.
- **Preporuka:** (1) Implementirati ili ukloniti/sakriti nefunkcionalne stavke (export → backend endpoint iz Faze 1 (PRIV-1); clear cache → MO-020; help/terms → link ili sadržaj); (2) izdvojiti `SettingItem` u zaseban fajl/komponentu izvan rendera (kao što je ispravno urađeno u `ScheduleManagementScreen.tsx:127` uz komentar „MOVED OUTSIDE to avoid hooks ordering issues"); (3) verziju čitati iz `Constants.expoConfig.version` (MO-004).
- **Kako provjeriti da je riješeno:** Test: nijedna `onPress` akcija u postavkama nije prazna; snapshot test koji potvrđuje da se `SettingItem` ne remontuje pri promjeni stanja.
- **Trud:** S — **Zavisnosti:** MO-004 (verzija), MO-020 (cache), PRIV-1.

---

### [MO-021] Tri ekrana bez ijednog `t()` poziva; dva ekrana zaobilaze lokalni hook — Ozbiljnost: SREDNJE — Pouzdanost: VERIFIKOVANO

- **Gdje:** `mobile/src/screens/home/HomeManagementScreen.tsx` (1079 linija, 0 `t()`; npr. `:130-149` validacijske poruke „Home name is required", „Floor area must be between 10 and 2000 m²", `:245` „Home added successfully", `:455` „My Homes"); `mobile/src/screens/profile/ProfileScreen.tsx` (0 `t()`); `mobile/src/screens/schedule/ScheduleManagementScreen.tsx` (0 `t()`; npr. `:107,126` „Today"/„Tomorrow", `:160` „Target: …"); dodatno `navigation/SettingsStackNavigator.tsx:39,47,55,63` (naslovi ekrana) i `constants/homeProfileEnums.ts:38-56` (labele opcija). Nekonzistentnost: `AnalyticsScreen.tsx:5` i `GasAnalysisScreen.tsx:16` importiraju `useTranslation` direktno iz `react-i18next`, dok ostalih 11 ekrana koristi `src/hooks/useTranslation.ts`.
- **Šta nije u redu i zašto je bitno:** Aplikacija tvrdi da podržava en-US i bs-BS (i ima selektor jezika u postavkama), ali tri ekrana od 14 ostaju na engleskom u oba jezika — uključujući cijeli tok upravljanja domovima i raspored grijanja. Validacijske poruke su dio tog problema: korisnik ne razumije zašto unos nije prošao.
- **Dokaz:** `for f in $(find src/screens -name '*.tsx'); do grep -c "t('" $f; done` → `HomeManagementScreen 0`, `ProfileScreen 0`, `ScheduleManagementScreen 0`; `grep -n "useTranslation from 'react-i18next'" src/screens -r` → 2 fajla.
- **Preporuka:** (1) Dodati `homeProfile.*`/`schedule.*`/`profile.*` ključeve (namespace `homeProfile` već postoji s 86 ključeva u oba jezika — provjeriti koliko se stvarno koristi); (2) sve ekrane prebaciti na `src/hooks/useTranslation.ts`; (3) uvesti statičku provjeru u `scripts/audit/mobile_inventory.py` koja broji fajlove bez `t()` i javlja regresiju; (4) labele enum opcija i naslove navigatora prevesti.
- **Kako provjeriti da je riješeno:** `python3 scripts/audit/mobile_inventory.py` → 0 ekrana bez i18n pokrivenosti; ručni prolazak u bs-BS: nijedan engleski tekst.
- **Trud:** M — **Zavisnosti:** MO-012 (regresijska provjera).

---

### [MO-022] 25 bosanskih ključeva zalutalo unutar `gas.*` namespace-a u `enUS` resursu — Ozbiljnost: NISKO — Pouzdanost: VERIFIKOVANO

- **Gdje:** `mobile/src/locales/config.ts:483-513` — unutar `enUS.gas` nalaze se `aboutSection: 'O aplikaciji'`, `changePassword: 'Promijeni lozinku'`, `notificationsEnabled: 'Uključi obavijesti'`, `pushNotifications: 'Push obavijesti'`, `manageHomes: 'Upravljanje domovima'`, `clearCache: 'Očisti keš'`, `units.dailyGasReminderTime: 'Podsjetnik u 19:00…'` i dr.; ispravni engleski ekvivalenti postoje na `:570-604`.
- **Šta nije u redu i zašto je bitno:** Kopirani blok iz bosanskog resursa ostao je u engleskom, što znači da `enUS` ima 550 ključeva naspram 525 u `bsBS` — razlika od tačno 25. Ključevi se ne koriste (nijedan statički `t()` poziv ih ne referencira), pa nema korisničkog efekta, ali zagađuju resurs, otežavaju automatizovano poređenje jezika i mogu sakriti stvarne nedostatke.
- **Dokaz:** `grep -n "changePassword:\|clearCache:\|pushNotifications:\|manageHomes:\|aboutSection:\|dailyGasReminderTime:" mobile/src/locales/config.ts` → 483, 492, 493, 495, 502, 505, 511 (unutar `gas`, granice `gas` bloka: 344-515) i 555, 570, 579, 586, 588, 595, 597, 603 (unutar `settings`, 560-609).
- **Preporuka:** Obrisati zalutali blok iz `enUS`; dodati provjeru u audit skriptu da su skupovi ključeva en/bs identični (uz toleranciju za dokumentovane izuzetke).
- **Kako provjeriti da je riješeno:** Skripta za poređenje ključeva vraća `en-bs = 0` i `bs-en = 0`; `npm run type-check` i dalje exit 0.
- **Trud:** S — **Zavisnosti:** nema.

---

### [MO-023] Liste bez virtualizacije i bez memoizacije — Ozbiljnost: NISKO — Pouzdanost: VERIFIKOVANO (statika) / HIPOTEZA (performanse)

- **Gdje:** `mobile/src/screens/gas/GasReadingsScreen.tsx` (1059 linija, lista očitanja kroz `ScrollView` + `map`), `mobile/src/screens/analytics/AnalyticsScreen.tsx:600-630` (ciklusi kao 24 `Box` elemenata s procentualnom visinom), `mobile/src/components/RecentHeatingEvents.tsx`, `mobile/src/screens/home/HomeManagementScreen.tsx`; `grep -rn "FlatList" src` → **0**, `SectionList` → 1 (`NotificationsScreen`), `React.memo` → **0**, `testID` → 0.
- **Šta nije u redu i zašto je bitno:** Backend ne ograničava broj očitanja plina po korisniku (`GET /api/gas/readings` vraća sve), pa lista raste s vremenom; bez `FlatList`/`FlashList` svi elementi se renderuju odjednom i mjere pri svakom scrollu. Nedostatak `React.memo` znači da se kartice (Boiler/Thermostat/Alerts) prerenderuju pri svakom refetchu dashboarda (koji se dešava svake minute — MO-027). Bez `React.memo`/`useMemo` oko grafova `react-native-chart-kit` se crta iznova.
- **Dokaz:** Rezultati `grep`-a iznad; `grep -n "refetchInterval" mobile/src` → `HeatingScreen.tsx:80`.
- **Preporuka:** (1) Liste s više od ~20 elemenata prebaciti na `FlatList` (ili `@shopify/flash-list`) s `keyExtractor` i `getItemLayout` gdje je moguće; (2) memoizirati kartice (`React.memo`) i izračune (`useMemo` za `getFilteredReadings`, `calculatePeriodConsumption`); (3) ograničiti/paginirati dohvat na backendu; (4) izmjeriti (Hermes sampling profiler ili `react-native-performance`) prije i poslije — bez mjere nema tvrdnje o poboljšanju.
- **Kako provjeriti da je riješeno:** Benchmark: 500 sintetičkih očitanja → vrijeme prvog rendera i FPS pri scrollu zabilježeni prije/poslije; snapshot testovi i dalje prolaze.
- **Trud:** M — **Zavisnosti:** MO-012, MO-027; backend paginacija (Faza 1).
