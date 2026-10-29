# Frontend UX, kvalitet i performanse — nalazi

## Sažetak: pet vrhunska nalaza

1. **FE-004, VERIFIKOVANO (build):** cijela aplikacija je jedan JS čip od **2.972 kB (gzip 905 kB)** — nema lazy ruta niti chunking; Vite sam upozorava na limit 500 kB.
2. **FE-005, VERIFIKOVANO:** i18n pokrivaju samo 5 od 14 fajlova s UI-jem (`LoginPage`, gas stranice/komponente); Dashboard, Boiler, Heating, HomeProfile, Profile, Reports, Notifications i MainLayout su **hardcoded EN** (Dashboard miješa i hardcoded BS u upozorenjima); nema ručnog izbora jezika u UI, a bs prevodi imaju greške u kucanju.
3. **FE-013, VERIFIKOVANO:** custom modal (GasForm) nema `role="dialog"`, aria atribut, focus trap niti Escape; tema Switch nema `aria-label`; ostali UI elementi koriste antd (relativno pristupačne).
4. **FE-017, VERIFIKOVANO:** HomeProfile forma ne izlaže `location` (ključno za weather — FE-003) ni `seasonMode` (postoje u DTO), 404 se prikazuje kao greška umjesto "kreiraj profil" stanja, a defaulti nisu konzistentni (initial 22/20/18 vs fallback 20/21/18).
5. **FE-020, VERIFIKOVANO:** VAT stopa 1.17 je hardcoded na webu (`ProfilePage`) iako backend već vraća `gasPriceVatRate` u odgovoru `/user` (dvostruka konstanta, rizično po paritet).

## Otvorena pitanja

- Koje je planirano CILJNO vrijeme prvog rendera (LCP) na najslabijem ciljanom uređaju, da li se 905 kB gzip smatra prihvatljivim?
- Da li je jezički selektor u UI obavezan (saobraćaj je pretežno BA, ali mobilna verzija ima en/bs)?

### [FE-004] Jedan 2.972 kB JS čip bez code-splittinga — Ozbiljnost: SREDNJE — Pouzdanost: VERIFIKOVANO (pokrenuto)
- Gdje: `frontend/vite.config.ts` (nema `build.rollupOptions`, nema lazy), `frontend/src/App.tsx:4-16` (svih 10 stranica statički importovano), build izlaz: `dist/assets/index-BcIIGfqz.js 2,972.34 kB │ gzip: 905.50 kB` (2026-10-29).
- Šta nije u redu i zašto: svaka posjeta preuzima i parsira cijeli bundle (React + antd + @ant-design/plots + react-query + axios + dayjs + i18next + svih 10 stranica) iako korisnik obično otvara 1-2 ekrana; na sporim vezama (grijanje aplikacija na jednostavnijim uređajima) to direktno usporava prvi ekran. Vite sam emituje upozorenje >500 kB.
- Dokaz: `cd frontend && npm run build` → gornje brojeve (izvještaj sačuvan u radnom zapisku; `dist/` nije u repozitoriju).
- Preporuka: `React.lazy` + `Suspense` po grupama ruta (npr. dashboard, gas, reports, profile), `manualChunks` za antd/plots/axios/dayjs; nakon toga izmjeriti velikost po čipu i LCP; ne uvoditi agresivno caching bez FE-008 headera.
- Kako provjeriti: build izvještaj pokazuje više čipova, login čip bez pages; LCP na emuliranoj sporoj vezi (Playwright trace) unutar dogovorenog praga.
- Trud: S/M — Zavisnosti: FE-014 (e2e mjeranje), dogovor o pragovima.

