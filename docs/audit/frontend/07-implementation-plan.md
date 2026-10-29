# Plan implementacije frontend-a — radna verzija

## Sažetak: pet prioriteta

1. **Talas 0:** stvarni type-check + popravka 11 grešaka, ESLint konfiguracija, čišćenje mrtvog koda i obrada grešaka mutacija (FE2-1/FE2-16/FE2-12).
2. **Talas 1:** jedna mjerodavna deploy konfiguracija + branch-only frontend CI (type-check, lint, build, e2e smoke) (FE2-7); zatim OpenAPI codegen i contract testovi (FE2-8).
3. **Talas 2:** sigurnost — httpOnly cookie + refresh usklađeno s backend 0.4 (FE2-2) i security headeri + gzip (FE2-6).
4. **Talas 3:** arhitektura i UX — React Query ujedinjenje (FE2-3), code-splitting (FE2-4), i18n kompletnost (FE2-5), a11y (FE2-13), testna infrastruktura (FE2-11).
5. **Talas 4:** funkcionalnosti usklađene s backend planom — weather ekran (FE2-9), "razlog preporuke" (FE2-10), poslovna logika na jednom mjestu (FE2-14), admin health (FE2-15).

## Otvorena pitanja

- Koja je stvarna produkcijska topologija (FE-009) i tko postavlja ivične header-e? Bez odgovora talas 2 (FE2-6) može biti dupliciranje.
- Odobrenje auth migracije (FE2-2) i rok prelaza postojećih sesija — ovisi o backend koraku 0.4.
- CILJNI LCP/veličina pragovi i minimalni preglednici (FE2-4).
- Admin ekran: da li se radi u ovom ciklusu i s kojim podacima (FE2-15, backend 5.2/OBS-1).

## Zajednička pravila svakog koraka

- Test-first gdje je moguće: prvo test koji fiksira postojeće ponašanje (Vitest/Playwright), zatim mala izmjena, dokaz prolaza. `CI` ovdje znači predloženi **frontend** branch-only workflow (isti obrazac kao backend: `on.push.branches` samo aktivna grana + `workflow_dispatch`, bez `pull_request`/`main`) — FE2-7 ga uvodi; do tada se komande pokreću lokalno.
- Obavezne komande nakon svakog koraka: `cd frontend && npm ci --no-audit --no-fund`, `npm run type-check` (nakon FE2-1: prava), `npm run lint` (nakon FE2-16), `npm run build` i, kad postanu, `npm run test` / `npm run test:e2e`.
- **Prihvat za sve korake:** navedeni ciljani testovi + obavezne komande + branch CI zeleni; starim klijentima održan ugovor ili odobren prelaz; ažuriran dokaz u `docs/audit/frontend/**`. Nijedan korak ne podrazumijeva PR, push bez korisničkog zahtjeva niti spajanje u `main`.
- Migracije: frontend nema DB sheme; "migracija" znači **API/ugovor i cache kompatibilnost** (stale oblici, query key-ovi, localStorage ključevi). Rollback = revert deploya prethodne verzije + (ako je uvedeno) feature flag off.
- Flagovi su prijedlog, ne postojeće funkcije. Troškovi S/M/L grubi.

## Talas 0 — hitna higijena

### 0.1 Stvarni type-check i popravka tipkih grešaka (FE2-1)
- **Cilj/fajlovi:** `frontend/tsconfig.json`, `frontend/package.json`, `frontend/src/pages/DashboardPage.tsx:215,870,1058,1060`, `frontend/src/pages/HomeProfilePage.tsx:16`, `frontend/src/services/notification.api.ts`.
- **Migracija/rollback, flag:** nema DB; bez flaga. Rollback = revert; nema uticaja na runtime osim ispravnih tipova.
- **Testovi:** `npm run type-check` (promijenjena u `tsc --noEmit -p tsconfig.app.json` ili `tsc -b`) + provjera `--listFiles` da se `src/**` kompajlira; namjerna tipka greška u odvojenom commitu ruši provjeru (negativni test). **Skripte:** postojeća `node scripts/audit/cors_headers_repro.cjs` nije ovdje; planirani `scripts/test-all.sh --help` (korijen) pokreće i frontend skup.
- **Prihvat/trud/kompatibilnost/zavisnosti:** S; nema API promjene; bez zavisnosti. Popravke: `homeProfileId` guard (`enabled` + non-null uz queryFn), tipizacija Collapse `items`, `updatedAt` u lokalni interface (ili FE2-8 tipovi), uklanjanje nepotrebnih importa.

