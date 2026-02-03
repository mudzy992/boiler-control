# Boiler Control - Full-Stack Application

Complete heating system management application with backend, web, and mobile clients.

## Project Structure

```
boiler-control/
├── backend/              # NestJS API backend
├── apps/
│   ├── web/             # React + Ant Design + Tailwind web app
│   └── mobile/          # React Native + Expo mobile app
└── docs/                # Documentation
```

## Getting Started

### Install All Dependencies

```bash
npm install
npm run install:all
```

### Run Development Servers

**All services** (backend + web):
```bash
npm run dev
```

**Backend only** (NestJS):
```bash
npm run dev:backend
```

**Web app only** (React):
```bash
npm run dev:web
```

**Mobile app** (React Native):
```bash
npm run dev:mobile
```

## Architecture

### Backend
- NestJS with AsyncLocalStorage migration (P2e)
- Prometheus monitoring
- Complete API for frontend/mobile integration
- Database: PostgreSQL with Prisma ORM

### Web App
- React 18 with TypeScript
- Ant Design for UI components
- Tailwind CSS for styling
- Context API for state management
- Responsive design

### Mobile App
- React Native with Expo
- NativeBase for UI components
- NativeWind for Tailwind styling
- Bottom tab navigation
- Async storage for local data

## Documentation

- **Backend**: See [backend/README.md](backend/README.md)
- **Web App**: See [apps/web/README.md](apps/web/README.md)
- **Mobile App**: See [apps/mobile/README.md](apps/mobile/README.md)
- **P2e Implementation**: See [docs/P2E_README.md](docs/P2E_README.md)

## API Integration

Both web and mobile apps connect to the backend API at `http://localhost:3020`:

- **Authentication**: POST `/auth/login`
- **Dashboard**: GET `/dashboard`
- **Boiler**: GET `/boiler/events`, GET `/boiler/status`
- **Heating**: GET `/heating/events`, GET `/heating/anomalies`
- **Weather**: GET `/weather`
- **User**: GET `/user/profile`, PUT `/user/profile`
- **Reports**: GET `/reports`, POST `/reports/generate`

## Database

Test database with seeded data is automatically created and populated when backend starts.

### Seed Data Includes
- Test users with different roles
- Boiler configurations
- Heating event history
- Weather data
- Anomaly detection history
- System reports

## Development Workflow

1. **Backend Development**: Start with `npm run dev:backend`
2. **Database Setup**: Runs automatic migrations and seeding
3. **Web Development**: Start with `npm run dev:web`
4. **Mobile Development**: Start with `npm run dev:mobile`

## Monitoring

Backend includes complete monitoring setup:
- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3000
- **Health Check**: http://localhost:3020/health

See [docs/internal/monitoring/](docs/internal/monitoring/) for monitoring setup.

## Testing

```bash
npm run test           # Backend unit tests
npm run test:all      # All tests and linting
```

## Deployment

See [docs/internal/pipeline/](docs/internal/pipeline/) for complete deployment guide.

---

**Status**: ✅ All three apps configured and ready for development
**Backend**: P2e complete and production-ready
**Frontend**: Web and mobile apps ready for feature development
