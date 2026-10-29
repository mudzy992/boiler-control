# Frontend veza s backend planom (Faza 1)

## Sažetak

- **Weather:** web **ne može postaviti lokaciju** (FE-017) a koristi dva paralelna izvora vremena (`GET /api/dashboard` → `system.weather` i `GET /api/weather/current/:id`) — backend plan 1.1/1.2 (FEAT-1) traži koordinate + potvrdu u `HomeProfile` i jedan izvor.
- **Formule:** web prikazuje samo brojke (`Suggested Flow Temp`, `recommendation` iz dashboarda) — **nema prikaza "zašto ova temperatura"** (osnovna krivulja, korekcije, povjerenje) koji je u backend planu 2.x (shadow mode → canary).
- **Realtime:** dashboard ručno polluje 3 endpointa svakih 60 s (FE-006); backend plan 3.x predlaže Redis/worker i opcionalno SSE — web treba jedan dogovoreni mehanizam osvježavanja, ne tri.
- **Admin/system health:** web nema nijedan admin ekran (poslovi, poll stanje, fallback) — backend 5.2 (OBS-1, health) treba paritetni prikaz.
- **OpenAPI:** svi frontend tipovi su ručni (FE-016); backend već izdaje Swagger (`/api/docs`); plan 5.2 predviđa OpenAPI kao izvor tipova.

## Otvorena pitanja

- Da li se weather ekran razdvaja (posvećena stranica) ili ostaje dio dashboard kartice?
- Kome je namijenjen admin health prikaz (ADMIN uloga već postoji u backend guardu — koristiti je)?
- SSE ili polling (60 s) za live status — vezano uz backend R-002 (worker) i trošak infrastrukture.

## Po području (ukrštaj s `docs/audit/backend/10-implementation-plan.md`)

### 1. Weather ekran (backend koraci 1.1/1.2, FEAT-1)

- **Trenutno (VERIFIKOVANO):** `DashboardPage.tsx:210-246` — `useQuery(['weather-current', homeProfileId])` + fallback na `data.system.weather`; polja se mapiraju dualno (`temperature ?? temp`, `feelslike ?? feelsLike`, `condition_text ?? condition`); prikaz: temperatura, feels-like, sirovo `condition` (backend vraća `WMO_<kod>`, B-002/W nalazi iz Faze 1 — web nema mapiranje niti i18n za stanja), vlaga, vjetar, min/max; nema starosti podataka (`fetchedAt` postoji u interfaceu, ali se ne prikazuje), nema satne/dnevne krivulje, nema izbora/protvrde lokacije (FE-017: `location` uopšte nije upisiv iz weba).
- **Ciljni dizajn (uskladiti s 05-weather.md):** forma lokacije s geokoder kandidatum i koordinatama (backend 1.1), satna 48-72 h + dnevna 3-7 dana krivulja, oznaka starosti + stale flag, mapirana WMO stanja (bs/en), jedan izvor (ukloniti `system.weather` duplicitet nakon backend tranzicije), eksplicitno "nema podataka / stara prognoza" stanja.
- **Testni plan:** component testovi za fallback/stale/empty; e2e s mock providera (fixture iz `scripts/audit/fixtures/`), contract test za novi weather DTO (backend 1.2); provjeriti da stari klijenti (mobile) ne ovise o uklonjenom obliku.

### 2. Prikaz formule "zašto ova temperatura" (backend koraci 2.1-2.2, FORM-1)

- **Trenutno (VERIFIKOVANO):** `DashboardPage.tsx:696-703` prikazuje `Suggested Flow Temp` i `Actual Flow Temp` (s delta bojom na BoilerPage:118-125); `ReportsPage.tsx:44-56` prikazuje `recommendedFlowTemp`, `expectedHeatTimeMin`, `confidenceScore` (0-1 → %) — bez objašnjenja komponenti (ext temp, korekcije, confidence smisao, learning offset).
- **Ciljni dizajn:** kartica "Razlog preporuke" koja renderira struktuirani breakdown (nova backend polja iz shadow moda: baza krivulje, korekcije po komponenti s jedinicama, confidence + broj uzoraka), uz disclaimer da je to savjetodavni prikaz (stručna potvrda ograničenja iz Faze 1). Prikazati samo ono što backend eksplicitno vrati (nema klijentskih rekonstrukcija — FE-010).
- **Testni plan:** snapshot/component testovi po breakdown varijanti; e2e sa shadow odgovorima; a11y (tabella/tekst umjesto samo grafikon).

### 3. Admin i stanje sistema (backend korak 5.2, OBS-1)

- **Trenutno:** ne postoji. Metrike backend izlaže samo na `/metrics` (S-001: bez guarda, s PII labelama).
- **Ciljni dizajn:** admin-only ekran (koristiti `ADMIN` ulogu) s: zadnji poll po uređaju + status, broj otvorenih eventsa, fallback svježina, cron zadnji ishod (gas reminder, daily recommendation, anomaly job), temperature health score po uređaju. Podaci isključivo iz novih backend endpointa (nema PII labela — S-001).
- **Testni plan:** role testovi (USER ne vidi), e2e s mock podacima.

### 4. Realtime osvježavanje (backend 3.x, R-002)

- **Trenutno:** `setInterval` 60 s × 3 poziva (FE-006) + RQ staleTime ad-hoc (1/5/10 min).
- **Ciljni dizajn:** jedan mehanizam: ili `refetchInterval` s visibility pauzom (najjeftinije, bez infrastrukture), ili SSE/WebSocket nakon uvoda Redis pub/sub u backendu. Dogovoriti frekvenciju po ekranu (dashboard 30-60 s, gas stranica po akciji, reports rijetko).
- **Testni plan:** e2e provjera da tab u pozadini ne polluje; mock gubitka konekcije → degradirana oznaka, ne beskonačan spinner.

### 5. OpenAPI tipovi i ugovori (backend korak 5.2, API-1)

- **Trenutno:** ručni interfacei (FE-016), neki stale (npr. `Notification` bez `deliveryOk` u dashboardu vs. s njim u `notification.api.ts`; `HomeProfileResponse` bez `location`).
- **Ciljni dizajn:** generisanje `src/api/generated/` iz `openapi.json` (backend `/api/docs-json` nakon 5.2), zamjena ručnih tipova po modulu, contract testovi (Playwright + mock server iz openapi specifikacije), zadržavanje uske legacy sloja do verzioniranja `/v1`.
- **Testni plan:** CI korak "openapi diff" (fail na promjeni ugovora bez izmjene codegen), e2e smoke.

### 6. Granice i opći dogovori

| Tema | Backend stanje (Faza 1) | Frontend djelovanje |
|---|---|---|
| Set-current-temp granice | clamp [46, 55] (06-formulas.md), B-019 | web dozvoljava 48-55 u dva fajla (FE-010) — uskladiti jedan izvor |
| `PATCH /boiler/current-temp` | poznati lokalni upis (read-only uređaji, plan 0.0 kontekst) | zadržati, ali s potvrdom i jasnom porukom da se piše u DB, ne na uređaj |
| Notifikacije | B-006 IDOR (web je žrtva/aktor), preferences ugas/uključi | FE-006 ujednačavanje; nakon backend popravke contract test owner scope |
| Gas upload | S-006 (MIME ne provjerava sadržaj) | FE-012/FE-017: client accept liste su samo UX — ne smiju se smatrati sigurnošću |
| `GET /api/weather` stub | B-002 (vraća `{}`) | web ga već ne poziva (FE-011) — ne uvesti bez backend popravke |
