# Frontend arhitektura i podaci — nalazi

## Sažetak: pet vrhunska nalaza

1. **FE-001, VERIFIKOVANO (pokrenuto):** `npm run type-check` je lažno zeleno (solution tsconfig s `"files": []`), a stvarna provjera daje 12 tipkih grešaka — greške tipizacije ne bi bile vidljive ni lokalno ni u CI-u.
2. **FE-006, VERIFIKOVANO:** mešoviti modeli dohvata podataka — glavni dashboard radi ručnim `useEffect` + `setInterval(60 s)` (bez React Query, bez pauze na skrivenom tabu), ostale stranice miješaju React Query i ručno stanje; QueryClient nema globalne default opcije.
3. **FE-010, VERIFIKOVANO:** poslovna logika duplirana na klijentu (health score, pravila upozorenja s magijskim brojevima, semantika "overshoot" suprotnog znaka, set-temp granice 48/55 u dva fajla) — rizično po paritet pravilo iz `GEMINI.md` i po dosljednost s backend clampom [46, 55].
4. **FE-011, VERIFIKOVANO:** mrtav `notification.api.ts` s pozivima metoda koje ne postoje na `ApiClient` klasi (5 tipkih grešaka) i 4 nepozvane `apiClient` metode — ugovor i implementacija već divergiraju.
5. **FE-003, VERIFIKOVANO:** web ne može postaviti lokaciju (`location` nije u formi niti u DTO-ovima) iako je to jedini ulaz za backend weather geokodiranje; dashboard paralelno čita dva weather endpointa s dualnim mapiranjem polja, bez starosti podataka i bez mapiranih WMO stanja.

## Otvorena pitanja

- Da li `GET /api/dashboard` treba biti jedini izvor "trenutnog stanja" (pa eliminirati paralelni `system.weather` + `weather/current` dohvat)?
- Koje pravilo upozorenja (kratki/dugi ciklusi, overshoot) je produktivno dogovoreno i gdje treba živjeti — backend ili shared modul?

### [FE-001] `npm run type-check` provjerava ništa; stvarna provjera daje 12 grešaka — Ozbiljnost: VISOKO — Pouzdanost: VERIFIKOVANO (pokrenuto)
- Gdje: `frontend/tsconfig.json` (cijeli: `{"files": [], "references": [{"path": "./tsconfig.app.json"}]}`), `frontend/package.json:6` (`"type-check": "tsc --noEmit"`), greške: `frontend/src/pages/DashboardPage.tsx:215,870,1058,1060`, `frontend/src/pages/HomeProfilePage.tsx:16`, `frontend/src/services/notification.api.ts:27,32,36,40,48`.
- Šta nije u redu i zašto: korenski tsconfig je solution-format bez vlastitih fajlova, pa `tsc --noEmit` izvan `-b` moda ne kompajlira ništa i vraća 0. Stvarna konfiguracija (`tsconfig.app.json`, strict + noUnusedLocals) pokazuje 12 grešaka: `homeProfileId` (`number | undefined`) se proslijeđuje funkciji koja traži `number` (DashboardPage:215), implicitni `any` parametri (870), `NotificationPreference.updatedAt` ne postoji u lokalnom interfaceu (1058/1060), nepotrebni importi (HomeProfilePage:16) i 5× `Property 'get'/'post'/'patch' does not exist on type 'ApiClient'` u mrtvom `notification.api.ts`. Build (`vite build`) ne pokreće tsc, pa ni jedna od ovoga ne ruši ni build ni (nepostojeći) frontend CI.
- Dokaz: `cd frontend && npm run type-check` → exit 0 bez ijedne linije; `npx tsc --noEmit -p tsconfig.app.json` → navedene 12 grešaka (2026-10-29, nakon `npm ci`).
- Preporuka: `type-check` skriptu promijeniti u `tsc --noEmit -p tsconfig.app.json` (ili `tsc -b`), popraviti 12 grešaka (mali subset: tip parametra s `enabled` guardom, tipizacija Collapse items, dodavanje `updatedAt` u lokalni interface, uklanjanje nepotrebnih importa, brisanje ili popravak `notification.api.ts` — vidi FE-011), i uvesti frontend CI korak koji pokreće type-check prije builda.
- Kako provjeriti: `npm run type-check` vrati 0 **i** `--listFiles` pokazuje da se `src/**` stvarno kompajlira; namjerno ubačena tipka greška u testnom commitu ruši CI.
- Trud: S — Zavisnosti: frontend CI (FE-007 plana talas 0), odluka o sudbini `notification.api.ts`.

