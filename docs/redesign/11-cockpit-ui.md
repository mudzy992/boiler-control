# Instrument UI system

Datum: 2026-11-07. Nadograđuje `06-design-direction.md`.

## Smjer

- **Instrument panel** — hairline borders, no shadows, radius 2px/4px.
- Brand signal `#ff6b3d` only for primary action, focus, live state.
- Dark default; light = daylight mapping of the same tokens.
- **No shadcn / Radix / cva.** Primitives live in `frontend/src/ui`.

## Tokens

Hex only in `frontend/src/design/tokens.css` (palette + button/input/panel tokens).
Tailwind exposes semantic names (`bg-canvas`, `text-ink`, `bg-btn-primary`, …).
Preflight ON.

## Components

Import from `@/ui`: Button, IconButton, Field, TextInput, NumberInput, Textarea, Select, Checkbox, Switch, Panel, HeroPanel, DataTable, Readout, GaugeBar, Badge, Banner, Skeleton, Led, Modal, Drawer, PageHeader, Stack, LogoMark.

Gallery (dev): `/design`.

## Shell

- Brand mark in header only.
- Sidebar `w-60` + `lg:ml-60`.
- Dashboard hero = `HeroPanel` + current/target readout + `GaugeBar`.

## Guardrails

- ESLint: ban `@radix-ui/*`, `class-variance-authority`.
- Features: warn on `shadow-*`, `rounded-xl`, `dark:`.
- Matrix: `.cursor/docs/matrices/design-system/MATRIX.md`.
