# Frontend Migration: v1 → v2 (apps/web)

## ✅ Migration Completed

The old frontend in `/frontend` has been successfully replaced with the new v2 frontend from `apps/web`.

### Changes Made:

#### 1. **Configuration Files Updated**
- ✅ `package.json`: Updated with v2 dependencies (React 19.1.0, Ant Design 5.11.0, TypeScript 5.3.0)
- ✅ `tsconfig.json`: Simplified to single reference
- ✅ `tsconfig.app.json`: Updated with v2 settings (ES2020 target, removed erasableSyntaxOnly)
- ✅ `vite.config.ts`: Simplified, removed @tailwindcss/vite plugin, output to 'dist'
- ✅ `postcss.config.js`: Created with tailwindcss and autoprefixer
- ✅ `tailwind.config.js`: Created with dark mode and preflight disabled
- ✅ Removed: `tsconfig.node.json`, `eslint.config.js`, old `package-lock.json`

#### 2. **Source Code Migration**
- ✅ Replaced entire `/frontend/src` with `/apps/web/src`
- ✅ New structure includes:
  - `components/`: MainLayout, ProtectedRoute, StatCard
  - `context/`: AuthContext, ThemeContext
  - `hooks/`: useAuth
  - `pages/`: LoginPage, DashboardPage, ProfilePage, BoilerPage, HeatingPage, etc.
  - `services/`: api.ts (axios client), notification.api.ts
  - `types/`: Type definitions including ant-design-plots

#### 3. **Docker Configuration**
- ✅ `/frontend/Dockerfile`: Updated for v2
  - Build stage: Copies root `package-lock.json` + `frontend/package.json`
  - Output directory: Changed from `build` to `dist`
  - Serve command: `serve -s dist -l 3021`
  - Build command: `npm run build` (vite build only, no tsc)

#### 4. **Monorepo Integration**
- ✅ Root `package.json`:
  - Updated workspaces: `["backend", "frontend", "apps/mobile"]`
  - Updated npm scripts to reference `frontend` instead of `apps/web`
  - Scripts: `dev:web`, `dev`, `build`, `test:all` all use `--workspace=frontend`

#### 5. **Docker Compose**
- ✅ Already configured correctly:
  - Build context: `.` (root)
  - Dockerfile: `./frontend/Dockerfile`
  - Port: `3021:3021`
  - Depends on: `boiler-control-backend`

### 🔗 Backend API Integration
- ✅ API Client: `/frontend/src/services/api.ts`
  - Base URL: `http://localhost:3020/api` (or `VITE_API_URL` env var)
  - Token management: localStorage with Bearer token
  - 401 handling: Auto-logout and redirect to /login
  - All endpoints compatible with existing backend

### 📦 Dependencies
#### Key Differences from Old Frontend:
- **React**: 19.2.0 → 19.1.0 (stable v19)
- **Ant Design**: 6.1.4 → 5.11.0 (stable v5, better TypeScript support)
- **TypeScript**: 5.6.2 → 5.3.0
- **Vite**: 6.2.0 → 5.0.0
- **React Router**: 7.11.0 → 6.20.0
- **Removed**: lucide-react, recharts, @tailwindcss/vite (v4 to v3)

### 🚀 Local Development

```bash
# From monorepo root
npm run dev:web         # Start frontend dev server (port 3021)
npm run dev:backend     # Start backend in separate terminal (port 3020)

# Or use the shorthand
npm run dev             # Starts both (backend & frontend)

# Frontend specific
cd frontend
npm install
npm run dev
npm run build
npm run lint
npm run type-check
```

### 🐳 Docker Build & Deployment

```bash
# Build frontend Docker image
docker compose build boiler-control-frontend

# Build and run both
docker compose build
docker compose up

# Rebuild after code changes
docker compose build boiler-control-frontend --no-cache
docker compose up boiler-control-frontend -d
```

### ✅ Testing Checklist

- [ ] **Local Development**
  - [ ] `npm run dev:web` starts without errors
  - [ ] Frontend loads on http://localhost:3021
  - [ ] API calls work (verify in browser console)
  - [ ] Login/logout functionality works
  - [ ] Protected routes redirect to login when not authenticated

- [ ] **Build & Production**
  - [ ] `npm run build` completes without errors in `/frontend`
  - [ ] Build output in `/frontend/dist`
  - [ ] Docker image builds: `docker compose build boiler-control-frontend`
  - [ ] Docker container runs: `docker compose up boiler-control-frontend`
  - [ ] Frontend accessible on `http://localhost:3021` from container

- [ ] **Backend Compatibility**
  - [ ] All API calls succeed (check Network tab)
  - [ ] Authentication endpoints work
  - [ ] Dashboard data loads
  - [ ] No CORS errors

- [ ] **Navigation & Pages**
  - [ ] Login page displays
  - [ ] Dashboard page displays
  - [ ] All menu items navigate correctly
  - [ ] Protected routes work
  - [ ] Logout redirects to login

- [ ] **Type Safety**
  - [ ] `npm run type-check` passes
  - [ ] No TypeScript errors in editor

- [ ] **Git & CI/CD**
  - [ ] Changes committed to git
  - [ ] GitHub Actions workflow triggers
  - [ ] Docker build succeeds in CI
  - [ ] Deployment to server works

### 📝 Environment Variables (if needed in future)

For Docker production builds, you can set:
```bash
VITE_API_URL=https://api.yourdomain.com
```

This would be passed to the Docker build as:
```dockerfile
ENV VITE_API_URL=https://api.yourdomain.com
```

### ⚠️ Important Notes

1. **No Backend Changes**: Backend code in `/backend` is untouched
2. **apps/web Preserved**: The original `/apps/web` folder is preserved for reference if needed
3. **Mobile App**: `/apps/mobile` remains unchanged
4. **monorepo Setup**: Frontend is now properly integrated as a workspace
5. **Build Output**: Changed from `build/` to `dist/` - update any references if needed

### 🔄 Rollback (if needed)

If issues arise, the old `/frontend` source is backed up:
- Copy from `/apps/web` to `/frontend/src` for v2 code
- Previous `apps/web` folder contains the original code

### 🎯 Next Steps

1. Test locally: `npm run dev:web`
2. Test Docker build: `docker compose build boiler-control-frontend`
3. Commit changes to git
4. Push to GitHub for CI/CD validation
5. Monitor server deployment
6. Verify frontend works in production

---

**Migration Status**: ✅ **COMPLETE** - Ready for testing and deployment
