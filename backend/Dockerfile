# Stage 1: dependencies
FROM node:20-slim AS dependencies
WORKDIR /usr/src/backend/app

COPY package*.json ./
RUN npm install --force --verbose

# Stage 2: build
FROM node:20-slim AS build
WORKDIR /usr/src/backend/app

COPY --from=dependencies /usr/src/backend/app/node_modules ./node_modules
COPY . .

RUN npx prisma generate
RUN npm run build --verbose

# Stage 3: production
FROM node:20-slim AS production
WORKDIR /usr/src/backend/app

ENV NODE_ENV=production
ENV PORT=3020

COPY --from=build /usr/src/backend/app/dist ./dist
COPY --from=build /usr/src/backend/app/node_modules ./node_modules
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh

EXPOSE 3020
ENTRYPOINT ["./docker-entrypoint.sh"]
