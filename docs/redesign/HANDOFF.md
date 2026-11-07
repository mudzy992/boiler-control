# HANDOFF — Boiler Control dashboard redesign

Datum: 2026-11-07. Repo: `mudzy992/boiler-control`, grana `main`.

I0–I7 + cockpit + **Vercel density polish** gotovi. Vidi `11-cockpit-ui.md`.

---

## Gdje smo

| Sloj | Status |
|---|---|
| I0–I7 implement | Gotovo |
| Cockpit visual override | Gotovo |
| Vercel density polish | Gotovo (Flame, header h-12/14, no nav underline, quiet type/forms) |

CI: Frontend on `main`. Zadnji run zelen: `42387408487` (`aa023b5`).

## Vercel polish sažetak

- `BrandMark` (Flame) u header/sidebar/login.
- Nav: `no-underline`, quiet active (muted + left bar).
- Header: ghost icon logout/theme, tight gaps.
- PageHeader `text-2xl`; Input `h-9`; Button bez default glow.
- Dark muted-foreground blago jači.

## Next (opcionalno)

- Lighthouse protected ruta
- A11y/SEO polish

## Prompt

```
Boiler-control: I0–I7 + cockpit + Vercel polish gotovi. Pročitaj docs/redesign/HANDOFF.md i 11-cockpit-ui.md.
```
