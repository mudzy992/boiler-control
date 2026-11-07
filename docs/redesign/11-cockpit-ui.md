# Cockpit UI + Vercel density

Datum: 2026-11-07. Nadograđuje `06-design-direction.md`.

## Smjer

- Dark-first operator UI; brand `#ff6b3d`.
- **Vercel density polish:** tight header, quiet borders, no nav underlines, Flame brand mark, quieter type (page `text-2xl`, large mono only on dashboard KPI/status).
- Glow samo na heating-active / eksplicitnom CTA — ne na svakom nav itemu.

## Brand

- Shared `BrandMark` = lucide `Flame` u `bg-brand/15`.
- Header, sidebar, login.

## Shell

- Header `h-12`/`h-14`, icon buttons `h-8 w-8`, `gap-1`.
- Sidebar: Flame + brand; active = muted bg + left brand bar; `no-underline`.
- Main: bez full-page card wrap.

## Forms

- Input `h-9`, Label `font-medium`, Button default bez glow shadow.
- Login: kompaktna kartica, Flame mark, stacked fields.