### 0.2 ESLint konfiguracija i lint (FE2-16)
- **Cilj/fajlovi:** novi `frontend/eslint.config.mjs`, `frontend/package.json` (flat config skripta).
- **Migracija/rollback, flag:** bez flaga; rollback = revert (lint je gate, ne runtime).
- **Testovi:** `npm run lint` exit 0 na trenutnom kodu (dokumentovane iznimke, ako ih ima), namjerna loša linija ruši. **Skripte:** `scripts/test-all.sh --help` (planiran).
- **Prihvat/trud/kompatibilnost/zavisnosti:** S; zavisno od 0.1 (type-aware rules opcionalno).

### 0.3 Mrtav kod i obrada grešaka mutacija (FE2-12)
- **Cilj/fajlovi:** `frontend/src/services/notification.api.ts` (brisanje), `frontend/src/services/api.ts:119-122,102-105,146-149,249-252` (nepozvane metode), `frontend/src/pages/GasReadingsPage.tsx:247,43-51` (delete `onError` + poruka).
- **Migracija/rollback, flag:** bez flaga; prije brisanja `rg` provjera referenci u `frontend/` i (nakon Faze 3) mobile ne koristi web servis sloj. Rollback = revert.
- **Testovi:** tsc bez TS2339 skupine; `rg "notification\.api"` prazno; mock DELETE 500 → poruka, lista neobječana; 200 → invalidacija. **Skripte:** planirani `scripts/test-all.sh --help`.
- **Prihvat/trud/kompatibilnost/zavisnosti:** S; zavisno od 0.1.

## Talas 1 — infrastruktura i ugovori

### 1.1 Jedna deploy konfiguracija + frontend CI (FE2-7)
- **Cilj/fajlovi:** odluka o mjerodavnom setu (`docker-compose.yml` korijen vs. traefik varijante), `frontend/Dockerfile`, `frontend/nginx.conf`, novi `.github/workflows/frontend-audit.yml` (branch-only), `frontend/.dockerignore`.
- **Migracija/rollback, flag:** bez DB; rollback = vraćanje prethodnog compose seta. Do potvrde vlasnika ova stavka ne mijenja ništa u produkciji — samo dokumentuje i fiksira jedan set + CI.
- **Testovi:** `docker compose config` na izabranom setu, image build s zadanim `VITE_API_URL`, `curl /health`, provjera da ugrađeni `API_BASE_URL` u `dist` odgovara dogovoru; e2e smoke (login → dashboard) protiv mock backenda u CI. **Skripte:** planirani `scripts/dev-up.sh --help` (test servisi), `scripts/smoke.sh --help`.
- **Prihvat/trud/kompatibilnost/zavisnosti:** M; zavisnosti: vlasnik deploya (otvoreno pitanje), mock backend dogovor (FE2-11).

