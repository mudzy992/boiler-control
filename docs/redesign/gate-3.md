# GATE 3 — odobrenje prije produkcijskog koda

Datum: 2026-11-06.

Faza 4 dokumentacija je kompletna. **Produkcijski UI kod Faze 5 ne počinje bez izričitog odobrenja.**

## Pravac

- Vizuelni jezik: `06-design-direction.md` (IBM Plex, brand `#ff6b3d`, drawer <1024px, SVG bar umjesto plots, lucide).
- Pristup: **opcija A** — inkrementalno na `main` (`07-decision-record.md`).
- Plan: I0→I7 (`08-implementation-plan.md`).
- Pravila + stop/rollback: `09-implementation-rules.md`.
- Audit korekcije: `05-audit-of-audit.md` (parse zatvoren u `e7142f1`; Q8 nije izmjeren).

## I0–I7 (kratko)

| ID | Cilj |
|---|---|
| I0 | Tokeni / Tailwind / fontovi |
| I1 | 401 login + User.role |
| I2 | Novi shell |
| I3 | shadcn Dialog/Sheet/… + lucide |
| I4 | PageHeader, QueryState, StatCard, StatusBanner |
| I5 | TempDialog, ConfirmDialog |
| I6 | Stranice redom (Auth…Profile) |
| I7 | Ukloniti antd, Lighthouse Q8 |

## Van opsega

mobile/, Prisma, novi API, Redis dashboard keš, meni-only auth, feature-flag v2.

## Poslovna pravila koja ostaju

Temp 48–55, health sa servera, dva heating ugovora, potrošnja novije−starije, breakdown snapshot, home profile granice forme, uzak PUT profila, `downloadProtectedFile`, 9 ruta svim ulogama.

## Traženo

Odgovor koji eksplicitno odobrava GATE 3 (i time I0). Do tada nema produkcijskog UI koda.
