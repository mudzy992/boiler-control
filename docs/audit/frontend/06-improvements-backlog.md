# Backlog nadogradnji frontend-a — radna verzija

## Sažetak: pet prioriteta

1. Otkriti i popraviti tipke greške + laganje `type-check` skripte, jer ništa drugo ne može biti sigurno bez toga (FE-001).
2. Uskladiti deploy konfiguraciju i uvesti frontend CI (type-check, build, lint, e2e smoke) — današnji "green" ne postoji (FE-007/FE-009/FE-015).
3. Autentifikacija: izbaciti token iz `localStorage` prema backend planu SEC-4 (FE-002) + security headeri i gzip (FE-006/FE-008).
4. Jedan izvor podataka: React Query s globalnim defaultima, OpenAPI generisani tipovi, uklanjanje dupliranih notifikacijskih stanja (FE-006/FE-016).
5. Weather i formula površi uskladiti s backend planom (lokacija u formi, starost podataka, breakdown "zašto ova temperatura") (FE-003/FE-010/FE-017).

## Otvorena pitanja

- Koja deploy topologija je stvarna (FE-009) i tko je vlasnik ivice (TLS/HSTS/headeri)?
- Odobrava li se auth migracija na httpOnly cookie + refresh i koji je rok prelaza za postojeće sesije (backend SEC-4)?
- CILJNI performantni pragovi (LCP, veličina prvočitanih čipova) i minimalni preglednici?
- Da li se admin health ekran radi u ovom ciklusu i s kojim podacima (OBS-1 iz Faze 1)?

## Metod

