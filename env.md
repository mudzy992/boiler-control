> **UPOZORENJE (SEC-0):** stvarne vrijednosti su uklonjene iz ovog fajla jer je
> repozitorij javan. Tajne se drže ISKLJUČIVO u secret manageru i lokalnom
> `backend/.env` koji nije praćen Gitom. Postupak rotacije:
> `docs/audit/backend/11-secret-rotation-runbook.md`.
> Vrijednosti koje su ovdje stajale morale su se rotirati — bile su u historiji.

APP_PORT=3020

# MySQL connection (replace with real values, do not commit )
# DATABASE_URL="mysql://mudzy:nije,kikiriki@sql.ba101.top:3306/boiler_assistant"
# DATABASE_USER="mudzy"
# DATABASE_PASSWORD="nije,kikiriki"
# DATABASE_HOST="sql.ba101.top"
# DATABASE_PORT=3306

# Postgres connection (replace with real values, do not commit)
DATABASE_URL="postgresql://boilercontrol:Mojalozinka!1@hgpchekxb6dutalsyctu42al:5432/boilercontrol"
DATABASE_USER=<DATABASE_USER: vrijednost iz secret managera>
DATABASE_PASSWORD=<DATABASE_PASSWORD: vrijednost iz secret managera>
DATABASE_NAME=<DATABASE_USER: vrijednost iz secret managera>
DATABASE_HOST="hgpchekxb6dutalsyctu42al"
DATABASE_PORT=5432
DATABASE_POOL_SIZE=10
DATABASE_CONNECT_TIMEOUT_MS=5000

JWT_SECRET=<JWT_SECRET: vrijednost iz secret managera>
JWT_EXPIRES_IN="3600s"

WEATHER_API_KEY=<WEATHER_API_KEY: vrijednost iz secret managera>

TUYA_CLIENT_ID=<TUYA_CLIENT_ID: vrijednost iz secret managera>
TUYA_CLIENT_SECRET=<TUYA_CLIENT_SECRET: vrijednost iz secret managera>
TUYA_REGION=EU
TUYA_BASE_URL=https://openapi.tuyaeu.com

NODE_ENV=production # ako je development onda cron neće raditi
TZ=Europe/Sarajevo