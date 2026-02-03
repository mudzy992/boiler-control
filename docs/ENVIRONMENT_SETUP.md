# Environment Setup Guide

Complete environment configuration for Boiler Control monorepo.

## Quick Setup

### 1. Backend Environment

Create `.env` file in `backend/`:

```bash
# Database Configuration
DATABASE_HOST=inventory.hopto.org
DATABASE_PORT=3306
DATABASE_USER=mudzy
DATABASE_PASSWORD=nije,kikiriki
DATABASE_NAME=boiler_assistant

# JWT Configuration
JWT_SECRET=tvoj_tajni_jwt_kljuc
JWT_EXPIRES_IN=3600s

# External APIs
WEATHER_API_KEY=8e968a22bfca43d18a6152747260301
TUYA_CLIENT_ID=y3kg9wjqwghsj8ak5swj
TUYA_CLIENT_SECRET=7d2164fd310f4edcb590ecbdaf373cca
TUYA_REGION=EU
TUYA_BASE_URL=https://openapi.tuyaeu.com

# Application Settings
NODE_ENV=development
PORT=3020

# Monitoring
PROMETHEUS_ENABLED=true
GRAFANA_URL=http://localhost:3000

# Notifications
EXPO_ACCESS_TOKEN=your_expo_token_here
```

### 2. Frontend (Web App) Environment

Create `.env.local` file in `apps/web/`:

```bash
# API Configuration
VITE_API_BASE_URL=http://localhost:3020
VITE_API_TIMEOUT=10000

# Application Settings
VITE_APP_NAME=Boiler Control
VITE_APP_VERSION=1.0.0

# Feature Flags
VITE_ENABLE_ANALYTICS=false
VITE_ENABLE_BETA_FEATURES=true
```

### 3. Mobile App (React Native/Expo) Environment

Create `.env` file in `apps/mobile/`:

```bash
# API Configuration
EXPO_API_BASE_URL=http://localhost:3020
EXPO_API_TIMEOUT=10000

# Expo Configuration
EXPO_SLUG=boiler-control
EXPO_NAME=Boiler Control

# Application Settings
ENABLE_DEV_MENU=true

# Feature Flags
ENABLE_ANALYTICS=false
ENABLE_BETA_FEATURES=true
```

## Detailed Configuration

### Backend Environment Variables

#### Database

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_HOST` | localhost | MariaDB/MySQL host |
| `DATABASE_PORT` | 3306 | Database port |
| `DATABASE_USER` | root | Database username |
| `DATABASE_PASSWORD` | - | Database password |
| `DATABASE_NAME` | boiler_control | Database name |

#### Authentication

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET` | - | Secret key for JWT signing |
| `JWT_EXPIRES_IN` | 3600s | Token expiration time |
| `JWT_REFRESH_EXPIRES_IN` | 7d | Refresh token expiration |

#### External Services

| Variable | Default | Description |
|----------|---------|-------------|
| `WEATHER_API_KEY` | - | Open Meteo API key |
| `TUYA_CLIENT_ID` | - | Tuya Cloud client ID |
| `TUYA_CLIENT_SECRET` | - | Tuya Cloud client secret |
| `TUYA_REGION` | EU | Tuya region (EU, US, CN) |
| `TUYA_BASE_URL` | https://openapi.tuyaeu.com | Tuya API base URL |

#### Application

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | development | Environment (development, test, production) |
| `PORT` | 3020 | API server port |
| `CORS_ORIGIN` | http://localhost:5173,http://localhost:19006 | Allowed origins |

#### Monitoring

| Variable | Default | Description |
|----------|---------|-------------|
| `PROMETHEUS_ENABLED` | true | Enable Prometheus metrics |
| `PROMETHEUS_PORT` | 9090 | Prometheus port |
| `GRAFANA_URL` | http://localhost:3000 | Grafana dashboard URL |

#### Notifications

| Variable | Default | Description |
|----------|---------|-------------|
| `EXPO_ACCESS_TOKEN` | - | Expo notification service token |
| `NOTIFICATION_SERVICE` | expo | Notification service (expo, fcm) |

### Frontend Environment Variables

#### API Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_BASE_URL` | http://localhost:3020 | Backend API URL |
| `VITE_API_TIMEOUT` | 10000 | Request timeout (ms) |

#### Application

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_APP_NAME` | Boiler Control | Application name |
| `VITE_APP_VERSION` | 1.0.0 | Application version |

#### Feature Flags

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_ENABLE_ANALYTICS` | false | Enable analytics tracking |
| `VITE_ENABLE_BETA_FEATURES` | true | Enable beta features |
| `VITE_DEBUG_MODE` | false | Enable debug logging |

### Mobile App Environment Variables

