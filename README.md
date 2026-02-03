# Boiler Control System - Monorepo

Complete heating system management application with NestJS backend, React web app, and React Native mobile app.

## 🚀 Quick Start

### Install Dependencies
```bash
npm install
npm run install:all
```

### Development Servers

**Backend** (NestJS API):
```bash
npm run dev:backend
# Runs on http://localhost:3020
```

**Web App** (React + Vite):
```bash
npm run dev:web
# Runs on http://localhost:3021
```
> **Note**: Frontend has been migrated to v2 from `apps/web`. See [FRONTEND_QUICKSTART.md](./FRONTEND_QUICKSTART.md) for details.

**Mobile App** (React Native + Expo):
```bash
npm run dev:mobile
# Opens Expo DevTools
```

### Docker Deployment

**Backend with MySQL**:
```bash
docker-compose up -d
```

This starts:
- Backend API on port 3020
- MySQL database on port 3306

## 📁 Project Structure

```
boiler-control/
├── backend/              # NestJS API (port 3020)
│   ├── src/             # Application source
│   ├── prisma/          # Database schema & migrations
│   └── Dockerfile       # Multi-stage production build
├── apps/
│   ├── web/             # React + Ant Design + Tailwind
│   └── mobile/          # React Native + Expo + NativeBase
├── docs/                # 📚 All project documentation
└── docker-compose.yml   # Backend orchestration
```

## 🔧 Technology Stack

### Backend
- **Framework**: NestJS with TypeScript
- **Database**: MySQL 8.0 with Prisma ORM
- **Auth**: JWT with passport-jwt
- **Monitoring**: Prometheus + Grafana
- **API Docs**: Swagger/OpenAPI

### Web App
- **Framework**: React 18 + TypeScript + Vite
- **UI**: Ant Design + Tailwind CSS
- **State**: Context API
- **HTTP**: Axios with interceptors

### Mobile App
- **Framework**: React Native + Expo
- **UI**: NativeBase + NativeWind (Tailwind)
- **Navigation**: React Navigation (bottom tabs)
- **Storage**: AsyncStorage

## 📚 Documentation

All documentation has been reorganized into the [docs](./docs) directory:

### Getting Started
- [README_MONOREPO.md](./docs/README_MONOREPO.md) - Detailed monorepo guide
- [QUICK_REFERENCE.md](./docs/QUICK_REFERENCE.md) - Command reference
- [ENVIRONMENT_SETUP.md](./docs/ENVIRONMENT_SETUP.md) - Environment configuration
- [SETUP_CHECKLIST.md](./docs/SETUP_CHECKLIST.md) - Setup verification

### Architecture & Design
- [V2_ARCHITECTURE.md](./docs/V2_ARCHITECTURE.md) - System architecture
- [V2_FRONTEND_GUIDE.md](./docs/V2_FRONTEND_GUIDE.md) - Frontend patterns
- [P2E_README.md](./docs/P2E_README.md) - AsyncLocalStorage implementation

### Project Status
- [PROJECT_SUMMARY.md](./docs/PROJECT_SUMMARY.md) - Project overview
- [V2_IMPLEMENTATION_COMPLETE.md](./docs/V2_IMPLEMENTATION_COMPLETE.md) - V2 completion
- [PROJECT_STATUS.md](./docs/PROJECT_STATUS.md) - Current status

### Component Guides
- [Backend README](./backend/README.md) - Backend documentation
- [Web App README](./apps/web/README.md) - Web app guide
- [Mobile App README](./apps/mobile/README.md) - Mobile app guide

### Internal Documentation
- [docs/internal/](./docs/internal/) - Architecture, pipelines, runbooks, logs

## 🐳 Docker & Deployment

### Multi-Stage Dockerfile
The [backend/Dockerfile](./backend/Dockerfile) uses three stages:
1. **deps**: Installs dependencies with npm ci
2. **build**: Generates Prisma client and builds NestJS
3. **production**: Lean runtime image with only production dependencies

### Docker Compose
The [docker-compose.yml](./docker-compose.yml) orchestrates:
- **MySQL 8.0**: Database with persistent volume
- **Backend API**: NestJS application with health checks
- **Networking**: Isolated bridge network
- **Environment**: Loads from `backend/.env`

### Running with Docker

```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f backend

# Run database migrations
docker-compose exec backend npx prisma migrate deploy

# Seed database
docker-compose exec backend npm run db:seed

# Stop services
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

## 🧪 Testing

### Backend Tests
```bash
cd backend

# Unit tests (25 tests)
npm test

# Integration tests (46 tests)
npm run test:integration

# Reset & seed test database
npm run db:reset:seed
```

### Test Credentials
```
User:  test@example.com / password123
Admin: admin@example.com / password123
```

## 🔒 Environment Variables

Create `backend/.env` based on the following template:

```env
# Database
DATABASE_URL="mysql://user:password@host:3306/boiler_assistant"
DATABASE_HOST="localhost"
DATABASE_PORT=3306
DATABASE_USER="boileruser"
DATABASE_PASSWORD="yourpassword"
DATABASE_NAME="boiler_assistant"

# Authentication
JWT_SECRET="your-secret-key-here"
JWT_EXPIRES_IN="3600s"

# External APIs
WEATHER_API_KEY="your-weather-api-key"
TUYA_CLIENT_ID="your-tuya-client-id"
TUYA_CLIENT_SECRET="your-tuya-secret"
TUYA_REGION="EU"
TUYA_BASE_URL="https://openapi.tuyaeu.com"

# Application
APP_PORT=3020
NODE_ENV=development
TZ=Europe/Sarajevo
```

## 📊 Monitoring

### Prometheus + Grafana

```bash
docker-compose -f docker-compose.monitoring.yml up -d
```

- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3000 (admin/admin)

### API Documentation

When backend is running:
- **Swagger UI**: http://localhost:3020/api

## 🛠 Common Commands

### Database Management
```bash
cd backend

# Generate Prisma client
npx prisma generate

# Create migration
npx prisma migrate dev --name your-migration-name

# Apply migrations
npx prisma migrate deploy

# Reset database (dev only)
npm run db:reset:seed

# Open Prisma Studio
npx prisma studio
```

### Building for Production
```bash
# Build backend
cd backend
npm run build

# Build web app
cd apps/web
npm run build

# Build Docker image
docker build -t boiler-control-backend:latest ./backend
```

## 🤝 Contributing

1. Create a feature branch from `main`
2. Make your changes
3. Ensure tests pass: `npm test`
4. Ensure linting passes: `npm run lint`
5. Submit a pull request

## 📝 License

UNLICENSED - Private project

## 📞 Support

For issues and questions, refer to:
- [QUICK_REFERENCE.md](./docs/QUICK_REFERENCE.md) for common commands
- [docs/internal/runbooks/](./docs/internal/runbooks/) for troubleshooting
- [V2_DOCUMENTATION_INDEX.md](./docs/V2_DOCUMENTATION_INDEX.md) for complete doc index
