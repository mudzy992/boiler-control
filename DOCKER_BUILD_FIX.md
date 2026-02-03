# Docker Build Fix - Rollup Optional Dependencies Issue

## Problem
When pushing to GitHub, the Docker build was failing with:
```
Error: Cannot find module @rollup/rollup-linux-x64-gnu
```

This is a known npm issue with optional dependencies not being properly installed in Docker on Linux.

## Solution
Updated both Dockerfiles to use `npm rebuild` after installation to properly rebuild native modules.

### Changes Made

#### Frontend Dockerfile
```dockerfile
# Before
RUN npm install

# After
RUN npm install --legacy-peer-deps && npm rebuild
```

#### Backend Dockerfile
```dockerfile
# Before
RUN npm install --legacy-peer-deps

# After
RUN npm install --legacy-peer-deps && npm rebuild
```

## Why This Works

1. **`npm install --legacy-peer-deps`** - Installs packages with peer dependency resolution
2. **`npm rebuild`** - Rebuilds all native modules for the current platform (Linux x64 in Docker)

This ensures that:
- Optional dependencies are properly resolved
- Native modules like @rollup/rollup-linux-x64-gnu are compiled for Linux
- No MODULE_NOT_FOUND errors occur during build

## Testing

The next push to GitHub will use the updated Dockerfiles and should build successfully.

### To Test Locally
```bash
# If you have Docker installed
docker compose build --no-cache

# Should now complete without rollup errors
```

## Files Updated
- ✅ `/frontend/Dockerfile` - Added `npm rebuild`
- ✅ `/backend/Dockerfile` - Added `npm rebuild`

---

**Status**: ✅ Fixed - Ready for next deployment
