# HANDOFF — Boiler Control dashboard redesign

Datum: 2026-11-07. Repo: `mudzy992/boiler-control`, grana `main`.

I0–I7 + cockpit polish + **instrument design system** (`frontend/src/ui`, no Radix/shadcn).

---

## Gdje smo

| Sloj | Status |
|---|---|
| I0–I7 | Gotovo |
| Instrument tokens + `ui/` | Gotovo |
| Shell/shared on `ui/` | Gotovo |
| Feature migration | In progress (compat bridges remain for old class names) |
| Radix/cva removed | Gotovo |

CI: Frontend on `main`.

## Next

- Finish page-by-page className cleanup (drop TW bridge aliases).
- Tighten ESLint restricted-syntax to error after cleanup.
- Visual pass via `/design` gallery.

## Prompt

```
Boiler-control: instrument design system shipped. Read docs/redesign/HANDOFF.md, .cursor/plans/instrument-design-system/HANDOFF.md, and .cursor/docs/matrices/design-system/MATRIX.md.
```
