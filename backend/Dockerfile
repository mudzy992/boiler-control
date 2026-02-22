############################
# Stage 1: Install deps (root + workspaces)
############################
FROM node:20-slim AS deps
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates python3 make g++ openssl git curl \
    && rm -rf /var/lib/apt/lists/*

# Kopiraj root package.json + lockfile
COPY package*.json ./

# Instaliraj sve workspace deps u root-u
RUN npm install --legacy-peer-deps

############################
# Stage 2: Build backend
############################
FROM node:20-slim AS build
WORKDIR /app

# Copy installed deps
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./

# Copy backend source
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

# Prisma generate + build
RUN npm run generate:prisma --workspace=backend
RUN npm run build

############################
# Stage 3: Production image
############################
FROM node:20-slim AS production
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3020

# Copy built backend
COPY --from=build /app/backend/dist ./dist
COPY --from=deps /app/node_modules ./node_modules

# Entrypoint
COPY backend/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh

EXPOSE 3020
ENTRYPOINT ["./docker-entrypoint.sh"]
