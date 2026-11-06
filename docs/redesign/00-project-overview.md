# 00 — Pregled projekta

Izvor: čitanje repozitorija 2026-11-06. Stari `docs/audit/frontend/01-inventory.md` i `docs/README.md` ne opisuju trenutno stablo. Ne koristiti ih kao izvor verzija.

## Šta aplikacija radi

Web dashboard za upravljanje grijanjem jednog naloga: pregled sistema, temperatura polazne vode kotla, događaji grijanja, očitanja i analitika plina, preporuke, profil kuće, notifikacije i profil korisnika.

Mobilna Expo aplikacija (`mobile/`) i NestJS API (`backend/`) su van opsega izmjena. API i Prisma su ovdje samo kao kontekst toka podataka.

## Stvarne verzije

Nema docs MCP-a u ovoj sesiji. Verzije su iz lockfile-a, ne iz memorije. Službene stranice biblioteka nisu ponovo otvarane u ovoj sesiji; tvrdnje o ponašanju dolaze iz koda.

### Web (`frontend/package-lock.json`, ključ `packages`)

| Paket | Zaključana verzija |
|---|---|
| react / react-dom | 19.1.0 |
| vite | 5.4.21 |
| typescript | 5.9.3 |
| tailwindcss | 3.4.19 |
| antd | 5.29.3 |
| @ant-design/icons | 5.6.1 |
| @ant-design/plots | 2.6.8 |
| @tanstack/react-query | 5.102.5 |
| @tanstack/react-virtual | u `package.json` kao `^3.14.26`; upotreba u `src` nije nađena grep-om |
| react-router-dom | 6.30.6 |
| i18next | 23.16.8 |
| zod | 4.6.7 |
| axios | 1.20.0 |
| @radix-ui/react-slot | 1.5.0 |
| class-variance-authority | 0.7.1 |
| clsx | 2.1.1 |
| tailwind-merge | 3.7.0 |
| eslint (lock) | 9.39.5 |
| vitest (lock) | 3.2.4 |
| @playwright/test | 1.49.1 |
| axe-core | 4.14.0 |

Instalirani `frontend/node_modules/eslint/package.json` je **8.57.1**, ne 9.39.5. `node_modules/vitest` i `node_modules/eslint-plugin-react-hooks` ne postoje. Detalj: `03-baseline.md`.

### API (`backend/package-lock.json`)

| Paket | Zaključana verzija |
|---|---|
| @nestjs/core | 11.2.3 |
| prisma / @prisma/client | 7.10.1 (`package.json` traži `^7.4.1`) |
| typescript | 5.9.3 |
| ioredis | 6.0.0 |
| pg | 8.23.0 |

`backend/prisma/schema.prisma` datasource `provider = "postgresql"`. `docs/README.md` i dalje piše MySQL i React 18. To je zastarjelo.

## Ulaz i konfiguracija

| Stavka | Dokaz |
|---|---|
| Entry | `frontend/src/main.tsx` — `QueryClientProvider` + `App` |
| Router | `frontend/src/App.tsx` — `BrowserRouter`, 10 stranica preko `React.lazy` |
| Alias `@` | `frontend/vite.config.ts` → `./src` |
| Dev port | `vite.config.ts` `server.port: 80`, proxy `/api` → `http://localhost:3020` |
| API base | `frontend/.env.example`: `VITE_API_URL` obavezan za build. Primjer produkcije: `https://api.boiler-control.ba101.top/api` |
| TS | `frontend/tsconfig.app.json`. `tsc --showConfig` spaja dva `compilerOptions` ključa i zadržava `strict`, `jsx: react-jsx`, `baseUrl`, `paths` |
| Tailwind | `frontend/tailwind.config.js`: `darkMode: 'class'`, `preflight: false`, samo shadcn HSL boje |
| shadcn config | `frontend/components.json`: style default, baseColor slate, css `src/index.css` |
| i18n | `frontend/src/locales/config.ts` (550 nepraznih linija), učitan iz `main.tsx` |

`docs/README.md` kaže da web sluša na portu 3021 i da živi u `apps/web`. Trenutni Vite config sluša na portu 80, a kod je u `frontend/`.

## Tok podataka

```
stranica / hook
  → apiClient (frontend/src/services/api.ts, axios)
  → Nest controller pod /api/*
  → Prisma model (PostgreSQL)
```

React Query (`frontend/src/lib/queryClient.ts`): `staleTime` 30s, `retry` 1, `refetchOnWindowFocus: true`, `refetchIntervalInBackground: false`. Ključevi: `frontend/src/lib/queryKeys.ts`.

Auth (`frontend/src/features/auth/AuthContext.tsx`): `detectAuthMode()`, opcionalni httpOnly refresh, inače token preko `apiClient`. `ProtectedRoute` pušta dijete samo ako postoji token. `isInitializing` drži spinner dok tokena nema.

Uloge: `UserRole` u šemi je `USER | ADMIN | SUPPORT` (`schema.prisma` oko linije 365). Web UI ne čita `role` (grep po `frontend/src` nalazi samo OpenAPI tip i `role="dialog"`). Svaka zaštićena ruta traži samo token.

## Redis

Redis nije keš dashboarda.

- Jedini klijent: `backend/src/common/redis-health.service.ts` (`new Redis(url)` kad postoji `REDIS_URL`).
- Izložen samo na health odgovoru: `backend/src/common/health.controller.ts`.
- `backend/.env.example` nema `REDIS` (grep bez pogodaka).
- Vrijeme je u Postgres modelima `WeatherCache` i `WeatherV2Cache`, ne u Redis ključevima.

Web moduli nemaju Redis ključeve.

## Prisma modeli (web ih dira posredno, preko API-ja)

`User`, `HomeProfile`, `ThermostatDevice`, `ThermostatProgram`, `HeatingEvent`, `Recommendation`, `WeatherCache`, `WeatherV2Cache`, `BoilerHistory`, `GasReading`, `HeatingIntervalLearning`, `TuyaToken`, `UserDevice`, `Notification`, `NotificationPreference`, `GasPriceHistory`, `RefreshToken`.

Termostat, Tuya i uređaji nemaju stranicu u `frontend/src/App.tsx`.