### [FE-006] Mešoviti modeli dohvata podataka; polling bez pauze na skrivenom tabu — Ozbiljnost: SREDNJE — Pouzdanost: VERIFIKOVANO (kod)
- Gdje: `frontend/src/pages/DashboardPage.tsx:283-301,343-374` (ručni `useEffect` + `window.setInterval(loadHeatingRange, 60000)`), `frontend/src/main.tsx:8` (`new QueryClient()` bez default opcija), `frontend/src/pages/HeatingPage.tsx:20-33`, `BoilerPage.tsx:26-40`, `ReportsPage.tsx:17-30` (jednokratni `useEffect`), `DashboardPage.tsx:248-281` (ručno stanje notifikacija) naspram `NotificationsPage.tsx:13-44` (React Query).
- Šta nije u redu i zašto: isti podaci (npr. notifikacije) postoje u dvije neovisne implementacije s različitim strategijama (drawer na dashboardu je ručno stanje s punim reloadom nakon mark-as-read; stranica koristi RQ + invalidacije) — broj nepročitanih se može razlikovati između crtežne kartice i stranice. `setInterval` nastavlja slati 3 HTTP poziva svake minute i dok je tab u pozadini (brauzer ga usporeno, ali ne zaustavlja), a gasi se samo uz `range` promjenu; nema `refetchOnWindowFocus` kontrole po query-u, QueryClient nema globalni `staleTime`/`retry` politiku, pa svaki query ima vlastite ad-hoc vrijednosti (1/5/10 min).
- Dokaz: navedene linije; `QueryClient` instance nema `defaultOptions` (main.tsx:8); dva različita queryKey-a za notifikacije (`['notifications']` na stranici vs. uopće ne — dashboard drži `useState<Notification[]>`).
- Preporuka: centralizovati dohvate u React Query s globalnim defaultima (staleTime 30-60 s, ograničeni retry, `refetchOnWindowFocus: true`), zamijeniti `setInterval` s `refetchInterval` (po mogućnosti uz `document.visibilityState` pauzu) i izbaciti duplicirano notifikacijsko stanje (jedan query, dva prikaza).
- Kako provjeriti: unit test da drawer i stranica dijele isti query; e2e da tab u pozadini ne generiše pozive (devtools/mocks); `refetchInterval` reaguje na vidljivost.
- Trud: M — Zavisnosti: FE-001 (tipke), odluka o izvoru vremena (FE-003), testna infrastruktura (FE-014).

