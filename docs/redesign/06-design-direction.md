# Dizajnerski pravac

Faza 4. Datum: 2026-11-06. Izvor: Q2 u `decisions.md`, sinteza, Apple-linear pravilo projekta.

**Override 2026-11-07:** vizuelni smjer je **dark-first cockpit** (brand glow, veliki KPI, živi heating status). Detalji: `11-cockpit-ui.md`. Ostatak ovog fajla i dalje važi za token mapu, i18n i strukturu; atmosfera je cockpit, ne flat Apple-linear.

## 1. Namjena

Gust, dramatičan operaterski **cockpit**. Referenca: Linear gustoća + instrument panel. Desktop je primaran. Mobilni od ~360px. Navigacija ispod `lg` (1024px) je drawer/sheet, ne trajni sidebar. Default tema: dark.

## 2. Paleta (semantička)

Vrijednosti su postojeće iz koda. U komponentama se koriste **samo** token klase / CSS varijable. Hex je zabranjen van definicije tokena.

| Semantika | Light | Dark | CSS var (cilj) | Tailwind |
|---|---|---|---|---|
| primary / brand | `#ff6b3d` | isti hue, prilagođen kontrast | `--brand` (HSL kanali) | `bg-brand`, `text-brand` |
| background | `#f6f7fb` | `#0b0f1a` | `--bg` | `bg-background` / `bg-[var(--bg)]` mapirano |
| surface | `#ffffff` | `#1e293b` | `--surface` | `bg-surface` |
| surface-muted | `#f3f4f6` | `#0f172a` | `--surface-muted` | `bg-surface-muted` |
| text | `#111827` | `#e5e7eb` | `--text-primary` | `text-text-primary` |
| text-secondary | `#6b7280` | `#cbd5e1` | `--text-secondary` | `text-text-secondary` |
| accent | `#f59e0b` | isti | `--accent-warn` | `text-accent` / `bg-accent` |
| success | `#10b981` | isti | `--success` | `text-success`, `bg-success` |
| danger / error | `#ef4444` | isti | `--error` | `text-error`, `bg-error` |
| border | `#e5e7eb` | `#334155` | `--border` (jedna definicija) | `border-border` |

shadcn HSL varijable (`--primary`, `--card`, …) se **uskladuju** sa ovom paletom u I0. Danas `--primary` u `index.css` nije brand narandžasta — to se ispravlja. `--border` se ne definiše dvaput.

Fokus ring: `ring-brand` / `focus-visible:ring-2`. Ne `rgb(var(--brand))` dok `--brand` nije u formatu koji ring očekuje.

Tema: `html.dark` klasa. Ključ `boiler.theme`. FOUC skripta u `index.html` ostaje. `prefersDarkMode` sa profila **ne** prepisuje lokalni ključ u v1.

## 3. Tipografija

| Uloga | Porodica | Težina | Veličine |
|---|---|---|---|
| UI / body | `IBM Plex Sans` | 400/500/600 | 12 / 14 / 16 |
| Display / page title | `IBM Plex Sans` (isti stack, 600) | 600 | 20 / 24 |
| Mono (brojači, ID) | `IBM Plex Mono` | 400/500 | 12 / 14 |

Učitavanje: `fontsource` ili self-host woff2 u `frontend/public/fonts` — bez Google CDN ako CSP to zabranjuje. Tokeni: `--font-sans`, `--font-mono` u CSS; Tailwind `font-sans` / `font-mono`.

Hijerarhija stranice: jedan `h1` (PageHeader), sekcije `h2`, kartice `h3`. Bez konkurentnih hero naslova na dashboardu.

## 4. Razmaci, radijus, sjena

- Skala razmaka: 4, 8, 12, 16, 24, 32, 48 (px). Stranica: `space-y-6` (24). Kartice: padding `md` = 16 ili 24.
- Radijus: `sm` 6px, `md` 8px (`--radius: 0.5rem`), `lg` 12px. Nema `rounded-full` pillova osim avatar/ikona 24px.
- Sjene: jedna `shadow-sm` na surface; overlay `shadow-lg`. Bez višeslojnih glow efekata.
- Gustina: tabele zbijene (`text-sm`, `py-2`/`py-3`). KPI u jednom redu gdje stane.

## 5. Layout shell

- Desktop ≥1024px: lijevi sidebar ~240px, `NavLink` + `aria-current="page"`, header sa temom / ulogom / logout.
- <1024px: header + Sheet drawer (Escape, focus trap, restore).
- Jedan `main#main-content`. SkipLink na taj id. Stranice ne postavljaju `id="content"`.
- Z-index tokeni u Tailwind: `z-fixed`, `z-popover`, `z-modal`, `z-modal-backdrop`.

## 6. Komponente (shadcn)

Jedini primitiv izvor: `frontend/src/shared/components/ui`.

| Potrebno | Izvor |
|---|---|
| Button, Card, Input, Label | već postoje — uskladiti sa tokenima |
| Dialog, Sheet, Select, Checkbox, Table, Switch | dodati (Radix) u I3 |
| PageHeader, QueryState, StatCard, StatusBanner, TempDialog, ConfirmDialog | app-level u `shared/components` ili `features/*/components`, grade na shadcn |

Lokalni `frontend/src/components/{Button,Card,Input,InputNumber,StatCard}`: potrošači prelaze u I2–I6; brisanje u I7.

Ikone: **lucide-react**. `@ant-design/icons` se uklanja kad shell i stranice pređu.

## 7. Stanja podataka

Svaki blok sa upitom:

| Stanje | Obrazac |
|---|---|
| Loading | Skeleton u istom footprintu (bez full-page spinera) |
| Error | Kratka poruka + Retry dugme; `role="alert"` |
| Empty | Poruka + primarna akcija gdje postoji |
| Disabled | opacity + `disabled` / `aria-disabled` |
| Success | StatusBanner `role="status"`, privremeno |

Bez layout shifta: rezervisan min-height skeletona.

## 8. Grafovi

Bez `@ant-design/plots` i bez novog chart paketa u v1.

Dashboard `buckets`: lagani **SVG bar chart** (jedna komponenta, pristupačan `table` ili `aria` sažetak ispod). Boje samo iz tokena. Aktivni bucket ostaje (postojeće ponašanje `activeBucket`).

## 9. Animacije

- Trajanje 150–200ms; easing `ease-out`.
- Drawer/sheet: transform + opacity.
- `prefers-reduced-motion: reduce` → isključi transform animacije, ostavi trenutni state.

## 10. Responsive checklist

- 360, 768, 1024, 1440.
- Tabele: horizontalni scroll u kontejneru, ne lom cijele stranice.
- Forme: jedna kolona ispod `md`.

## 11. Mapiranje fajlova (I0)

| Fajl | Posao |
|---|---|
| `frontend/src/index.css` | Jedna definicija tokena; uskladiti shadcn HSL sa brand paletom |
| `frontend/src/design/tokens.css` | Ili učitati ispravno, ili ukloniti mrtav fajl |
| `frontend/tailwind.config.js` | `extend.colors` za brand/surface/text/success/error/z-index |
| `ThemeContext.tsx` | Skinuti antd `ConfigProvider` tek kad antd nestane sa stranica; do tada ne širiti hex |
