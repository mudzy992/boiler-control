# Cockpit UI override

Datum: 2026-11-07. Nadograđuje `06-design-direction.md` (Apple-linear miran stil → **dark-first cockpit**).

## Smjer

- Dark-first operator cockpit: veliki KPI, živi status grijanja, brand glow `#ff6b3d`.
- Default tema: **dark** ako `boiler.theme` nije `light`.
- Light ostaje prekidač; postojeći `light` se ne prepisuje.
- Gust, dramatičan — ne flat form stack.

## Tokeni

- Page `#07090f`, card `#121826`, elevated `#1a2233`.
- `--glow-brand`, `--glow-brand-soft`; Tailwind `shadow-glow` / `shadow-glow-soft`.
- Display / KPI type scale; `font-mono` za temperature i brojače.
- Hex samo u `frontend/src/design/tokens.css`.

## Shell

- Instrument sidebar (~224px), aktivni item: lijeva brand crta + soft glow.
- Main background: `bg-cockpit-radial` (CSS radial, ne slika).
- Bez omotača kartice oko cijelog `main` sadržaja.

## Dashboard hero

- Status band (Heating/Idle + pulse + flow temp + Set temp).
- Veliki KPI red.
- SVG bar sa brand gradijentom; `activeBucket` zadržan.
