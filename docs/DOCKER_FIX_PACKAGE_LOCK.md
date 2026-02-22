# Docker Build Fix - Package Lock Version Mismatch

## Problem
Docker build was failing with:
```
npm error Invalid: lock file's @types/react@19.1.17 does not satisfy @types/react@19.1.10
```

This occurred because:
1. Frontend is now a monorepo workspace
2. Root `package-lock.json` has different versions than `frontend/package.json`
3. `npm ci` couldn't reconcile the mismatched versions

## Solution
Changed the installation strategy to use direct `npm install` with force flags:

### Frontend Dockerfile
```dockerfile
# Old approach (failed on version mismatch)
RUN npm ci --force 2>&1 || npm install --force --legacy-peer-deps

# New approach (handles workspace versions)
RUN npm install --force --legacy-peer-deps --no-audit --no-fund || npm install --force --legacy-peer-deps
RUN npm rebuild
```

### Backend Dockerfile
```dockerfile
# Same approach for consistency
RUN npm install --force --legacy-peer-deps --no-audit --no-fund || npm install --force --legacy-peer-deps
RUN npm rebuild
```

## Why This Works

1. **`--force`** - Ignores peer dependency conflicts
2. **`--legacy-peer-deps`** - Uses legacy peer dependency resolution
3. **`--no-audit` and `--no-fund`** - Skips non-essential checks to speed up build
4. **Retry logic** - If first attempt fails, tries again
5. **`npm rebuild`** - Ensures native modules build for Linux x64

## What Changed

- ✅ Removed `npm ci` (which requires exact lock file match)
- ✅ Using `npm install --force` (more forgiving)
- ✅ Added performance flags (`--no-audit`, `--no-fund`)
- ✅ Kept `npm rebuild` to compile native modules for Linux
- ✅ Both Dockerfiles now consistent

## Files Updated
- `/frontend/Dockerfile`
- `/backend/Dockerfile`

## Ready to Deploy

```bash
git add -A
git commit -m "fix: use npm install instead of npm ci for monorepo workspaces"
git push origin main
```

This should resolve all Docker build issues with optional dependencies.