### 1.2 OpenAPI codegen i contract testovi (FE2-8)
- **Cilj/fajlovi:** `frontend/src/api/generated/` (novi), `frontend/package.json` (codegen script), zamjena ručnih tipova po modulu (gas, dashboard, auth, home-profile, notifications), contract testovi.
- **Migracija/rollback, flag:** bez DB; flag `OPENAPI_TYPES_ENABLED` nije potreban ako se radi po modulu; rollback = revert modula. Ovisi o backend 5.2 (`/api/docs-json` stabilan) — do tada koristiti lokalno snimljen `openapi.json` fixture.
- **Testovi:** codegen determinističan (dva pokretanja → isti izlaz), "openapi diff" CI korak (fail na promjeni specifikacije bez codegen), contract testovi: gas ugovori, dashboard, auth 401, home-profile (uključujući `location` kad backend 1.1 uveze). **Skripte:** `scripts/audit/frontend_inventory.py --help` (novi, inventar markera), planirani `scripts/test-all.sh --help`.
- **Prihvat/trud/kompatibilnost/zavisnosti:** M; zavisno od 0.1, 1.1; backend 5.2 (nema blokade — fixture).

## Talas 2 — sigurnost

### 2.1 httpOnly cookie + refresh (FE2-2)
- **Cilj/fajlovi:** `frontend/src/services/api.ts`, `frontend/src/context/AuthContext.tsx`, `frontend/src/pages/GasReadingsPage.tsx:14,95-115` (file download), backend 0.4 (SEC-4) — koordinate.
- **Migracija/rollback, flag:** migracija sesija: tokom prelaznog perioda podržati i Bearer i cookie (backend guard), flag `COOKIE_AUTH_ENABLED` na backendu; rollback = staru vratu, cookie ostaje inerciran. Istek postojećih Bearer sesija prema dogovorenom roku.
- **Testovi:** e2e: login → cookie `HttpOnly`+`Secure`, `localStorage` bez tokena; 401 → logout; refresh rotacija (stari refresh ne radi); file download s cookie-jem; XSS sandbox (CSP + cookie) ne može pročitati token. **Skripte:** planirani `scripts/smoke.sh --help`.
- **Prihvat/trud/kompatibilnost/zavisnosti:** L; zavisno od backend 0.4, 1.1 (deploy), mobile paritet (Faza 3); CORS `credentials` uskladiti (S-009).

### 2.2 Security headeri i gzip (FE2-6)
- **Cilj/fajlovi:** `frontend/nginx.conf`, `frontend/index.html` (`lang`), `frontend/src/locales/config.ts` (set `document.documentElement.lang`).
- **Migracija/rollback, flag:** bez flaga; rollback = revert. Ako vlasnik potvrdi da ivica postavlja header — dokumentovati i ne duplicirati.
- **Testovi:** `curl -I` provjera headera (e2e ili CI smoke), `Accept-Encoding: gzip` → kompresija, e2e da CSP ne blokira app (render + interakcija), `lang` za bs/en. **Skripte:** `scripts/smoke.sh --help` (planiran).
- **Prihvat/trud/kompatibilnost/zavisnosti:** S; zavisno od 1.1 (topologija).

## Talas 3 — arhitektura i UX

### 3.1 React Query ujedinjenje (FE2-3)
- **Cilj/fajlovi:** `frontend/src/main.tsx` (QueryClient defaultOptions), `DashboardPage.tsx` (replace `setInterval` → `refetchInterval` + visibility), `HeatingPage.tsx`, `BoilerPage.tsx`, `ReportsPage.tsx`, `NotificationsPage.tsx` (shared key s dashboard drawer).
- **Migracija/rollback, flag:** query key-ovi ostaju stabilni; rollback = revert; bez flaga.
- **Testovi:** unit: drawer i stranica dijele key (fake fetch); e2e: tab u pozadini bez poziva (mock interceptor), fokus vraća refetch; gas stranice bez dupliranih poziva. **Skripte:** planirani `scripts/test-all.sh --help`.
- **Prihvat/trud/kompatibilnost/zavisnosti:** M; zavisno od 1.2 (tipovi), 0.3.

