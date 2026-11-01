# SEC-6 — zaštita metrics endpointa i uklanjanje monitoring stack artefakata

**Status:** RIJEŠENO U KODU 2026-11-01 (`6845060`), CI-verificirano.
**Vlasničke odluke:** `token_fail_closed`, `aggregate_worst`, `minimize_reporting`,
`keep_metrics_remove_stack`.

## Cilj

Zaštititi sve `/metrics*` rute zasebnim scraper tokenom, ukloniti ID labele iz
Prometheus reporting izvoza, minimizirati reporting logove i ukloniti repo
artefakte Prometheus/Grafana monitoring stacka. Korisnički JWT se ne koristi za
metrics. Produkcijska mrežna izolacija i gašenje već pokrenutih kontejnera nisu
mogli biti verificirani iz ovog okruženja.

## Ponašanje

`MetricsAuthGuard` čita `METRICS_AUTH_TOKEN` pri svakom zahtjevu:

- token nedostaje, kraći je od 32 znaka ili sadrži whitespace → **503**;
- `Authorization` header nedostaje, nije Bearer šema ili se token ne poklapa → **401**;
- ispravan `Authorization: Bearer <token>` → **200**;
- svi odgovori nose `Cache-Control: no-store`;
- poređenje koristi SHA-256 digest + `timingSafeEqual`, bez ranog izlaza po dužini;
- token se ne loguje i ne šalje u query/cookie obliku.

Nema javnog bypass flaga. Rollback je prethodni image samo uz odobrenu
mrežnu/proxy zaštitu; ne vraćati javni pristup kao trajno stanje.

## Reporting agregati

Postojeća imena metrika su zadržana, ali bez `deviceId`, `userId` i
`homeProfileId` labela:

| Metrika | Novo značenje |
|---|---|
| `reporting_home_health_score` | najniži health score među domovima |
| `reporting_anomaly_rate_per_hour` | najveća anomaly stopa |
| `reporting_fallback_rate_per_hour` | najveća fallback stopa |
| `reporting_active_alerts` | broj aktivnih alertata po severity |

Ako nema reporting podataka, health/rate gauge se ne emituje; active alerts se
i dalje emituju. Interni `HomeReportMetrics` i `Alert` objekti zadržavaju ID-eve
za postojeći interni kod, ali se oni ne pojavljuju u Prometheus tekstu,
reporting logovima ni alert porukama.

## Uklonjeni artefakti

Obrisani su:

- `docker-compose.monitoring.yml`;
- `docs/internal/monitoring/` Prometheus/Grafana konfiguracije, dashboardi i
  setup vodič.

Root i aplikacijski compose nisu mijenjani. Ovo ne gasi već pokrenute
produkcijske kontejnere; vlasnik ih može ugasiti/ukloniti na serveru ako želi.

## Konfiguracija

Backend proces mora dobiti `METRICS_AUTH_TOKEN` iz secret/env mehanizma.
Primjer generisanja: `openssl rand -hex 32`. Vrijednost se ne commituje.
Ako token nije postavljen, metrics endpointi namjerno vraćaju 503.

Smoke testovi za metrics sada zahtijevaju `METRICS_AUTH_TOKEN` i šalju Bearer
header. Postojeći backend unit/integration testovi koriste nasumični testni
token; CI ne koristi produkcijsku tajnu.

## Testovi i skripte

- `backend/src/common/tests/metrics-auth.spec.ts` — stvarni Nest HTTP,
  503/401/200 za sve četiri rute, rotacija tokena, pogrešne šeme, no-store,
  JSON/text oblik i odsustvo ID labela.
- `backend/src/common/tests/reporting-sec6.spec.ts` — worst-case agregati,
  prazan reporting, odsustvo sirovih ID-eva u logovima/alert tekstu.
- `node scripts/audit/metrics_auth_repro.cjs` — izolovana HTTP regresija.
- `python3 scripts/audit/metrics_auth_mutations.py` — **7/7 KILLED**.
- `node scripts/audit/openapi_metrics_fragment.cjs --write` — lokalni OpenAPI
  fragment; CI puni `npm run openapi:generate -- --check` je mjerodavan.

Lokalno: ciljani Jest **35/35**, ESLint **0 grešaka / 2 pre-existing warninga**,
frontend type-check i OpenAPI types sync prolaze.

## CI dokaz

Run **`41323254765`** na `6845060`:

- backend `test` **success**: eslint 0, tsc 0, OpenAPI sync, SEC-6 HTTP
  regresija, **45 suite / 554 testova**, **4 integration suite / 53 testa**;
- mobile **success**;
- frontend failure samo na pre-existing `Deploy config consistent (FE2-7)`.

## Ostaje otvoreno

- Produkcijsku mrežnu/proxy izolaciju i stvarni scraper tok treba potvrditi na
  serveru; ovaj korak dokazuje aplikacijsku autentifikaciju, ne WAF/topologiju.
- Ako vlasnik želi potpuno ugasiti Prometheus/Grafanu, to je operativna akcija
  na serveru, ne samo brisanje repo artefakata.
- FE2-7 deploy config problem ostaje po odluci `preserve_compose`.
