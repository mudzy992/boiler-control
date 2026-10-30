# Frontend inventar — Faza 2

## Sažetak: pet ključnih činjenica

1. **VERIFIKOVANO:** aplikacija ima 10 ruta i 10 stranica, 5 komponenti, 2 konteksta (Auth/Theme), 2 servisa (api, notification.api), 1 hook (useAuth) i inline i18n (en-US/bs-BS) u jednom fajlu; ukupno 28 fajlova u `frontend/src`, ~4600 linija.
2. **VERIFIKOVANO (pokrenuto):** `npm run type-check` daje **lažno zeleno** — korenski `tsconfig.json` je solution-format (`"files": []`), pa `tsc --noEmit` ne provjerava ništa; stvarna provjera `tsc -p tsconfig.app.json` daje **12 grešaka** (FE-001).
3. **VERIFIKOVANO (pokrenuto):** `npm run build` uspijeva; **FE2-4 (2026-10-30) je uklonio jedan čip od 2.975,35 kB (gzip 906,26 kB)** — sada 21 čip, inicijalni JS 1.434,19 kB (gzip 451,87 kB) preko `React.lazy` + `manualChunks` (FE-004, riješeno). `npm run lint` **radi** — `frontend/eslint.config.mjs` postoji (FE-015 riješen ranije), daje 0 grešaka i 13 pre-postojećih upozorenja. *Ispravka: ova stavka je prvobitno navodila „2.972 kB" i „lint ne radi" — oba su zastarjela.*
4. **VERIFIKOVANO:** ne postoji nijedan test — `package.json` nema test skriptu, nema test direktorija niti testing zavisnosti (FE-014).
5. **VERIFIKOVANO:** `notification.api.ts` koristi `apiClient.get/post/patch` koji ne postoje na klasi `ApiClient`, a **niko ga ne importira** — mrtav, tipki slomljen kod (FE-011).

## Otvorena pitanja za vlasnika

- ~~Koji od tri compose rasporeda (korijenski `docker-compose.yml`, `frontend/docker-compose.yml` sa traefik labelama, `backend/docker-compose.yml`) je stvarna produkcija? (FE-009)~~ **RIJEŠENO 2026-10-30 (FE2-7, `1761876`):** mjerodavan je korijenski `docker-compose.yml`; `frontend/docker-compose.yml` je obrisan, `backend/docker-compose.yml` označen zamijenjenim. Otvoreno ostaje samo stvarno stanje servera (traefik mreža, certresolver, DNS), što se ne može provjeriti iz repozitorija.
- Da li je planiran refresh token / httpOnly cookie model (vezano za backend SEC-4/S-004) prije uvođenja na web?
- Koji je dogovoreni minimum podržanih preglednika i da li je gzip/brotli na ivici (traefik) ili u nginx?

## Struktura (28 fajlova, `frontend/src`)

<!-- fe:pages:10 -->

### Stranice i rute (10/10)

| # | Ruta | Stranica | Veličina | Pokrivenost i18n (`t()`) | Primjećeno |
|---|------|----------|----------|--------------------------|------------|
| 1 | `/login` | `pages/LoginPage.tsx` | 64 | 8 poziva | jedina potpuno i18n strana |
| 2 | `/dashboard` | `pages/DashboardPage.tsx` | 1113 | 3 poziva | najveći fajl; mešoviti hardcoded EN/BS |
| 3 | `/boiler` | `pages/BoilerPage.tsx` | 180 | 0 | hardcoded EN; duplirani set-temp modal |
| 4 | `/heating` | `pages/HeatingPage.tsx` | 95 | 0 | hardcoded EN; jednokratno učitavanje |
| 5 | `/gas/readings` | `pages/GasReadingsPage.tsx` | 285 | 20 | React Query + mutacije; i18n |
| 6 | `/gas/analytics` | `pages/GasAnalyticsPage.tsx` | 294 | 38 | React Query; `console.log` odgovora |
| 7 | `/reports` | `pages/ReportsPage.tsx` | 80 | 0 | hardcoded EN; čita `/recommendations` |
| 8 | `/home-profile` | `pages/HomeProfilePage.tsx` | 258 | 0 | nema `location` ni `seasonMode` u formi |
| 9 | `/notifications` | `pages/NotificationsPage.tsx` | 237 | 1 | React Query; mrtva invalidacija |
| 10 | `/profile` | `pages/ProfilePage.tsx` | 115 | 0 | gas cijena; hardcoded VAT 1.17 |

`/` je `Navigate` na `/dashboard`. Sve zaštićene rute su omotane s `ProtectedRoute` (provjera samo postojanja tokena) unutar `MainLayout` (App.tsx:24-115). Nema lazy loading (`React.lazy`) niti `Suspense` — svi importi su statički (App.tsx:4-16).

### Komponente (5/5)

