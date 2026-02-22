############################
# Stage 1: Base deps (cached)
############################
FROM node:20-slim AS deps

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY backend/package*.json ./
RUN npm install --legacy-peer-deps


############################
# Stage 2: Build
############################
FROM node:20-slim AS build
WORKDIR /app

# ---- VRACENI SVI TVOJI ENV ----
ENV NODE_OPTIONS="--dns-result-order=ipv4first"
ENV DATABASE_URL="mysql://mudzy:nije,kikiriki@172.17.0.1:3306/boiler_assistant"
ENV DATABASE_HOST=172.17.0.1
ENV DATABASE_USER=mudzy
ENV DATABASE_PASSWORD="nije,kikiriki"
ENV DATABASE_NAME=boiler_assistant
ENV JWT_SECRET="tvoj_tajni_jwt_kljuc"
ENV JWT_EXPIRES_IN="3600s"
ENV WEATHER_API_KEY="8e968a22bfca43d18a6152747260301"
ENV TUYA_CLIENT_ID="y3kg9wjqwghsj8ak5swj"
ENV TUYA_CLIENT_SECRET="7d2164fd310f4edcb590ecbdaf373cca"
ENV TUYA_REGION=EU
ENV TUYA_BASE_URL=https://openapi.tuyaeu.com
# --------------------------------

COPY backend/package*.json ./
COPY --from=deps /app/node_modules ./node_modules

COPY backend/ .

RUN npx prisma generate
RUN npm run build


############################
# Stage 3: Production deps only
############################
FROM node:20-slim AS pruned
WORKDIR /app

COPY backend/package*.json ./
RUN npm install --omit=dev --legacy-peer-deps


############################
# Stage 4: Final Production Image
############################
FROM node:20-slim AS production
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3020

COPY --from=build /app/dist ./dist
COPY --from=pruned /app/node_modules ./node_modules

COPY backend/package*.json ./
COPY backend/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh

EXPOSE 3020
ENTRYPOINT ["./docker-entrypoint.sh"]
