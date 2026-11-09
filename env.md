# Okruženje — imena varijabli i primjeri

> **UPOZORENJE (SEC-0 / SEC-5):** ovaj fajl je javan. Stvarne vrijednosti se
> drže ISKLJUČIVO u Coolify secretima i u lokalnom `backend/.env` koji **nije**
> praćen Gitom. Ako je vrijednost ikad bila u Gitu, smatra se kompromitovanom.
>
> Ovaj fajl je 2026-11-08 očišćen: u njemu je stajala **stvarna lozinka baze**.
> Postupak rotacije: `docs/audit/backend/35-secret-leak.md`.

## Backend (`backend/.env`, nije u Gitu)

| Varijabla | Primjer | Napomena |
|---|---|---|
| `APP_PORT` | `3020` | |
| `DATABASE_URL` | `postgresql://USER:PASSWORD@HOST:5432/DB` | jedini oblik koji kod čita |
| `DATABASE_USER` | `<DATABASE_USER>` | |
| `DATABASE_PASSWORD` | `<DATABASE_PASSWORD>` | |
| `DATABASE_NAME` | `<DATABASE_NAME>` | |
| `DATABASE_HOST` | `<DATABASE_HOST>` | |
| `DATABASE_PORT` | `5432` | |
| `DATABASE_POOL_SIZE` | `10` | |
| `DATABASE_CONNECT_TIMEOUT_MS` | `5000` | |
| `JWT_SECRET` | `<JWT_SECRET>` | min. 32 znaka, rotiran povremeno |
| `JWT_EXPIRES_IN` | `3600s` | |
| `WEATHER_API_KEY` | `<WEATHER_API_KEY>` | |
| `TUYA_CLIENT_ID` | `<TUYA_CLIENT_ID>` | |
| `TUYA_CLIENT_SECRET` | `<TUYA_CLIENT_SECRET>` | |
| `TUYA_REGION` | `EU` | |
| `TUYA_BASE_URL` | `https://openapi.tuyaeu.com` | |
| `NODE_ENV` | `production` | u `development`/`test` cron poslovi su isključeni |
| `TZ` | `Europe/Sarajevo` | |
| `UPLOAD_ROOT_PATH` | `/usr/src/app/uploads` | u kontejneru; bind mount na hostu |
| `FRONTEND_URL` | `https://boiler-control.ba101.top` | CORS origin, obavezan |
| `REDIS_URL` | `<REDIS_URL>` | opciono |

## Frontend (build arg, ne runtime)

| Varijabla | Primjer |
|---|---|
| `VITE_API_URL` | `https://api.boiler-control.ba101.top/api` |

Build **pada** ako `VITE_API_URL` izostane (`frontend/vite.config.ts`), namjerno —
ranije se tiho ugrađivao `http://localhost:3020/api`.

## Mobile

| Varijabla | Gdje |
|---|---|
| `EXPO_PUBLIC_API_URL` | `mobile/app.config.js` + `mobile/eas.json` profili |

## Provjera prije commita

`node scripts/audit/secret-scan.cjs` — traži obrasce tajni u **praćenim**
fajlovima. Isti skript se vrti u CI-ju; commit sa stvarnom vrijednošću pada.
