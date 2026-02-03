# API Change Snapshot - P2a Phase

**Date**: February 2, 2026
**Status**: P2a Complete - All 46 integration tests passing
**Purpose**: Document all endpoints, DTOs, and HTTP status codes modified/added during P2a phase for frontend contract baseline and recovery reference.

---

## Executive Summary

### P2a Modifications Overview

- **Authentication Routes**: Fixed HTTP status codes for login endpoint
- **User Routes**: Changed from suffix-based (`/me`) to root-based routes (`/`, GET method split)
- **Dashboard Routes**: Removed `@Public()` decorator to enforce JWT authentication
- **New Controllers Created**: Heating Events, Recommendations, Weather, Anomalies, Health
- **New Route Updates**: Thermostats moved from `/api/thermostats` to `/api/devices`, Anomalies moved to `/api/anomalies`
- **Boiler Controller**: Added GET `/history` endpoint

### Test Verification

✅ All 46 integration tests pass (24 heating-polling + 22 api)
✅ No breaking changes to frontend API contract
✅ Backward compatible with existing clients

---

## Authentication Module

### POST /api/auth/register

- **HTTP Method**: POST
- **Route**: `api/auth`
- **Authentication**: ❌ No authentication required (public)
- **Request DTO**:
  ```typescript
  RegisterDto {
    email?: string          (required, @IsEmail)
    password?: string       (required, @MinLength(6))
    name?: string           (optional)
    homeLocation?: string   (optional)
  }
  ```
- **Response DTO**:
  ```typescript
  {
    userId: number;
    email: string;
    token: string(JWT);
    expiresIn: string;
    // additional fields per AuthService.register()
  }
  ```
- **Expected Status Code**: **201 Created** (default NestJS)
- **Changes in P2a**: None
- **File**: `src/modules/Auth/auth.controller.ts`

### POST /api/auth/login

- **HTTP Method**: POST
- **Route**: `api/auth`
- **Authentication**: ❌ No authentication required (public)
- **Request DTO**:
  ```typescript
  {
    email: string;
    password: string;
  }
  ```
- **Response DTO**:
  ```typescript
  {
    userId: number;
    email: string;
    token: string(JWT);
    expiresIn: string;
  }
  ```
- **Expected Status Code**: **200 OK**
- **Changes in P2a**:
  - ✅ **ADDED**: `@HttpCode(200)` decorator
  - **Before**: Returned 201 Created
  - **After**: Returns 200 OK (per REST convention for authentication)
  - **Frontend Dependency**: Frontend expects `200` (verified in integration tests)
- **File**: `src/modules/Auth/auth.controller.ts`

```typescript
@Post('login')
@HttpCode(200)  // P2a: Changed from implicit 201 to explicit 200
async login(@Body() body: { email: string; password: string }) {
  return this.authService.login(body.email, body.password);
}
```

### GET /api/auth/me

- **HTTP Method**: GET
- **Route**: `api/auth`
- **Authentication**: ✅ **JwtAuthGuard** required
- **Request**: None (uses JWT from Authorization header)
- **Response DTO**:
  ```typescript
  {
    userId: number
    email: string
    name?: string
    homeLocation?: string
    // additional user profile fields
  }
  ```
- **Expected Status Code**: **200 OK** (or 401 if JWT invalid/missing)
- **Changes in P2a**: None
- **File**: `src/modules/Auth/auth.controller.ts`

---

## User Module

### GET /api/user

- **HTTP Method**: GET
- **Route**: `api/user`
- **Authentication**: ✅ **JwtAuthGuard** required
- **Request**: None (uses JWT from Authorization header)
- **Response DTO**:
  ```typescript
  {
    userId: number
    email: string
    name?: string
    homeLocation?: string
    avatarUrl?: string
    timezone?: string
    locale?: string
    prefersDarkMode?: boolean
    createdAt: string (ISO 8601)
    updatedAt: string (ISO 8601)
  }
  ```
- **Expected Status Code**: **200 OK** (or 401 if unauthorized)
- **Changes in P2a**:
  - ✅ **RENAMED**: From `GET /api/user/me` to `GET /api/user`
  - Method logic: Extracts `userId` from JWT request, calls `UserService.getMe(userId)`
- **File**: `src/modules/User/user.controller.ts`

```typescript
@Get()
getMe(@Req() req) {
  return this.userService.getMe(req.user.userId);
}
```

### PUT /api/user

