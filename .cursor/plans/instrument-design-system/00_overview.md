# Instrument design system — overview

Datum: 2026-11-07. Repo: `mudzy992/boiler-control`, grana `main`.

## Cilj

Jedan in-house design system: tokeni → `frontend/src/ui` → sve stranice. Bez shadcn/Radix/cva. Vizuelni smjer: **instrument panel**.

## Faze

| Faza | Šta | Commit tip |
|---|---|---|
| P0 | Plan docs + MATRIX | docs |
| P1 | Tokeni + Tailwind rewrite + preflight | feat(design) |
| P2 | `ui/` primitives + hooks + `/design` gallery | feat(ui) |
| P3 | Shell + shared app components na `ui/` | feat(shell) |
| P4 | Migracija svih feature stranica | feat(frontend) |
| P5 | Brisanje Radix/shadcn, ESLint guardrails, ship | chore |

Approach A: commit + push + CI green po fazi.

## Out of scope

Backend, Prisma, mobile, business logic.