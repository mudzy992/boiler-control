# Redesign state

Ažurirano: 2026-11-06.

## Trenutna faza

**Faza 5 — I1 zatvoren (lokalno + push).** Sljedeće I2 čeka potvrdu nakon zelenog CI.

## Odluke

- GATE 1 + GATE 3 odobreni; pristup A

## Završeno

- I0: tokeni / Tailwind / IBM Plex (`4106ee7`)
- **I1:** 401 na `/auth/login` ne radi full reload; `AuthUser` sa `role`; login validacija + `role="alert"` + autoComplete; redirect ako token postoji

## Otvoreno

- Q8 Lighthouse (I7)
- HP-04, RE-06

## Sljedeći korak

I2 — shell rewrite.