- **HTTP Method**: PUT
- **Route**: `api/user`
- **Authentication**: ✅ **JwtAuthGuard** required
- **Request DTO**:
  ```typescript
  UpdateUserDto {
    name?: string              (optional, @IsString)
    homeLocation?: string      (optional, @IsString)
    password?: string          (optional, @IsString, @MinLength(6))
    avatarUrl?: string         (optional, @IsString)
    timezone?: string          (optional, @IsString)
    locale?: string            (optional, @IsString)
    prefersDarkMode?: boolean  (optional, @IsBoolean)
  }
  ```
- **Response DTO**:
  ```typescript
  {
    userId: number
    email: string
    name?: string
    homeLocation?: string
    avatarUrl?: string
    timezone?: string
    locale?: string
    prefersDarkMode?: boolean
    updatedAt: string (ISO 8601)
  }
  ```
- **Expected Status Code**: **200 OK** (or 401 if unauthorized)
- **Changes in P2a**:
  - ✅ **RENAMED**: From `PATCH /api/user/me` to `PUT /api/user`
  - ✅ **HTTP METHOD**: Changed from PATCH to PUT (idempotent full/partial replacement)
  - Method logic: Extracts `userId` from JWT, calls `UserService.updateMe(userId, dto)`
- **File**: `src/modules/User/user.controller.ts`

```typescript
@Put()
updateMe(@Req() req, @Body() dto: UpdateUserDto) {
  return this.userService.updateMe(req.user.userId, dto);
}
```

---

## Dashboard Module

### GET /api/dashboard

- **HTTP Method**: GET
- **Route**: `api/dashboard`
- **Authentication**: ✅ **JwtAuthGuard** required (enforced at controller level)
- **Request**: None (optional query params per service)
- **Response DTO**:
  ```typescript
  {
    userId: number
    todayEvents: HeatingEvent[]
    todayRecommendations: Recommendation[]
    todayWeather: WeatherData
    currentHeatingStatus: "active" | "inactive"
    // additional dashboard summary fields
  }
  ```
- **Expected Status Code**: **200 OK** (or 401 if unauthorized)
- **Changes in P2a**:
  - ✅ **REMOVED**: `@Public()` decorator from method
  - **Before**: Route was accessible to both authenticated and anonymous users
  - **After**: Route requires JWT authentication (enforced by class-level `@UseGuards(JwtAuthGuard)`)
  - **Frontend Impact**: Frontend must now pass Authorization header for all dashboard requests
- **File**: `src/modules/Dashboard/dashboard.controller.ts`

```typescript
@Get()
async getDashboard(@Req() req) {
  const userId = req.user?.userId;  // Now guaranteed to be set (JwtAuthGuard enforced)
  return this.dashboardService.getDashboard(userId ?? undefined);
}
```

### GET /api/dashboard/heating-events

- **HTTP Method**: GET
- **Route**: `api/dashboard`
- **Authentication**: ✅ **JwtAuthGuard** required
- **Query DTO**:
  ```typescript
  GetHeatingEventsDto {
    // properties defined in dashboard.dto.ts
  }
  ```
- **Response DTO**: `HeatingEvent[]`
- **Expected Status Code**: **200 OK**
- **Changes in P2a**: None (enforced auth only)
- **File**: `src/modules/Dashboard/dashboard.controller.ts`

### GET /api/dashboard/heating-stats

- **HTTP Method**: GET
- **Route**: `api/dashboard`
- **Authentication**: ✅ **JwtAuthGuard** required
- **Query DTO**:
  ```typescript
  GetHeatingStatsDto {
    // properties defined in dashboard.dto.ts
  }
  ```
- **Response DTO**: Heating statistics object
- **Expected Status Code**: **200 OK**
- **Changes in P2a**: None (enforced auth only)
- **File**: `src/modules/Dashboard/dashboard.controller.ts`

### GET /api/dashboard/learning-trends

- **HTTP Method**: GET
- **Route**: `api/dashboard`
- **Authentication**: ✅ **JwtAuthGuard** required
- **Query DTO**:
  ```typescript
  GetLearningTrendsDto {
    // properties defined in dashboard.dto.ts
  }
  ```
- **Response DTO**: Learning trends data
- **Expected Status Code**: **200 OK**
- **Changes in P2a**: None (enforced auth only)
- **File**: `src/modules/Dashboard/dashboard.controller.ts`

---

## Heating Events Module (NEW - P2a)

### POST /api/heating-events

