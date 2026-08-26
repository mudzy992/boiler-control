# Boiler Control System - AI Agent Instructions

## Project Overview
Monorepo for heating system management with NestJS backend, React production frontend (/frontend), and React Native mobile app (Expo + NativeBase). Database: PostgreSQL with Prisma ORM (migrated from MySQL — see docs/MYSQL_TO_POSTGRES_MIGRATION.md).

## Architecture & Structure

### Monorepo Layout
```
backend/           # NestJS API (port 3020)
frontend/          # React production frontend (Vite, port 5173) ⭐ PRIMARY
mobile/            # React Native Expo app
```

### Frontend Architecture (Production - /frontend)
**NOTE**: `/frontend` is the active production frontend. The old `apps/web` duplicate was removed (2026-08-26) — it was an unused, deprecated copy that was never wired into any deploy path.

- **Framework**: React 19 + TypeScript + Vite
- **UI Components**: Ant Design 5.x
- **Styling**: Tailwind CSS 3
- **Routing**: React Router v6
- **Data Fetching**: React Query (TanStack Query)
- **Authentication**: JWT tokens via localStorage
- **Context API**: AuthContext (login/logout), ThemeContext (dark mode)

### Backend Architecture (NestJS)
- **Module Pattern**: Each feature is a NestJS module in `backend/src/modules/` (Auth, Boiler, Dashboard, Heating, Weather, Gas, etc.)
- **AsyncLocalStorage for Context**: Uses native Node.js `AsyncLocalStorage` for correlation ID tracking across async flows. See `backend/src/common/correlation-id.service.ts` - do NOT use Map-based approaches, they cause race conditions
- **Prisma ORM**: Schema in `backend/prisma/schema.prisma`, generated client in `backend/src/generated/prisma/`
- **Auth**: JWT tokens via `@nestjs/jwt`, guards in `backend/src/modules/Auth/`

### Gas Features (Production Frontend)

**Frontend Components** (`/frontend/src`):
- **Pages**:
  - `pages/GasReadingsPage.tsx` - List view with add/delete/export
  - `pages/GasAnalyticsPage.tsx` - Analytics dashboard with statistics and trends
- **Components**:
  - `components/GasReadingCard.tsx` - Card displaying single reading with consumption
  - `components/GasForm.tsx` - Modal form for adding readings
- **API**: `services/api.ts` - Extended with:
  - `getGasReadings()` - Fetch all readings
  - `addGasReadingPayload(data)` - Add new reading
  - `deleteGasReading(id)` - Delete reading
- **Routes**:
  - `/gas/readings` - Readings list
  - `/gas/analytics` - Analytics dashboard
- **Menu Items**: Gas Readings, Gas Analytics (in MainLayout)

**Backend API** (`backend/src/modules/Gas`):
- GET `/gas/readings` - List all readings
- POST `/gas/readings` - Add reading
- DELETE `/gas/readings/:id` - Delete reading

**Features**:
- ✅ View all readings (sorted newest first)
- ✅ Add reading with date/time picker
- ✅ Delete readings with confirmation
- ✅ Automatic consumption calculation (counter diff / days)
- ✅ Daily average calculation
- ✅ CSV export
- ✅ Analytics: total, avg, min/max, median, std dev, trend
- ✅ Dark mode support
- ✅ Fully responsive design

## Development Workflow

### Quick Start Commands
```bash
# From root - install all workspaces
npm run install:all

# Backend (separate terminal)
cd backend
npm run db:reset:seed    # Reset database + seed test data
npm run start:dev        # Dev server with hot reload

# Production Frontend (separate terminal) ⭐ USE THIS
cd frontend
npm run dev             # Vite dev server (port 5173)

# Mobile app (separate terminal)
cd mobile
npm run start           # Expo dev server
npx expo start -c       # Clear cache if needed
```

### Test Credentials
```
User: test@example.com / password123
Admin: admin@example.com / password123
```

