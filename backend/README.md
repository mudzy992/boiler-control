# Boiler Control Backend - NestJS API

NestJS-based REST API for the Boiler Control System, providing heating system management, monitoring, and control capabilities.

## 🚀 Quick Start

### Installation

```bash
npm install
```

### Database Setup

```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Seed test data
npm run db:seed

# Or do all at once
npm run db:reset:seed
```

### Development

```bash
# Start dev server with hot reload
npm run start:dev

# API available at http://localhost:3020
# Swagger docs at http://localhost:3020/api
```

### Testing

```bash
# Unit tests (25 tests)
npm test

# Integration tests (46 tests)
npm run test:integration

# Test coverage
npm run test:cov

# Smoke tests
npm run test:smoke
```

## 🏗 Architecture

### Technology Stack

- **Framework**: NestJS 11 with TypeScript
- **Database**: MySQL 8.0 with Prisma ORM
- **Authentication**: JWT with Passport
- **Validation**: class-validator + class-transformer
- **Monitoring**: Prometheus metrics
- **API Docs**: Swagger/OpenAPI

### Key Features

- **AsyncLocalStorage**: Correlation ID tracking across async operations (see [../docs/P2E_README.md](../docs/P2E_README.md))
- **Module Pattern**: Feature-based modules in `src/modules/`
- **Guards**: JWT authentication, role-based access control
- **Scheduling**: Cron jobs for periodic tasks
- **Rate Limiting**: Throttling with @nestjs/throttler
- **Health Checks**: Custom health check endpoint

### Module Structure

```
src/
├── modules/
│   ├── Auth/           # JWT authentication
│   ├── Boiler/         # Boiler management & events
│   ├── Dashboard/      # Dashboard aggregations
│   ├── Heating/        # Heating control & anomalies
│   ├── User/           # User management
│   ├── Weather/        # Weather API integration
│   ├── Reports/        # Report generation
│   └── Thermostat/     # Thermostat programs
├── common/             # Shared utilities
│   ├── correlation-id.service.ts  # AsyncLocalStorage
│   └── guards/         # Auth guards
├── prisma/             # Prisma service
└── generated/          # Prisma generated types
```

## 🔧 Configuration

### Environment Variables

Create `backend/.env`:

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
UPLOAD_ROOT_PATH="/usr/src/app/uploads"
```

## 📊 Database

### Prisma Commands

```bash
# Generate Prisma client
npx prisma generate

# Create a migration
npx prisma migrate dev --name your-migration-name

# Apply migrations
npx prisma migrate deploy

# Reset database (dev only)
npx prisma migrate reset

# Open Prisma Studio
npx prisma studio
```

### Schema

- Located in `prisma/schema.prisma`
- Generated types in `src/generated/prisma/`
- Seed file: `prisma/seed.ts`

### Test Data

```bash
# Reset and seed database
npm run db:reset:seed
```

Test credentials:

- **User**: test@example.com / password123
- **Admin**: admin@example.com / password123

## 🐳 Docker

### Build Image

```bash
docker build -t boiler-control-backend:latest .
```

### Run with Docker Compose

```bash
# From project root
docker-compose up -d

# View logs
docker-compose logs -f backend

# Run migrations
docker-compose exec backend npx prisma migrate deploy

# Seed database
docker-compose exec backend npm run db:seed
```

See [../docker-compose.yml](../docker-compose.yml) for configuration details.

## 🔌 API Endpoints

### Authentication

- `POST /auth/login` - User login
- `POST /auth/register` - User registration
- `POST /auth/refresh` - Refresh token

### Dashboard

- `GET /dashboard` - Dashboard summary

### Boiler

- `GET /boiler/events` - Boiler event history
- `GET /boiler/status` - Current boiler status
- `POST /boiler/control` - Control boiler

### Heating

- `GET /heating/events` - Heating events
- `GET /heating/anomalies` - Detected anomalies
- `POST /heating/schedule` - Set heating schedule

### Weather

- `GET /weather` - Current weather data
- `GET /weather/forecast` - Weather forecast

### User

- `GET /user/profile` - Get user profile
- `PUT /user/profile` - Update user profile

### Reports

- `GET /reports` - List reports
- `POST /reports/generate` - Generate new report
- `GET /reports/:id` - Get specific report

Full API documentation available at http://localhost:3020/api (Swagger).

## 🧪 Testing

### Test Structure

```
test/
├── unit/               # Unit tests
├── integration/        # Integration tests
└── smoke-tests.ts      # Smoke tests
```

### Running Tests

```bash
# Unit tests
npm test

# Integration tests (requires test database)
npm run test:integration

# Watch mode
npm run test:watch

# Coverage report
npm run test:cov

# Debug tests
npm run test:debug
```

### Test Database

Integration tests use a separate test database configured via environment variables.
Always re-seed before running integration tests:

```bash
npm run db:reset:seed
```

## 📈 Monitoring

### Prometheus Metrics

Metrics exposed on `/metrics` endpoint.

Start monitoring stack:

```bash
docker-compose -f docker-compose.monitoring.yml up -d
```

- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3000 (admin/admin)

## 🛠 Development

### Code Style

```bash
# Lint
npm run lint

# Format
npm run format
```

### Building

```bash
# Build for production
npm run build

# Run production build
npm run start:prod
```

### Hot Reload

The dev server (`npm run start:dev`) automatically reloads on file changes.

## 📚 Additional Documentation

- **AsyncLocalStorage Implementation**: [../docs/P2E_README.md](../docs/P2E_README.md)
- **Architecture Overview**: [../docs/V2_ARCHITECTURE.md](../docs/V2_ARCHITECTURE.md)
- **Database Setup**: [DATABASE_SETUP.md](./DATABASE_SETUP.md)
- **P2B Implementation**: [P2B_IMPLEMENTATION.md](./P2B_IMPLEMENTATION.md)
- **Deployment Guides**: [../docs/internal/pipeline/](../docs/internal/pipeline/)

## 🐛 Troubleshooting

### Common Issues

**Database connection fails:**

- Check DATABASE_URL in `.env`
- Ensure MySQL is running
- Verify database credentials

**Prisma client not found:**

```bash
npx prisma generate
```

**Test failures:**

```bash
# Reset test database
npm run db:reset:seed
```

**Port already in use:**

```bash
# Change APP_PORT in .env or kill existing process
lsof -ti:3020 | xargs kill -9
```

## 📝 License

UNLICENSED - Private project
