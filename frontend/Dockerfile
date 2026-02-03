# Stage 1: Build the frontend
FROM node:20-slim AS build-stage

WORKDIR /app

# Copy package files from monorepo root
COPY package-lock.json ./
COPY frontend/package*.json ./

# Copy frontend source early to ensure package.json context
COPY frontend/ .

# Install dependencies and rebuild for Linux platform
# Use npm ci for reproducible builds, --force to handle optional deps
RUN npm ci --force 2>&1 || npm install --force --legacy-peer-deps
RUN npm rebuild

# Build the application
RUN npm run build

# Stage 2: Production image
FROM node:20-slim

WORKDIR /app

# Install serve to run the application
RUN npm install -g serve

# Copy built assets from build stage (output to dist directory)
COPY --from=build-stage /app/dist ./dist

# Expose port
EXPOSE 3021

# Run the application
CMD ["serve", "-s", "dist", "-l", "3021"]
