# Stage 1: Dependencies
FROM node:20-slim AS deps
WORKDIR /usr/src/app
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates build-essential git curl \
    && rm -rf /var/lib/apt/lists/*

# Copy root package-lock.json and backend package.json
COPY package-lock.json ./
COPY backend/package*.json ./
RUN npm install --legacy-peer-deps

# Stage 2: Build
FROM deps AS build
WORKDIR /usr/src/app
ENV NODE_OPTIONS=${NODE_OPTIONS:-"--dns-result-order=ipv4first"}

COPY backend/ .
COPY backend/prisma ./prisma

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

RUN npx prisma generate
RUN npm run build
RUN cp -r src/generated dist/generated

# Stage 3: Production
FROM node:20-slim AS production
WORKDIR /usr/src/app
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=deps /usr/src/app/package*.json ./
COPY --from=deps /usr/src/app/node_modules ./node_modules

COPY --from=build /usr/src/app/dist ./dist
#COPY --from=build /usr/src/app/src/generated ./dist/generated

COPY backend/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x /usr/src/app/docker-entrypoint.sh

ENV NODE_ENV=production
ENV PORT=3020

EXPOSE 3020

ENTRYPOINT ["./docker-entrypoint.sh"]
