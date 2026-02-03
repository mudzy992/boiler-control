# Stage 1: Build the frontend
FROM node:20-slim AS build-stage

WORKDIR /app

# Copy frontend package files
COPY frontend/package*.json ./

# Copy frontend source
COPY frontend/ .

# Install dependencies with retry logic for optional dependencies
# npm install with --no-audit and --no-fund to speed up installation
RUN npm install --force --legacy-peer-deps --no-audit --no-fund || npm install --force --legacy-peer-deps

# Rebuild native modules for Linux platform
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