Same as Frontend, prefixed with `EXPO_` instead of `VITE_`

## Setup Scripts

### Complete Setup

```bash
# From monorepo root
npm install
npm run install:all

# Backend setup
cd backend
npm run db:reset:seed
npm run start:dev

# Web app setup (new terminal)
cd apps/web
npm install
npm run dev

# Mobile app setup (new terminal)
cd apps/mobile
npm install
npm run start
```

### Individual Component Setup

**Backend**
```bash
cd backend
npm install
npm run db:reset:seed
npm run start:dev
```

**Web App**
```bash
cd apps/web
npm install
npm run dev
# Access at http://localhost:5173
```

**Mobile App**
```bash
cd apps/mobile
npm install
npm run start
# Scan QR code with Expo Go app
```

## Development Tools

### Database Studio (Prisma)

```bash
cd backend
npx prisma studio
# Opens http://localhost:5555
```

### Database Monitoring (MySQL)

```bash
# Connect to database
mysql -h $DATABASE_HOST -u $DATABASE_USER -p $DATABASE_NAME

# Useful queries
SHOW DATABASES;
DESCRIBE User;
SELECT COUNT(*) FROM User;
```

### API Documentation (Swagger)

```bash
# Available at http://localhost:3020/api
# Interactive API testing
```

### Monitoring Dashboards

- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3000 (admin/admin)
- **Health Check**: http://localhost:3020/health

## Testing Configuration

### Backend Tests

```bash
# Unit tests
npm run test

# Integration tests
npm run test:integration

# Coverage report
npm run test:cov

# Watch mode
npm run test:watch
```

### Frontend Tests

```bash
cd apps/web
npm run test          # Run tests
npm run test:watch    # Watch mode
npm run test:cov      # Coverage
```

### Mobile Tests

```bash
cd apps/mobile
npm run test          # Run tests
npm run test:watch    # Watch mode
```

## Docker Configuration

### Using Docker Compose

```bash
# From monorepo root
docker-compose up -d

# Services
# - Backend: http://localhost:3020
# - PostgreSQL: localhost:5432
# - Redis: localhost:6379
# - Prometheus: http://localhost:9090
# - Grafana: http://localhost:3000
```

### Manual Docker Setup

```bash
# Build backend image
cd backend
docker build -t boiler-control-backend .

# Run container
docker run -p 3020:3020 --env-file .env boiler-control-backend
```

## Production Configuration

### Backend Production

```bash
# .env
NODE_ENV=production
DATABASE_HOST=prod-db.example.com
DATABASE_NAME=boiler_control_prod
JWT_SECRET=<strong-secret-key>
# ... other production values
```

### Frontend Production Build

```bash
cd apps/web
VITE_API_BASE_URL=https://api.example.com npm run build
# Output in dist/
```

### Mobile Production Build

```bash
cd apps/mobile
eas build --platform all
```

## Troubleshooting

### "Can't connect to database"
1. Check DATABASE_HOST is reachable
2. Verify DATABASE_USER/PASSWORD
3. Ensure DATABASE_NAME exists
4. Test with `mysql` command

### "API not responding"
1. Backend running on PORT (default 3020)
2. Check VITE_API_BASE_URL points to backend
3. CORS configured correctly
4. Check firewall rules

### "Push notifications not working"
1. EXPO_ACCESS_TOKEN set
2. User devices have valid expoPushToken
3. Platform-specific credentials (iOS/Android) configured
4. Check Expo dashboard

### "TypeScript errors"
1. Run `npm run build` in backend
2. Run `npm run type-check` in frontend/mobile
3. Ensure TypeScript version consistent

## Environment File Templates

### .env.example (Backend)
Located in `backend/.env.example`

### .env.local.example (Frontend)
Located in `apps/web/.env.local.example`

### .env.example (Mobile)
Located in `apps/mobile/.env.example`

## Security Best Practices

⚠️ **Important**

1. **Never commit .env files** - Use .env.example instead
2. **Rotate secrets regularly** - Especially JWT_SECRET
3. **Use strong passwords** - Minimum 16 characters
4. **Enable HTTPS in production** - Use certificates
5. **Keep API keys private** - Don't expose in frontend
6. **Use environment-specific values** - Dev ≠ Prod

## Verification Checklist

Before running applications:

- [ ] Backend `.env` configured
- [ ] Frontend `.env.local` configured
- [ ] Mobile `.env` configured
- [ ] Database connection verified
- [ ] API endpoints accessible
- [ ] Ports 3020, 5173, 19006 available
- [ ] Node.js version >= 18
- [ ] npm version >= 8

---

**Last Updated**: 2026-02-02
**Environment Type**: All (dev, test, staging, production)