### 3.2 Code-splitting i mjerena performansa (FE2-4)
- **Cilj/fajlovi:** `frontend/src/App.tsx` (lazy rute), `frontend/vite.config.ts` (`manualChunks`), novi build izvještaj.
- **Migracija/rollback, flag:** bez flaga; rollback = revert.
- **Testovi:** build izvještaj: više čipova, login čip bez pages; Playwright trace LCP na emuliranoj 4G/slow 3G unutar dogovorenog praga; e2e smoke na svim lazy rutama (Suspense fallback bez infinite spinnera). **Skripte:** planirani `scripts/smoke.sh --help`.
- **Prihvat/trud/kompatibilnost/zavisnosti:** S/M; zavisno od dogovora o pragovima.

### 3.3 i18n kompletnost (FE2-5)
- **Cilj/fajlovi:** `frontend/src/locales/config.ts` (popunjenje + ispravke bs, selektor + perzistencija + `document.lang`), svi `pages/*` i `MainLayout` (hardcoded → `t()`), uklanjanje dead `settings.*` ili implementacija.
- **Migracija/rollback, flag:** bez flaga; rollback = revert.
- **Testovi:** e2e: jezik BS na svim ekranima; selektor mijenja bez reloada i preživljava refresh; `document.lang` tačan; statička provjera da `pages/` nema novi hardcoded tekst (skripta brojanja). **Skripte:** `scripts/audit/frontend_inventory.py --help` (može izlaziti broj hardcoded stringova), planirani `scripts/test-all.sh --help`.
- **Prihvat/trud/kompatibilnost/zavisnosti:** M; zavisno od 0.2 (lint), 3.1 (tekstovi u komponentama).

### 3.4 A11y i responzivnost (FE2-13)
- **Cilj/fajlovi:** `frontend/src/components/GasForm.tsx` (antd Modal ili ARIA set + focus trap + Escape), `frontend/src/components/MainLayout.tsx` (aria-label Switch), tabele (`HeatingPage.tsx:91`, `BoilerPage.tsx:151`, `ReportsPage.tsx:76`, DashboardPage events) — `scroll={{ x }}` i/ili responzivne kolone, `frontend/src/index.css:34` (maskirajući `overflow-x: hidden`), `frontend/index.html` (minimalna inline skripta koja odmah primjenjuje `localStorage['boiler.theme']` — FE-021).
- **Migracija/rollback, flag:** bez flaga.
- **Testovi:** keyboard-only e2e walkthrough modala; axe sken bez serious nalaza na login/dashboard/gas ekranima; e2e na 360 px širini: tabela horizontalno skrola, nijedan sadržaj nije režimiran; reload s dark temom bez svijetlog flasha (screenshot prije/poslije). **Skripte:** planirani `scripts/test-all.sh --help`.
- **Prihvat/trud/kompatibilnost/zavisnosti:** S; zavisno od 3.3 (tekstovi), 3.2 (lazy rute, kako ne bi ometale mjeru FOUC-a).

### 3.5 Testna infrastruktura (FE2-11)
- **Cilj/fajlovi:** `frontend/package.json` (vitest, @testing-library, playwright, mock server), `frontend/vitest.config.ts`, `frontend/test/**`, `frontend/e2e/**`.
- **Migracija/rollback, flag:** bez promjene aplikacije; idempotentne komande.
- **Testovi:** sam CI: `npm run test` (unit/komponente: GasForm validacija (regex/3 decimale/budući datum/nula), GasReadingCard potrošnja (parni par očitanja), i18n fallback en), `npm run test:e2e` (login, dashboard render, gas unos s mock backendom, 401 redirect). **Skripte:** `scripts/dev-up.sh --help` (planiran), `scripts/test-all.sh --help` (planiran).
- **Prihvat/trud/kompatibilnost/zavisnosti:** M; osnovica za 3.1-3.4 i 4.x; zavisno od 1.1 (CI mjesto).

## Talas 4 — funkcionalnosti (usklađeno s backend planom)

