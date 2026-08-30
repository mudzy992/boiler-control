# ============================================================
# Stage 1: Build
# ============================================================
FROM node:20-slim AS build

WORKDIR /app

# Vite environment variable - available during build only
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

# Build tools are devDependencies
ENV NODE_ENV=development

# Install dependencies
COPY package*.json ./
RUN npm ci --legacy-peer-deps --no-audit --no-fund

# Copy source
COPY . .

# Build production assets
RUN npm run build


# ============================================================
# Stage 2: Production
# ============================================================
FROM nginx:1.27-alpine AS production

# Remove default Nginx configuration
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy production build
COPY --from=build /app/dist /usr/share/nginx/html

# Nginx
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]