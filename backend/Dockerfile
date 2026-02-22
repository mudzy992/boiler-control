############################
# Stage 1: deps
############################
FROM node:20-alpine AS dependencies
WORKDIR /usr/src/backend/app

# Kopiramo package.json i package-lock.json u radni direktorij
COPY package*.json ./

# Instaliramo ovisnosti
RUN npm install --force --verbose

###########################
# Stage 2: build
############################
FROM dependencies AS build
COPY . .
RUN npm run build --verbose

COPY --from=dependencies /usr/src/backend/app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY src ./src

# Prisma generate
RUN npx prisma generate

# Build NestJS
RUN npm run build

############################
# Stage 3: production
############################
FROM node:20-slim AS production
WORKDIR /usr/src/backend/app

ENV NODE_ENV=production
ENV PORT=3020

COPY --from=build /usr/src/backend/app/dist ./dist
COPY --from=build /usr/src/backend/app/node_modules ./node_modules

# Entrypoint
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh

EXPOSE 3020
ENTRYPOINT ["./docker-entrypoint.sh"]