### [FE-003] Web ne može postaviti lokaciju; dva paralelna izvora vremena — Ozbiljnost: VISOKO — Pouzdanost: VERIFIKOVANO (kod), HIPOTEZA (stvarni web-only korisnici)
- Gdje: `frontend/src/pages/HomeProfilePage.tsx:26-42` i `frontend/src/types/homeProfile.ts` (nema polja `location` u formi ni u DTO-ovima), `frontend/src/pages/DashboardPage.tsx:210-246` (dva izvora: `GET /api/weather/current/:homeProfileId` preko `useQuery` + `system.weather` iz `GET /api/dashboard` kao fallback s dualnim mapiranjem polja `temperature ?? temp`, `feelslike ?? feelsLike`, `condition_text ?? condition`), backend: `HomeProfile.location` je jedini ulaz za geokodiranje (docs/audit/backend/05-weather.md, W nalazi), `GET /api/weather` je stub koji vraća `{}` (B-002).
- Šta nije u redu i zašto: korisnik koji koristi isključivo web nikad ne može unijeti niti promijeniti grad/lokaciju — a to je jedini input koji backend weather servis koristi za geokodiranje i dohvat prognoze; za takve korisnike weather ostaje prazan ili pogrešan ovisno o podacima u bazi. Istovremeno dashboard prikazuje vrijeme iz dva različita endpointa s dva različita oblika polja (defanzivno mapiranje maskira koji je ugovor stvarni), a nijedan od prikaza ne pokazuje starost podataka (`fetchedAt` postoji u interfaceu, ali se ne renderizuje) niti mapirano stanje (backend vraća sirovo `WMO_<kod>`).
- Dokaz: `rg -n 'location' frontend/src/types frontend/src/pages` → bez rezultata (osim `homeLocation` u `ProfilePage` koji ide u `PUT /user` — drugo polje); `DashboardPage.tsx:210-246` pokazuje oba dohvata i dualno mapiranje; backend 05-weather.md dokumentuje geokodiranje iz `HomeProfile.location` i stub rutu (B-002).
- Preporuka: dodati `location` u home-profile formu i DTO-ove (geokoder s kandidatima + koordinatama + potvrda — uskladiti s backend korakom 1.1/FEAT-1), zatim jedan izvor vremena: novi weather DTO (satna 48-72 h, dnevna 3-7 dana, starost, stale flag, mapirani WMO) i uklanjanje `system.weather` dupliciteta nakon backend tranzicije; do tada bar prikazati `fetchedAt` kao "podaci od".
- Kako provjeriti: e2e: novi korisnik bez profila → prazno weather stanje s pozivom na unos lokacije → unos → weather se pojavi; mock provider bez fresh podataka → stale oznaka; contract test za novi DTO; provjeriti da mobile ne ovisi o uklonjenom obliku (Faza 3).
- Trud: M/L — Zavisnosti: backend 1.1/1.2 (FEAT-1), FE-016/FE2-8 (OpenAPI tipovi), FE-017 (forma), odluka o layoutu weather ekrana.

### [FE-007] Gas analitika tiho proguta greške; `console.log` API odgovora u produkciji — Ozbiljnost: SREDNJE — Pouzdanost: VERIFIKOVANO (kod)
- Gdje: `frontend/src/pages/GasAnalyticsPage.tsx:29-42` (queryFn `catch → console.error; return {}`), `frontend/src/pages/NotificationsPage.tsx:17` (`console.log('Notifications API Response:', response)`), `frontend/src/pages/GasAnalyticsPage.tsx:34` (`console.log('Gas Analysis API Response:', result)`), `GasReadingsPage.tsx:15-24` (bez logova, ali isti obrazac `Array.isArray(response) ? response : []`).
- Šta nije u redu i zašto: jer queryFn nikad ne baca, `error` u `useQuery` ostaje `undefined` i greška-blok (red 63-69) je mrtva grana — pad poslužitelja korisniku se prikazuje kao prazan "NEMA PODATAKA" umjesto greške s retryjem; `console.log` cijelih odgovora u produkcijskom bundle-u ostavlja operativne podatke (uključujući sadržaj notifikacija) u konzoli svake posjete.
- Dokaz: queryFn u `GasAnalyticsPage.tsx:36-39` hvata sve i vraća `{}`; dva `console.log` poziva su u direktnom queryFn tijelu.
- Preporuka: ne hvatati greške unutar queryFn-a (pustiti da RQ upravlja stanjem i retryjem), dodati `onError`/error UI s retry akcijom, ukloniti `console.log` cijelih odgovora (zadržati samo redigovan debug log iza develop flaga).
- Kako provjeriti: mock 500 na `/gas/analysis` → prikaz greške + retry; mock 401 → interceptor redirect; DevTools console bez API tijela.
- Trud: S — Zavisnosti: FE-001/FE-014 (testovi).

