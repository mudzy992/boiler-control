# FEAT-6 — Analytics export (#35)

Status: **implementiran bounded synchronous analytics export**. GDPR nalog export/brisanje (`PRIV-1`) i asinhroni jobovi nisu dio ovog koraka.

## Obim i odluke

- Postojeći `GET /api/dashboard/export` je **analytics izvoz**, odvojen od `PRIV-1`.
- Vlasništvo se provjerava prije bilo kojeg analytics čitanja i prije feature flag-a. Tuđi i nepostojeći profil vraćaju **identičan 404**.
- CSV je spreadsheet-safe: tekstualne ćelije koje nakon vodećih praznina/kontrolnih znakova počinju s `=`, `+`, `-`, `@` dobijaju apostrof. Brojevi ostaju brojevi, uključujući negativne temperature.
- Legacy poziv bez `version=2` zadržava omotnicu `summary/stats/learning/export`, nazive polja, redoslijed kolona, LF newline i legacy bucket semantiku.
- V2 je opt-in: `version=2` + `ANALYTICS_EXPORT_V2_ENABLED=on`. Donosi JSON, eksplicitnu IANA zonu (default `UTC`), konzistentne day/hour bucket-e i `meta`.
- Nema DB migracije. Veliki izvoz se odbija, ne truncates i ne prelazi u asinhroni job.

## API

Query paramteri:

| Parametar | Legacy | V2 |
|---|---|---|
| `homeProfileId` | obavezan, cijeli broj >= 1 | isto |
| `from`, `to` | ISO datum | ISO datum s eksplicitnim `Z` ili UTC offsetom |
| `bucket` | `day` default, `hour` | isto |
| `version` | odsutan ili `1` | `2` |
| `format` | nije dozvoljen | `csv` default ili `json` |
| `timeZone` | nije dozvoljen | IANA zona, default `UTC` |

Odgovori:

- `200`: legacy CSV omotnica; v2 dodatno ima `meta`, a `export.format` može biti `json`.
- `400`: neispravan DTO, opseg, IANA zona ili v2-only parametar na legacy pozivu.
- `401`: nedostaje/ne vrijedi Bearer token.
- `404`: profil ne postoji ili nije vlasništvo korisnika.
- `413`: v2 source redovi prelaze `ANALYTICS_EXPORT_MAX_ROWS`.
- `503`: `version=2` dok je `ANALYTICS_EXPORT_V2_ENABLED=off`.

V2 JSON `export.content` je JSON tekst oblika:

```json
{
  "schemaVersion": 2,
  "meta": {},
  "summary": {},
  "stats": {},
  "learning": {}
}
```

`meta` sadrži `version`, `homeProfileId`, `from`, `to`, `timeZone`, `bucket`, `sourceRows` i `maxRows`. `sourceRows.total` je zbir heating eventa i learning intervala prije agregacije.

## Limiti

- Maksimalni raspon: **366 dana**.
- `ANALYTICS_EXPORT_MAX_ROWS`: default **10000**, dozvoljeno **1..50000**. Neispravna vrijednost koristi default.
- Upiti su owner-scoped, deterministički sortirani i ograničeni sa `take`. Ako ukupni source redovi prelaze limit, zahtjev se odbija sa 413 prije nego što se napravi djelimičan fajl.
- Ponovljeni DST sat ostaje dva reda jer satna labela nosi lokalni offset, npr. `2026-10-25T02:00:00+02:00` i `2026-10-25T02:00:00+01:00`. Redovi se ne sortiraju leksikografski po labeli nego čuvaju hronološki ulaz.

## Zastavice i rollback

```env
ANALYTICS_EXPORT_V2_ENABLED=off
ANALYTICS_EXPORT_MAX_ROWS=10000
```

Rollback v2: postaviti `ANALYTICS_EXPORT_V2_ENABLED=off`. Legacy export ostaje dostupan. Rollback **ne smije** ukloniti owner provjeru niti CSV neutralizaciju; to su sigurnosne zaštite, ne feature flag.

## Kompatibilnost