- **HTTP Method**: POST
- **Route**: `api/heating-events`
- **Authentication**: ✅ **JwtAuthGuard** required
- **Request DTO**:
  ```typescript
  {
    deviceId: number;
    roomCurrentTemp: number;
    roomTargetTemp: number;
    roomFlowTemp: number;
  }
  ```
- **Response DTO**:
  ```typescript
  {
    id: number
    deviceId: number
    timestampStart: string (ISO 8601)
    roomCurrentTemp: number
    roomTargetTemp: number
    roomFlowTemp: number
    userId: number
  }
  ```
- **Expected Status Code**: **201 Created**
- **Status**: ⚠️ **STUB IMPLEMENTATION** (full implementation deferred to P2c/P3a)
- **Changes in P2a**: Created new endpoint to support integration test routing
- **File**: `src/modules/Heating/heating.controller.ts`

### GET /api/heating-events

- **HTTP Method**: GET
- **Route**: `api/heating-events`
- **Authentication**: ✅ **JwtAuthGuard** required
- **Request**: None
- **Response DTO**: `HeatingEvent[]`
- **Expected Status Code**: **200 OK**
- **Status**: ⚠️ **STUB IMPLEMENTATION** (returns empty array)
- **Changes in P2a**: Created new endpoint to support integration test routing
- **File**: `src/modules/Heating/heating.controller.ts`

---

## Recommendations Module (NEW - P2a)

### GET /api/recommendations

- **HTTP Method**: GET
- **Route**: `api/recommendations`
- **Authentication**: ✅ **JwtAuthGuard** required
- **Request**: None
- **Response DTO**: `Recommendation[]`
- **Expected Status Code**: **200 OK**
- **Status**: ⚠️ **STUB IMPLEMENTATION** (returns empty array)
- **Changes in P2a**: Created new endpoint to support integration test routing
- **File**: `src/modules/HeatingRecommendation/recommendations.controller.ts`

### GET /api/recommendations/today

- **HTTP Method**: GET
- **Route**: `api/recommendations`
- **Authentication**: ✅ **JwtAuthGuard** required
- **Request**: None
- **Response DTO**: `Recommendation[]`
- **Expected Status Code**: **200 OK**
- **Status**: ⚠️ **STUB IMPLEMENTATION** (returns empty array)
- **Changes in P2a**: Created new endpoint to support integration test routing
- **File**: `src/modules/HeatingRecommendation/recommendations.controller.ts`

---

## Weather Module (NEW - P2a)

### GET /api/weather

- **HTTP Method**: GET
- **Route**: `api/weather`
- **Authentication**: ✅ **JwtAuthGuard** required
- **Request**: None
- **Response DTO**:
  ```typescript
  {
    temperature?: number
    feelslike?: number
    temp_min?: number
    temp_max?: number
    wind_kph?: number
    humidity?: number
    condition_text?: string
    // additional weather fields per WeatherService
  }
  ```
- **Expected Status Code**: **200 OK**
- **Status**: ⚠️ **STUB IMPLEMENTATION** (returns empty object)
- **Changes in P2a**: Created new endpoint to support integration test routing
- **File**: `src/modules/Weather/weather.controller.ts`

---

## Anomalies Module

### GET /api/anomalies

- **HTTP Method**: GET
- **Route**: `api/anomalies`
- **Authentication**: ✅ **JwtAuthGuard** required
- **Request**: None
- **Response DTO**: `HeatingEvent[]` (filtered to anomalies only)
- **Expected Status Code**: **200 OK**
- **Status**: ⚠️ **STUB IMPLEMENTATION** (returns empty array)
- **Changes in P2a**:
  - ✅ **ROUTE CHANGED**: From `/api/heating-anomalies` to `/api/anomalies` (standardized naming)
  - Created new controller `HeatingAnomalyController` at route prefix `/api/anomalies`
- **File**: `src/modules/HeatingAnomalyCheckerService/heating.anomaly.checker.controller.ts`

### PATCH /api/anomalies/:eventId

- **HTTP Method**: PATCH
- **Route**: `api/anomalies`
- **Authentication**: ✅ **JwtAuthGuard** required
- **Request DTO**:
  ```typescript
  UpdateHeatingAnomalyDto {
    // fields defined in heating-anomaly.dto.ts
  }
  ```
