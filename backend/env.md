> **UPOZORENJE (SEC-0):** stvarne vrijednosti su uklonjene iz ovog fajla jer je
> repozitorij javan. Tajne se drže ISKLJUČIVO u secret manageru i lokalnom
> `backend/.env` koji nije praćen Gitom. Postupak rotacije:
> `docs/audit/backend/11-secret-rotation-runbook.md`.
> Vrijednosti koje su ovdje stajale morale su se rotirati — bile su u historiji.

# =====================================================================
# SANITIZED FILE — see docs/MYSQL_TO_POSTGRES_MIGRATION.md
#
# The real production credentials that used to live in this file were
# removed as part of the MySQL -> PostgreSQL migration prep, because
# this file should never have contained live secrets in the first
# place (see CRITICAL finding in the project audit). Fill in real
# values locally / in your secret manager; never commit real values
# here. This file is already covered by .gitignore (`.env.*`).
# =====================================================================

APP_PORT=3020

# MySQL connection (replace with real values, do not commit)
# DATABASE_URL="mysql://mudzy:nije,kikiriki@sql.ba101.top:3306/boiler_assistant"
# DATABASE_USER="mudzy"
# DATABASE_PASSWORD="nije,kikiriki"
# DATABASE_HOST="sql.ba101.top"
# DATABASE_PORT=3306

# Postgres connection (replace with real values, do not commit)
DATABASE_URL=<DATABASE_URL: vrijednost iz secret managera>
DATABASE_USER=<DATABASE_USER: vrijednost iz secret managera>
DATABASE_PASSWORD=<DATABASE_PASSWORD: vrijednost iz secret managera>
DATABASE_NAME=<DATABASE_USER: vrijednost iz secret managera>
DATABASE_HOST="sql.ba101.top"
DATABASE_PORT=5432

# ---------------------------------------------------------------------
# REL-4 / B-021 — zaštita destruktivnog seeda i `prisma migrate reset`.
# Seed briše sve retke iz 14 tabela, pa prije konekcije provjerava cilj
# (backend/src/common/seed-target-guard.ts). NODE_ENV=production se uvijek
# odbija i nijedan override to ne zaobilazi.
# ---------------------------------------------------------------------
# Lozinka testnog naloga koji seed kreira. Obavezna, bez defaulta; seed je
# namjerno NE ispisuje na stdout.
SEED_TEST_PASSWORD=<SEED_TEST_PASSWORD: lokalna vrijednost, ne commitovati>
# CSV imena baza koje su izričito dozvoljene (npr. za CI disposable bazu).
# Ostavi prazno ako nije potrebno.
SEED_ALLOWED_DATABASES=
# Eksplicitni override za nelokalni disposable host. Prima ISKLJUČIVO "on";
# svaka druga vrijednost je neaktivna. Ne postavlja se u produkciji.
SEED_ALLOW_ANY_TARGET=
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