Kao u backend backlogu: **VERIFIKOVANO** = potvrđeno kodom/izvođenjem; korist i prihvatni pragovi su prijedlozi/**HIPOTEZA** dok vlasnik ne potvrdi; S/M/L = redoslijed zahvata, ne rokovi. **Nijedna stavka nije odobrenje za implementaciju.** Redoslijed i testovi su u `07-implementation-plan.md`.

## Sigurnost i privatnost

| ID | Problem i dokaz | Prijedlog i korist | Trud | Rizik / zavisnosti | Kriterij prihvatanja |
|---|---|---|---|---|---|
| FE2-2 | **VERIFIKOVANO:** Bearer token u `localStorage` (api.ts:22-49, AuthContext.tsx:24-26), 24-h rok bez revokacije (S-004), `ProtectedRoute` vjeruje postojanju stringa (FE-002). | httpOnly Secure cookie access token + rotirani refresh, logout/401 handler, cookie model za file download; uskladiti s backend 0.4 (SEC-4). | L | Prekid postojećih sesija, CORS `credentials`, mobile paritet (SecureStore), deploy (FE2-7). | `localStorage` bez tokena, 401 → logout, refresh rotacija testirana, XSS sandbox ne može pročitati access token. |
| FE2-6 | **VERIFIKOVANO:** nginx bez CSP/XFO/HSTS/XCTO i bez gzip (nginx.conf, FE-008); index.html bez CSP meta, statički `lang="en"` (FE-018). | Minimalan skup headera (ili eksplicitno na ivici), gzip/brotli, `lang` iz i18next, `theme-color`. | S | Dupliciranje s ivičnim headerima; CSP breakage (antd/plots). | `curl -I` pokazuje header, kompresija aktivna, CSP ne blokira app (e2e). |

## Pouzdanost i arhitektura

| ID | Problem i dokaz | Prijedlog i korist | Trud | Rizik / zavisnosti | Kriterij prihvatanja |
|---|---|---|---|---|---|
| FE2-1 | **VERIFIKOVANO:** `npm run type-check` lažno zeleno (tsconfig `files: []`), stvarno 12 grešaka (FE-001). | `tsc -p tsconfig.app.json` (ili `-b`) kao prava skripta, popraviti 12 grešaka, CI korak type-check. | S | Nalaz novo slomljenog koda; redoslijed s FE2-12. | tsc provjerava `src/**` (listFiles), green, namjerna greška ruši CI. |
| FE2-3 | **VERIFIKOVANO:** mešoviti dohvati, `setInterval` 60 s bez visibility pauze, dva notifikacijska stanja, QueryClient bez defaulta (FE-006). | Sve stranice na React Query s globalnim defaultima (staleTime, retry, focus refetch), `refetchInterval` umjesto `setInterval`, jedno notifikacijsko stanje. | M | Ponašanje cachea/refetcha; paralelni pozivi; FE2-8 tipovi. | Drawer i stranica dijele key; tab u pozadini bez poziva; gasne stranice bez dupliranja. |
| FE2-7 | **VERIFIKOVANO:** tri suprotne compose varijante, port 3021 vs listen 80, različiti hostovi/VITE_API_URL (FE-009); nema frontend CI. | Jedna mjerodavna konfiguracija (vlasnik potvrđuje), ostale ukloniti/označiti; branch-only CI: type-check, lint, build, e2e smoke; build uz zadane ARG-ove + provjera ugrađenog API base. | M | Produkcija neprovjerena (kao u Fazi 1 B-011/B-029); vlasnik deploya. | Jedan set prolazi `docker compose config` + build + `/health`; CI zelen na grani; build-arg provjera ugrađenog base URL-a. |
| FE2-14 | **VERIFIKOVANO:** health score i pravila upozorenja + granice 48/55 duplirane na klijentu, "overshoot" znak obrnut (FE-010); backend clamp [46,55] (06-formulas.md). | Logika jednom (backend endpoint ili shared modul), uskladiti granice s vlasnikom, ispraviti semantiku overshoota. | M | Paritet mobile (GEMINI); backend plan dashboard/formula koraci. | Iste ulazne vrijednosti daju iste izlaze na web/mobile; e2e za granicu. |

## Performanse

| ID | Problem i dokaz | Prijedlog i korist | Trud | Rizik / zavisnosti | Kriterij prihvatanja |
|---|---|---|---|---|---|
| FE2-4 | **VERIFIKOVANO (build):** jedan čip 2.972 kB / gzip 905 kB, bez lazy rut ni chunking (FE-004). | `React.lazy`+`Suspense` po grupama, `manualChunks` (antd, plots, axios, dayjs), izmjera po čipu i LCP. | S/M | Ponašanje Suspense fallbacka; rute; FE2-7 (mjeranje u CI). | Više čipova, login bez svih pages, LCP unutar dogovorenog praga na sporoj vezi. |

## Funkcionalnosti

| ID | Problem i dokaz | Prijedlog i korist | Trud | Rizik / zavisnosti | Kriterij prihvatanja |
|---|---|---|---|---|---|
| FE2-5 | **VERIFIKOVANO:** i18n u 5/14 fajlova, hardcoded EN/BS mješavina, nema selektora, bs tipfelere (FE-005, FE-018). | Preliti sve stringove u resurse, jezički selektor s perzistencijom i `document.lang`, ispraviti bs, izbaciti dead `settings.*` ili implementirati. | M | Obim prevoda; e2e pokriće; FE2-13 a11y. | BS ekran za ekran, selektor bez reloada, brojanje hardcoded opada. |
| FE2-9 | **VERIFIKOVANO:** web ne može postaviti `location` (FE-017), dvostruki weather izvor, sirovi WMO kod, nema starosti (FE-003; backend 05-weather.md). | Forma lokacije (geokoder kandidati + koordinate prema backend 1.1), satna 48-72 h + dnevna krivulja, starost/stale oznaka, mapirana WMO stanja, jedan izvor. | L | Backend 1.1/1.2, mobilni paritet, legacy oblik. | Novi korisnik postavi lokaciju → weather na dashboardu; stale > dogovorenog → oznaka; contract test. |
| FE2-10 | **VERIFIKOVANO:** nema prikaza komponenti preporuke (DashboardPage:696-703, ReportsPage:44-56; backend 2.x shadow). | "Razlog preporuke" kartica iz struktuiranog backend breakdowna (baza, korekcije s jedinicama, confidence + uzorci), disclaimer savjetodavnosti. | M | Backend 2.1/2.2 polja; a11y prikaza. | Breakdown se mijenja s backend odgovorom (mock), bez klijentske rekonstrukcije. |
| FE2-15 | **VERIFIKOVANO:** nema admin prikaza sistema (OBS-1/S-001 iz Faze 1). | Admin-only ekran (ADMIN uloga): zadnji poll po uređaju, otvoreni eventi, fallback svježina, cron ishodi, health po uređaju — samo iz novih backend endpointa. | M | Backend 5.2 health/OBS-1; PII minimizacija. | USER ne vidi ekran (role test), e2e s mockovima, bez PII labela. |

## API

| ID | Problem i dokaz | Prijedlog i korist | Trud | Rizik / zavisnosti | Kriterij prihvatanja |
|---|---|---|---|---|---|
| FE2-8 | **VERIFIKOVANO:** ručni stale tipovi, defanzivni dvostruki shape, dva različita Notification interfacea (FE-016). | Codegen iz OpenAPI (`/api/docs-json` nakon backend 5.2), zamjena po modulu, contract testovi, uski legacy sloj do `/v1`. | M | Backend OpenAPI stabilnost; redoslijed s FE2-3. | CI "openapi diff" ruši promjenu bez codegen; contract testovi pokrivaju gas/dashboard/auth. |

## Održavanje i kvalitet

| ID | Problem i dokaz | Prijedlog i korist | Trud | Rizik / zavisnosti | Kriterij prihvatanja |
|---|---|---|---|---|---|
| FE2-11 | **VERIFIKOVANO:** nema testova niti infrastrukture (FE-014). | **DJELIMIČNO RIJEŠENO 2026-10-30 (FE2-11, `d328afc`):** Vitest 3.2.4 + Testing Library + jsdom, **37 testova u 3 suitea** (GasForm validacija 13, GasReadingCard potrošnja 16, i18n fallback 8) + CI korak „Unit and component tests (FE2-11)“. Mutacijski testirano: svaka jedinica pada na namjerno grešci (1/3/2 pada). Uzgred popravljen stvarni bug — `errors.readingDate` se postavljao ali nikad nije prikazan. **OSTAJE OTVORENO:** Playwright e2e smoke (`test:e2e`) — Chromium download pada u sandboxu (`Download failure, code=1`, CDN nije dostupan), pa se ne može verificirati lokalno; traži odluku vlasnika o uvođenju browser binarki u CI. | M | Održavanje mockova; redoslijed s FE2-7. | `npm run test` i `test:e2e` idempotentni, padaju na namjerno grešci, CI zelen. |
| FE2-12 | **VERIFIKOVANO:** mrtav `notification.api.ts` (5 tsc grešaka), 4 nepozvane API metode, delete bez `onError` (FE-011, FE-012). | Obrisati mrtvi modul i nepotrebne metode (uz provjeru potrošača), dodati `onError` poruke na mutacije. | S | Mogući skriveni potrošači (mobile koristi vlastiti kod — provjeriti u Fazi 3). | tsc green bez ovih grešaka, `rg` bez referenci, 500 na delete → poruka. |
| FE2-13 | **VERIFIKOVANO:** GasForm dialog bez role/aria/focus trap/Escape, Switch bez aria-label (FE-013); tabele bez horizontalnog skrolovanja + `overflow-x: hidden` maskira prelijevanje, dark mode FOUC (FE-021). | antd Modal ili puni ARIA set + focus trap + Escape; `aria-label` na switch; `scroll={{x}}` na tabelama + minimalna inline tema skripta u `index.html`; axe sken u e2e. | S | UI promjena; FE2-5 (tekstovi); FE2-4 (lazy rute). | Keyboard-only walkthrough prolazi, axe bez serious nalaza, tabela na 360 px skrola, reload bez svijetlog flasha. |
| FE2-16 | **VERIFIKOVANO:** lint ne radi (nema ESLint konfiguracija, exit 2, FE-015). | `eslint.config.mjs` (flat, typescript-eslint + react), prilagođena skripta, CI korak. | S | Broj novonalaženja; iznimke dokumentovane. | `npm run lint` exit 0, namjerna loša linija ruši. |
