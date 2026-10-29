# API Configuration Guide

## Overview

The backend API URL is centralized in a single location to ensure consistency
across the application and prevent configuration drift.

> **MO2-1 (2026-10-29):** this document previously described platform-specific
> fallback hosts and an `eas.json` example that did not match the actual files.
> The hardcoded `__DEV__` fallback has been **removed from the code**, so the
> sections below now describe what the code really does.

## Architecture

### Single Source of Truth: `src/config/api.config.ts`

- **Primary Config**: all API configuration is defined here
- **Environment Variables**: reads `EXPO_PUBLIC_API_URL`, set by EAS builds or a local `.env`
- **No platform branching**: Android/iOS use the same value
- **No fallback host**: if no value is configured, the app throws at startup

### Configuration Priority

1. **`EXPO_PUBLIC_API_URL`** — from `eas.json` per build profile, or from a local `.env`
2. **`extra.EXPO_PUBLIC_API_URL`** — from `app.config.js`

If neither is set, `getApiBaseUrl()` throws:

```
API_URL not configured. Set EXPO_PUBLIC_API_URL in eas.json, .env, or app.config.js extra.
```

There is deliberately **no** hardcoded default. The previous version returned
`https://boiler.ba101.top/backend/api` in `__DEV__`, which silently sent
development traffic (including logins) to a real server.

## Files

### 1. `src/config/api.config.ts` — Single Source of Truth

```typescript
export const API_CONFIG = {
  BASE_URL: getApiBaseUrl(),
  TIMEOUT: 30000,
  RETRY_ATTEMPTS: 2,
} as const;
```

### 2. `eas.json` — Build Profiles

Both profiles currently point at the production host:

```json
{
  "build": {
    "development": {
      "env": {
        "EXPO_PUBLIC_API_URL": "https://api.boiler-control.ba101.top/api"
      }
    },
    "production": {
      "env": {
        "EXPO_PUBLIC_API_URL": "https://api.boiler-control.ba101.top/api"
      }
    }
  }
}
```

### 3. `.env` (Local Development)

`.env` is **not** committed. Copy `.env.example` and point it at your own
backend. `.env.example` must never contain real private IP addresses or secrets.

```bash
EXPO_PUBLIC_API_URL=http://localhost:3020/api
```

### 4. `app.config.js` — Expo Configuration

Provides `extra.EXPO_PUBLIC_API_URL`, which reaches the app through
`Constants.expoConfig.extra`. This is what makes `npx expo start` work without
a `.env` file.

## Usage

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
2. Set `EXPO_PUBLIC_API_URL` to your backend address
3. Run `npx expo start`

Without a `.env`, the app uses `extra.EXPO_PUBLIC_API_URL` from `app.config.js`.

### Building with EAS

```bash
# Development build
eas build --profile development --platform android

# Production build
eas build --profile production --platform android
```

## Reaching a Local Backend from a Simulator

There is no automatic platform default — set the address explicitly in `.env`:

| Target | `EXPO_PUBLIC_API_URL` |
|---|---|
| Android emulator | `http://10.0.2.2:3020/api` |
| iOS simulator | `http://localhost:3020/api` |
| Physical device on LAN | `http://<your-machine-LAN-IP>:3020/api` |

## Migration Notes

### What Was Removed

- `EXPO_PUBLIC_API_URL_ANDROID` / `EXPO_PUBLIC_API_URL_IOS` — no longer needed
- Platform-specific URL management in multiple files
- Redundant `getApiUrl()` logic in `client.ts`
- **`__DEV__` hardcoded fallback host** (MO2-1) — replaced by an explicit error

### What Was Added

- Centralized `src/config/api.config.ts`
- Simplified `eas.json` with a single URL per profile
- Fail-fast behaviour when the host is not configured

## Testing

### Verify Configuration

```bash
# TypeScript compilation (real check: src + App.tsx + index.js, strict)
npm run type-check

# Resolve the effective public config, including extra.*
npx expo config --type public --json
```

`npx expo config --type public --json` should report
`extra.EXPO_PUBLIC_API_URL = https://api.boiler-control.ba101.top/api`.
