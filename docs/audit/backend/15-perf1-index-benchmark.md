# PERF-1 — mjereni indeksi za polling i weather cache

Status: **implementirano i CI-verificirano za prihvaćeni HeatingEvent indeks**.
Weather kompozitni indeks je **odgođen** jer uobičajeni mali cache nije prošao
mjerne kriterije. Ovo je sintetički CI benchmark, ne produkcijski p95 dokaz.

## Obim i odluke

- Vlasnik je izabrao **`synthetic_ci`** benchmark i **standardnu Prisma
  migraciju** (`CREATE INDEX`, ne `CONCURRENTLY`).
- Prvo je poslan samo mjerni korak **`579e58c`**, bez promjene šeme.
  CI run **`41302067615`** izmjerio je kandidate prije migracije.
- Implementacija je **`d9831c9`**. CI run **`41303090502`** potvrdio je
  migraciju, rollback regresiju i konačni benchmark.
- Prihvaćen je samo kandidat:
  `HeatingEvent(deviceId, timestampStart DESC)`.
- Postojeći single-column `HeatingEvent(deviceId)` indeks je zadržan.
- Weather kandidat `WeatherCache(city, fetchedAt DESC)` nije migriran.
  Stressni dataset ga podržava, ali normalni mali cache ne; stress sam po
  sebi nije dovoljan za produkcijsku odluku.
- Nema runtime feature flaga. Rollback je namjenski
  `DROP INDEX IF EXISTS "HeatingEvent_deviceId_timestampStart_idx";`.
- Nema promjene HTTP/OpenAPI ugovora, compose fajlova ni mobilnog builda.

## Migracija

Nova migracija:
`backend/prisma/migrations/20261101000000_perf1_heating_event_device_timestamp/migration.sql`

```sql
CREATE INDEX "HeatingEvent_deviceId_timestampStart_idx"
    ON "HeatingEvent"("deviceId", "timestampStart" DESC);
```

Prisma šema dodaje:

```prisma
@@index([deviceId, timestampStart(sort: Desc)])
```

Standardna migracija može zaključati upise tokom gradnje indeksa. Prije
produkcijskog deploya treba provjeriti veličinu tabele, raspoloživi prostor i
dogovoriti prozor održavanja. Rollback ne briše poslovne podataka:

```sql
DROP INDEX IF EXISTS "HeatingEvent_deviceId_timestampStart_idx";
```

## Benchmark metod

Skripta: `scripts/audit/perf1_index_benchmark.cjs`.

- Radi isključivo u efemernom GitHub Actions PostgreSQL servisu, uz iste
  zaštitne uslove kao ostale disposable-DB skripte.
- Kreira `TEMP` tabele kopirane iz javne šeme, puni ih sintetičkim podacima,
  mjeri baseline/kandidate u ABBA redoslijedu i završava `ROLLBACK`-om.
- Ne koristi produkcijske podatke i ne mijenja javne tabele.
- Mjeri `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)`, p95 čitanja, p95
  insert/delete operacija, buffer blokove, veličine indeksa i jednakost
  rezultata upita.
- Za `TEMP` tabele računa i `Local Hit Blocks` / `Local Read Blocks`, ne
  samo `Shared Hit Blocks` / `Shared Read Blocks`.
- Pragovi: najmanje **20%** bolji p95 ciljanog čitanja, najviše **10%**
  rasta p95 upisa, kandidat indeks stvarno korišten, sort uklonjen,
  buffer blokovi nisu povećani i rezultati upita ostaju isti.

Sintetički dataset:

- `HeatingEvent`: 200 uređaja; nejednak raspored događaja, uključujući
  jedan vrlo aktivan uređaj, warm uređaje, cold uređaje i nepostojeće
  uređaje u mješovitim upitima.
- `WeatherCache normal`: 100 gradova po 1 zapis.
- `WeatherCache stress`: 200 gradova po 100 zapisa.

## Konačni CI rezultati

Run **`41303090502`**, commit **`d9831c9`**, backend job **`124837912166`**.

| Kandidat | Read p95 prije | Read p95 poslije | Promjena | Write p95 prije | Write p95 poslije | Buffer prije/poslije | Sort prije/poslije | Odluka |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| HeatingEvent | 5.922 ms | 0.431 ms | -92.72% | 0.374 ms | 0.286 ms | 756 / 4 | 1 / 0 | prihvaćen |
| WeatherCache normal | 0.335 ms | 0.337 ms | +0.66% | 0.275 ms | 0.277 ms | 3 / 4 | 1 / 1 | odgođen |
| WeatherCache stress | 1.630 ms | 0.318 ms | -80.50% | 0.311 ms | 0.271 ms | 189 / 3 | 1 / 0 | nije dovoljan bez normalnog workloada |

Napomena: negativna promjena read p95 znači poboljšanje; pozitivna znači
pogoršanje. Write regresija za HeatingEvent je bila negativna, tj. u ovom
sintetičkom mjerenju upisi nisu bili sporiji.

## Testovi i skripte

- `backend/test/contract/perf1-index.spec.ts` — Prisma šema, SQL migracija,
  benchmark kandidat, odgođeni weather indeks, legacy indeks i CI guardovi.
- `scripts/audit/perf1_index_benchmark.cjs --self-test` — lokalne provjere
  percentile/plan/evaluation/guard logike bez baze.
- `scripts/audit/perf1_index_benchmark.cjs --ci` — stvarni PostgreSQL
  benchmark u efemernom CI servisu.
- `scripts/audit/perf1_index_migration_repro.cjs --ci` — provjerava da je
  migracija primijenjena, da legacy indeks postoji, da weather indeks nije
  migriran, te da transakcijski `DROP INDEX` + ponovna primjena + `ROLLBACK`
  čuvaju indeks i broj redova.
- `python3 scripts/audit/perf1_index_mutations.py` — anchored mutation
  provjera; svaki anchor mora biti jedinstven i svaka mutacija mora pasti.

Lokalno prije finalnog slanja:

- ugovorni Jest: **6/6**;
- mutacije: **7/7 killed**;
- benchmark self-test: **PASS**;
- neoznačeni `--ci` pozivi odbijeni izvan efemernog CI okruženja;
- tačna CI ESLint komanda: **0 grešaka / 2 pre-existing warninga**.

## CI ishod

Run **`41303090502`** na **`d9831c9`**:

- backend **success**: ESLint 0, tsc 0, build, OpenAPI sync,
  PERF-1 benchmark, PERF-1 migration rollback, **43 suite / 535 testova**
  i **4 integration suite / 53 testa**;
- mobile **success**;
- frontend **failure** samo na pre-existing
  `Deploy config consistent (FE2-7)`.

Compose i FE2-7 checker nisu mijenjani.

## Kompatibilnost i otvoreno

Instalirani mobile i frontend ne vide promjenu HTTP ugovora. Nema novog
mobilnog builda potrebnog za ovaj korak.

Ostaje otvoreno:

- produkcijsko `EXPLAIN (ANALYZE, BUFFERS)` i p95 mjerenje na stvarnom
  workloadu prije tvrdnje o produkcijskom učinku;
- eventualni weather indeks samo ako stvarni rast/selektivnost cachea
  opravda migraciju;
- REL-2 preklapanje cron ciklusa / više replika nije riješeno ovim korakom.
