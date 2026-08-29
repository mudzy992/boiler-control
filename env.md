APP_PORT=3020

# MySQL connection (replace with real values, do not commit)
# DATABASE_URL="mysql://mudzy:nije,kikiriki@sql.ba101.top:3306/boiler_assistant"
# DATABASE_USER="mudzy"
# DATABASE_PASSWORD="nije,kikiriki"
# DATABASE_HOST="sql.ba101.top"
# DATABASE_PORT=3306

# Postgres connection (replace with real values, do not commit)
DATABASE_URL="postgresql://boilercontrol:Mojalozinka!1@hgpchekxb6dutalsyctu42al:5432/boilercontrol"
DATABASE_USER="boilercontrol"
DATABASE_PASSWORD="Mojalozinka!1"
DATABASE_NAME="boilercontrol"
DATABASE_HOST="hgpchekxb6dutalsyctu42al"
DATABASE_PORT=5432
DATABASE_POOL_SIZE=10
DATABASE_CONNECT_TIMEOUT_MS=5000

JWT_SECRET="bbeb461428b2b35208d90cdccf438e39"
JWT_EXPIRES_IN="3600s"

WEATHER_API_KEY="8e968a22bfca43d18a6152747260301"

TUYA_CLIENT_ID="y3kg9wjqwghsj8ak5swj"
TUYA_CLIENT_SECRET="7d2164fd310f4edcb590ecbdaf373cca"
TUYA_REGION=EU
TUYA_BASE_URL=https://openapi.tuyaeu.com

NODE_ENV=production # ako je development onda cron neće raditi
TZ=Europe/Sarajevo