Instalirani mobile `analytics.api.ts` i `AnalyticsScreen.handleExport` čitaju `export.content`, `export.filename` i `export.contentType` koji sadrži `csv`. Legacy poziv ne šalje `version`, `format` ni `timeZone`, pa dobija isti CSV oblik. V2 JSON zahtijeva buduće mobilne/web izmjene prije nego što se počne slati iz instaliranih klijenata.

## Testovi i skripte

- `backend/src/common/tests/csv.spec.ts` — formule, vodeće praznine, kontrolni znakovi, quoting, newline, negativni brojevi.
- `backend/src/modules/Dashboard/tests/analytics-export.spec.ts` — flagovi, limit parser, IANA zona, opseg, DST, bucket keys, agregacija.
- `backend/src/modules/Dashboard/tests/dashboard-export.spec.ts` — servis, owner 404, legacy kompatibilnost, v2 CSV/JSON, prazan izvoz, 413.
- `backend/src/modules/Dashboard/tests/dashboard-export-http.spec.ts` — stvarni kontroler, JWT guard i ValidationPipe nad lažnom bazom.
- `backend/test/integration/analytics-export.integration.spec.ts` — stvarni AppModule/JWT/Prisma/PostgreSQL: owner-scope, flag/maxRows, višednevni legacy/v2 hour export i Sarajevo DST.
- `node scripts/audit/analytics_export_repro.cjs` — lokalni HTTP repro bez stvarne baze/mreže.
- `python3 scripts/audit/analytics_export_mutations.py` — anchored mutation checks; svaki anchor mora biti jedinstven i svaka mutacija mora pasti.
- `node scripts/audit/openapi_dashboard_fragment.cjs --write` — lokalni OpenAPI fragment iz stvarnih Dashboard dekoratora bez Prisma baze. Mjerodavna provjera je i dalje backend `npm run openapi:generate -- --check` u CI.

Lokalno izvršeno: ciljani Jest 75/75, HTTP repro, contract OpenAPI test 26/26, eslint 0 errors/2 pre-existing warnings, frontend `openapi:check`, `type-check`, `lint`, 84 Vitest testova i produkcijski build uz `VITE_API_URL`, mutation checks 5/5 killed. Puni backend Jest lokalno pada na nedostajućem generisanom Prisma klijentu; CI generiše Prisma klijent prije testova.

CI run `41251815121` na `47ace4e`: backend `success` (eslint 0, tsc 0, build, OpenAPI sync, 39 suite/519 unit testova, 3 suite/52 integration testova, FEAT-6 HTTP repro), mobile `success`. Frontend je `failure` samo na pre-existing FE2-7 deploy checkeru (`traefik loadbalancer port mora biti 80, bilo undefined`); vlasnikove compose izmjene nisu vraćane niti je checker oslabljen.

**Runtime dopuna (2026-11-03, test HEAD `9b1a9ea`, CI `41644670775`):** dva nova scenarija u postojećem integration specu dokazuju kroz stvarni AppModule/JWT/Prisma/PostgreSQL legacy spajanje dvaju dana u jedan `10:00` bucket i v2 UTC razdvajanje u date-hour bucket-e, te hronološki `Europe/Sarajevo` DST par s offsetima `+02:00` pa `+01:00`. Agregati i `sourceRows` su tačno provjereni, a izdvojeni februarski/oktobarski fixture ne mijenja postojeće januarske owner-scope/maxRows rezultate. CI prolazi backend **75/737 + 9/81 integration**, mobile **24/136**, frontend **4/4**, `tsc: 0`, `eslint: 0` i nula failure annotations. Lokalno prolaze postojeći **6 Dashboard suitea / 57 testova**, HTTP helper, mutation checks **5/5 killed uz unique anchors**, integration discovery i ESLint **0 errors / 2 postojeća warnings**. Nema production/API/DTO/OpenAPI/migracije/flag-default/mobile promjene; v2 rollout i konačni timezone/bucket ugovor ostaju otvoreni.

## Otvoreno

- `PRIV-1`: GDPR izvoz/brisanje naloga, retention i backup politika.
- Asinhroni export/jobovi: tek nakon mjerenja stvarnog opterećenja.
- Produženi mobile/web UI za v2 JSON.
- Pre-existing frontend deploy CI failure (`FE2-7`) na vlasnikovim compose izmjenama; compose nije mijenjan niti je checker oslabljen.
