# Stage 1: dependencies
FROM node:20-slim AS dependencies
RUN apt-get update -y && apt-get install -y openssl libssl-dev && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/backend/app

COPY package*.json ./
RUN npm ci

# Stage 2: build
FROM node:20-slim AS build
# FIX: Re-install openssl here too for the build phase
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/backend/app

COPY --from=dependencies /usr/src/backend/app/node_modules ./node_modules
COPY . .

RUN npx prisma generate
RUN cat tsconfig.build.json
RUN npm run build --verbose

# Stage 3: production
FROM node:20-slim AS production
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /usr/src/backend/app

ENV NODE_ENV=production

COPY --from=build /usr/src/backend/app/dist ./dist
COPY --from=build /usr/src/backend/app/node_modules ./node_modules
COPY --from=build /usr/src/backend/app/package*.json ./
# Make sure your prisma schema is available if needed at runtime
COPY --from=build /usr/src/backend/app/prisma ./prisma
COPY --from=build /usr/src/backend/app/src/generated ./dist/generated

EXPOSE 3020
# Start NestJS directly
CMD ["node", "dist/main.js"]
