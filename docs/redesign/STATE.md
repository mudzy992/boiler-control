# Redesign state

Ažurirano: 2026-11-07.

## Trenutna faza

**Faza 5 — I6 u toku.** Auth + Boiler migrirani; Dashboard TempDialog spojen. Ostale stranice još ne.

**Sljedeće u I6:** Heating → Reports → Gas readings → Gas analytics → Notifications → Home profile → Profile (+ Dashboard full redesign: SVG bars, QueryState, PageHeader).

## Završeno

- I0–I5
- I6 Auth: LoginPage → shadcn Card/Input/Label/Button + StatusBanner
- I6 Boiler: PageHeader + QueryState + Table + TempDialog + invalidate helper
- I6 Dashboard (parcijalno): TempDialog + invalidateQueriesAfterTempSet (antd plots još tu)

## Sljedeći korak

Nastavi I6 od Heating (ili dovrši Dashboard full pass). Preferiraj **novu sesiju** — ovaj chat je dug.
