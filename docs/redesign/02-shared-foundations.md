# 02 — Zajednički temelji

## Layout i navigacija

Meni je hardcoded engleski niz `MENU_ITEMS` u `frontend/src/components/MainLayout.tsx` (linije 35–90): Dashboard, Boiler Control, Heating Events, Gas Readings, Gas Analytics, Reports, Home Profile, Notifications, Profile.

Isti fajl trenutno sadrži i antd `Layout` granu (od linije 109) i Tailwind granu (od linije 167). JSX se ne zatvara. Vidi `01-module-map.md`.

`ProtectedRoute` (`frontend/src/components/ProtectedRoute.tsx`) koristi antd `Spin` dok traje init bez tokena, zatim `<Navigate to="/login">`.

Tema: `frontend/src/context/ThemeContext.tsx`. Ključ `boiler.theme`. Ant Design `ConfigProvider` + klasa na `<html>`. Početno stanje je `localStorage`, inače `light` (linije 24–27). Nema čitanja `prefers-color-scheme` u tom inicijalizatoru.

## Tri UI sloja

| Sloj | Gdje | Šta jeste |
|---|---|---|
| Ant Design 5.29.3 | stranice dashboard, profile, home-profile, notifications, gas analytics, ProtectedRoute, Theme | Stvarni UI većine ekrana |
| Ručni Tailwind | `frontend/src/components/Button.tsx`, `Card.tsx`, `Input.tsx`, `InputNumber.tsx`, `StatCard.tsx` | Drugi set dugmeta/kartice/inputa. `Button` ima `variant` primary/secondary/ghost/danger/success i `icon` |
| shadcn-stil | `frontend/src/shared/components/ui/{Button,Card,Input,Label}.tsx` | CVA + `@radix-ui/react-slot` + `cn()`. U produkcijskim stranicama se ne importuje. Jedini potrošač van testa: niko. Test: `shared/components/__tests__/accessibility.test.tsx` |

`frontend/components.json` opisuje shadcn alias `@/shared/components/ui`. U `node_modules` od Radixa postoji samo `@radix-ui/react-slot` (lock 1.5.0). Nema dialog, dropdown, tabs, table, toast primitiva.

`frontend/src/components/index.ts` eksportuje i nepostojeće `GasReadingCard` / `GasForm`.

`@tanstack/react-virtual` je u `frontend/package.json`, a u `frontend/src` nema importa (grep).

## Tokeni

Tri izvora, nisu usklađena:

1. `frontend/src/index.css` `:root` i `html.dark` — hex (`--bg`, `--surface`) i HSL shadcn varijable. `--border` je definisan dvaput u `:root` (linija 12 hex, linija 34 HSL). Kasnija deklaracija važi.
2. `frontend/src/design/tokens.css` — deklaracije `--brand`, razmaci, tipografija, sjene, z-index, bez selektora (`:root` nije otvoren). Fajl se nigdje ne importuje. Jedina referenca je komentar u `index.css:6`.
3. `frontend/tailwind.config.js` `theme.extend.colors` ima samo shadcn HSL tokena (`primary`, `border`, `card`, …). Nema `brand`, `surface`, `text-primary`, `error`.

`components/Button.tsx` koristi klase `bg-brand`, `text-text-primary`, `dark:bg-dark-surface`. Te klase nisu u Tailwind temi iz tačke 3. `index.css` definiše klase `.bg-surface` i `.text-primary`, što nije isto što i `bg-surface` / `text-text-primary` utility.

`preflight: false` (`tailwind.config.js` `corePlugins`). Ant Design i Tailwind dijele stranicu bez Tailwind reset-a.

## Podaci, greške, i18n

- HTTP: klasa u `frontend/src/services/api.ts`. `updateUserProfile(data: any)` na liniji 425. Generički `get/post/patch/delete` primaju `config?: any` (linije 278, 318 i susjedne).
- Keš: React Query, ključevi u `lib/queryKeys.ts`. Nema Redis ključeva na webu.
- i18n: `locales/config.ts`, `react-i18next`. Pokrivenost nije ujednačena: login i gas zovu `t()`, dio stranica ima engleski/bosanski tekst u JSX-u (npr. dashboard drawer, `MainLayout` "Welcome").
- Validacija: Zod u `features/home-profile/lib/schemas.ts`. Ostale forme nisu pregledane do nivoa Faze 2.
- State: React Context za auth i temu. Nema Redux/Zustand.

## shadcn inventar

| Komponenta | Status |
|---|---|
| Button, Card, Input, Label u `shared/components/ui` | Ručno pisane u shadcn obrascu (CVA, Slot, `cn`). Nisu povučene kao puni shadcn set |
| Dialog, Sheet, Table, Tabs, Select, Toast, Skeleton, Dropdown, Tooltip, Badge, Separator | Ne postoje pod `shared/components/ui` |
| antd Modal, Drawer, Table, Spin, Form, message | Korišteni na stranicama. Ovo su paralele, ne shadcn |
| `components/Button`, `Card`, `Input`, `InputNumber`, `StatCard` | Treći, ručni set. `StatCard` koristi lokalni `Card`, a dashboard i gas analytics ga importuju |

Cilj iz zadatka ("shadcn je jedini izvor primitiva") i trenutni kod (antd je primarni) nisu isto. Odluka je pitanje Q1 u `open-questions.md`.
