# MO2-13 — virtualizacija liste, memoizacija i AppState polling

**Status:** RIJEŠENO U KODU 2026-11-01 (`07acc30`), CI-verificirano.
**CI run:** `41351779085` na `07acc30`.

## Cilj

Smanjiti rad pri prikazu velikog broja očitanja plina, memoizirati dashboard
kartice i zaustaviti heating polling kad je mobilna aplikacija u pozadini.
Dashboard i Heating ekran moraju dijeliti isti dashboard cache entry.

## Promjene

- `GasReadingsScreen` koristi `FlatList` sa stabilnim
  `keyExtractor={(item) => String(item.id)}` i `renderItem` callbackom.
  Header/filteri/statistika su `ListHeaderComponent`, prazno stanje je
  `ListEmptyComponent`.
- `HeatingScreen` više ne koristi zaseban `['dashboard-heating']` key;
  koristi shared `DASHBOARD_QUERY_KEY` (`['dashboard']`).
- `refetchInterval` za heating dashboard računa se iz `AppState`:
  `active` → 60 s, `background`/`inactive`/`unknown` → `false`.
- `React.memo` dodan na `BoilerStatusCard`, `ThermostatCard`, `AlertsCard`,
  `HealthScoreCard`, `RecentHeatingEvents` i `GasReadingCard`.
- Uklonjen nekorišteni `API_CONFIG.RETRY_ATTEMPTS`.
- Mali ograničeni prikazi (`RecentHeatingEvents` slice 5, analytics cycle
  bars slice 24) nisu virtualizirani jer nisu neograničene liste.

## Migracija, rollback i flag

- Nema DB migracije.
- Nema backend/API promjene.
- Nema novog flaga.
- Rollback je revert commita `07acc30`.

## Testovi i benchmark

Lokalno:

- `npm run type-check` — čisto;
- `npm run lint` — **0 grešaka / 78 pre-existing warninga**;
- `npm test -- --ci` — **6 suite / 49 testova**;
- benchmark: `npx jest --runInBand --testMatch '**/benchmarks/*.benchmark.tsx'`.

Sintetički benchmark s 500 očitanja (`mobile/benchmarks/gasReadingsList.benchmark.tsx`):

| Način | Inicijalno renderovanih redova | Jest initial render |
|---|---:|---:|
| legacy `ScrollView` + `map` | 500 | 373 ms |
| `FlatList` | 10 | 1061 ms |

Ovo je Jest/render benchmark, ne mjerenje FPS-a na uređaju. `FlatList` u
ovom sintetičkom mountu ima veći JS overhead, ali inicijalno renderuje 10
redova umjesto 500; korist je manji inicijalni broj mountovanih kartica i
ograničen render window pri scrollu. Produkcijski FPS na uređaju ostaje za
mjerenje prije tvrdnje o glatkoći scrolla.

Novi testovi:

- `polling.test.ts` — active/background/inactive/unknown interval;
- `mo213Source.test.ts` — shared dashboard key, AppState polling i
  `FlatList` keyExtractor regresija.

## CI dokaz

Run `41351779085` na `07acc30`:

- mobile **success** (type-check, lint, unit tests);
- backend `test` **success**;
- frontend failure samo na pre-existing `Deploy config consistent (FE2-7)`.

## Kompatibilnost

- Nema promjene backend ugovora; instalirani mobile klijenti nisu pogođeni
  dok se ne ažuriraju.
- Pull-to-refresh, filteri i akcije nad očitanjima ostaju na istom ekranu.
- Preostali postojeći lint warningi nisu novi; CI lint i dalje pada na novu
  grešku, a ne na dokumentovani baseline.
