# Complete Monorepo Setup Checklist

## Phase 1: Initial Setup ✅ COMPLETE

### Repository Structure
- [x] Monorepo directory structure created (`apps/web`, `apps/mobile`, `backend`)
- [x] Root package.json with workspace configuration
- [x] Root README with project overview

### Backend Setup
- [x] NestJS application configured
- [x] Prisma ORM with database schema (25+ models)
- [x] 16 database migrations applied
- [x] AsyncLocalStorage correlation ID implementation
- [x] 71 tests passing (25 unit + 46 integration)
- [x] Prometheus monitoring integrated
- [x] GitHub Actions CI/CD pipeline
- [x] API documentation (Swagger)

### Web App (React)
- [x] React 18 + Vite + TypeScript
- [x] Ant Design component library
- [x] Tailwind CSS utility styling
- [x] React Router DOM client-side routing
- [x] Axios HTTP client with interceptors
- [x] React Context API authentication
- [x] Protected route component
- [x] Main layout with sidebar navigation
- [x] Login page with form validation
- [x] Dashboard page with metrics cards
- [x] 11+ core files created

### Mobile App (React Native)
- [x] React Native 0.73 + Expo 50
- [x] NativeBase UI components
- [x] NativeWind Tailwind-style utilities
- [x] React Navigation (Stack + Bottom Tabs)
- [x] Axios HTTP client with AsyncStorage
- [x] AsyncStorage token persistence
- [x] Bottom tab navigation
- [x] Login screen
- [x] Dashboard screen with pull-to-refresh
- [x] Placeholder screens (Boiler, Heating, Profile)
- [x] 14+ core files created

---

## Phase 2: Database Setup ⏳ PENDING

### Database Initialization
- [ ] Verify `.env` file with correct DATABASE_* variables
- [ ] Test database connection: `npx prisma studio`
- [ ] Run initial migrations: `npm run build && npm run start`
- [ ] Verify all 16 migrations applied

### Database Seeding
- [ ] Run: `npm run db:seed` from backend directory
- [ ] Verify 3 test users created
- [ ] Verify 3 home profiles created
- [ ] Verify 3 thermostat devices created
- [ ] Verify heating events (16+ per day for 7 days)
- [ ] Verify gas readings (12 monthly records)
- [ ] Verify boiler history (hourly records)
- [ ] Verify weather cache populated
- [ ] Verify notifications and preferences

### Data Verification
```bash
# After seeding, verify with queries:
SELECT 'Users' as entity, COUNT(*) FROM User
UNION ALL
SELECT 'HeatingEvents', COUNT(*) FROM HeatingEvent
UNION ALL
SELECT 'GasReadings', COUNT(*) FROM GasReading;
```

**Test Users Created**:
- Email: `test@example.com` (PRO plan)
- Email: `admin@example.com` (ADMIN role)
- Email: `demo@example.com` (FREE plan)
- Password: `password123` (all users)

---

## Phase 3: Backend Verification ⏳ PENDING

### Installation
- [ ] From `backend` directory: `npm install`
- [ ] Verify: `npm run build` succeeds
- [ ] Check: 0 TypeScript errors

### Development Server
- [ ] Run: `npm run start:dev`
- [ ] Check output: "Listening on port 3020"
- [ ] Verify API: `curl http://localhost:3020/health`
- [ ] Check Swagger docs: `http://localhost:3020/api`

### API Endpoints Verification
- [ ] POST `/auth/login` - Test with test@example.com/password123
- [ ] GET `/dashboard` - Should return metrics data
- [ ] GET `/boiler/events` - Should return boiler history
- [ ] GET `/heating/events` - Should return heating events
- [ ] GET `/weather` - Should return weather data
- [ ] GET `/user/profile` - Should return user info
- [ ] GET `/reports` - Should return available reports

### Monitoring Services
- [ ] Prometheus: `http://localhost:9090`
  - [ ] Check metrics: `/metrics` endpoint active
  - [ ] Verify graphs load
  - [ ] Check alert rules
- [ ] Grafana: `http://localhost:3000`
  - [ ] Login: admin/admin
  - [ ] Verify 8 dashboard panels
  - [ ] Check alert triggers

### Tests
- [ ] Run: `npm run test`
- [ ] Result: All 25 unit tests passing
- [ ] Run: `npm run test:integration`
- [ ] Result: All 46 integration tests passing
- [ ] Coverage: > 80%

---

## Phase 4: Web App Verification ⏳ PENDING

### Installation
- [ ] From `apps/web` directory: `npm install`
- [ ] Verify: No errors during installation
- [ ] Check: `npm run build` succeeds

### Development Environment
- [ ] Backend running on localhost:3020
- [ ] Run: `npm run dev`
- [ ] Check output: "Local: http://localhost:5173"

### Features Testing
- [ ] Navigate to login page
- [ ] Login with test@example.com / password123
- [ ] Redirected to dashboard
- [ ] Dashboard loads with metrics:
  - [ ] Health Score card
  - [ ] Anomaly Rate card
  - [ ] Active Alerts card
  - [ ] Last Update card
- [ ] Recent events table displays
- [ ] Logout button works
- [ ] Redirected back to login
- [ ] Network tab shows API calls to localhost:3020

### Build Verification
- [ ] Run: `npm run build`
- [ ] Output directory: `dist/`
- [ ] All assets compiled
- [ ] No TypeScript errors
- [ ] Source maps generated

---

## Phase 5: Mobile App Verification ⏳ PENDING

