# Design system matrix — instrument panel

Source of truth for primitives under `frontend/src/ui`.

## Visual rules

| Rule | Value |
|---|---|
| Direction | Instrument panel |
| Shadows | None |
| Control radius | 2px |
| Panel radius | 4px |
| Border | 1px hairline |
| Motion | color only, 120ms |
| Primary contrast | dark ink on signal |

## Palette tokens

| Token | Role |
|---|---|
| canvas | page bg |
| panel | card/surface |
| raised | elevated strip |
| line / line-strong | borders |
| ink / ink-muted / ink-dim | text |
| signal | primary / live |
| ok / warn / fault / info | status |

## Components

| Component | Variants | Sizes | Key tokens | States |
|---|---|---|---|---|
| Button | primary, secondary, ghost, danger | sm, md, lg | btn-* | default, hover, disabled, loading |
| IconButton | same | md (square) | btn-* | + aria-label required |
| Text | — | — | — | wires label/hint/error a11y |
| TextInput | — | md | input-* | focus, invalid, disabled |
| NumberInput | — | md | input-* | same |
| Textarea | — | — | input-* | same |
| Select | — | md | input-* | native |
| Checkbox | — | — | signal | checked |
| Switch | — | — | signal | on/off |
| Panel | default | — | panel-* | — |
| HeroPanel | hero only | — | hero-* | — |
| DataTable | — | — | line, ink | — |
| Readout | — | — | ink, mono | — |
| GaugeBar | normal, overtime | — | signal, fault | — |
| Badge | ok, warn, fault, info, muted | — | status | — |
| Banner | ok, warn, fault, info | — | status | dismissible |
| Skeleton | — | — | raised | pulse |
| Led | on, off, fault | — | ok/fault | pulse when on |
| Modal | — | — | panel | focus trap, Escape |
| Drawer | — | — | panel | focus trap, Escape |
| PageHeader | — | — | ink | — |
| Stack | page, section, field | — | space | — |
| LogoMark | — | sm, md | signal | — |

## Forbidden in features/

- Raw `<button>`, `<input>`, `<select>`, `<textarea>`
- `shadow-*`, `rounded-xl`, `dark:` class fragments
- Imports from `@radix-ui/*`, `class-variance-authority`, `shared/components/ui`
