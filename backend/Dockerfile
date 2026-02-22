############################
# Stage 1: Install root deps (workspaces)
############################
FROM node:20-slim AS deps
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates python3 make g++ openssl git curl \
    && rm -rf /var/lib/apt/lists/*

# Kopiraj root package.json + lockfile
COPY package.json package-lock.json ./

# Instaliraj sve workspace deps jednom
RUN npm ci --legacy-peer-deps

############################
# Stage 2: Build backend
############################
FROM node:20-slim AS build
WORKDIR /app

# Kopiraj node_modules iz deps stage
COPY --from=deps /app/node_modules ./node_modules

# Kopiraj root package.json + lockfile (obavezno)
COPY package.json package-lock.json ./

# Kopiraj backend source
COPY backend/ ./backend/
WORKDIR /app/backend

# Env varijable (env7)
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

# Prisma generate (lokalna verzija iz node_modules)
RUN npx prisma generate --schema=prisma/schema.prisma

# Build NestJS
RUN npm run build --workspace=backend

############################
# Stage 3: Production image
############################
FROM node:20-slim AS production
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3020

# Kopiraj build + node_modules
COPY --from=build /app/backend/dist ./dist
COPY --from=deps /app/node_modules ./node_modules

# Entrypoint
COPY backend/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh

EXPOSE 3020
ENTRYPOINT ["./docker-entrypoint.sh"]
