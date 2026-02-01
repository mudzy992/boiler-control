# Frontend (React) Technical Review

## Table of Contents
- High-level Architecture
- API & Backend Contracts
- UI Coverage & Missing Widgets
- Performance & Code Quality
- Error Handling & Offline Safety
- Testing Plan (unit/integration/e2e)
- File-by-file recommendations
- Actionable Task Plan (P1/P2/P3)

---

## High-level Architecture
- Frontend is a React/Vite app in `frontend/src` with routes/pages under `src/pages/*` and layout components under `src/layouts/*`.
- API layer centralized at `src/api/api.ts` using axios with JWT interceptor — good single point of truth for requests.
- Present UI pages of interest: `src/pages/DashboardPage.tsx`, `src/pages/HomePage.tsx`, `src/pages/ProfilePage.tsx`, `src/pages/LoginPage.tsx`, `src/pages/RegisterPage.tsx`.

---

## API & Backend Contracts
- `src/api/api.ts` sets base URL to `VITE_API_BASE_URL` (`http://localhost:3020/api` fallback). Confirm this matches backend's exposed `main.ts` listener (`process.env.APP_PORT || 3000`) and API prefix (check controller routes — controllers appear to have default NestJS routing `/`).
- APIs present in `src/api/*.ts`: `auth.api.ts`, `boiler.api.ts`, `dashboard.api.ts`, `heating.anomaly.api.ts`, `homeProfile.api.ts`, `user.api.ts`, `gas.api.ts`.
- Verify each frontend API call matches backend controllers' route shapes and DTOs (e.g., `user.updateMe`, `notification` endpoints). Cross-check required fields & response shapes, especially around `recommendation` and `boilerHistory`.

---

## UI Coverage & Missing Widgets (Critical UX Gaps)
Required dashboard widgets missing or incomplete:
- Boiler status: current state, last cycle, suggested flow temp.
  - Ensure `boiler.api.ts` supports fetching `boilerHistory` or current boiler state.
- Active cycles: show active heating events per thermostat (start time, duration).
  - API: `heatingEvent` endpoints should support filtering `timestampEnd==null`.
- Sensors overview: list thermostat devices with `roomCurrentTemp`, `roomTargetTemp`, `lastSnapshotAt`.
  - `src/pages/DashboardPage.tsx` likely needs a component to render `thermostatDevice` list; check `src/api/homeProfile.api.ts` and `src/api/boiler.api.ts`.
- Weather-based recommendations: today's recommended flow temp and confidence.
  - Ensure `src/api/dashboard.api.ts` or `boiler.api.ts` surface `recommendation` results.
- Alerts/Anomalies: UI for open anomalies and ability to confirm end time.
  - `src/api/heating.anomaly.api.ts` exists but ensure pages/components exist to present and act on anomalies.
- Historical charts: energy/gas usage and heating durations (use `recharts` dependency present).

---

## Performance & Code Quality
- Look for unnecessary rerenders in layout components (e.g., `AuthProvider`/`AuthContext`) — ensure `useMemo`/`useCallback` usage for heavy props.
- Check components that subscribe to global state (if any) and limit updates.
- Unused files: run `eslint --print-config` and `tsc` to find unreachable imports; repository contains `build/` and `public/` folders — ensure Vite ignore rules are correct.

---

## Error Handling & Offline Safety
- `api.ts` response interceptor currently just rejects the error. Add global 401 handler to logout and redirect to login.
- Offline: Add retry/backoff strategy for GETs for occasional network flakiness and show toasts for offline failures.
- Form validation: Ensure forms use proper client-side validation matching backend DTOs.

---

## Testing Plan
Missing tests:
- Unit tests for `src/api/*` wrappers and `AuthProvider`.
- Component tests for `DashboardPage`, `HomePage`, and anomaly confirm modal.
- Integration/E2E tests for login → dashboard flow (Cypress or Playwright).

Suggested test files:
- `src/__tests__/api.spec.ts`
- `src/__tests__/DashboardPage.spec.tsx`
- `src/__tests__/AuthProvider.spec.tsx`
- `e2e/login-and-dashboard.spec.ts` (Playwright or Cypress)

