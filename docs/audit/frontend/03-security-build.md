# Frontend sigurnost i build — nalazi

## Sažetak: pet vrhunska nalaza

1. **FE-002, VERIFIKOVANO:** JWT se čuva u `localStorage` i čita se iz svake axios poruke; ukupni rok je 24 h (backend `auth.module.ts`), bez refresh tokena i bez revokacije (S-004 iz Faze 1) — bilo koji XSS na domenu daje pristup računu dok token ne istekne.
2. **FE-009, VERIFIKOVANO (fajlovi):** tri međusobno suprotne deploy konfiguracije (korijenski compose, frontend compose sa traefik labelama, backend compose) s različitim hostovima, `VITE_API_URL` vrijednostima i portom 3021 koji ne odgovara nginx `listen 80` — nijedna konfiguracija nije provjerena protiv stvarne produkcije.
3. **FE-008, VERIFIKOVANO:** nginx ne dodaje nijedan security header (CSP, X-Frame-Options, HSTS, X-Content-Type-Options) i nema gzip/brotli.
4. **FE-014, VERIFIKOVANO (pokrenuto):** ne postoji nijedan test niti testna infrastruktura (nema skripte, nema direktorija, nema vitest/playwright zavisnosti).
5. **FE-015, VERIFIKOVANO (pokrenuto):** `npm run lint` ne radi — `frontend/` nema ESLint konfiguraciju (backend je ima), komanda izlazi kod 2.

## Otvorena pitanja

- Gdje je TLS/HSTS postavljan (traefik edge?) i da li edge već dodaje header, pa ih nginx ne bi smio duplicirati?
- Koja topologija je stvarna (povezano s FE-009 i backend B-029/S-009)?
- Odobrava li se prelazak s localStorage tokena na httpOnly cookie + refresh (backend SEC-4)?

### [FE-002] JWT u localStorage bez refresha/revokacije — Ozbiljnost: VISOKO — Pouzdanost: VERIFIKOVANO (kod), HIPOTEZA (stvarni XSS rizik)
- Gdje: `frontend/src/services/api.ts:22-49` (interceptor čita `localStorage.getItem('token')`; `setToken`/`clearToken` pišu `localStorage`), `frontend/src/context/AuthContext.tsx:24-26,44-54`, `frontend/src/pages/GasReadingsPage.tsx:14,95-115` (token se iz `localStorage` ručno postavlja u `fetch` header za preuzimanje fajlova), `frontend/src/components/ProtectedRoute.tsx:10-14`.
- Šta nije u redu i zašto: Bearer token je dostupan svim skriptama koje mogu da izvršavaju JavaScript na domenu (XSS → ukradeni token s 24-h važenjem, S-004: bez revokacije i bez provjere `isActive` u guardu). Redirekcija na `/login` po 401 (api.ts:34-37) briše token, ali to nije zaštita od krađe, a `ProtectedRoute` smatra aplikaciju prijavljenom dok god string postoji (bez provjere isteka). File download putanja (openProtectedFile) pravilno slježe token headerom, ali istovremeno pokazuje da pristup resursima potpuno zavisi od istog tokena u localStorage.
- Dokaz: navedene linije; backend 24-h token i odsustvo sesije/revokacije: `docs/audit/backend/08-security.md` S-003/S-004.
- Preporuka: uskladiti s backend planom (SEC-4): httpOnly Secure cookie za access token (kratki rok) + rotirajući refresh (httpOnly), CORS `credentials` u skladu, izbaciti direktno čitanje tokena iz skripti (fajlovi preko cookie/session), zadržati 401 handler koji radi logout + redirect. Dok se to ne uradi, barem: ne logovati token (trenutno se ne loguje — zadržati), dodati `SameSite=strict` na cookie prilikom uvođenja.
- Kako provjeriti: e2e: login → cookie `HttpOnly`, `localStorage` bez tokena, 401 → logout, refresh rotacija ruši stari refresh token; XSS sandbox test (mozdža CI) pokazuje da skripta ne može pročitati access token.
- Trud: L — Zavisnosti: backend 0.4 (SEC-4/S-004), deploy (FE-009), kompatibilnost postojećih sesija.