| Komponenta | Namjena | Bilješka |
|---|---|---|
| `components/MainLayout.tsx` (165) | Sider/Header/Content/Footer, tema switch, logout | meni hardcoded EN; `collapsedWidth={0}` na mobilnom |
| `components/ProtectedRoute.tsx` (17) | redirect na `/login` ako nema tokena | ne provjerava istek/valjanost tokena |
| `components/GasForm.tsx` (243) | modal unosa očitanja + slika | ručna validacija (regex, budućnost datuma); custom dialog bez a11y atributa |
| `components/GasReadingCard.tsx` (212) | kartica očitanja + akcije + potrošnja | `previousReading` zapravo proslijeđuje "novije" očitanje (naziv zbunjujuće, račun ispravan) |
| `components/StatCard.tsx` (24) | antd Statistic kartica | — |

### Konteksti, hookovi, servisi, tipovi

| Fajl | Namjena | Bilješka |
|---|---|---|
| `context/AuthContext.tsx` (73) | login/logout, `user`/`token` stanje, `localStorage.token` | on mount sa tokenom poziva `getUserProfile`, catch briše token |
| `context/ThemeContext.tsx` (78) | light/dark, `localStorage['boiler.theme']`, antd ConfigProvider + `dark` klasa | toggle u headeru; nema `prefers-color-scheme` fallback |
| `hooks/useAuth.ts` (10) | getter za AuthContext | — |
| `services/api.ts` (281) | `ApiClient` klasa + axios instance; interceptori (Bearer iz localStorage, 401 → redirect); 30+ endpoint metoda | 4 metode nije niko pozvao (FE-011); `updateUserProfile(data: any)` |
| `services/notification.api.ts` (49) | **mrtav kod**: poziva `apiClient.get/post/patch` (ne postoje na klasi); niko ne importira | tipke greške 5× (FE-001/FE-011) |
| `types/homeProfile.ts` (70) | DTO/response tipovi profila | nema `location`; ručno pisan, ne iz OpenAPI |
| `types/ant-design-plots.d.ts` (1) | module declaration | — |
| `constants/homeProfileEnums.ts` (52) | enumi INSULATION/WINDOW/HEATING/SEASON + opcije Selecta | "matches backend Prisma enums" (komentar) |
| `locales/config.ts` (431) | inline en-US + bsBS resursi, i18next init, browser detekcija | nema ručnog izbora jezika u UI (FE-005); bs greške u kucanju |
| `index.css` | Tailwind (`preflight: false`) | — |

### Infrastrukturni fajlovi

| Fajl | Namjena |
|---|---|
| `vite.config.ts` | `react()` + `requireApiBaseUrl()` (FE2-7: rusi build bez `VITE_API_URL`); `server.port: 80`; `build.rollupOptions.output.manualChunks` po porodici paketa (FE2-4) |
| `nginx.conf` | SPA `try_files`, `/assets/` 1y immutable, `/health` 200, blokira dotfileove; gzip **uključen** i security headeri dodani (FE2-6), CSP u report-only rezimu |
| `Dockerfile` | 2 stage: build (`npm ci --legacy-peer-deps`, `npm run build`) → `nginx:1.27-alpine`; `ARG VITE_API_URL` **bez defaulta** — bez njega build sada pada (FE2-7) |
| ~~`docker-compose.yml` (frontend)~~ | **OBRISAN 2026-10-30 (FE2-7).** Bio: traefik host `boiler.ba101.top`, `VITE_API_URL=/backend/api`, `expose 3021` + loadbalancer port 3021 **iako nginx sluša 80** (FE-009). Mjerodavan je korijenski `docker-compose.yml`; `backend/docker-compose.yml` je označen zamijenjenim |
| `index.html` | nema CSP meta; `lang="en"` statički; faviconi (16/32) |
| `tailwind.config.js` | `darkMode: 'class'`, `preflight: false` |
| `DESIGN_SYSTEM.md` | dokumentovana paleta/tipografija (kontekst, ne dio builda) |
| `README.md` | **neizmijenjeni Vite template README** (nema opisa aplikacije) |

## Mapa "ekran → API poziv → backend ruta"

<!-- fe:routes:10 -->

Sve pozive je moguće pratiti do backend ruta iz `docs/audit/backend/02-api-catalog.md` (Faza 1); owner/guard kolone tamo važe. "Potrošač: web" u tom katalogu ovim je potvrđen.