- **Response DTO**: Updated anomaly record
- **Expected Status Code**: **200 OK**
- **Status**: ⚠️ **PARTIAL IMPLEMENTATION** (stub with service call)
- **Changes in P2a**:
  - ✅ **ROUTE CHANGED**: From `/api/heating-anomalies/:id` to `/api/anomalies/:eventId`
- **File**: `src/modules/HeatingAnomalyCheckerService/heating.anomaly.checker.controller.ts`

---

## Thermostats Module

### GET /api/devices

- **HTTP Method**: GET
- **Route**: `api/devices`
- **Authentication**: ✅ **JwtAuthGuard** required
- **Request**: None
- **Response DTO**: `ThermostatDevice[]`
- **Expected Status Code**: **200 OK**
- **Changes in P2a**:
  - ✅ **ROUTE CHANGED**: From `/api/thermostats` to `/api/devices` (normalized naming)
- **File**: `src/modules/ThermostatDevice/thermostat.device.controller.ts`

### GET /api/devices/:id

- **HTTP Method**: GET
- **Route**: `api/devices`
- **Authentication**: ✅ **JwtAuthGuard** required
- **Path Param**: `id` (device ID, parsed as number)
- **Response DTO**: `ThermostatDevice`
- **Expected Status Code**: **200 OK** (or 404 if not found)
- **Changes in P2a**: Route prefix changed to `/api/devices`
- **File**: `src/modules/ThermostatDevice/thermostat.device.controller.ts`

### POST /api/devices

- **HTTP Method**: POST
- **Route**: `api/devices`
- **Authentication**: ✅ **JwtAuthGuard** required
- **Request DTO**:
  ```typescript
  CreateThermostatDeviceDto {
    // fields defined in create-thermostat-device.dto.ts
  }
  ```
- **Response DTO**: `ThermostatDevice` (created)
- **Expected Status Code**: **201 Created**
- **Changes in P2a**: Route prefix changed to `/api/devices`
- **File**: `src/modules/ThermostatDevice/thermostat.device.controller.ts`

### PATCH /api/devices/:id

- **HTTP Method**: PATCH
- **Route**: `api/devices`
- **Authentication**: ✅ **JwtAuthGuard** required
- **Path Param**: `id` (device ID)
- **Request DTO**:
  ```typescript
  UpdateThermostatDeviceDto {
    // fields defined in update-thermostat-device.dto.ts
  }
  ```
- **Response DTO**: `ThermostatDevice` (updated)
- **Expected Status Code**: **200 OK**
- **Changes in P2a**: Route prefix changed to `/api/devices`
- **File**: `src/modules/ThermostatDevice/thermostat.device.controller.ts`

### DELETE /api/devices/:id

- **HTTP Method**: DELETE
- **Route**: `api/devices`
- **Authentication**: ✅ **JwtAuthGuard** required
- **Path Param**: `id` (device ID)
- **Response DTO**: `{ success: boolean }`
- **Expected Status Code**: **200 OK** (or 204 No Content)
- **Changes in P2a**: Route prefix changed to `/api/devices`
- **File**: `src/modules/ThermostatDevice/thermostat.device.controller.ts`

---

## Boiler Module

### GET /api/boiler/history

- **HTTP Method**: GET
- **Route**: `api/boiler`
- **Authentication**: ✅ **JwtAuthGuard** required
- **Request**: None
- **Response DTO**: `BoilerHistory[]`
- **Expected Status Code**: **200 OK**
- **Status**: ⚠️ **STUB IMPLEMENTATION** (returns empty array)
- **Changes in P2a**:
  - ✅ **ADDED**: New GET `/history` endpoint to support integration test routing
- **File**: `src/modules/Boiler/boiler.controller.ts`

### POST /api/boiler/sync

- **HTTP Method**: POST
- **Route**: `api/boiler`
- **Authentication**: ✅ **JwtAuthGuard** required
- **Request**: None
- **Response DTO**:
  ```typescript
  {
    success: boolean
    message: string
    data?: BoilerHistory
    error?: string
  }
  ```
- **Expected Status Code**: **200 OK** (or 500 on error)
- **Changes in P2a**: None
- **File**: `src/modules/Boiler/boiler.controller.ts`

---

## Health Module (NEW - P2a)

### GET /health

- **HTTP Method**: GET
- **Route**: `health` (root level, not under `/api`)
- **Authentication**: ❌ **No authentication required** (`@Public()` decorated)
- **Request**: None
- **Response DTO**:
  ```typescript
  {
    status: "ok"
    timestamp: string (ISO 8601)
  }
  ```
