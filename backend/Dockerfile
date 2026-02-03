# ============================================================================
# Multi-stage Dockerfile for NestJS Backend (Boiler Control System)
# ============================================================================
# This Dockerfile builds a production-ready NestJS application with Prisma ORM
# using multi-stage builds to minimize final image size and improve security.
# ============================================================================

# ----------------------------------------------------------------------------
# Stage 1: Base Dependencies Layer
# ----------------------------------------------------------------------------
# Installs system dependencies and Node.js packages required for building
# the application. This stage is cached and reused across builds when
# package.json hasn't changed.
# ----------------------------------------------------------------------------
FROM node:20-slim AS deps

WORKDIR /usr/src/app

# Install system dependencies required for native npm modules and Prisma
# - ca-certificates: SSL/TLS certificate verification
# - build-essential: C++ compiler for native addons
# - git: Required for some npm packages
# - curl: Useful for health checks
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    ca-certificates \
    build-essential \
    git \
    curl \
    openssl \
    && rm -rf /var/lib/apt/lists/*

# Copy package manifests first for better layer caching
# If package.json/package-lock.json don't change, this layer is reused
COPY package*.json ./

# Install all dependencies (including devDependencies needed for build)
# npm ci provides faster, more reliable, repeatable builds for CI/CD
RUN npm ci --prefer-offline --no-audit

# ----------------------------------------------------------------------------
# Stage 2: Build Layer
# ----------------------------------------------------------------------------
# Compiles TypeScript to JavaScript, generates Prisma Client, and prepares
# the application for production deployment.
# ----------------------------------------------------------------------------
FROM deps AS build

WORKDIR /usr/src/app

# Set Node.js DNS resolution order (fixes some Docker networking issues)
ENV NODE_OPTIONS="--dns-result-order=ipv4first"

# Copy Prisma schema first for Prisma Client generation
COPY prisma ./prisma

# Generate Prisma Client based on schema.prisma
# This creates type-safe database client in node_modules/@prisma/client
RUN npx prisma generate

# Copy application source code
COPY src ./src
COPY tsconfig.json ./
COPY tsconfig.build.json ./
COPY nest-cli.json ./

# Build NestJS application (compiles TypeScript to JavaScript in ./dist)
RUN npm run build

# Copy generated Prisma types to dist for runtime access
# Prisma generates code in src/generated that needs to be available at runtime
RUN cp -r src/generated dist/generated 2>/dev/null || true

# ----------------------------------------------------------------------------
# Stage 3: Production Runtime Layer
# ----------------------------------------------------------------------------
# Creates a minimal production image with only runtime dependencies and
# compiled application code. This significantly reduces image size and
# attack surface.
# ----------------------------------------------------------------------------
FROM node:20-slim AS production

WORKDIR /usr/src/app

# Install only runtime system dependencies (no build tools)
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    ca-certificates \
    openssl \
    && rm -rf /var/lib/apt/lists/*

# Copy package manifests for production dependency installation
COPY package*.json ./

# Install only production dependencies (excludes devDependencies)
# This keeps the final image lean by excluding build-time packages
RUN npm ci --only=production --prefer-offline --no-audit \
    && npm cache clean --force

# Copy Prisma schema and generate client in production environment
COPY prisma ./prisma
RUN npx prisma generate

# Copy compiled application from build stage
COPY --from=build /usr/src/app/dist ./dist

# Copy and configure entrypoint script
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x /usr/src/app/docker-entrypoint.sh

# Set production environment variables
# These can be overridden by docker-compose.yml or runtime environment
ENV NODE_ENV=production
ENV PORT=3020
ENV NODE_OPTIONS="--dns-result-order=ipv4first"

# Expose application port
EXPOSE 3020

# Use custom entrypoint for database readiness checks and graceful startup
ENTRYPOINT ["./docker-entrypoint.sh"]