### [FE-008] Nginx bez security headera i bez kompresije — Ozbiljnost: SREDNJE — Pouzdanost: VERIFIKOVANO (fajl), HIPOTEZA (edge headeri nepoznati)
- Gdje: `frontend/nginx.conf` (cijeli fajl: `location /`, `/assets/`, `= /health`, `~ /\.`; nema `add_header` redova), `frontend/Dockerfile` (production stage `nginx:1.27-alpine`).
- Šta nije u redu i zašto: static app ne poslužuje nijedan od standardnih headera (`Content-Security-Policy`, `X-Frame-Options`, `Strict-Transport-Security`, `X-Content-Type-Options`) — clickjacking/XSS povijest je moguća ako edge (traefik) ih ne dodaje, a to nije provjereno; bez gzip/brotli jedini JS čip (2.972 kB, FE-004) ide "sirov" (905 kB gzip bi bio).
- Dokaz: `cat frontend/nginx.conf` (2026-10-29) — nijedan `add_header`; build izlaz (FE-004) pokazuje veličinu; edge konfiguracija ne postoji u repozitoriju.
- Preporuka: dodati minimalan skup headera u nginx (`X-Content-Type-Options nosniff`, `X-Frame-Options DENY` ili frame-ancestors CSP, `Referrer-Policy no-referrer`, CSP prilagođena antd/plots) ili eksplicitno dokumentovati da ih postavlja edge; uključiti `gzip`/`brotli` za text/javascript,css; provjeriti HSTS na edge-u (traefik) i ne duplicirati.
- Kako provjeriti: `curl -I` (ili e2e) pokazuje header-e; `curl -H 'Accept-Encoding: gzip'` pokazuje kompresovan odgovor; edge provjera odvojeno.
- Trud: S — Zavisnosti: FE-009 (topologija), edge vlasnik.

### [FE-009] Tri suprotne deploy konfiguracije u repozitoriju — Ozbiljnost: SREDNJE — Pouzdanost: VERIFIKOVANO (fajlovi), HIPOTEZA (koja je produkcija)
- Gdje: `docker-compose.yml` (korijen: frontend `VITE_API_URL: https://api.boiler-control.ba101.top/api`, backend `FRONTEND_URL=https://boiler-control.ba101.top`, samo `expose`, bez traefik labela), `frontend/docker-compose.yml` (traefik: host `boiler.ba101.top`, `VITE_API_URL=/backend/api`, `expose 3021` + `loadbalancer.server.port=3021` **dok `frontend/nginx.conf` sluša na 80**), `backend/docker-compose.yml` (traefik: `boiler.ba101.top/backend/` → port 3020 s strip-prefix — konzistentno).
- Šta nije u redu i zašto: (a) port 3021 u frontend compose nikad ne odgovara nginx-u (80) — ta varijanta ne bi radila s traefikom; (b) korijenski compose koristi apsolutnu URL za API (`api.boiler-control.ba101.top`) → cross-origin pozivi, pa backend CORS origin (`FRONTEND_URL`) mora biti tačan host — a hostovi se razlikuju između varijanti (`boiler-control.ba101.top` vs `boiler.ba101.top`); (c) `frontend/.dockerignore` ne isključuje `docker-compose.yml`/nginx (manje bitno), ali `backend/.env` jest praćen (S-005 iz Faze 1) — ukupno: nijedna konfiguracija nije provjerena protiv stvarne produkcije, pa se ne može tvrditi ni kako korisnici danas uopće dolaze do API-ja.
- Dokaz: `cat` navedenih fajlova (2026-10-29); traefik labele i `listen 80` u istom setu; backend CORS behavior iz `docs/audit/backend/08-security.md` S-009 (fiksni origin, bez refleksije).
- Preporuka: odrediti jednu mjerodavnu topologiju s vlasnikom (produkcija + staging), sačuvati je kao jedini set fajlova (brisati ostale ili ih jasno označiti), uskladiti `VITE_API_URL`/`FRONTEND_URL`/porte u istom fajlu, i dodati CI smoke test koji gradi frontend uz zadane build-argove i provjerava da je ugrađeni `API_BASE_URL` ekvivalentan expected.
- Kako provjeriti: jedinstveni compose set prolazi `docker compose config` + image build + curl `/health`; ugrađeni API base iz `dist` odgovara dogovorenom; CORS provjera iz stvarnog frontend hosta (S-009 repro proširen).
- Trud: M — Zavisnosti: vlasnik deploya (isto otvoreno pitanje iz Faze 1, B-011/B-029/S-009).

