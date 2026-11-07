# Cockpit UI + Vercel density

Datum: 2026-11-07. Nadograđuje `06-design-direction.md`.

## Smjer

- Dark-first operator UI; brand `#ff6b3d`.
- **Vercel density:** tight header, quiet borders, no nav underlines, Flame brand, quieter type.
- Glow samo na heating-active / eksplicitnom CTA.

## Contrast

- Dark: foreground ~98% L, muted-foreground ~80% L, jasniji border/input, card odvojen od page bg.
- Light: muted-foreground tamniji za AA secondary.

## Brand + shell

- `BrandMark` samo u headeru (ne i u desktop sidebaru).
- Sidebar/drawer `w-60`; main/footer `lg:ml-60` + isti horizontalni padding kao header.
- Header `h-12`/`h-14`, solid `bg-background`, icon `size="icon"`.

## Buttons (flat)

- Bez shadow/bevel/ring-offset — flat fill + border.
- default: `bg-brand-700` + bijeli tekst (AA kontrast).
- outline/ghost/secondary: border ili transparent, hover `bg-muted`.
- sm `h-8`, default `h-9`, lg `h-10`, icon `h-8 w-8`.

## Spacing

- Page root: `space-y-6`.
- Card Header/Content/Footer: `p-4` / `sm:p-5`; CardTitle `text-base`.
- Action rows: `flex flex-wrap items-center gap-2`.