### [FE-005] i18n pokriva samo dio stranica; mješavina EN/BS; nema izbora jezika — Ozbiljnost: SREDNJE — Pouzdanost: VERIFIKOVANO (kod + brojanje)
- Gdje: `useTranslation` postoji samo u `LoginPage.tsx`, `GasReadingsPage.tsx`, `GasAnalyticsPage.tsx`, `GasReadingCard.tsx`, `GasForm.tsx`; ostalih 9 UI fajlova nema nijedan `t()` poziv; `DashboardPage.tsx:588-591,626-660,665-724,815...` hardcoded EN naspram `DashboardPage.tsx:488,500,510,520` hardcoded BS upozorenja; `locales/config.ts:406-429` (init + samo browser detekcija, bez ručnog izbora i bez perzistencije odabrana); bs greške: `locales/config.ts:258` ("cilje temperature"), `:259` ("na cilji").
- Šta nije u redu i zašto: prebacivanje na `bs-BS` (browser jezik) mijenja samo gas ekran i prijavu — ostatak ostaje engleski, a dashboard miješa jezike unutar jednog ekrana; nema načina da korisnik ručno bira jezik (ključ `settings.language` postoji u prevodima, ali UI za njega ne postoji — `settings.*` sekcija je dead code); greške u kucanju oštećuju povjerenje u bs lokalizaciju.
- Dokaz: `rg -c "t('" src/pages src/components` (brojanje po fajlu, 2026-10-29); `rg -l useTranslation src/` → 5 fajlova; navedene linije.
- Preporuka: (1) ispraviti bs tipfelere; (2) preliti sve hardcoded stringove u resurse (početi s Dashboard i MainLayout); (3) dodati jezički selektor (header) s perzistencijom (`localStorage`) i `document.documentElement.lang` (FE-018); (4) izbaciti ili implementirati `settings.*` ključeve; (5) uvesti jednostavan test da nijedan fajl u `pages/` nema vidljivi hardcoded tekst izvan ikona/znakova.
- Kako provjeriti: e2e: jezik BS na svim ekranima; selektor mijenja jezik bez reloada; brojanje hardcoded stringova opada po dogovorenom redoslijedu.
- Trud: M — Zavisnosti: FE-014, odluka o prioritetu ekranâ.

### [FE-013] Pristupačnost: dialog bez ARIA/focus trap, switch bez labelle — Ozbiljnost: NISKO — Pouzdanost: VERIFIKOVANO (kod)
- Gdje: `frontend/src/components/GasForm.tsx:104-109` (custom `fixed inset-0` overlay, `<div role>` nema, nema `aria-modal`, `aria-labelledby`, Escape niti focus trap — fokus ostaje na poziciji izvan modalnog stabla), `frontend/src/components/MainLayout.tsx:145-152` (tema `Switch` bez `aria-label`, samo Tooltip), `GasReadingCard.tsx:57-61` (`window.confirm` — pristupačan, ali blokiran i bez custom a11y kontrole, prihvatljivo).
- Šta nije u redu i zašto: keyboard-only korisnik ne može zatvoriti modal Escape-om, screen reader ne oglašava modalni kontekst; tema switch se čita bez naziva. Ostatak (antd Table/Form/Tooltip) donosi osnovnu a11y.
- Dokaz: navedene linije; nema `role=`, `aria-` u `GasForm.tsx`.
- Preporuka: zamijeniti custom overlay s antd `Modal` (ima gotovu a11y) ili dodati `role="dialog"`, `aria-modal`, `aria-labelledby`, Escape handler i focus trap; `aria-label` na Switch; provjeriti kontrast iz `DESIGN_SYSTEM.md` tokom FE-005.
- Kako provjeriti: keyboard walkthrough (tastatura samo) u e2e; axe/playwright a11y sken bez "serious" nalaza na cljučnim ekranima.
- Trud: S — Zavisnosti: FE-005/FE-014.

### [FE-017] HomeProfile forma: nema `location`, nema `seasonMode`, zbunjujući 404, nekonzistentni defaulti — Ozbiljnost: SREDNJE — Pouzdanost: VERIFIKOVANO (kod), HIPOTEZA (uzorak prvokorisenja u produkciji)
- Gdje: `frontend/src/pages/HomeProfilePage.tsx:26-42` (interface bez `location`/`seasonMode` iako `types/homeProfile.ts` DTO nema `location` niti u backend-u — provjeriti ugovor), `:50-83` (load: 404 → `message.error('Failed to load home profile')` i forma ostaje s defaultima, `profileId=null` → POST pri prvom sačuvanju), `:125-137` (initialValues `targetMorningTemp: 22, targetDayTemp: 20`) naspram `:69-71` (fallback pri loadu `?? 20, ?? 21`), `frontend/src/types/homeProfile.ts` (bez `location`, bez `seasonMode` u Create/Update), backend: `HomeProfile.location` se koristi za weather (docs/audit/backend/05-weather.md), `seasonMode` postoji u shemi (03-data-model.md).
- Šta nije u redu i zašto: korisnik koji koristi isključivo web nikad ne može unijeti lokaciju grada — a to je jedini input za weather geokodiranje (FE-003); 404 "nemam profil" se prikazuje kao greška umjesto praznog "kreiraj svoj profil" stanja; `seasonMode` je u DTO/shemi, ali web ga ne može ni čitati ni pisati (form `HomeProfileFormValues` ga nema iako `HomeProfileResponse` ga deklariše); različiti defaulti (22/20/18 vs 20/21/18) znače da "prazan" profil nije isti kao "profil bez vrijednosti".
- Dokaz: navedene linije; `rg -n 'location' src/types src/pages` → bez rezultata (osim `homeLocation` u `ProfilePage` koje ide u `PUT /user`, a to je drugo polje); backend `05-weather.md` opisuje geokodiranje iz `HomeProfile.location`.
- Preporuka: dodati `location` u formu i DTO (s geokoderskim izborom prema backend planu 1.1 — FEAT-1: koordinate + izbor kandidate), dodati `seasonMode` Select, 404 → prazno "kreiraj profil" stanje, uskladiti defaulti s backend defaultima (jedan izvor).
- Kako provjeriti: e2e: novi korisnik → prazno stanje → kreira profil s lokacijom → weather se pojavi na dashboardu; tipovi poklapaju OpenAPI (FE-016).
- Trud: M — Zavisnosti: backend 1.1 (FEAT-1), FE-016 (OpenAPI tipovi).