### [FE-010] Poslovna logika na klijentu: health score, upozorenja i granice temperature — Ozbiljnost: SREDNJE — Pouzdanost: VERIFIKOVANO (kod), HIPOTEZA (razilaženje s drugim klijentima)
- Gdje: `frontend/src/pages/DashboardPage.tsx:376-403` (`healthScore = max(0, 100 - anomalies*15)`), `DashboardPage.tsx:480-526` (pravila: ≥3 ciklusa <20 min; `overshootAvg = avg(target - current) > 1.5`; ciklusi >90 min), `DashboardPage.tsx:176-177` i `BoilerPage.tsx:16-17` (`MIN/MAX_CURRENT_FLOW_TEMP = 48/55` duplirano), usporedbi: backend clamp [46, 55] (docs/audit/backend/06-formulas.md) i backend health/analiza (03-data-model.md, dashboard servis).
- Šta nije u redu i zašto: isti koncepti (zdravlje, upozorenja, granice) se neovisno implementiraju na web-u (i, po pravilu iz `GEMINI.md`, treba biti u paritetu s mobile); "overshoot" ovdje zapravo računa ** shortfall** (`targetTemp - currentTemp`, pozitivan kad se cilj NE dostigne) pa poruka "Mogući overshoot" može biti semantički pogrešna; UI ograničenje 48-55 strože je od backend granice 46-55 pa je dio dozvoljenog raspona nedostižan iz weba (ili je backend clamp star). Brojevi (20/90 min, 1.5 °C, ×15) nisu nigdje dokumentovani kao politika.
- Dokaz: navedene linije; backend clamp i semantika overshoota u `docs/audit/backend/06-formulas.md` (F-005) i `04-findings.md` (B-019).
- Preporuka: definisati ovu logiku jednom (backend endpoint ili shared modul koji web i mobile koriste), uskladiti granice 48/55 vs 46/55 s vlasnikom i backend planom, ispraviti naziv/znak "overshoot"; dok se ne preseli, dokumentovati magijske brojeve kao privremenu politiku.
- Kako provjeriti: isti unos daje isti health/upozorenja na web i mobile (sporedni test), e2e za granicu 47.9 °C prema dogovorenoj politici.
- Trud: M — Zavisnosti: backend plan (formule/dashboard koraci), odluka o shared kodu, GEMINI paritet.

### [FE-011] Mrtav i tipki slomljen `notification.api.ts`; nepozvane API metode — Ozbiljnost: NISKO — Pouzdanost: VERIFIKOVANO (kod + tsc)
- Gdje: `frontend/src/services/notification.api.ts:27,32,36,40,48` (pozivi `apiClient.get/post/patch` — `ApiClient` klasa nema te metode, `frontend/src/services/api.ts:10-279`), `api.ts:119-122` (`getWeather`), `api.ts:102-105` (`getBoilerStatus`), `api.ts:146-149` (`addGasReadingPayload`), `api.ts:249-252` (`generateReport`).
- Šta nije u redu i zašto: `apiClient` je instanca klase s eksplicitnim metodama, a ne axios instance — `apiClient.get(...)` bi na runtime dalo `TypeError: apiClient.get is not a function`, ali fajl **nema importera** (`rg "notification.api" src` → prazno), pa se nikad ne izvršava; 5 tsc grešaka iz FE-001 dolaze upravo ovdje. Četiri metode klase nema pozivatelja, uključujući `getWeather` koja bi pogađala backend stub `GET /api/weather` (vraća `{}`, B-002).
- Dokaz: `rg -n "notification\.api" frontend/src` → bez rezultata; `npx tsc --noEmit -p tsconfig.app.json` → 5 grešaka TS2339 u tom fajlu; pozivi `getWeather()/generateReport()/getBoilerStatus()/addGasReadingPayload()` → bez rezultata u `src/`.
- Preporuka: obrisati `notification.api.ts` (funkcionalnost pokrivaju `apiClient` metode koje koriste obje notifikacijske površine) ili ga pretvoriti u ispravan modul na istoj bazi; metode bez pozivatelja zadržati samo ako su dogovoreni deprecirani ugovori, inače ukloniti uz provjeru da mobile/web ih ne koriste.
- Kako provjeriti: `tsc -p tsconfig.app.json` bez grešaka iz tog skupa; `rg` ne nalazi reference; build zelen.
- Trud: S — Zavisnosti: FE-001.

### [FE-012] Brisanje očitanja bez obrade greške (fire-and-forget `mutateAsync`) — Ozbiljnost: NISKO — Pouzdanost: VERIFIKOVANO (kod)
- Gdje: `frontend/src/pages/GasReadingsPage.tsx:247` (`onDelete={(id) => deleteMutation.mutateAsync(id)}`), `deleteMutation` definicija bez `onError` (43-51).
- Šta nije u redu i za što je bitno: ako brisanje padne (400/409/500), korisnik ne dobije nikakvu poruku, `window.confirm` je već prošao, a odbacena Promise postaje unhandled rejection u konzoli.
- Dokaz: navedene linije; nijedan `message.error` nije povezan s `deleteMutation`.
- Preporuka: dodati `onError` s jasnom porukom (i `onSuccess` invalidaciju koja već postoji) i opciju "odmah osvježavanje nakon brisanja" radi konzistentnosti.
- Kako provjeriti: mock DELETE 500 → poruka korisniku, lista neobječana; 200 → invalidacija i nestanak kartice.
- Trud: S — Zavisnosti: testna infrastruktura (FE-014).