---

# Frontend Technical Review (Complete)

## Table of Contents
- **Overview**
- **API Adapter & Contract Compliance**
- **Dashboard Specification (Professional)**
- **Call Frequency & Tuya/Backend Constraints**
- **UI Architecture & State Management**
- **Error Handling & Offline Strategy**
- **Performance & Rendering**
- **Testing Plan (unit/integration/e2e)**
- **File-by-file Recommendations**
- **Prioritized Task Plan (P1/P2/P3)**

---

## Overview
This review inspects the frontend code under `frontend/src`. The app is a React + Vite + AntD + Tailwind codebase. The frontend must consume the backend API stably and preserve feature parity with the React Native Expo mobile app. The document includes a professional heating dashboard spec, missing integrations, and a prioritized task plan.

Key requirements applied here:
- Respect backend polling cadence and avoid making any extra device-control calls that could push Tuya API usage over budget.
- Provide a complete dashboard that exposes boiler state, active cycles, recommendations, anomalies, and analytics for web and mobile.

---

**API Adapter & Contract Compliance**

- Central adapter: `frontend/src/api/api.ts` (see [frontend/src/api/api.ts](frontend/src/api/api.ts)). It sets baseURL via `VITE_API_BASE_URL` and injects JWT into requests.
- Immediate actions:
  - P1: Add global 401 handler to clear token and redirect to login. Handle refresh-token flows if available.
  - P1: Add standardized error parsing and toast-friendly messages.
  - P1: Add request cancellation/timeouts for UI-initiated requests to avoid orphaned requests.
  - P2: Add retry/backoff for idempotent GETs.

API contract tasks:
- P1: Add contract tests that run against a dev backend instance to validate shapes used in `frontend/src/api/*.ts` (auth, dashboard, boiler, heating.*).
- P1: Pin API versions in frontend calls or read from `/api/docs` OpenAPI spec.

---

**Dashboard Specification (Professional)**

This is the required set of dashboard widgets and their data sources. Each widget must be available on both web and mobile (feature parity checklist included below).

Widgets (data source mapping):
- Live Boiler Status
  - Data: current boiler state, `BoilerHistory` latest row, `actualFlowTemp`, `suggestedFlowTemp`.
  - Endpoint: `GET /api/boiler/status` or `GET /api/boiler/history/latest` (ensure backend provides)
- Active Heating Cycles
  - Data: list of `HeatingEvent` where `timestampEnd == null` with device info.
  - Endpoint: `GET /api/heating/events?active=true`
- Setpoint vs Measured Temperature (per device)
  - Data: `thermostatDevice.roomTargetTemp`, `thermostatDevice.roomCurrentTemp`, `lastSnapshotAt`.
  - Endpoint: `GET /api/thermostat/devices`
- Weather + Heating Curve
  - Data: `WeatherCache` latest, today's `Recommendation` (recommendedFlowTemp), confidence.
  - Endpoint: `GET /api/weather/latest`, `GET /api/recommendation/today`
- Daily Recommended Flow Temp
  - Data: today's `Recommendation` with `confidenceScore`.
- Alerts & Anomalies
  - Data: `HeatingEvent` where `isAnomaly=true` and `timestampEnd=null`. Support action: confirm or change proposed end time.
  - Endpoint: `GET /api/heating/anomalies`, `POST /api/heating/anomalies/:id/confirm`
- Charts & Analytics
  - Data: historical `BoilerHistory`, `GasReading`, `HeatingEvent` durations aggregated hourly/daily.
  - Endpoint: `GET /api/analytics/heating?range=7d`
- Logs & Diagnostics
  - Data: recent poll logs and system events (server-provided limited view), perhaps via `GET /api/admin/logs?deviceId=`.

Mobile/Web Feature Parity Checklist:
- P1: Boiler status, active cycles, setpoint vs measured temps, today recommendation, anomalies.
- P2: Charts, logs, advanced analytics.

---

