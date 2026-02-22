############################
# Stage 1: Dependencies
############################
FROM node:20-slim AS deps

WORKDIR /usr/src/app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    ca-certificates \
    build-essential \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Kopiramo SAMO backend package fajlove
COPY backend/package*.json ./

# Reproducibilan install
RUN npm cache clean --force \
    && npm install --legacy-peer-deps

############################
# Stage 2: Build
############################
FROM node:20-slim AS build

WORKDIR /app

ENV NODE_OPTIONS="--dns-result-order=ipv4first"
ENV DATABASE_URL="mysql://mudzy:nije,kikiriki@172.17.0.1:3306/boiler_assistant"
ENV DATABASE_HOST=172.17.0.1
ENV DATABASE_USER=mudzy
ENV DATABASE_PASSWORD=nije,kikiriki
ENV DATABASE_NAME=boiler_assistant
ENV JWT_SECRET="tvoj_tajni_jwt_kljuc"
ENV JWT_EXPIRES_IN="3600s"
ENV WEATHER_API_KEY="8e968a22bfca43d18a6152747260301"
ENV TUYA_CLIENT_ID="y3kg9wjqwghsj8ak5swj"
ENV TUYA_CLIENT_SECRET="7d2164fd310f4edcb590ecbdaf373cca"
ENV TUYA_REGION=EU
ENV TUYA_BASE_URL=https://openapi.tuyaeu.com

# Kopiramo backend source
COPY --from=deps /app/node_modules ./node_modules
COPY backend/ .

# Prisma generate
RUN npx prisma generate

# Build Nest aplikacije
RUN npm run build

############################
# Stage 3: Production
############################
FROM node:20-slim AS production

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=3020

# Kopiramo samo ono što treba za runtime
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY backend/package*.json ./
COPY backend/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh

EXPOSE 3020

ENTRYPOINT ["./docker-entrypoint.sh"]
