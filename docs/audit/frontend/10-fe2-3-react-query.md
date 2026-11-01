# FE2-3 — React Query ujedinjenje i visibility pauza pollinga

**Status:** RIJEŠENO U KODU 2026-11-01 (`29ce3c7`), CI-verificirano.
**CI run:** `41343423105` na `29ce3c7`.

## Cilj

Ukloniti mješovite ručne dohvate i `window.setInterval` polling, uvesti jedan
`QueryClient` s konzervativnim globalnim defaultima, dijeliti notification/gas
cache između stranica i zaustaviti polling kad je tab u pozadini.

## Promjene

- `frontend/src/lib/queryClient.ts` kreira shared `QueryClient`:
  - `staleTime: 30_000`;
  - `retry: 1`;
  - `refetchOnWindowFocus: true`;
  - `refetchIntervalInBackground: false`.
- `frontend/src/lib/queryKeys.ts` definiše shared key-ove:
  - `notifications` / `notification-preferences`;
  - `gas-readings` / `gas-analysis`;
  - dashboard, heating range, health, home profile, weather, reports,
    heating events i boiler events.
- `useNotificationsQuery` dijele dashboard drawer i `NotificationsPage`.
- `useGasReadingsQuery` dijele `GasReadingsPage` i `GasAnalyticsPage`.
- `useDashboardHeatingRange` koristi React Query `refetchInterval: 60_000`
  umjesto `window.setInterval`; interval se ne izvršava kad je tab skriven.
- `HeatingPage`, `BoilerPage` i `ReportsPage` prebačeni su s ručnog
  `useEffect` fetcha na React Query.
- `DashboardPage` više ne drži zaseban notification state niti ručni
  dashboard/heating-range polling.

## Migracija, rollback i flag

- Nema DB migracije.
- Nema promjene API ugovora.
- Nema novog env flaga.
- Rollback je revert commita `29ce3c7`.

## Testovi

Novi `frontend/src/hooks/__tests__/fe23-query.test.tsx` pokriva:

1. globalne `QueryClient` defaulte i `refetchIntervalInBackground: false`;
2. drawer i stranica dijele isti notifications key i jedan API poziv;
3. gas readings i gas analytics dijele isti key i ne dupliciraju poziv;
4. dashboard heating polling radi dok je tab vidljiv, staje kad je skriven i
   nastavlja kad je ponovo vidljiv.

Lokalno:

- `npm run type-check` — čisto;
- `npm run type-check:e2e` — čisto;
- `npm test` — **11 suite / 92 testa**;
- `npm run lint` — **0 grešaka / 11 pre-existing warninga**;
- `npm run openapi:check` — usklađeno;
- produkcijski build s `VITE_API_URL=https://api.boiler-control.ba101.top/api`
  prolazi;
- `node scripts/audit/frontend_chunk_graph.cjs` — 24 chunka, 0 kružnih odnosa,
  evaluacija OK.

## CI dokaz

Run `41343423105` na `29ce3c7`:

- backend `test` **success**;
- mobile **success**;
- frontend failure samo na pre-existing `Deploy config consistent (FE2-7)`;
  OpenAPI sync, type-check, type-check e2e, lint i unit/component testovi su
  prošli.

## Kompatibilnost

- Nema promjene backend ugovora, pa instalirani mobile klijenti nisu pogođeni.
- FE2-7 deploy config problem ostaje po odluci `preserve_compose`.
- Promjena ponašanja cachea/refetcha je namjerna i pokrivena testovima;
  produkcijsko mrežno ponašanje treba pratiti nakon deploya.