**Call Frequency & Tuya/Backend Constraints**

- Frontend must never trigger direct Tuya calls. All device control requests must be proxied to the backend API which enforces quota and rate-limits.
- Frontend polling strategies:
  - DO NOT poll devices faster than the backend cron. Prefer server push (websocket/notifications) or the dashboard should poll aggregated endpoints (e.g., `GET /api/dashboard/summary`) at a conservative interval (e.g., 15–30s for live UI, or use server-sent events / websocket if available).
- Action items:
  - P1: Audit all frontend code to ensure there are no calls directly to Tuya or third-party thermostats. (Search for 'tuya' or external endpoints in frontend).
  - P1: Use backend-provided summary endpoints to power dashboard widgets; avoid per-device heavy polling from the client.

---

**UI Architecture & State Management**

- Current auth context: `frontend/src/auth/AuthProvider.tsx` and `AuthContext.tsx`. Keep authentication state minimal and memoized.
- Recommendations:
  - P1: Centralize API calls via `api.ts` and a small data layer for caching (e.g., React Query or SWR) to reduce redundant calls and provide offline cache.
  - P2: Use minimal global state; prefer per-component queries with caching for freshness control.

---

**Error Handling & Offline Strategy**

- Add a global 401 handler to `api.ts` to redirect to login. Implement a small offline notice component and use cached data when offline.
- For critical reads (Dashboard summary), implement stale-while-revalidate using React Query.

---

**Performance & Rendering**

- Identify heavy components: large device lists or charts. Use virtualization for long lists and memoization for chart data.
- Avoid unnecessary rerenders by memoizing props from `AuthContext`.

---

**Testing Plan (unit/integration/e2e)**

Priority tests (P1):
- Unit tests for `frontend/src/api/api.ts` request/response handling and auth interceptor.
- Component tests for `DashboardPage` and a `DeviceCard` component.

Integration/E2E (P1/P2):
- E2E test for login → view dashboard → confirm anomaly. Use Playwright or Cypress.

Suggested test files:
- `src/__tests__/api.spec.ts`
- `src/__tests__/DashboardPage.spec.tsx`
- `e2e/login-dashboard.spec.ts`

---

**File-by-file Recommendations (selected)**

- `frontend/src/api/api.ts`:
  - Add `timeout` on requests and global 401 handler. Use axios cancel tokens for component unmount.
  - Ensure `API_BASE_URL` points to backend port; environment mismatch found (frontend default `3020`, backend `3000`) — confirm envs.

- `frontend/src/pages/DashboardPage.tsx`:
  - Break into subcomponents: `BoilerWidget`, `DevicesList`, `ActiveCycles`, `RecommendationCard`, `AnomaliesPanel`, `AnalyticsCharts`.

- `frontend/src/api/heating.anomaly.api.ts`:
  - Handle `{ success: false }` gracefully (don't treat as 500). Show user-friendly messages.

- `frontend/src/auth/AuthProvider.tsx`:
  - Ensure token is cleared on 401 and persistent login state is minimal. Consider adding token expiry check on app start.

---

## Prioritized Task Plan (P1/P2/P3)

P1 (Critical)
- [ ] Add global 401 handling and request timeouts in `frontend/src/api/api.ts`.
- [ ] Audit frontend for any direct thermostat/Tuya HTTP calls and remove them.
- [ ] Implement Dashboard top-level page with the following widgets (feature parity): Boiler status, Active cycles, Devices list, Recommendation card, Anomalies panel. Use backend summary endpoints.
- [ ] Add unit tests for `api` wrappers and critical dashboard components.

P2 (Important)
- [ ] Add React Query (or equivalent) caching layer for dashboard data.
- [ ] Implement E2E test for login → dashboard flow.

P3 (Optional)
- [ ] Add offline-first caching with background sync for read-only dashboards.

---

## Next steps I can take now
- I can scaffold the Dashboard subcomponents and add the `api.ts` improvements (401 handler, timeouts). I can also add the recommended unit test files and an E2E skeleton. Which do you want me to start with?
