# Plan: User-Set Current Boiler Temp as Source of Truth

## Summary
Implement a canonical, user-controlled current boiler flow temperature and stop deriving `actualFlowTemp` from previous recommendations.  
This wave includes backend + `apps/mobile` + `frontend` (excluding `apps/web`), with data-correctness updates only (no learning-model redesign in this wave).

## Root Artifact
- Target plan file to create in repo root during implementation: [PLAN-current-boiler-temp-source-of-truth.md](C:/Users/m.ceric/Documents/GitHub/boiler-control/PLAN-current-boiler-temp-source-of-truth.md)

## Current-State Review

### Backend: where `actualFlowTemp` is used today
| Area | Current behavior | Risk/Gap | File |
|---|---|---|---|
| Boiler history write on heating start | New row sets `actualFlowTemp` from previous `suggestedFlowTemp` | Wrong source-of-truth; user real setting ignored | [thermostat.polling.service.ts](C:/Users/m.ceric/Documents/GitHub/boiler-control/backend/src/modules/ThermostatPoll/thermostat.polling.service.ts) |
| Latest boiler row lookup before write | Uses global latest row | Cross-user contamination risk (missing `userId` filter) | [thermostat.polling.service.ts](C:/Users/m.ceric/Documents/GitHub/boiler-control/backend/src/modules/ThermostatPoll/thermostat.polling.service.ts) |
| Dashboard boiler status | Returns latest `BoilerHistory` row | UI shows inherited/assumed value, not user-confirmed | [dashboard.service.ts](C:/Users/m.ceric/Documents/GitHub/boiler-control/backend/src/modules/Dashboard/dashboard.service.ts) |
| Gas efficiency analysis | Uses `actualFlowTemp || suggestedFlowTemp` weighted by duration | Falls back to suggestion when actual missing; `||` should be `??` | [gas.reading.service.ts](C:/Users/m.ceric/Documents/GitHub/boiler-control/backend/src/modules/Gas/gas.reading.service.ts) |
| Anomaly confirmation recommendation call | Uses latest boiler row `suggestedFlowTemp` | Should prefer user/current actual temp; also missing user scoping | [heating.anomayl.checker.service.ts](C:/Users/m.ceric/Documents/GitHub/boiler-control/backend/src/modules/HeatingAnomalyCheckerService/heating.anomayl.checker.service.ts) |
| Boiler history read API | Exposes raw `actualFlowTemp` field | No endpoint exists to explicitly set current temp | [boiler.controller.ts](C:/Users/m.ceric/Documents/GitHub/boiler-control/backend/src/modules/Boiler/boiler.controller.ts) |

### Mobile (`apps/mobile`) and frontend (`frontend`): where value is consumed
| Area | Current behavior | Gap | File |
|---|---|---|---|
| Boiler card | Displays Suggested vs Actual delta | No “Set current temp” action | [BoilerStatusCard.tsx](C:/Users/m.ceric/Documents/GitHub/boiler-control/apps/mobile/src/components/BoilerStatusCard.tsx) |
| Dashboard health score | Uses `abs(actual - suggested)` | Score quality depends on incorrect actual source | [DashboardScreen.tsx](C:/Users/m.ceric/Documents/GitHub/boiler-control/apps/mobile/src/screens/dashboard/DashboardScreen.tsx) |
| Alerts | Warning/critical based on flow delta | Alert quality depends on incorrect actual source | [AlertsCard.tsx](C:/Users/m.ceric/Documents/GitHub/boiler-control/apps/mobile/src/components/AlertsCard.tsx) |
| Mobile dashboard types | `actualFlowTemp` typed as non-null number | Mismatch with backend nullable DB field | [Dashboard.ts](C:/Users/m.ceric/Documents/GitHub/boiler-control/apps/mobile/src/types/Dashboard.ts) |
| Frontend dashboard/boiler pages | Display actual/suggested/delta only | No setter UI/API integration | [DashboardPage.tsx](C:/Users/m.ceric/Documents/GitHub/boiler-control/frontend/src/pages/DashboardPage.tsx) |
| Frontend boiler history table | Shows actual/delta only | No user-set action | [BoilerPage.tsx](C:/Users/m.ceric/Documents/GitHub/boiler-control/frontend/src/pages/BoilerPage.tsx) |

## Locked Decisions
1. Persistence model: dedicated canonical user state + snapshot into history rows.
2. Write semantics: update latest boiler-history row immediately and use same value for future rows.
3. Scope: backend + `apps/mobile` + `frontend`; exclude `apps/web`.
4. Recommendation/learning scope now: data correctness only; redesign proposal included for later.

