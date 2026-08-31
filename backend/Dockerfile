# ============================================================
# Stage 1: Dependencies
# ============================================================
FROM node:20-slim AS dependencies

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl libssl-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/backend/app

# Build stage MUST contain devDependencies
ENV NODE_ENV=development

COPY package*.json ./

RUN npm ci --no-audit --no-fund


# ============================================================
# Stage 2: Build
# ============================================================
FROM node:20-slim AS build

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/backend/app

# Build MUST use development dependencies
ENV NODE_ENV=development

COPY --from=dependencies /usr/src/backend/app/node_modules ./node_modules
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build NestJS
RUN npm run build


# ============================================================
# Stage 3: Production
# ============================================================
FROM node:20-slim AS production

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/backend/app

ENV NODE_ENV=production
ENV UPLOAD_ROOT_PATH=/usr/src/app/uploads

COPY --from=build /usr/src/backend/app/dist ./dist
COPY --from=build /usr/src/backend/app/node_modules ./node_modules
COPY --from=build /usr/src/backend/app/package*.json ./
COPY --from=build /usr/src/backend/app/prisma ./prisma

EXPOSE 3020

CMD ["node", "dist/src/main.js"]