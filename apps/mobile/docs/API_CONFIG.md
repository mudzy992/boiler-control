# API Configuration Guide

## Overview

The backend API URL is centralized in a single location to ensure consistency across the application and prevent configuration drift.

## Architecture

### Single Source of Truth: `src/config/api.config.ts`

- **Primary Config**: All API configuration is defined here
- **Platform Handling**: Automatic detection of Android emulator vs iOS simulator
- **Environment Variables**: Reads from `EXPO_PUBLIC_API_URL` set by EAS builds or local .env

### Configuration Priority

1. **EAS Build Environment** (Production/Preview/Development)
   - Defined in `eas.json` per build profile
   - Injected during build time
2. **Local .env file** (Development only)
   - For local development
   - Not committed to repository
3. **app.config.js default** (Fallback)
   - Default development URL
4. **Platform-specific defaults** (Last resort)
   - Android: `http://10.0.2.2:3020/api` (emulator loopback)
   - iOS: `http://localhost:3020/api`

## Files

### 1. `src/config/api.config.ts` ✅ Single Source of Truth

```typescript
export const API_CONFIG = {
  BASE_URL: getApiBaseUrl(),
  TIMEOUT: 30000,
  RETRY_ATTEMPTS: 2,
};
```

### 2. `eas.json` - Build Profiles

```json
{
  "build": {
    "development": {
      "env": {
        "EXPO_PUBLIC_API_URL": "http://192.168.31.247:3020/api"
      }
    },
    "production": {
      "env": {
        "EXPO_PUBLIC_API_URL": "https://boiler.ba101.top/backend/api"
      }
    }
  }
}
```

### 3. `.env` (Local Development)

```bash
EXPO_PUBLIC_API_URL=http://192.168.31.247:3020/api
```

### 4. `app.config.js` - Expo Configuration

- Reads from environment variables
- Provides defaults for development
- Passes to `Constants.expoConfig.extra`

## Usage

### In Application Code

```typescript
import { API_CONFIG } from '@/config/api.config';

// API_CONFIG.BASE_URL is available everywhere
console.log(API_CONFIG.BASE_URL);
```

### In API Client

```typescript
import { API_CONFIG } from '../../config/api.config';

axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
});
```

## Development Workflow

### Local Development

1. Copy `.env.example` to `.env`
2. Update `EXPO_PUBLIC_API_URL` to your local network IP
3. Run `npx expo start`
4. The app will use your .env configuration

### Building with EAS

```bash
# Development build (local network)
eas build --profile development --platform android

# Production build (public domain)
eas build --profile production --platform android
```

## Migration Notes

### What Was Removed ❌

- ❌ `EXPO_PUBLIC_API_URL_ANDROID` - No longer needed
- ❌ `EXPO_PUBLIC_API_URL_IOS` - No longer needed
- ❌ Platform-specific URL management in multiple files
- ❌ Redundant getApiUrl() logic in client.ts

### What Was Added ✅

- ✅ Centralized `src/config/api.config.ts`
- ✅ Simplified `eas.json` with single URL per profile
- ✅ Cleaner `.env` structure
- ✅ Platform detection in config layer only

## Benefits

1. **Single Source of Truth**: All URL logic in one place
2. **Easier Maintenance**: Update URL in one location
3. **No Desync**: Impossible to have mismatched URLs across platforms
4. **Cleaner Code**: API client doesn't need to know about platforms
5. **Better EAS Integration**: Clear separation of concerns

## Testing

### Verify Configuration

```bash
# Check TypeScript compilation
npm run type-check

# Start development server
npx expo start -c

# Check console output
# Should see: "API Configuration: { baseUrl: '...', platform: '...' }"
```

### Platform Testing

- **Android Emulator**: Should automatically use `10.0.2.2` in dev mode
- **iOS Simulator**: Should use `localhost` in dev mode
- **Physical Devices**: Should use LAN IP from env var
- **Production Builds**: Should use production URL from eas.json
