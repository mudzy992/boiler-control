# HANDOFF — Boiler Control dashboard redesign

Datum: 2026-11-07. Repo: `mudzy992/boiler-control`, grana `main`.

Nova sesija: pročitaj ovaj fajl, zatim `STATE.md` i `08-implementation-plan.md`. Nastavi **I7** (antd out + Lighthouse). Ne ponavljaj I0–I6.

---

## 1. Gdje smo

| Faza | Status |
|---|---|
| 1 Analysis | Gotovo — `00`–`03`, `decisions.md` |
| 2 Modules | Gotovo — `modules/*.md`, `gate-2.md` |
| 3 Synthesis | Gotovo — `04-cross-module-synthesis.md` |
| 4 Plan | Gotovo — `05`–`09`, `gate-3.md` (odobreno) |
| 5 Implement | **I0–I6 gotovi.** Sljedeće: I7 antd out + Lighthouse. |

### Recent commits (main)

| SHA | Opis |
|---|---|
| `e7142f1` | Parse fix shell/dashboard (pre-I0 CI unblock) |
| `e43d6e3` | Phase 4 docs + GATE 3 |
| `4106ee7` | **I0** tokens, Tailwind map, IBM Plex |
| `f99a53b` | **I1** login 401 + `AuthUser.role` |
| `26805b2` | **I2** shell rewrite (NavLink, drawer) |
| `8ae15d7` | STATE: I2 closed |
| `b496765` | **I3** shadcn primitives + native InputNumber |
| `2ba7dac` | STATE: I3 closed |
| `32beb33` | **I4** PageHeader / QueryState / StatCard / StatusBanner |
| `d7fd13a` | STATE: I4 closed |
| `b0e0a2c` | **I5** TempDialog + ConfirmDialog |
| `c3d2b5f` | **I6 partial** Auth + Boiler + Dashboard TempDialog |
| `db2c9e7` | **I6** Heating + Reports + gas ConfirmDialog |
| `28b762d` | **I6** Gas analytics + Notifications + Profile + Home profile shells |
| `f60a04f` | **I6** Dashboard full (SVG/QueryState/DA-02/04/05) |

CI: Frontend workflow `.github/workflows/frontend-ci.yml` on push to `main`. Zadnji run zelen: `42382387551`.

Dev: `frontend/` → `npm run dev` (port **80** zauzet često → Vite pada na **81**).

---

## 2. Odluke (ne re-pitati)

Izvor: `decisions.md`, `07-decision-record.md`, `09-implementation-rules.md`.

1. **Q1** Ant Design se uklanja; primitiv = shadcn u `frontend/src/shared/components/ui`.
2. **Q2** Gust operator UI (Linear/Vercel + Apple-linear). Boje iz postojećeg koda (`#ff6b3d` brand, …) — hex samo u token fajlu.
3. **Q3** Shell/dashboard se grade iznova (ne krpe antd). Trenutno stablo = source of behavior.
4. **Q5** Samo web dashboard; `mobile/` van opsega.
5. **Q6** Devet ruta vidljivo USER/SUPPORT/ADMIN. Shell prikazuje role. Nema meni-only auth.
6. **Q7** i18n BS+EN preko `t()`.
7. **Pristup A:** inkrementalno na `main`, I0→I7, commit+push+`gh run watch` po podfazi.
8. **Van opsega:** Prisma, API ugovori, auth business logika, Redis dashboard keš.
9. Poslovna pravila (`04` §6): temp **48–55**, health sa servera, dva heating ugovora, potrošnja novije−starije, breakdown snapshot, home profile granice forme (ne Zod), uzak PUT profila, `downloadProtectedFile`.

---

## 3. Šta je urađeno u kodu

### I0 — Tokeni
- `frontend/src/design/tokens.css` — validan `:root` / `html.dark`, RGB + shadcn HSL (primary = brand).
- `frontend/src/index.css` — import tokena; bez duplog `--border`.
- `frontend/tailwind.config.js` — `brand`, `surface`, `text`, `success`, `error`, `dark-*`, z-index.
- `@fontsource/ibm-plex-sans` + `ibm-plex-mono` u `main.tsx`.
- Ključ teme: **`boiler.theme`** + FOUC skripta u `index.html` (ne dirati).

### I1 — Auth
- `services/auth401.ts` — `shouldForceLoginRedirectOn401` (login 401 **ne** radi full reload).
- `features/auth/map-auth-user.ts` — `AuthUser` sa `id: number`, `role`, `plan?`, `prefersDarkMode?`.
- `LoginPage` — empty validation, `role="alert"`, autocomplete, redirect ako token postoji.

### I2 — Shell
- `MainLayout.tsx` + `shell-nav-items.ts` + `shell-nav-list.tsx` + `shell-nav-drawer.tsx`.
- `NavLink`, drawer Escape + focus trap, `#main-content`, prikaz role, i18n `shell.*` / `nav.*`.
- Bez antd Layout/Menu/icons u shellu (emoji privremeno za menu/theme).
- `RouteFallback` = skeleton (token klase), ne inline hex.