## Public API / Interface Changes

### Data model
1. Extend `User` with:
   - `currentBoilerFlowTemp Float?`
   - `currentBoilerFlowTempSetAt DateTime?`
   File: [schema.prisma](C:/Users/m.ceric/Documents/GitHub/boiler-control/backend/prisma/schema.prisma)
2. Keep `BoilerHistory.actualFlowTemp` as per-row snapshot.

### Backend REST API
1. Add `PATCH /api/boiler/current-temp`.
2. Request DTO:
   - `currentFlowTemp: number` (Celsius, one decimal allowed, min `48`, max `55`).
3. Response:
   - `success: boolean`
   - `data: { userId, currentFlowTemp, setAt, latestBoilerHistoryId, latestBoilerHistoryUpdated }`
4. Files:
   - [boiler.controller.ts](C:/Users/m.ceric/Documents/GitHub/boiler-control/backend/src/modules/Boiler/boiler.controller.ts)
   - [boiler.service.ts](C:/Users/m.ceric/Documents/GitHub/boiler-control/backend/src/modules/Boiler/boiler.service.ts)
   - new DTO in `backend/src/modules/Boiler/dto/`

### Client interfaces
1. Mobile API client add `setBoilerCurrentTemp(currentFlowTemp: number)`.
   File: [client.ts](C:/Users/m.ceric/Documents/GitHub/boiler-control/apps/mobile/src/services/api/client.ts)
2. Frontend API client add same method.
   File: [api.ts](C:/Users/m.ceric/Documents/GitHub/boiler-control/frontend/src/services/api.ts)
3. Update mobile types:
   - `actualFlowTemp: number | null`.
   File: [Dashboard.ts](C:/Users/m.ceric/Documents/GitHub/boiler-control/apps/mobile/src/types/Dashboard.ts)

## Implementation Plan

### Phase 1: Backend state and write-path correction
1. Add Prisma migration for `User.currentBoilerFlowTemp` and `User.currentBoilerFlowTempSetAt`.
2. Add migration backfill SQL/script:
   - For each user: initialize canonical temp from latest boiler row using `latest.actualFlowTemp ?? latest.suggestedFlowTemp`.
3. Implement `PATCH /api/boiler/current-temp` in Boiler module.
4. Endpoint service logic in single transaction:
   - update user canonical temp + timestamp;
   - update latest user boilerHistory row `actualFlowTemp` if row exists;
   - return structured response payload.
5. Add structured log + metric counter for manual temp updates.

### Phase 2: Propagate canonical temp to all relevant backend calculations
1. `ThermostatPollingService.handleHeatingStart`:
   - fetch last boiler row with `where: { userId }`;
   - fetch user canonical temp;
   - set new row `actualFlowTemp = user.currentBoilerFlowTemp ?? lastBoilerHistory.actualFlowTemp ?? null`;
   - remove fallback to previous suggested temp.
2. Fix cross-user scoping bug in polling latest boiler lookup.
3. `HeatingAnomalyCheckerService`:
   - scope boiler lookup by event user;
   - pass `boilerFlowTemp = boiler.actualFlowTemp ?? boiler.suggestedFlowTemp ?? 0`.
4. `GasReadingService`:
   - keep actual-first fallback behavior but replace `||` with `??` in weighted temp calculation.
5. Keep dashboard and history APIs backward-compatible; data quality improves automatically.

### Phase 3: Mobile (`apps/mobile`) UX
1. Add “Set current temp” action in boiler status card.
   File: [BoilerStatusCard.tsx](C:/Users/m.ceric/Documents/GitHub/boiler-control/apps/mobile/src/components/BoilerStatusCard.tsx)
2. Use existing bottom-sheet pattern for numeric input and submit.
   File: [BottomSheetModal.tsx](C:/Users/m.ceric/Documents/GitHub/boiler-control/apps/mobile/src/components/BottomSheetModal.tsx)
3. Wire mutation in dashboard screen:
   - call new API;
   - invalidate `['dashboard']` and `['gas-analysis']`.
   File: [DashboardScreen.tsx](C:/Users/m.ceric/Documents/GitHub/boiler-control/apps/mobile/src/screens/dashboard/DashboardScreen.tsx)