### 4.1 Weather ekran v2 (FE2-9)
- **Cilj/fajlovi:** `HomeProfilePage.tsx` (lokacija: geokoder kandidati + koordinate + potvrda), `DashboardPage.tsx` (jedan izvor, satna/dnevna krivulja, starost/stale, WMO mapiranje), `types`/generated (FE2-8), backend 1.1/1.2 (FEAT-1).
- **Migracija/rollback, flag:** `WEATHER_UI_V2` default off; rollback = staru karticu; legacy oblik ostaje dok backend tranzicija ne završi.
- **Testovi:** e2e: novi korisnik → prazno stanje → kreira profil s lokacijom → weather se pojavi; stale > dogovorenog → oznaka; WMO mapiranje bs/en; contract test za novi DTO (fixture iz `scripts/audit/fixtures/`). **Skripte:** `node scripts/audit/weather_repro.cjs --help` (stara reprodukcija; prilagoditi nakon backend popravke), `scripts/test-all.sh --help`.
- **Prihvat/trud/kompatibilnost/zavisnosti:** L; zavisno od backend 1.1/1.2, 1.2 (tipovi), 3.3 (tekstovi), 3.5 (testovi).

### 4.2 "Razlog preporuke" (FE2-10)
- **Cilj/fajlovi:** nova komponenta `components/RecommendationBreakdown.tsx`, `DashboardPage.tsx`/`ReportsPage.tsx` (mount), generated tipovi, backend 2.1/2.2 (shadow breakdown polja).
- **Migracija/rollback, flag:** `RECOMMENDATION_BREAKDOWN_ENABLED` default off; rollback = isključi karticu.
- **Testovi:** component testovi po varijanti breakdowna (mock), e2e: breakdown prati mock backend odgovor (bez klijentske rekonstrukcije), a11y (tekst/tablica), disclaimer prisutan. **Skripte:** `node scripts/audit/formula_table.cjs --help` (kontekst formule), `scripts/test-all.sh --help`.
- **Prihvat/trud/kompatibilnost/zavisnosti:** M; zavisno od backend 2.x, 1.2, 3.5.

### 4.3 Poslovna logika na jednom mjestu (FE2-14)
- **Cilj/fajlovi:** `DashboardPage.tsx:376-403,480-526,176-177`, `BoilerPage.tsx:16-17` → backend endpoint (health/alerts) ili shared modul; uskladiti granice 48/55 vs 46/55; ispraviti overshoot semantiku.
- **Migracija/rollback, flag:** `CLIENT_RULES_ENABLED` default (stari) dok backend ne servira; rollback = staru logiku.
- **Testovi:** property-like unit testovi (isti unos → isti izlaz web/mobile shared), e2e za granicu (47.9/48/55/55.1), alert pravila fiksnih fixturea. **Skripte:** `node scripts/audit/dashboard_repro.cjs --help` (stara reprodukcija), `scripts/test-all.sh --help`.
- **Prihvat/trud/kompatibilnost/zavisnosti:** M; zavisno od backend dashboard koraka, 3.5, odluka o shared kodu.

### 4.4 Admin sistem health ekran (FE2-15)
- **Cilj/fajlovi:** novi `pages/AdminSystemPage.tsx` + ruta `/admin` (ProtectedRoute + ADMIN provjera), `MainLayout` (menu stavka samo za admin), generated tipovi, backend 5.2 (health/OBS-1 endpointi).
- **Migracija/rollback, flag:** `ADMIN_UI_ENABLED` default off; rollback = isključi.
- **Testovi:** role testovi (USER → 404/403 UI), e2e s mock podacima (poll po uređaju, otvoreni eventi, cron ishod, fallback svježina), bez PII labela. **Skripte:** `scripts/test-all.sh --help`.
- **Prihvat/trud/kompatibilnost/zavisnosti:** M; zavisno od backend 5.2, 1.2, 3.5.

## Sljedivost svih backlog stavki prema planu

