# Stage 1: Build the apps
FROM node:20-slim AS build-stage

# Postavljanje radnog direktorija
WORKDIR /app

# Kopiraj package.json i package-lock.json
COPY frontend/package*.json frontend/package-lock.json ./

# Instalacija dependencies
RUN npm install --force --silent

# Kopiraj cijelu aplikaciju
COPY frontend/ .

# Build aplikacije
RUN npm run build

# Stage 2: Production image
FROM node:20-slim

# Postavljanje radnog direktorija za aplikaciju unutar image-a
WORKDIR /app

# Kopiramo izgrađene datoteke iz build-stage
COPY --from=build-stage /app/build /app/build

# Instaliraj serve globalno
RUN npm install -g serve --silent

# Otvori port za aplikaciju
EXPOSE 3021

# Pokreni aplikaciju
CMD ["serve", "-s", "build", "-l", "3021"]
