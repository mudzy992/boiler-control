# Stage 1: Build the frontend
FROM node:20-slim AS build-stage

WORKDIR /app

# Copy package files from monorepo root
COPY package-lock.json ./
COPY frontend/package*.json ./

# Install dependencies with legacy peer deps to handle optional dependencies
RUN npm install --legacy-peer-deps && npm rebuild

# Copy frontend source
COPY frontend/ .

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