4. Fix null-safe checks for `actualFlowTemp` usage in card/alerts.
   Files:
   - [BoilerStatusCard.tsx](C:/Users/m.ceric/Documents/GitHub/boiler-control/apps/mobile/src/components/BoilerStatusCard.tsx)
   - [AlertsCard.tsx](C:/Users/m.ceric/Documents/GitHub/boiler-control/apps/mobile/src/components/AlertsCard.tsx)
5. Add i18n strings (EN + BS/HR):
   - set button label;
   - validation and success texts.
   File: [config.ts](C:/Users/m.ceric/Documents/GitHub/boiler-control/apps/mobile/src/locales/config.ts)

### Phase 4: Frontend (`frontend`) UX
1. Add “Set current temp” action in dashboard boiler status card.
   File: [DashboardPage.tsx](C:/Users/m.ceric/Documents/GitHub/boiler-control/frontend/src/pages/DashboardPage.tsx)
2. Add same action in boiler history page header for direct adjustment.
   File: [BoilerPage.tsx](C:/Users/m.ceric/Documents/GitHub/boiler-control/frontend/src/pages/BoilerPage.tsx)
3. Use AntD `Modal` + `InputNumber` with same validation range (48–55).
4. Refresh dashboard/history after successful mutation.

### Phase 5: Contracts, tests, and docs
1. Add/extend backend contract tests for new endpoint and response shape.
   File: [api-contract.spec.ts](C:/Users/m.ceric/Documents/GitHub/boiler-control/backend/test/contract/api-contract.spec.ts)
2. Add integration tests for:
   - authenticated set-temp update;
   - update with and without existing boiler-history row;
   - polling creates new row using canonical current temp.
   File: [heating-polling.integration.spec.ts](C:/Users/m.ceric/Documents/GitHub/boiler-control/backend/test/integration/heating-polling.integration.spec.ts)
3. Update API docs reference with new endpoint and semantics.
4. Add rollout note + QA checklist to root plan doc.

## Test Cases and Scenarios

### Backend automated
1. `PATCH /api/boiler/current-temp` rejects unauthenticated requests.
2. DTO validation rejects out-of-range and non-numeric values.
3. Endpoint updates `User.currentBoilerFlowTemp` and latest user `BoilerHistory.actualFlowTemp` atomically.
4. Endpoint works when user has zero boiler-history rows (updates canonical state only).
5. Polling heating-start row no longer copies previous suggested temp.
6. Polling and anomaly lookup are user-scoped (no cross-user leakage).
7. Gas analysis weighted flow uses `actualFlowTemp` when present and `suggestedFlowTemp` only as fallback.

### Mobile/frontend QA
1. User sets valid temp; dashboard actual value updates after refetch.
2. Invalid input shows validation error and does not call API.
3. Network/API failure shows error toast/message and preserves previous UI state.
4. New heating cycle inherits last user-set current temp as new row `actualFlowTemp`.
5. Alerts and health score reflect updated actual-vs-suggested delta.

## Acceptance Criteria
1. No new boiler-history row is seeded from previous `suggestedFlowTemp` for `actualFlowTemp`.
2. Canonical user current temp exists and is used for future boiler-history snapshots.
3. Manual update modifies latest boiler-history row when present.
4. Gas analysis and anomaly paths consume actual temp first.
5. Mobile and frontend both expose “Set current temp”.
6. Existing dashboard and boiler history endpoints remain backward compatible.
7. `apps/web` remains unchanged.

## Future Redesign Proposal (Out of Scope for This Wave)

### Proposal
Introduce closed-loop learning using user-confirmed boiler temp as a first-class feature in recommendation learning.

### What to add later
1. Persist `boilerFlowTempAtStart` and `boilerFlowTempAtEnd` on heating events.
2. Add derived features:
   - flow tracking error (`actual - recommended`);
   - stability score across cycles;
   - efficiency by flow bands.
3. Extend recommendation engine inputs with these features and add calibration logic.

### Advantages
1. Better personalization and faster convergence of recommendations.
2. More reliable anomaly detection (behavioral + thermal context).
3. Better gas-efficiency interpretation (temperature-informed, not recommendation-informed).

### Disadvantages
1. Higher model complexity and tuning risk.
2. Requires experiment tracking and careful regression monitoring.
3. Needs larger data volume before confidence is stable.

## Assumptions and Defaults
1. Temperature unit is Celsius only.
2. Valid current-temp input range is `48` to `55` °C.
3. Precision allowed: one decimal place.
4. Canonical state is user-level (not per thermostat device).
5. If no boiler-history row exists, setting current temp still succeeds and only canonical state is saved.
6. This plan is prepared in Plan Mode; creating the root plan file is the first implementation action.
