# Redesign state

Ažurirano: 2026-11-06.

## Trenutna faza

**Faza 3 zatvorena.** Sinteza je u `docs/redesign/04-cross-module-synthesis.md`. Faza 4 ne počinje bez odobrenja.

## Odluke

`docs/redesign/decisions.md`.

## Završeno

- Faza 1: pregled, mapa, temelji, baseline.
- Faza 2: svih 11 modula i `gate-2.md`.
- Faza 3: obrasci, zajedničke komponente, sistemski problemi, matrica, zavisnosti.

## Otvoreno

- Q8 Lighthouse, i dalje blokiran padom builda.
- Home profile: HTTP status kad profil ne postoji (HP-04).
- Reports: raspon `confidenceScore` (RE-06).

## CI

Run `42293997746` (push "Do faze 3") pao je na type-checku: spojeni JSX u `MainLayout.tsx` i `DashboardPage.tsx`. Poslije toga lokalno prolaze `type-check`, `lint` (0 grešaka, 26 upozorenja) i Vitest (98).

## Sljedeći korak

Poslije odobrenja: Faza 4 (`05` do `09`).