### I3 — Primitives
- Radix: dialog, select, checkbox, switch (+ postojeći slot); `lucide-react`; `tailwindcss-animate`.
- `shared/components/ui`: Dialog, Sheet, Select, Checkbox, Table, Switch; Button/Card/Input/Label na I0 tokenima.
- `components/InputNumber.tsx` — native brojčani unos (bez antd), isti props ugovor (`onChange(number|null)`, precision, addonAfter).
- Testovi: `shared/components/ui/__tests__/primitives.test.tsx`.

### I4 — Shared stanja
- `shared/components/{page-header,query-state,stat-card,status-banner}.tsx` + barrel `index.ts`.
- `RouteFallback` → `<QueryState status="loading" />`.
- i18n: `common.empty`, `common.loadFailed`, `common.dismiss` (EN+BS).
- Testovi: `shared/components/__tests__/shared-states.test.tsx`.
- Lokalni `components/StatCard` ostaje na stranicama do I6/I7.

### I5 — Dialogs
- `TempDialog` + `ConfirmDialog` (Radix Dialog focus trap / Escape).
- `validateFlowTempInput` u `boilerLimits.ts` (48–55 inkluzivno, 1 decimal).
- `invalidateQueriesAfterTempSet` → `boilerEvents` + `dashboard` + `dashboardHealth`.
- Matrica: `.cursor/docs/matrices/temp-dialog/`.

### I6 — Pages (in progress)
- **Auth** ✅ LoginPage → shadcn + StatusBanner.
- **Boiler** ✅ PageHeader + QueryState + Table + TempDialog.
- **Heating** ✅ PageHeader + QueryState + Table + `anomaly-badge`.
- **Reports** ✅ PageHeader + QueryState + Table + breakdown expand (`confidenceScore * 100` zadržan).
- **Gas readings** ✅ `ConfirmDialog` umjesto `window.confirm` (formula potrošnje netaknuta).
- **Gas analytics** ✅ PageHeader/QueryState + `gas-analytics-period-bar` / `gas-analytics-metrics`.
- **Notifications** ✅ lucide + PageHeader/QueryState (bez antd icons).
- **Profile** ✅ shells + VAT `gasPriceVatRate ?? 0.17` (`constants/gas-vat.ts`); uzak PUT.
- **Home profile** ✅ PageHeader/QueryState/StatusBanner (minimal; fajl i dalje velik).
- **Dashboard** ✅ full: PageHeader/QueryState/SVG bar/Sheets; DA-02 array `isHeatingNow`; DA-04 error≠empty; DA-05 controlled from+to; TempDialog zadržan. Bez antd/plots u dashboard feature.

### Još nije
- Lokalni `frontend/src/components/{Button,Card,Input,StatCard}` ako još ima importa (I7).
- Antd u ThemeContext + package deps (`antd`, plots, icons).
- I7 antd out + Lighthouse.

---

## 4. Next steps (redoslijed)

Strogo po `08-implementation-plan.md` + `09-implementation-rules.md`.

### I7 — Ukloniti antd, obrisati mrtav lokalni set, Lighthouse (Q8)

Po podfazi: **jedna** I-podfaza; stop ako CI crven ili poslovni broj regressira → revert.

---

## 5. Test status

| Provjera | Status |
|---|---|
| `npm run type-check` (frontend) | Prolazi nakon I2 |
| `npm run lint` | 0 errors, ~26 warnings (poznati) |
| `npm test` | 121 pass |
| `npm run build` + `VITE_API_URL` | Prolazi |
| Frontend CI on main | Zelen za I0–I2 |
| Lighthouse Q8 | **Nije pokrenut** (plan I7) |
| E2E Playwright | Nije dio I0–I2 acceptance |

---

## 6. Otvoreno / rizici

- **Q8** Lighthouse — I7.
- **HP-04** HTTP status kad home profil ne postoji — razdvojiti create vs network error u I6.
- **RE-06** `confidenceScore` raspon u DTO — zadržati `* 100` dok DTO ne kaže drugačije.
- I3 povećava bundle (Radix + lucide); antd još nije van.
- Drawer u I2 je custom; I3 Sheet može zamijeniti drawer u kasnijem polishu — ne blokira I3.
- `prefersDarkMode` sa profila **ne** prepisuje `boiler.theme` u v1.
- Chat je bio dug; **ova sesija treba stati** — nastavak u novoj sesiji od I3.

---

## 7. Ključni fajlovi za agenta

```
docs/redesign/STATE.md
docs/redesign/HANDOFF.md          ← ovaj fajl
docs/redesign/08-implementation-plan.md
docs/redesign/09-implementation-rules.md
docs/redesign/06-design-direction.md
docs/redesign/07-decision-record.md
docs/redesign/04-cross-module-synthesis.md
docs/redesign/decisions.md
frontend/src/shared/components/ui/
frontend/src/components/MainLayout.tsx
frontend/src/design/tokens.css
frontend/tailwind.config.js
.github/workflows/frontend-ci.yml
```

## 8. Prompt za novu sesiju (kopiraj)

```
Nastavi boiler-control dashboard redesign I7.
Pročitaj docs/redesign/HANDOFF.md, STATE.md, 08-implementation-plan.md, 09-implementation-rules.md.
I0–I6 gotovi. Ukloni antd/@ant-design/plots/icons iz produkcijskog grafa, mrtav lokalni UI set, ThemeContext bez ConfigProvider; Lighthouse Q8. Commit+push+gh run watch.
```