| Backlog ID | Korak(ovi) |
|---|---|
| FE2-1 | 0.1 |
| FE2-16 | 0.2 |
| FE2-12 | 0.3 |
| FE2-7 | 1.1 |
| FE2-8 | 1.2 |
| FE2-2 | 2.1 |
| FE2-6 | 2.2 |
| FE2-3 | 3.1 |
| FE2-4 | 3.2 |
| FE2-5 | 3.3 |
| FE2-13 | 3.4 |
| FE2-11 | 3.5 |
| FE2-9 | 4.1 |
| FE2-10 | 4.2 |
| FE2-14 | 4.3 |
| FE2-15 | 4.4 |

## Katalog pomoćnih skripti

**Postojeće audit skripte ne mijenjaju aplikaciju; planirane skripte ne postoje i komande su njihove buduće specifikacije.**

| Skripta | Status, svrha | Način / korak |
|---|---|---|
| `scripts/audit/frontend_inventory.py` | PLAN: `frontend/src` + dokumentni markeri → pokrivenost stranica/ruta i nalaza (kao `backend_inventory.py`), bez semantike. | `python3 scripts/audit/frontend_inventory.py --help`; sve faze Faze 2. |
| `scripts/audit/document_selfcheck.py` | Postoji (backend); produžiti na frontend dokumente ili odvojena `frontend_selfcheck.py` sa istim marker principom. | `python3 scripts/audit/document_selfcheck.py --help`; samoprovjera. |
| `scripts/test-all.sh` | PLAN: nepopravljajući lint, type-check, build, test i audit izvještaj za backend + frontend; izlazni kod != 0 na padu. | `scripts/test-all.sh --help`; svaki korak. |
| `scripts/dev-up.sh` | PLAN: namjenski test PostgreSQL/Redis (backend) + mock backend (frontend e2e) sa izolovanim prefiksom; bez URL credentiala u izlazu. | `scripts/dev-up.sh --help`; 1.1, 3.5. |
| `scripts/smoke.sh` | PLAN: build image (backend/frontend), `/health`, osnovni e2e putanja; bez tajni u izlazu. | `scripts/smoke.sh --help`; 1.1, 2.2, 3.2. |

## Registar rizika i rollout/rollback

| Rizik | Utjecaj | Vjerovatnoća | Ublažavanje |
|---|---|---|---|
| FE2-2 (cookie/refresh) prekine postojeće sesije ili mobile paritet | VISOK | SREDNJA | Dvostruki prelazni period (Bearer + cookie), rok isteka, mobile provjera u Fazi 3, rollback flag |
| FE2-7 (deploy) promijeni ponašanje produkcije bez da se zna koja je stvarna | VISOK | SREDNJA | Prvo read-only potvrda topologije s vlasnikom, zatimCI-only promjene, ništa se ne deployuje u okviru plana |
| FE2-3 (RQ) promijeni cache/refetch ponašanje → dupli pozivi ili stara podataka | SREDNJA | SREDNJA | Globalni defaulti oprezno (staleTime 30-60 s), e2e mock brojač poziva, po modul po modul |
| FE2-8 (OpenAPI) codegen razlikuje se od stvarnog runtime ugovora | SREDNJA | NISKA | Contract testovi + fixture iz stvarnog endpointa; "openapi diff" u CI |
| FE2-9 (weather) pokrene loše geokodiranje/lokaciju u prod | SREDNJA | SREDNJA | Backend 1.1 prvo (koordinate + potvrda), flag, contract test, stale oznaka |
| FE2-4 (split) uvodi Suspense regresije (blank screen) | NISKO | NISKA | Fallback UI po ruti, e2e smoke svih ruta |
| FE2-5 (i18n) promijeni tekstove koje klijenti prepoznaju | NISKO | NISKA | Resurs ključevi stabilni, BS ispravke bez promjene ključeva |

**Rollout/rollback:** svaki talas je serija malih commitova na aktivnoj grani (bez PR prema `main`), svaki korak samostalno povratljiv (revert ili flag off); redoslijed je 0 → 1 → 2 → 3 → 4 uz zavisnosti iz svake stavke; ništa se ne deployuje u produkciju u okviru ovog plana — deploy ostaje vlasniku. Plan **nije odobrenje za aplikacijske izmjene**.