| Ekran (ruta) | `apiClient` metoda | Backend ruta | Bilješka |
|---|---|---|---|
| `/login` | `login` | `POST /api/auth/login` | token u `localStorage` |
| `/dashboard` | `getHomeProfile` | `GET /api/home-profile` | `useQuery`, staleTime 5 min |
| `/dashboard` | `getCurrentWeather(homeProfileId)` | `GET /api/weather/current/:id` | `useQuery`, staleTime 10 min; drugi izvor vremena uz `system.weather` iz dashboarda (FE-003) |
| `/dashboard` | `getDashboard` | `GET /api/dashboard` | ručni `useEffect`, jednom pri mountu |
| `/dashboard` | `getDashboardHeatingEvents` | `GET /api/dashboard/heating-events?from&to&limit=500` | `setInterval` 60 s (FE-006) |
| `/dashboard` | `getDashboardHeatingSummary` | `GET /api/dashboard/heating-summary?from&to&bucket` | isti interval |
| `/dashboard` | `getDashboardHeatingStatus` | `GET /api/dashboard/heating-status` | isti interval |
| `/dashboard` | `getNotifications` + `getNotificationPreferences` | `GET /api/notifications`, `GET /api/notifications/preferences` | ručno stanje (duplikat s `/notifications` stranicom) |
| `/dashboard` | `markNotificationAsRead` | `POST /api/notifications/:id/read` | pun reload liste nakon |
| `/dashboard` | `updateNotificationPreference` | `PATCH /api/notifications/preferences` | — |
| `/dashboard`, `/boiler` | `setBoilerCurrentTemp` | `PATCH /api/boiler/current-temp` | duplirani modal + konstante 48/55 (FE-010) |
| `/boiler` | `getBoilerEvents` | `GET /api/boiler/history` | jednokratno |
| `/heating` | `getHeatingEvents` | `GET /api/heating-events` | jednokratno, defanzivno dvostruki shape (FE-016) |
| `/gas/readings` | `getGasReadings` | `GET /api/gas/readings` | RQ staleTime 5 min |
| `/gas/readings` | `addGasReadingWithUpload` | `POST /api/gas/reading` (multipart) | RQ mutacija + invalidacije |
| `/gas/readings` | `deleteGasReading` | `DELETE /api/gas/reading/:id` | fire-and-forget bez `onError` (FE-012) |
| `/gas/readings` | `updateGasReference` | `PATCH /api/gas/reading/:id/reference` | — |
| `/gas/readings` | `uploadGasMeterImage` / `uploadGasInvoice` / `deleteGasInvoice` | `POST /api/gas/reading/:id/meter-image`, `POST /api/gas/reading/:id/invoice`, `DELETE /api/gas/reading/:id/invoice` | file input preko dom.createElement (accept PDF / JPEG,PNG,WebP) |
| `/gas/readings` | `getGasMeterImageUrl` / `getGasInvoiceUrl` | `GET /api/gas/reading/:id/meter-image`, `GET /api/gas/reading/:id/invoice` | preuzimanje s Bearer headerom preko `fetch` (ispravno) |
| `/gas/analytics` | `getGasAnalysis(from?,to?)` | `GET /api/gas/analysis?from&to` | queryFn swallowa greške → `{}` (FE-007) |
| `/reports` | `getReports` | `GET /api/recommendations` | `generateReport` (`POST /recommendations/generate`) nije niko pozvao |
| `/home-profile` | `getHomeProfile` / `createHomeProfile` / `updateHomeProfile` | `GET/POST /api/home-profile`, `PATCH /api/home-profile/:id` | 404 → zbunjujuća greška; nema `location` u formi (FE-003/FE-017) |
| `/notifications` | `getNotifications` / `markNotificationAsRead` / `markAllNotificationsRead` | `GET /api/notifications`, `POST /api/notifications/:id/read`, `POST /api/notifications/mark-all-read` | RQ; invalidira nepostojeći key `notifications-unread-count` |
| `/profile` | `getUserProfile` / `updateUserProfile` | `GET /api/user`, `PUT /api/user` | gasPriceExVat; VAT 1.17 hardcoded |

**Definirane, ali niko ne poziva (web):** `getWeather` (`GET /api/weather` — backend stub koji vraća `{}`, B-002), `getBoilerStatus` (`GET /api/boiler/status`), `addGasReadingPayload` (JSON varijanta), `generateReport`.

## Testovi i izvođenje (stvarno stanje, 2026-10-29)

<!-- fe:tests -->

| Komanda | Rezultat | Napomena |
|---|---|---|
| `npm ci --no-audit --no-fund` | uspjeh, 531 paket | 12 s |
| `npm run type-check` (`tsc --noEmit`) | **exit 0 — lažno zeleno** | korenski tsconfig ima `"files": []` (solution format) pa ništa ne provjerava |
| `npx tsc --noEmit -p tsconfig.app.json` | **12 grešaka** | `DashboardPage.tsx:215,870,1058,1060`, `HomeProfilePage.tsx:16` (2×), `notification.api.ts:27,32,36,40,48` |
| `npm run build` (vite) | uspjeh, 15.9 s | jedan čip `index-*.js` **2.972 kB / gzip 905 kB**; CSS 18.9 kB; vite upozorenje >500 kB |
| `npm run lint` (eslint) | **ne radi**, exit 2 | "ESLint couldn't find a configuration file" — u `frontend/` nema eslint konfiguracije (backend je ima) |
| testovi | **ne postoje** | nema `test` skripte niti test direktorija |

Vite build **ne pokreće** type-check (skripta je samo `vite build`), zato tipke greške ne ruše ni build ni (nepostojeći) frontend CI.
