# Stage 1: Build the frontend
FROM node:20-slim AS build-stage

WORKDIR /app

# Build argument for API URL (defaults to backend service)
ARG VITE_API_URL=https://api.boiler-contro.ba101.top/api
ENV VITE_API_URL=${VITE_API_URL}

# FORSIRANO: bez obzira šta Coolify pošalje kao --build-arg NODE_ENV,
# build stage MORA imati development da bi npm install povukao devDependencies (vite i sl.)
ENV NODE_ENV=development

# Copy frontend package files
COPY package*.json ./

# Copy frontend source
COPY . .

RUN npm install --force --legacy-peer-deps --no-audit --no-fund || npm install --force --legacy-peer-deps

RUN npm rebuild

RUN npm run build

# Stage 2: Production image
FROM node:20-slim

WORKDIR /app

# ovdje je NODE_ENV=production sasvim OK, jer se ovo tiče runtime-a servera koji servira static fajlove, ne buildovanja
ENV NODE_ENV=production

RUN npm install -g serve

COPY --from=build-stage /app/dist ./dist

EXPOSE 3021

CMD ["serve", "-s", "dist", "-l", "3021"]