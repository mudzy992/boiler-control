# MO2-12 — health score i alerti iz backenda

**Status:** RIJEŠENO U KODU 2026-11-01 (`5914c9f`), CI-verificirano.
**CI run:** `41347741131` na `5914c9f`.

## Cilj

Mobilni dashboard više ne računa lokalni health score niti lokalne alert
pragove. Jedan izvor istine je postojeći backend endpoint
`GET /api/dashboard/health`, koji već koristi web kroz FE2-14.

## Promjene

- `mobile/src/services/api/client.ts` dodaje `getDashboardHealth()`.
- `mobile/src/types/Dashboard.ts` dodaje tipove za health odgovor, komponente
  i upozorenja.
- `DashboardScreen` čita `['dashboard-health']` query i prikazuje backend
  `score` / `learningConfidence`; pri povlačenju osvježava i dashboard i health.
- Uklonjena je lokalna `calculateSystemHealthMetrics` formula i pragovi
  `12.5`, `tempDiff > 5`, `avgConfidence < 0.3`, `hoursSinceLastSeen > 24`.
- `AlertsCard` prima backend `warnings` i renderuje ih preko
  `mapHealthWarningsToAlerts()`.
- `AlertsCard` više ne zove `useColorModeValue` unutar `map` callbacka; svi
  hook pozivi su stabilni i bezuvjetni.
- Dodani su `healthWarnings.*` prijevodi za naslove upozorenja; tekst poruke
  dolazi iz backend odgovora.

## Migracija, rollback i flag

- Nema DB migracije.
- Nema backend promjene; endpoint već postoji.
- Nema novog flaga.
- Rollback je revert mobilnog commita `5914c9f`.
- Stari instalirani mobile klijenti nastavljaju raditi po starom kodu dok se
  ne ažuriraju; backend ugovor se ne mijenja.

## Testovi

Lokalno:

- `npm run type-check` — čisto;
- `npm run lint` — **0 grešaka / 78 warninga** (prije MO2-12 bilo 92 warninga;
  uklonjeni su conditional-hook warningi iz `AlertsCard`);
- `npm test -- --ci --coverage` — **4 suite / 40 testova**;
- `healthAlerts.ts` pokrivenost: 100% linija.

Novi testovi:

- `healthAlerts.test.ts` — 20 backend fixturea, mapiranje nivoa u severity,
  prazan odgovor i odsustvo mutacije backend odgovora;
- `dashboardHealthSource.test.ts` — statička regresija da dashboard čita
  backend health i da nema lokalne health/alert pragove.

## CI dokaz

Run `41347741131` na `5914c9f`:

- mobile **success** (type-check, lint, unit tests);
- backend `test` **success**;
- frontend failure samo na pre-existing `Deploy config consistent (FE2-7)`.

## Napomena o preostalim `> 5` pogodcima

Health/alert pragovi su uklonjeni iz dashboard/alerts koda. Preostali
`> 5` pogodci u `mobile/src` nisu health pragovi: validacija visine plafona
u `HomeManagementScreen` i granica prikaza liste u `RecentHeatingEvents`.