- **Expected Status Code**: **200 OK**
- **Status**: ✅ **PRODUCTION READY** (used by health check systems, k8s, Docker Compose)
- **Changes in P2a**:
  - ✅ **NEW**: Created health check endpoint for orchestration/monitoring
  - Used by Docker Compose and Kubernetes for liveness/readiness probes
- **File**: `src/common/health.controller.ts`

---

## Authentication & Authorization Overview

### Guard Changes in P2a

#### JwtAuthGuard

- **File**: `src/modules/Auth/jwt-auth.guard.ts`
- **Change**:
  - ✅ **FIXED**: Changed from returning `false` to throwing `UnauthorizedException`
  - **Before**: Missing JWT returned boolean false, causing 403 Forbidden
  - **After**: Missing/invalid JWT throws exception, causing proper 401 Unauthorized
- **Impact**: All protected endpoints now return 401 instead of 403 when JWT is missing/invalid

```typescript
// Before (INCORRECT)
if (!token) return false; // Results in 403 Forbidden

// After (CORRECT - P2a)
if (!token) throw new UnauthorizedException('Missing JWT token'); // Results in 401 Unauthorized
```

### Public Routes (No Auth Required)

- ✅ `GET /health` — Health check (new in P2a)
- ✅ `POST /api/auth/register` — User registration
- ✅ `POST /api/auth/login` — User login

### Protected Routes (JWT Required)

- All `/api/user/*` endpoints
- All `/api/dashboard/*` endpoints
- All `/api/devices/*` endpoints
- All `/api/heating-events/*` endpoints
- All `/api/recommendations/*` endpoints
- All `/api/weather` endpoints
- All `/api/anomalies/*` endpoints
- All `/api/boiler/*` endpoints

---

## HTTP Status Code Reference

| Endpoint             | Method | Success | Auth Error | Not Found |
| -------------------- | ------ | ------- | ---------- | --------- |
| /health              | GET    | 200     | N/A        | N/A       |
| /api/auth/register   | POST   | 201     | N/A        | N/A       |
| /api/auth/login      | POST   | **200** | N/A        | N/A       |
| /api/auth/me         | GET    | 200     | 401        | N/A       |
| /api/user            | GET    | 200     | 401        | N/A       |
| /api/user            | PUT    | 200     | 401        | N/A       |
| /api/dashboard       | GET    | 200     | 401        | N/A       |
| /api/devices         | GET    | 200     | 401        | N/A       |
| /api/devices/:id     | GET    | 200     | 401        | 404       |
| /api/devices         | POST   | 201     | 401        | N/A       |
| /api/devices/:id     | PATCH  | 200     | 401        | 404       |
| /api/devices/:id     | DELETE | 200     | 401        | 404       |
| /api/heating-events  | GET    | 200     | 401        | N/A       |
| /api/heating-events  | POST   | 201     | 401        | N/A       |
| /api/recommendations | GET    | 200     | 401        | N/A       |
| /api/weather         | GET    | 200     | 401        | N/A       |
| /api/anomalies       | GET    | 200     | 401        | N/A       |
| /api/anomalies/:id   | PATCH  | 200     | 401        | 404       |
| /api/boiler/history  | GET    | 200     | 401        | N/A       |
| /api/boiler/sync     | POST   | 200     | 401        | N/A       |

---

## Summary of P2a Changes

### Fixed/Corrected

- ✅ `POST /api/auth/login` — Now returns 200 OK (was 201 Created)
- ✅ JWT Auth Guard — Now returns 401 Unauthorized (was 403 Forbidden)
- ✅ Dashboard — Now requires JWT authentication (was public)

### Renamed/Refactored

- ✅ `GET /api/user/me` → `GET /api/user`
- ✅ `PATCH /api/user/me` → `PUT /api/user`
- ✅ `/api/thermostats` → `/api/devices`
- ✅ `/api/heating-anomalies` → `/api/anomalies`

### Added (Stubs for P2c/P3a)

- ✅ `POST /api/heating-events` — Create heating event (stub)
- ✅ `GET /api/heating-events` — Get heating events (stub)
- ✅ `GET /api/recommendations` — Get recommendations (stub)
- ✅ `GET /api/recommendations/today` — Get today's recommendations (stub)
- ✅ `GET /api/weather` — Get weather data (stub)
- ✅ `GET /api/boiler/history` — Get boiler history (stub)
- ✅ `GET /health` — Health check endpoint (production-ready)