### Testing
```bash
cd backend
npm test                    # Unit tests (25 tests)
npm run test:integration    # Integration tests (46 tests)
npm run db:reset:seed       # Always re-seed before integration tests
```

## Key Patterns & Conventions

### Backend Code Patterns
- **Controllers**: Use decorators `@Get()`, `@Post()`, `@UseGuards(JwtAuthGuard)` for protected routes
- **Services**: Business logic lives in `*.service.ts` files, injected via constructor
- **Correlation IDs**: Import `CorrelationIdService` and call `createRunContext()` for async operations requiring tracing
- **Database**: Use Prisma client via `PrismaService`. Always use transactions for multi-step operations
- **Error Handling**: Throw NestJS exceptions (`BadRequestException`, `NotFoundException`) - they're auto-serialized

### Frontend Code Patterns (/frontend)
- **API Calls**: Import singleton `apiClient` from `services/api.ts`. Methods are async/await, no manual token handling needed
  - Example: `const readings = await apiClient.getGasReadings();`
  - Token auto-injected via axios interceptor
  - 401 → auto logout + redirect to /login
- **Data Fetching**: Use React Query for all data
  - Example: `useQuery({ queryKey: ['gas-readings'], queryFn: () => apiClient.getGasReadings() })`
- **Mutations**: Use `useMutation` with `queryClient.invalidateQueries()` for add/delete
  - Always invalidate affected query keys after mutation
- **Auth Flow**: Use `useAuth()` hook to access `login()`, `logout()`, `user`, `isAuthenticated`
- **Styling**: Ant Design components + Tailwind utilities. Never mix inline styles
  - Dark mode classes: `dark:bg-slate-800`, `dark:text-white`
- **Navigation**: React Router v6 (useNavigate hook)
- **Forms**: HTML form elements + validation, no external form libraries
- **Components**: Functional components with TypeScript props interfaces
- **Cross-platform parity**: Any business logic or feature changes implemented in `/frontend` must be mirrored in `/mobile` (and vice versa) unless explicitly documented as platform-specific.

### Design System & Responsiveness (Frontend)
- **Source of truth**: `/frontend` is the only production UI source. (`apps/web` was removed 2026-08-26.)
- **Color tokens**: Use consistent light/dark tokens across pages (backgrounds, surfaces, borders, text). Prefer Tailwind palette + existing global CSS variables.
- **Spacing**: Use consistent spacing scale (4/8/12/16/24/32). Avoid ad-hoc padding.
- **Shadows & Radius**: Use subtle shadows (`shadow-sm`) and consistent radius (`rounded-lg`, `rounded-xl`).
- **Layout**: Page structure: header → toolbar → content grid/list. Keep max width and responsive padding.
- **Responsiveness**:
  - Mobile: 1-column, stacked buttons, no horizontal scroll.
  - Tablet: 2-column grids where applicable.
  - Desktop: 3–4 column grids for metrics.
  - Navigation must be mobile-friendly (collapsible sidebar or equivalent).
- **Dark Mode**: All UI elements must include `dark:` variants for background, text, border, and hover.

### Mobile Styling
- **UI**: NativeBase components + NativeWind (Tailwind for React Native)
- **Navigation**: `@react-navigation/bottom-tabs` + React Navigation
- **Localization**: i18next with en-US (default) and bs-BS locales
- **Error Handling**: Centralized error handler in `services/api/error.handler.ts` with user-friendly toast messages

### Environment Variables
- **Backend**: `backend/.env` - `DATABASE_URL`, `JWT_SECRET`
- **Frontend**: `frontend/.env` - `VITE_API_URL` (defaults to `http://localhost:3020/api`)
- **Mobile**: `mobile/.env` - `EXPO_PUBLIC_API_URL`

## Common Gotchas