### Installation
- [ ] From `apps/mobile` directory: `npm install`
- [ ] Verify: No errors during installation

### Development Environment
- [ ] Backend running on localhost:3020
- [ ] Run: `npm run start`
- [ ] Check output: "Local: exp://..."
- [ ] Expo Go app on phone/emulator ready

### Features Testing
- [ ] Scan QR code with Expo Go
- [ ] App loads on device/emulator
- [ ] Presented with login screen
- [ ] Login with test@example.com / password123
- [ ] Redirected to dashboard
- [ ] Dashboard displays metrics:
  - [ ] Health Score card
  - [ ] Anomaly Rate card
  - [ ] Active Alerts card
  - [ ] Last Update value
- [ ] Pull-to-refresh works
- [ ] Tab navigation works (4 tabs visible)
- [ ] Switch between tabs (Home, Boiler, Heating, Profile)
- [ ] Logout works
- [ ] Token persists in AsyncStorage
- [ ] Close app and reopen - still logged in

### Build Verification
- [ ] Generates valid EAS build config
- [ ] No TypeScript errors
- [ ] Expo doctor passes

---

## Phase 6: Integration Testing ⏳ PENDING

### Cross-App API Integration
- [ ] Web app can login and fetch data
- [ ] Mobile app can login and fetch data
- [ ] Both apps show same data
- [ ] Token refresh works in both apps
- [ ] Error handling consistent

### Data Synchronization
- [ ] Changes on backend reflected in both apps
- [ ] Real-time data updates functional
- [ ] Pull-to-refresh fetches fresh data

### Authentication Flow
- [ ] Token stored securely (localStorage web, AsyncStorage mobile)
- [ ] Token expires after time limit
- [ ] Logout clears token in both apps
- [ ] Unauthorized requests redirected to login

---

## Phase 7: Performance & Optimization ⏳ PENDING

### Backend Performance
- [ ] Response time < 500ms for dashboard
- [ ] Database queries optimized
- [ ] No N+1 queries
- [ ] Metrics collection minimal overhead

### Web App Performance
- [ ] Initial load < 3 seconds
- [ ] Lighthouse score > 80
- [ ] Code splitting working
- [ ] Lazy loading for routes

### Mobile App Performance
- [ ] Initial load < 2 seconds
- [ ] Smooth tab navigation
- [ ] No memory leaks
- [ ] Bundle size < 50MB

---

## Phase 8: Deployment Readiness ⏳ PENDING

### Documentation
- [ ] Deployment guide created
- [ ] Troubleshooting guide created
- [ ] API documentation complete
- [ ] Architecture diagrams included

### Environment Configuration
- [ ] Production .env variables documented
- [ ] Secrets management strategy defined
- [ ] Backup/recovery procedures documented

### CI/CD Pipeline
- [ ] GitHub Actions workflows created
- [ ] Automated tests run on push
- [ ] Build artifacts generated
- [ ] Staging deployment automated

### Security
- [ ] JWT validation enabled
- [ ] CORS properly configured
- [ ] Rate limiting active
- [ ] Input validation complete
- [ ] SQL injection prevention verified

---

## Quick Reference Commands

### Full Monorepo Setup (from root)
```bash
npm install
npm run install:all
```

### Backend Complete Setup
```bash
cd backend
npm install
npm run db:reset:seed
npm run start:dev
```

### Web App Setup
```bash
cd apps/web
npm install
npm run dev          # http://localhost:5173
```

### Mobile App Setup
```bash
cd apps/mobile
npm install
npm run start        # Scan QR code
```

### Run All Services (from root, separate terminals)
```bash
# Terminal 1: Backend
npm run dev:backend

# Terminal 2: Web App
npm run dev:web

# Terminal 3: Mobile App
npm run dev:mobile
```

### Database Management
```bash
cd backend

# Full reset and seed
npm run db:reset:seed

# Seed only (if DB exists)
npm run db:seed

# Interactive database browser
npx prisma studio
```

### Testing
```bash
cd backend

# All tests
npm run test

# Integration tests
npm run test:integration

# Coverage report
npm run test:cov
```

---

## Troubleshooting Quick Links

| Issue | Solution |
|-------|----------|
| Database connection error | Check `.env` variables, ensure database is running |
| Port 3020 already in use | Kill process: `lsof -ti:3020 \| xargs kill -9` |
| Token expired during testing | Login again or check JWT_EXPIRES_IN value |
| Expo app not loading | Ensure backend on localhost:3020, check firewall |
| Web app can't fetch API | Check VITE_API_BASE_URL, backend running, CORS enabled |
| Mobile token not persisting | Check AsyncStorage package installed, check permissions |

---

## Success Criteria

### All Systems Go ✅
- [ ] Backend: Running, all tests pass, API responsive
- [ ] Web App: Running, features work, API integrated
- [ ] Mobile App: Running on device/emulator, features work
- [ ] Database: Seeded with realistic test data
- [ ] Monitoring: Prometheus and Grafana operational
- [ ] Documentation: Complete and up-to-date
- [ ] No console errors or warnings

---

## Sign Off

**Project Status**: 🟡 Phase 2 In Progress

**Completed Phases**:
1. ✅ Initial Setup & Architecture
2. 🟡 Database Setup (In Progress)

**Next Phase**:
3. ⏳ Backend Verification

**Estimated Completion**: 1-2 hours (all phases)

**Owner**: Development Team
**Last Updated**: 2026-02-02
**Next Review**: After Phase 2 completion
