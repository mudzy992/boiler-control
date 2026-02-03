# Frontend V2 Migration - Deployment Checklist

## Pre-Deployment Testing

### ✅ Local Development Testing
```bash
# 1. Install monorepo dependencies
npm run install:all

# 2. Start frontend dev server
npm run dev:web
# Expected: Vite server on http://localhost:3021

# 3. Test in new terminal
npm run dev:backend
# Expected: NestJS on http://localhost:3020
```

### ✅ Verify Frontend Works Locally
- [ ] Navigate to http://localhost:3021
- [ ] Login page loads without errors
- [ ] Can enter credentials
- [ ] API calls work (check Network tab in DevTools)
- [ ] Can navigate to dashboard (if authenticated)
- [ ] Styling/Tailwind CSS applied correctly
- [ ] No console errors

### ✅ Build Testing
```bash
# From root or /frontend
npm run build --workspace=frontend

# Check output
ls -la frontend/dist/
# Should contain: index.html, assets folder with JS/CSS chunks
```

### ✅ Docker Build Testing
```bash
# Build frontend image
docker compose build boiler-control-frontend --no-cache

# Expected: Build succeeds, no errors about missing files or failed npm install
# Check for these success messages:
# - "npm install"
# - "npm run build"
# - "Copy built assets from build stage"
```

### ✅ Docker Run Testing
```bash
# Start containers
docker compose up -d

# Verify container is running
docker ps | grep boiler-control-frontend

# Check logs for errors
docker logs boiler-control-frontend

# Test from host
curl http://localhost:3021

# Expected: HTML response (not error)
```

## Git & CI/CD

### ✅ Git Commit
```bash
git add -A
git commit -m "feat: migrate frontend to v2 (apps/web) with monorepo integration"
git push origin main
```

### ✅ GitHub Actions Verification
1. Push to main triggers deploy workflow
2. Check Actions tab for build status
3. Verify no errors in Docker build step
4. Confirm deployment succeeds

### ✅ Production Deployment
1. SSH to server and check latest deployment
2. Verify frontend container is running: `docker ps`
3. Test frontend URL in browser
4. Check server logs: `docker logs boiler-control-frontend`
5. Verify API calls work (network tab in DevTools)

## Troubleshooting

### Issue: Docker build fails with "module not found"
**Solution**: Clean build and remove lockfile
```bash
cd frontend
npm install
npm run build
```

### Issue: "EUSAGE: npm ci" error in Docker
**Solution**: Already fixed - Dockerfile uses `npm install` instead of `npm ci`

### Issue: Frontend shows blank page or 404
**Solution**: Check if build output is in `/dist` (not `/build`)
```bash
ls -la frontend/dist/
```

### Issue: Cannot connect to backend API
**Solution**: Verify VITE_API_URL or check if backend is running on port 3020

### Issue: TypeScript errors during build
**Solution**: Run type check locally
```bash
npm run type-check --workspace=frontend
```

## Rollback Plan

If critical issues occur:

1. **Local Development Rollback**:
   ```bash
   # Revert to apps/web from git
   git revert <commit-hash>
   git push origin main
   ```

2. **Docker Rollback**:
   ```bash
   # Stop and remove new frontend
   docker compose stop boiler-control-frontend
   docker compose rm -f boiler-control-frontend

   # Rebuild from previous commit
   git checkout <previous-commit>
   docker compose build boiler-control-frontend
   docker compose up -d boiler-control-frontend
   ```

## Success Criteria

✅ All the following must pass:
- [ ] Local dev server starts without errors
- [ ] Frontend loads on port 3021
- [ ] Login page displays correctly
- [ ] Can authenticate with backend
- [ ] All pages load without 404s
- [ ] No console errors
- [ ] Docker image builds successfully
- [ ] Docker container runs on port 3021
- [ ] Frontend works from deployed URL
- [ ] GitHub Actions workflow passes
- [ ] No backend functionality broken

---

**Migration Status**: Ready for deployment ✅

**Key Files Changed**:
- `/frontend/package.json` - Updated dependencies
- `/frontend/vite.config.ts` - Removed tailwindcss plugin, output to dist
- `/frontend/tsconfig.app.json` - Updated TypeScript config
- `/frontend/src/` - Complete replacement with v2 code
- `/frontend/Dockerfile` - Updated build process
- `/package.json` - Updated workspaces and scripts
- **NEW**: `/FRONTEND_MIGRATION_GUIDE.md` - Detailed migration documentation

**Backend**: No changes required ✅

**Mobile**: No changes required ✅