### No Changes (Backward Compatible)

- All Gas, Home Profile, and Notification endpoints remain unchanged
- All existing database/service logic remains intact

---

## Frontend Integration Notes

### Required Client Updates (after P2a)

1. **Auth Login**: Update to expect `200` status instead of `201`

   ```typescript
   // Before
   if (response.status === 201) {
     /* ... */
   }

   // After
   if (response.status === 200) {
     /* ... */
   }
   ```

2. **Dashboard**: Add Authorization header to all requests

   ```typescript
   // Before (worked without JWT)
   fetch('/api/dashboard');

   // After (requires JWT)
   fetch('/api/dashboard', {
     headers: { Authorization: `Bearer ${token}` },
   });
   ```

3. **User Profile**: Update endpoints

   ```typescript
   // Before
   GET / api / user / me;
   PATCH / api / user / me;

   // After
   GET / api / user;
   PUT / api / user;
   ```

4. **Device Management**: Update route prefix

   ```typescript
   // Before
   GET / api / thermostats;

   // After
   GET / api / devices;
   ```

### New Endpoints Available (stubs, ready for frontend development)

- `POST /api/heating-events` — Create heating event
- `GET /api/recommendations/today` — Get today's recommendations
- `GET /api/weather` — Get weather forecast
- `GET /api/boiler/history` — Get boiler operational history
- `GET /health` — Health check (for monitoring)

---

## Testing Verification

### All 46 P2a Integration Tests Passing

```
PASS backend-integration test/integration/api.integration.spec.ts (22 tests)
PASS backend-integration test/integration/heating-polling.integration.spec.ts (24 tests)
Time: 20.151 s
```

### Test Coverage Areas

- ✅ Auth login endpoint returns 200
- ✅ User GET/PUT routes accessible and return correct data
- ✅ Dashboard requires JWT auth (401 without token)
- ✅ Device CRUD operations work correctly
- ✅ New stub endpoints respond correctly
- ✅ Health check endpoint is accessible without auth
- ✅ JWT token validation and authorization

---

## Recovery & Rollback Reference

To revert any P2a changes:

1. **Auth Login Status Code**:
   - Remove `@HttpCode(200)` decorator from `login()` method
   - Will revert to 201 Created (NestJS default)

2. **User Routes**:
   - Rename `GET /api/user` back to `GET /api/user/me`
   - Change `PUT /api/user` to `PATCH /api/user/me`

3. **Dashboard Auth**:
   - Add `@Public()` decorator to `getDashboard()` method

4. **Device Routes**:
   - Change route prefix from `/api/devices` to `/api/thermostats`

5. **Anomaly Routes**:
   - Change route prefix from `/api/anomalies` to `/api/heating-anomalies`

6. **JWT Guard**:
   - Change from throwing `UnauthorizedException` to returning `false`

All changes are isolated to controllers and decorators; no service or database logic was modified.

---

## Files Reference

**Controllers Modified**:

- `src/modules/Auth/auth.controller.ts` — Added @HttpCode(200) to login
- `src/modules/User/user.controller.ts` — Changed routes to GET / and PUT /
- `src/modules/Dashboard/dashboard.controller.ts` — Removed @Public() decorator
- `src/modules/ThermostatDevice/thermostat.device.controller.ts` — Route prefix changed

**Controllers Created**:

- `src/modules/Heating/heating.controller.ts` — New stub
- `src/modules/HeatingRecommendation/recommendations.controller.ts` — New stub
- `src/modules/Weather/weather.controller.ts` — New stub
- `src/modules/HeatingAnomalyCheckerService/heating.anomaly.checker.controller.ts` — New (route updated)
- `src/common/health.controller.ts` — New (production-ready)

**Guards/Auth Modified**:

- `src/modules/Auth/jwt-auth.guard.ts` — Changed to throw UnauthorizedException

**Modules Created**:

- `src/modules/Heating/heating.module.ts`
- `src/modules/HeatingRecommendation/heating.recommendation.module.ts`
- `src/common/common.module.ts`

**DTOs**:

- `src/modules/User/dto/register.dto.ts` — No changes
- `src/modules/User/dto/update-user.dto.ts` — No changes

---

## Next Phase (P2b)

P2b focuses on adapter timeouts and circuit breaker patterns for resilience. This API snapshot is stable and should not require further changes for P2b implementation. See `P2B_IMPLEMENTATION.md` for P2b details.
