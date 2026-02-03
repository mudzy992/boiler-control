# Quick Reference - Boiler Control Monorepo

## 🚀 Start Everything (5 minutes)

```bash
# Terminal 1: Setup & Backend
cd backend
npm install
npm run db:reset:seed
npm run start:dev

# Terminal 2: Web App
cd apps/web
npm install
npm run dev

# Terminal 3: Mobile App
cd apps/mobile
npm install
npm run start
```

## 🔐 Test Login Credentials

```
Email: test@example.com
Password: password123
```

Or admin:
```
Email: admin@example.com
Password: password123
```

## 📍 Service URLs

| Service | URL | Purpose |
|---------|-----|---------|
| **Backend API** | http://localhost:3020 | REST API |
| **API Docs** | http://localhost:3020/api | Swagger |
| **Health Check** | http://localhost:3020/health | Status |
| **Web App** | http://localhost:5173 | React app |
| **Database Studio** | http://localhost:5555 | Prisma Studio |
| **Prometheus** | http://localhost:9090 | Metrics |
| **Grafana** | http://localhost:3000 | Dashboards |

## 📦 Key npm Commands

### From Root
```bash
npm run install:all          # Install all dependencies
npm run dev                  # Run backend + web
npm run dev:backend          # Backend only
npm run dev:web              # Web app only
npm run dev:mobile           # Mobile app only
npm run test:all             # Run all tests
```

### From Backend
```bash
npm run db:reset:seed        # Reset DB and seed (RECOMMENDED)
npm run db:seed              # Seed only (if DB exists)
npm run db:reset             # Reset only
npm run start:dev            # Development mode
npm run test                 # Unit tests
npm run test:integration     # Integration tests
npm run build                # Production build
npx prisma studio           # Database browser
```

### From Apps/Web
```bash
npm run dev                  # Development
npm run build                # Production build
npm run lint                 # ESLint check
npm run type-check           # TypeScript check
```

### From Apps/Mobile
```bash
npm run start                # Expo dev server
npm run build                # Production build
npm run lint                 # ESLint check
```

## 🗄️ Database

**Quick Commands:**
```bash
cd backend

# Full setup (recommended first time)
npm run db:reset:seed

# Just seed existing DB
npm run db:seed

# Visual database browser
npx prisma studio
```

**Test Users Created:**
- test@example.com (PRO) ← Try this one
- admin@example.com (ADMIN)
- demo@example.com (FREE)

**All passwords**: password123

**Records Created:**
- 3 users
- 3 home profiles
- 3 thermostats with 6+ programs each
- 112+ heating events (7 days, 2 anomalies)
- 8 daily recommendations
- 112+ boiler records (hourly)
- 12 monthly gas readings
- Weather data
- 18 notification preferences
- 3 mobile devices

## 📋 File Locations

**Important Documentation:**
- `PROJECT_SUMMARY.md` - Overview (this session)
- `SETUP_CHECKLIST.md` - 8-phase checklist
- `ENVIRONMENT_SETUP.md` - Configuration guide
- `backend/DATABASE_SETUP.md` - Database guide

**Key Application Files:**

Web App:
- `apps/web/src/services/api.ts` - API client
- `apps/web/src/context/AuthContext.tsx` - Auth state
- `apps/web/src/pages/LoginPage.tsx` - Login form
- `apps/web/src/pages/DashboardPage.tsx` - Dashboard

Mobile App:
- `apps/mobile/src/services/api.ts` - Mobile API client
- `apps/mobile/src/context/AuthContext.tsx` - Mobile auth
- `apps/mobile/src/screens/LoginScreen.tsx` - Mobile login
- `apps/mobile/src/screens/DashboardScreen.tsx` - Mobile dashboard

Backend:
- `backend/src/main.ts` - Entry point
- `backend/prisma/schema.prisma` - Database schema
- `backend/prisma/seed.ts` - Seed script
- `backend/src/modules/` - Feature modules

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| **"Cannot find module"** | Run `npm install` in that directory |
| **"Port 3020 in use"** | `lsof -ti:3020 \| xargs kill -9` |
| **"Database connection error"** | Check `.env` file in backend directory |
| **"npm ERR! 404 Not Found"** | Delete `node_modules`, run `npm install` again |
| **"TypeScript errors"** | Run `npm run build` to check |
| **"API not responding"** | Make sure backend is running: `npm run start:dev` |
| **"Web app can't fetch"** | Check VITE_API_BASE_URL in `.env.local` |
| **"Mobile won't load"** | Backend must be on localhost:3020 |

## 🔄 Development Workflow

### Adding Features

1. **Update Backend**
   - Modify schema.prisma if needed
   - Create migration: `npx prisma migrate dev --name feature_name`
   - Add resolver/service in src/modules
   - Test: `npm run test:integration`

2. **Update Web App**
   - Add page in apps/web/src/pages
   - Update api.ts with new endpoint
   - Import in App.tsx router
   - Test locally

3. **Update Mobile App**
   - Add screen in apps/mobile/src/screens
   - Update api.ts with new endpoint
   - Add to RootNavigator.tsx
   - Test with Expo

### Testing

```bash
# Backend (from backend dir)
npm run test                    # Unit tests
npm run test:integration        # Integration tests
npm run test:cov                # Coverage report

# Web App (from apps/web)
npm run test                    # Jest tests
npm run test:watch              # Watch mode

# Mobile App (from apps/mobile)
npm run test                    # React Native tests
```

## 📊 Monitoring

**View Metrics:**
```bash
# In new terminal
# Prometheus: http://localhost:9090
# Grafana: http://localhost:3000 (admin/admin)
```

**Custom Metrics Available:**
- Request count/duration
- Error rates
- Database performance
- Heating events/day
- Anomalies detected
- System health

## 🔐 Security Notes

⚠️ **Keep in Mind:**
- `.env` files NOT in git (use .env.example)
- Never commit test credentials
- JWT tokens expire (check logs)
- Change JWT_SECRET in production
- Use HTTPS in production
- Enable rate limiting in production

## 📚 Documentation Quick Links

- **Project Overview**: `PROJECT_SUMMARY.md`
- **Setup Steps**: `SETUP_CHECKLIST.md` (8 phases)
- **Environment Variables**: `ENVIRONMENT_SETUP.md`
- **Database Guide**: `backend/DATABASE_SETUP.md`
- **Backend**: `backend/README.md`
- **Web App**: `apps/web/README.md`
- **Mobile App**: `apps/mobile/README.md`

## 🎯 Today's Checklist

- [ ] Run `npm run install:all` from root
- [ ] Run `npm run db:reset:seed` in backend
- [ ] Start backend with `npm run start:dev`
- [ ] Test login at http://localhost:3020/api (Swagger)
- [ ] Start web app with `npm run dev`
- [ ] Login at http://localhost:5173
- [ ] Start mobile app with `npm run start`
- [ ] Scan QR code in Expo Go
- [ ] Verify all three show same dashboard data

**Estimated Time**: 15-20 minutes

## 🆘 Need Help?

1. Check `SETUP_CHECKLIST.md` Phase section
2. Review `ENVIRONMENT_SETUP.md` for config
3. See `backend/DATABASE_SETUP.md` for DB issues
4. Check console output for error details
5. Verify service URLs above are accessible

## 📞 Key Contacts

- **Backend Issues**: Check test results
- **Web App Issues**: Check browser console
- **Mobile Issues**: Check Expo terminal output
- **Database Issues**: Check .env file configuration

---

**Last Updated**: 2026-02-02
**Status**: Ready for Phase 2 (Database Setup)
**All Systems**: ✅ Scaffolded and Ready