### [FE-016] Ručni tipovi i defanzivni dvostruki response shape — Ozbiljnost: NISKO — Pouzdanost: VERIFIKOVANO (kod)
- Gdje: `frontend/src/pages/HeatingPage.tsx:24` (`Array.isArray(data) ? data : data?.events ?? []`), `BoilerPage.tsx:29` (isti obrazac s `data?.events`), `ReportsPage.tsx:21` (`data?.recommendations`), `GasReadingsPage.tsx:21`, `GasAnalyticsPage.tsx:49`, `types/homeProfile.ts` (ručno pisani, bez OpenAPI izvora), `notification.api.ts:3-24` (interface Notification s `deliveryOk`, `sourceRef` — različito od lokalnog u `DashboardPage.tsx:13-24` koji nema `deliveryOk`).
- Šta nije u redu i zašto: dva različita lokalna `Notification` interfacea za isti endpoint i defanzivno "ili array ili {x}" maskiraju stvarni backend ugovor — ako backend promijeni oblik, UI tiho pokaže prazno umjesto da se otkrije u testu; ručni tipovi divergiraju od backend DTO-ova (npr. `DashboardPage.tsx:202-218` očekuje `HomeProfileResponse` koji nema `location` — backend `GET /api/home-profile` je može vraćati, a web ga ne koristi, vidi FE-003).
- Dokaz: navedene linije; backend ugovori u `docs/audit/backend/02-api-catalog.md`; `HomeProfileResponse` (types/homeProfile.ts) nema `location` dok backend model ima polje (03-data-model.md).
- Preporuka: generisati tipove iz OpenAPI dokumenta (backend već izdaje Swagger na `/api/docs`), ujednačiti response ugovor (jedan oblik po ruti) i izbaciti defanzivne dvostruké grane nakon kontraktnih testova; zadržati samo eksplicitno odobrene legacy shapeove.
- Kako provjeriti: contract testovi (Playwright ili Vitest + mock) koji ruše promjenu shape-a; tipovi se regenerišu skriptom, ne ručno.
- Trud: M — Zavisnosti: backend OpenAPI stabilizacija (plan 5.2), FE-007 plana.

### [FE-019] Dashboard range: tvrdokodirani limit, default dan i lokalno vrijeme za "danas" — Ozbiljnost: NISKO — Pouzdanost: VERIFIKOVANO (kod)
- Gdje: `frontend/src/pages/DashboardPage.tsx:187-190` (default `dayjs().startOf('day')` → `dayjs()`), `DashboardPage.tsx:353` (`limit: 500`), `DashboardPage.tsx:415-436` (`getTodayDayType`/`getActiveProgram` preko lokalnog `dayjs()`), `DashboardPage.tsx:438-443` (bucket label u lokalnom vremenu).
- Šta nije u redu i zašto: "danas" i satni bucketi se određuju lokalnim vremenom preglednika, a backend upiti i server TZ (`Europe/Sarajevo`) mogu imati drugu granicu dana (npr. korisnik putuje ili koristi drugi uređaj) — prikazani "aktivni program" i bucketi mogu odstupati od backend semantike; `limit: 500` je tvrdokodirano bez paginacije i šuti ako je period pun (nema upozorenja da su podaci skraćeni).
- Dokaz: navedene linije; backend bucket semantika i `deviceId` indeksiranje u `docs/audit/backend/03-data-model.md` i 04-findings B-020.
- Preporuka: dogovoriti da "danas"/bucketi dolaze iz backend-a (s eksplicitnom zonom) ili barem iz korisničke postavke (profile `timezone` već postoji u `PUT /user`), uvesti paginaciju ili jasno "prikazanih 500" upozorenje.
- Kako provjeriti: test s dvije različite browser vremenske zone prikazuje iste buckete; period s >500 događaja pokazuje upozorenje/paginaciju.
- Trud: S/M — Zavisnosti: FE-016 (ugovor), backend bucket dogovor (B-020).
