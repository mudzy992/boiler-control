# Redesign state

Ažurirano: 2026-11-06.

## Trenutna faza

**GATE 2.** Svi moduli Faze 2 su dokumentovani. Faza 3 ne počinje bez odobrenja.

## Odluke

`docs/redesign/decisions.md`.

## Završeni moduli

- Shell, Auth, Dashboard, Boiler, Heating
- Gas readings, Gas analytics, Reports, Notifications
- Home profile, Profile

Sažetak: `docs/redesign/gate-2.md`.

## Otvoreno

- Q8 Lighthouse, i dalje blokiran padom builda.
- Home profile: tačan HTTP status kad profil ne postoji nije čitan u kontroleru (HP-04).
- Reports: raspon `confidenceScore` nije zapisan u DTO (RE-06). Zadržava se množenje sa 100.

## Sljedeći korak

Poslije odobrenja GATE 2: `docs/redesign/04-cross-module-synthesis.md`.