### [FE-021] Tabele bez horizontalnog skrolovanja na uskim ekranima; dark mode FOUC — Ozbiljnost: NISKO — Pouzdanost: VERIFIKOVANO (kod)
- Gdje: `frontend/src/pages/HeatingPage.tsx:91`, `BoilerPage.tsx:151`, `ReportsPage.tsx:76`, `DashboardPage.tsx` (events tabela) — antd `Table` bez `scroll={{ x }}` i bez responzivnog skupa kolona; `frontend/src/index.css:34` (`body { overflow-x: hidden }` maskira prelijevanje umjesto da se riješi); `frontend/src/context/ThemeContext.tsx:22-30` (klasa `dark` se dodaje React `useEffect`-om) i `frontend/index.html` (nema inline skripte koja postavlja klasu prije rendera).
- Šta nije u redu i za što je bitno: na mobilnim širinama tabele (6-7 kolona, npr. boiler history) prelijevaju, a `overflow-x: hidden` na body-u ih tiho režimira — korisnik ne vidi dio tabele i ne zna da postoji više; dark mode korisnik pri svakom reloadu kratko vidi svijetlu verziju (FOUC) jer `localStorage` provjera čeka JS bundle.
- Dokaz: `rg -n 'scroll={\{' frontend/src` → bez rezultata; `index.css:34`; `ThemeContext.tsx:22-30`; `index.html` bez inline skripte.
- Preporuka: `scroll={{ x: ... }}` + po potrebi skrivanje manje bitnih kolona na uskim širinama; u `index.html` dodati minimalnu inline skriptu koja odmah primjenjuje `localStorage['boiler.theme']`; uklanjanje/omekšavanje `overflow-x: hidden` nakon popravke prelijevanja.
- Kako provjeriti: e2e na 360 px širini: tabela skrola horizontalno, nijedan sadržaj nije režimiran; reload s dark temom bez svijetlog flasha (Playwright screenshot prije/poslije).
- Trud: S — Zavisnosti: FE2-13/FE-005 (UI rad), FE2-4 (lazy rute, kako ne bi ometale mjeru FOUC-a).

### [FE-020] VAT stopa hardcoded na klijentu — Ozbiljnost: NISKO — Pouzdanost: VERIFIKOVANO (kod)
- Gdje: `frontend/src/pages/ProfilePage.tsx:93-98` (`watchedGasPrice * 1.17`), usporedba: `backend/src/modules/User/user.service.ts` (`GAS_PRICE_VAT_RATE = 0.17`, odgovor vraća `gasPriceVatRate`), `frontend/src/pages/GasAnalyticsPage.tsx` (PDV iz backend odgovora, ne hardcoded).
- Šta nije u redu i zašto: ako se stopa promijeni (zakonska izmjena), backend i web će divergirati; odgovor već vraća `gasPriceVatRate`, a web ga ignoriše.
- Dokaz: navedene linije (2026-10-29); backend `mapUserResponse` (user.service.ts).
- Preporuka: prikazivati `gasPriceIncVat`/`gasPriceVatRate` iz odgovora `/user` umjesto lokalnog izračuna; izbaciti `1.17`.
- Kako provjeriti: mock odgovor s drugačijom stopom → prikaz prati odgovor; unit test komponente.
- Trud: S — Zavisnosti: FE-016.
