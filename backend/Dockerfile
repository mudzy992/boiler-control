############################
# Stage 1: Build dependencies
############################
FROM node:20-slim AS build
WORKDIR /app

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    python3 \
    make \
    g++ \
    openssl \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Environment variables (env7)
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

# Copy root + backend package.json
COPY package*.json ./
COPY backend/package*.json ./backend/

# Install all dependencies (workspaces)
RUN npm install --legacy-peer-deps

# Copy backend source
COPY backend/ ./backend/

# Build backend
WORKDIR /app/backend

# Prisma generate
RUN npx prisma generate

# NestJS build
RUN npm run build

############################
# Stage 2: Production-only deps
############################
FROM node:20-slim AS pruned
WORKDIR /app

# Copy root + backend package.json
COPY package*.json ./
COPY backend/package*.json ./backend/

# Install only production deps
RUN npm install --omit=dev --legacy-peer-deps

############################
# Stage 3: Final Production Image
############################
FROM node:20-slim AS production
WORKDIR /app

# Production ENV
ENV NODE_ENV=production
ENV PORT=3020

# Copy dist
COPY --from=build /app/backend/dist ./dist
# Copy production node_modules
COPY --from=pruned /app/node_modules ./node_modules

# Copy package.json + entrypoint
COPY backend/package*.json ./
COPY backend/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh

EXPOSE 3020
ENTRYPOINT ["./docker-entrypoint.sh"]
