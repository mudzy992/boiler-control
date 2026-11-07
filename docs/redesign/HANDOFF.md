# HANDOFF — Boiler Control dashboard redesign

Datum: 2026-11-07. Repo: `mudzy992/boiler-control`, grana `main`.

I0–I7 zatvoreni. Dodatni **cockpit UI** (dark-first) je implementiran — vidi `11-cockpit-ui.md`.

---

## Gdje smo

| Sloj | Status |
|---|---|
| I0–I7 implement | Gotovo |
| Cockpit visual override | Gotovo (tokens + shell + dashboard hero + shared surfaces) |

CI: Frontend on `main`. Zadnji run zelen: `42386468112` (`cee2db2`).

## Cockpit sažetak

- Default tema: **dark** osim ako je `boiler.theme=light`.
- Shell: instrument sidebar, radial main bg, bez full-page card wrap.
- Dashboard: status band (pulse + flow temp), hero KPI, brand SVG bars.
- Hex samo u `tokens.css`; glow via `shadow-glow` / `shadow-glow-soft`.

## Next (opcionalno)

- Lighthouse protected ruta
- A11y/SEO polish

## Prompt

```
Boiler-control: I0–I7 + cockpit UI gotovi. Pročitaj docs/redesign/HANDOFF.md i 11-cockpit-ui.md.
```
