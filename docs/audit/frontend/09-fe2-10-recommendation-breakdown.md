# FE2-10 — „Razlog preporuke“ iz backend breakdown snapshota

**Status:** RIJEŠENO U KODU 2026-11-01 (`ab08519` + `c9fe88c`), CI-verificirano.
**Vlasnička odluka:** `backend_breakdown` — aditivni backend snapshot + frontend
prikaz, bez promjene formule ili vrijednosti preporuke.
**CI run:** `41339126329` na `c9fe88c`.

## Cilj

Prikazati korisniku zašto je preporuka takva kakva jest, ali isključivo iz
strukturiranog backend odgovora. Web ne rekonstruiše formulu, ne računa baznu
krivulju i ne mijenja preporučenu temperaturu.

## Backend ponašanje

- `Recommendation.breakdown` je novi nullable `JSONB` stupac.
- Migracija: `20261101130000_fe210_recommendation_breakdown`.
- Rollback: `ALTER TABLE "Recommendation" DROP COLUMN IF EXISTS "breakdown";`.
- Stari redovi ostaju `NULL`; nema backfilla ni prepisivanja starih preporuka.
- Snapshot se upisuje na oba mjesta koja kreiraju/ažuriraju preporuku:
  `HeatingRecommendationService.processHeatingEvent` i
  `DailyRecommendationService.generateDailyRecommendations`.
- `buildRecommendationBreakdown()` samo kopira već izračunate vrijednosti
  `FlowTemperatureEngine.calculate()` u verzionirani oblik `version: 1`.
- Snapshot ne sadrži `userId`, `deviceId` ni `homeProfileId`.

Polja snapshota:

| Polje | Značenje |
|---|---|
| `version` | verzija oblika snapshota, trenutno `1` |
| `mode` | `FULL`, `PROFILE_ONLY` ili `ANONYMOUS` |
| `intervalKey` | ključ intervala ako postoji, inače `null` |
| `baseCurveTemp` | bazna temperatura krivulje, °C |
| `weightedExternalTemp` | ponderisana vanjska temperatura, °C |
| `appliedOffsets.home` | korekcija profila doma, °C |
| `appliedOffsets.interval` | korekcija intervala, °C |
| `appliedOffsets.events` | korekcija nedavnih događaja, °C |
| `finalTemp` | konačna preporuka, °C |
| `confidence` | pouzdanost 0..1 |
| `samples` | broj uzoraka ako postoji, inače `null` |
| `expectedHeatTimeMin` | očekivano vrijeme zagrijavanja ako postoji, inače `null` |

## API ugovor

- `GET /api/recommendations` sada ima tipiziran odgovor
  `RecommendationResponseDto[]`.
- `RecommendationResponseDto.breakdown` je opciono/nullable polje.
- `DashboardStoredRecommendationDto.breakdown` je također opciono/nullable.
- `contracts/openapi.json` i `frontend/src/types/api.d.ts` su usklađeni.
- CI puni backend `npm run openapi:generate -- --check` je mjerodavan; lokalni
  helper je `node scripts/audit/openapi_recommendation_fragment.cjs --write`.

## Frontend ponašanje

- Nova komponenta `RecommendationBreakdown.tsx` renderuje karticu „Razlog
  preporuke“ sa bazom, korekcijama, konačnom temperaturom, pouzdanošću,
  uzorcima i očekivanim vremenom zagrijavanja.
- Kartica ima savjetodavni disclaimer i semantičku tabelu.
- `ReportsPage` prikazuje breakdown kroz proširive redove tabele.
- `DashboardPage` prikazuje breakdown iz `system.recommendation` kada postoji.
- Ako `breakdown` nedostaje ili je `null`, komponenta ne renderuje ništa.
- Nema novog env flaga. Rollback je revert frontend mount-a i, po potrebi,
  rollback migracije.

## Testovi i lokalna provjera

Backend:

- `recommendation-breakdown.spec.ts` — copy-only snapshot, null optional
  polja, bez mutacije engine rezultata i bez ID polja.
- `recommendation-write-sites.spec.ts` — create/update upisuje snapshot bez
  promjene preporuke.
- `openapi-schema.spec.ts` — FE2-10 response/breakdown šeme i opciono polje.
- `heating-polling.integration.spec.ts` — HTTP odgovor vraća snapshot za novi
  red i `null` za stari red.
- Ciljani Jest: **3 suite / 32 testa**.
- Tačan CI ESLint: **0 grešaka / 2 pre-existing warninga**.

Frontend:

- `RecommendationBreakdown.test.tsx` — 4 testa: prikaz iz backend mocka,
  promjena odgovora mijenja prikaz, bez breakdowna nema kartice, null optional
  polja ne prikazuju redove.
- `npm run openapi:check` — usklađeno.
- `npm run type-check` — čisto.
- `npm test` — **10 suite / 88 testova**.
- `npm run lint` — **0 grešaka / 13 pre-existing warninga**.
- Produkcijski build s `VITE_API_URL=https://api.boiler-control.ba101.top/api`
  prolazi; chunk-graph audit: 21 chunk, 0 kružnih odnosa, evaluacija OK.

## CI dokaz

Run `41339126329` na `c9fe88c`:

- backend `test` **success**: ESLint 0, tsc 0, build, OpenAPI sync,
  **47 suite / 561 test**, **4 integration suite / 54 testa**;
- mobile **success**;
- frontend failure samo na pre-existing `Deploy config consistent (FE2-7)`;
  OpenAPI sync, type-check, lint i unit/component testovi su prošli.

Prvi FE2-10 run `41338351553` na `ab08519` pao je na backend tsc/build zbog
`TS2322`: TypeScript `interface` nije bio dodjeljiv Prisma JSON input tipu.
Ispravka `c9fe88c` mijenja snapshot u type alias; CI je nakon toga zelen za
backend/mobile.

## Kompatibilnost i otvoreno

- Instalirani mobile klijenti nisu pogođeni: nema promjene poziva ni obaveznih
  polja; `getRecommendations()` i dalje radi, a novo polje je opciono/nullable.
- FORM-1 i stručna validacija formule ostaju otvoreni/blokirani; FE2-10 ne
  mijenja formulu niti tvrdi da je formula validirana.
- FE2-7 deploy config problem ostaje po odluci `preserve_compose`.
- Produkcijsku migraciju izvršava vlasnik kroz uobičajeni deploy; CI je
  migraciju izvršio na izolovanoj bazi.