### Backend
- **Database changes**: Always run `npx prisma migrate dev` after schema changes, then `npm run db:seed`
- **AsyncLocalStorage**: Do not create new instances in services - use injected `CorrelationIdService`
- **Test isolation**: Integration tests share database - use unique identifiers or reset DB between test suites

### Frontend (/frontend)
- **API URL**: Check `VITE_API_URL` environment variable (defaults to http://localhost:3020/api)
- **Token persistence**: Web clears on 401, requires re-login
- **Dark mode**: Update both Ant Design theme and Tailwind classes (dark: prefix)
- **Hot reload**: Sometimes requires page refresh

### Mobile
- **Mobile API URL**: Android emulator requires `10.0.2.2` instead of `localhost`
- **Token persistence**: Mobile must handle `AsyncStorage.removeItem('token')`
- **Hot reload**: Expo sometimes requires cache clear (`npx expo start -c`)
- **i18n Language**: Auto-detects device language; can be overridden in settings
- **Error Toasts**: All API errors show user-friendly messages via toast notifications
- **Gas Daily Limit**: Backend enforces one reading per day; mobile UI checks before submit

## Monitoring & Observability
- **Prometheus**: Metrics on port 9090 (start via `docker-compose -f docker-compose.monitoring.yml up`)
- **Grafana**: Dashboards on port 3000 (admin/admin)
- **Swagger Docs**: `http://localhost:3020/api` when backend is running
- **Prisma Studio**: `npx prisma studio` from `backend/` to browse database visually

## Documentation References (Single Source of Truth)
- **Production Frontend**: `/frontend` (active development)
- **AI Agent Instructions**: `docs/copilot-instructions.md` (this file - always keep updated)
- **Feature Inventory & Status**: `docs/features.md` (all features with status, endpoints, dependencies)
- **API Reference**: `docs/api-reference.md` (all REST endpoints with examples)
- **Quick Reference**: `docs/QUICK_REFERENCE.md` (commands, URLs, troubleshooting)
- **Architecture Details**: `docs/V2_ARCHITECTURE.md` (system design & patterns)
- **Deployment Guides**: `docs/internal/pipeline/`
- **Docker Setup**: `README.md` and `docker-compose.yml`

## Production Deployment

### Frontend (/frontend)
```bash
cd frontend
npm run build      # Creates /dist folder
npm run preview    # Test production build locally
```

Deploy `/dist` to web server with environment variable:
```
VITE_API_URL=https://api.yourdomain.com/api
```

### Backend
See `docs/internal/pipeline/` for deployment procedures

### Mobile
Use Expo Build service or development builds for production distribution

## Phase 5 Additions (February 2026)

### Localization
- **Framework**: i18next with react-i18next
- **Locales**: en-US (default), bs-BS (Bosnian)
- **Language Selector**: Available in Settings screen
- **Scope**: All user-facing screens (Dashboard, Heating, Gas, Notifications, Settings, Login)
- **Key Pattern**: All strings use `t('section.key')` pattern for consistency

### Mobile Error Handling
- **Centralized**: `mobile/src/services/api/error.handler.ts`
- **User Messages**: Friendly, localized error messages for all HTTP status codes
- **Network Detection**: Distinguishes between network errors and server errors
- **Toast UI**: Error toast appears at top, auto-dismisses after 4 seconds
- **Logging**: All errors logged to console for debugging

### Gas Daily Limit
- **Backend**: Validates one reading per calendar day (00:00-23:59)
- **Mobile**: Checks before submission; shows duplicate warning if today's entry exists
- **HTTP Status**: Returns 409 Conflict if duplicate detected
- **User Message**: "An entry for today already exists. Please edit the existing entry."

### Gas Reminder Channel
- **Channel ID**: 'gas_reminder' (Android)
- **Scheduling**: 7:00 PM daily (adjustable in settings)
- **Deep Link**: Opens GasReadingsScreen with add modal ready
- **Fallback**: Works on iOS with default notification handler