### [FE-014] Nema testova niti testne infrastrukture — Ozbiljnost: SREDNJE — Pouzdanost: VERIFIKOVANO (pokrenuto)
- Gdje: `frontend/package.json` (skripte: samo `dev`, `build`, `preview`, `lint`, `type-check`; devDependencies bez `vitest`, `@testing-library/*`, `playwright`, `jsdom`), `find frontend -name '*.test.*' -o -name '*.spec.*'` → bez rezultata (osim `node_modules`).
- Šta nije u redu i zašto: nijedan korak nadogradnje (auth promjena FE-002, i18n FE-005, RQ migracija FE-006) nema mrežu sigurnosti; backend CI pokreće samo backend testove, pa frontend regresije izlaze tek u produkciji.
- Dokaz: `cat frontend/package.json` i `find` (2026-10-29).
- Preporuka: uvesti Vitest + Testing Library (unit/komponente: GasForm validacija, GasReadingCard potrošnja, i18n fallback) i Playwright e2e smoke (login, dashboard učitavanje, dodavanje gas očitanja s mock backendom), pokretanje u istom branch-only workflowu s mock API-jem ili sa backend servisima iz CI.
- Kako provjeriti: `npm run test` i `npm run test:e2e` postoje, idempotentni su i padaju na namjernom grešci; CI green.
- Trud: M — Zavisnosti: FE-001/FE-007 (plan talas 0/1), mock backend dogovor.

### [FE-015] `npm run lint` ne radi — nema ESLint konfiguracije — Ozbiljnost: NISKO — Pouzdanost: VERIFIKOVANO (pokrenuto)
- Gdje: `frontend/package.json` (`"lint": "eslint src --ext ts,tsx"`; devDependencies `eslint ^8.56.0`, `@typescript-eslint/*`, `eslint-plugin-react`), `ls -a frontend/` → bez `.eslintrc*`/`eslint.config.*` (backend ima `eslint.config.mjs`).
- Šta nije u redu i zašto: komanda izlazi s kodom 2 ("ESLint couldn't find a configuration file"), pa niko ne može znati stanje lint-a; script dependencyi postaju mrtvi.
- Dokaz: `cd frontend && npm run lint` → gornja poruka, exit 2 (2026-10-29).
- Preporuka: dodati `eslint.config.mjs` (flat config, typescript-eslint + react), `lint` skripta prilagođena flat configu, i uključiti u CI zajedno s type-checkom.
- Kako provjeriti: `npm run lint` exit 0 na trenutnom kodu (uz eventualno dokumentovane iznimke) i ruši namjerno lošu liniju.
- Trud: S — Zavisnosti: FE-014/CI (FE-007 plana).

### [FE-018] `index.html` bez CSP meta i statički `lang="en"` — Ozbiljnost: NISKO — Pouzdanost: VERIFIKOVANO (fajl)
- Gdje: `frontend/index.html` (cijeli: `lang="en"`, meta charset/viewport/title, faviconi; nema CSP meta ni `theme-color`).
- Šta nije u redu i za što je bitno: bez CSP (iako ga FE-008 dodaje na nivou nginx/edge) nema drugog sloja zaštite; `lang` ostaje `en` čak i kad i18next bira `bs-BS` (screen readeri i fontovi dobijaju krivu oznaku jezika).
- Dokaz: `cat frontend/index.html` (2026-10-29).
- Preporuka: nakon FE-008, uvesti CSP header (ne meta) na nivou servisa; `document.documentElement.lang` postaviti u `locales/config.ts` nakon i18next init-a; `theme-color` za mobilne preglednike.
- Kako provjeriti: e2e provjera `lang` za bs/en; header provjera iz FE-008.
- Trud: S — Zavisnosti: FE-005/FE-008.
