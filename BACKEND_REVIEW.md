# Backend Technical Review (Complete)

## Table of Contents
- **Overview**
- **Multi-client API Contract (Web + Mobile)**
- **Tuya API Constraints & Safety Plan**
- **Architecture & Module Analysis**
- **Domain Logic Review (Poll, Recommendation, Interval Learning, Boiler)**
- **Prisma / Schema / Migrations**
- **Async Workflows, Transactions & Race Conditions**
- **Cron Jobs, Adapters, and External Calls**
- **Error Handling and Observability**
- **Security, Auth & Guards**
- **Testing: Missing tests & Coverage Plan**
- **File-by-file Actionable Recommendations**
- **Prioritized Task Plan (P1/P2/P3)**

---

## Overview
This review inspects the backend code under `backend/src` and the Prisma schema at `backend/prisma/schema.prisma`. It focuses on making the system safe and robust for two clients (web + React Native Expo mobile), respecting strict Tuya API quotas, and ensuring high-reliability polling and production-grade observability.

Key constraints enforced in this review:
- Do NOT change polling frequency: 1 minute while heating active, 2 minutes while inactive.
- Tuya API budget ~50k calls/month; avoid any accidental or redundant Tuya calls.
- Backend must provide a stable, documented API for both web and mobile clients.

I include a prioritized task list and concrete, file-level recommendations.

---

**Multi-client API Contract (Web + Mobile)**

- The backend currently exposes Swagger/OpenAPI via `src/main.ts` (see [src/main.ts](src/main.ts)). This must be used as the definitive contract and versioned.
- Action items:
  - P1: Create a stable API versioning strategy: introduce `/api/v1/` prefix (or ensure current controllers map to documented stable paths). Add a note in the OpenAPI config to set a version header.
  - P1: Ensure responses are consistent for both clients (same field names, types). Use DTO response classes and explicit `select`/`transform` logic for mobile-friendly payloads.
  - P1: Add API compatibility tests (contract tests) asserting JSON response shapes used by the web (`frontend/src/api/*.ts`) and mobile app.

Files to check for API shape alignment:
- `backend/src/modules/*/controller.ts` (all controllers)
- `frontend/src/api/*.ts` and mobile API clients (not in this repo) — add contract tests.

---

**Tuya API Constraints & Safety Plan**

Constraint: ~50,000 calls/month (approx 1,600 calls/day). Polling rules are fixed; plan must prevent additional calls beyond those polls.

Findings:
- Tuya adapter exists at [src/modules/Boiler/adapter/tuya.adapter.ts](src/modules/Boiler/adapter/tuya.adapter.ts). Ensure it's the only place performing Tuya network I/O.
- Polling happens in [src/modules/ThermostatPoll/thermostat.polling.service.ts](src/modules/ThermostatPoll/thermostat.polling.service.ts). That code calls `adapter.fetchSnapshot(device.deviceId)` — verify adapter maps to the correct thermostat implementation and does not re-trigger any extra Tuya calls elsewhere.

Tuya Safety Plan (Actionable):
- P1: Single adapter gate
  - Ensure all Tuya calls are routed through a single adapter module (`tuya.adapter.ts`). Refactor any stray Tuya client usage into that adapter.
- P1: Request coalescing & caching
  - Add a short in-memory cache (e.g., per process LRU) for reads to avoid duplicate calls within the same cron tick or across concurrent polls for the same device. TTL = 5s.
- P1: Explicit call accounting and logging
  - Instrument every outgoing Tuya request with a small accounting counter (increment Prometheus counter `tuya_requests_total{endpoint,success}`) and log call metadata (deviceId, duration, status).
  - Add a budget monitor (daily/weekly) that calculates projected monthly usage and emits alerts when usage > 70% budget.
- P1: Respect polling frequencies
  - Confirm no background worker or retry strategy will cause unseen Tuya calls outside polling windows. Retries must be bounded and delayed (exponential backoff) and must contribute to the budget accounting.
- P1: Rate-limit & circuit breaker
  - Add an in-process circuit breaker (e.g., opossum) to avoid large bursts; fail fast if Tuya returns throttling errors.

Monitoring & Alerting Steps:
- Add Prometheus metrics: `tuya_requests_total`, `tuya_request_errors_total`, `tuya_latency_seconds`.
- Add daily job to compute rolling 30-day usage and send alert via email/Sentry when > 70%.
- Add logging structured events to Sentry for any non-2xx Tuya responses.

---

**Architecture & Module Analysis (summary)**

- Major modules:
  - `Auth` — JWT sign/login ([src/modules/Auth/auth.service.ts](src/modules/Auth/auth.service.ts)).
  - `ThermostatPoll` — device polling & state changes ([src/modules/ThermostatPoll/thermostat.polling.service.ts]).
  - `HeatingRecommendation` — interval-learning & recommendations ([src/modules/HeatingRecommendation/heating.recommendation.service.ts]).
  - `HeatingAnomalyCheckerService` — anomaly detection ([src/modules/HeatingAnomalyCheckerService/heating.anomayl.checker.service.ts]).
  - `Boiler` — adapters, program sync, boiler state ([src/modules/Boiler/*]).
  - `Notification` — push notifications and debouncing ([src/modules/Notification/*]).

Strengths:
- Clean modular structure, DI via NestJS and explicit adapters.
- Swagger present for API documentation.

Weaknesses / Risks:
- Numerous unsafe `prisma.update()` calls which can throw if the record is missing (these must be made tolerant).
- Multi-step flows (create event → update boiler history → run recommendations) are not consistently run inside transactions.
- `.txt` backup files are present in modules — risk of stale/confusing code.

---

**Domain Logic Review (focus areas)**

Thermostat polling and state machine (`ThermostatPollingService`):
- The service polls devices sequentially and handles three state transitions: start, end, and target change. It creates `HeatingEvent` and `BoilerHistory` records. Risks:
  - Partial failures: if `heatingEvent` is created but `boilerHistory.create` fails, system state may be inconsistent.
  - Duplicate events: no idempotency prevention for near-simultaneous polls.
  - External adapter calls must be rate-limited and cached.

HeatingRecommendation:
- Computes interval-based learning and updates `HeatingIntervalLearning`. Arithmetic is done in-memory and written back; ensure `update` doesn't crash when the DB record no longer exists (use `updateMany()` or pre-checks).

Interval Learning:
- Uses `intervalKey` + `homeProfile.intervalLearnings` — this in-memory merge of profile-derived learning with DB state should be normalized: read from DB, compute, then write back via transaction.

Boiler logic:
- Boiler flow calculation engine is in `Heating/engine/flow-temperature.engine.ts` — extract deterministic units and test coverage.

Anomaly detection:
- `HeatingAnomalyCheckerService` flags `isAnomaly` and suggests `proposedEndTime`. Use non-throwing updates and ensure notifications are debounced and logged.

---

**Prisma / Schema / Migrations**

Schema quick notes (see [prisma/schema.prisma](prisma/schema.prisma)):
- Keys and indices exist for many relations. Good:
  - `@@unique([homeProfileId, intervalKey])` in `HeatingIntervalLearning`.
  - `@unique` on `User.email` and `UserDevice.expoPushToken`.
- Recommendations:
  - Add a unique constraint on `Recommendation(userId, date)` if only one entry per day is desired (or ensure application enforces it).
  - Add explicit indexes on frequently queried timestamp fields used in range queries (e.g., `heatingEvent(timestampStart, timestampEnd)`), if not already present at DB level.
  - Consider using `createdAt` / `updatedAt` consistent timezone handling (store UTC always).

Migration hygiene:
- Validate that `prisma/migrations/*` folder matches schema, and don't commit generated Prisma client; the client is currently in source under `src/generated/prisma` — that's acceptable but consider regenerating as part of CI.

---

**Async Workflows, Transactions & Race Conditions**

Primary concerns:
- Multi-step operations should use `this.prisma.$transaction()` where atomicity is required, especially in `ThermostatPollingService.handleHeatingStart` and `handleHeatingEnd`.
- Polling loop currently runs per-device sequentially; to scale without increasing Tuya calls, consider limited concurrency while honoring the per-device polling cadence.
- Ensure any background retry mechanism respects Tuya budget and does not cause repeated requests for the same failure.

Recommended changes:
- P1: Wrap create-event + create- boilerHistory + recommendation call (or put recommendation in queue) inside a transaction that sets a minimal record and defers heavy compute.
- P2: Introduce small idempotency token for heating event creation: e.g., `sourceRef` or hash(deviceId + minute-slot) to prevent duplicate starts.

---

**Cron Jobs, Adapters & External Calls**

Files to review and harden:
- `src/modules/ThermostatPoll/thermostat.polling.service.ts` — polling logic and calls to adapter.
- `src/modules/Boiler/adapter/tuya.adapter.ts` — external Tuya client.
- `src/modules/HeatingAnomalyCheckerService/heating.anomayl.checker.service.ts` — anomaly detection cron.

Hardening steps:
- Add timeouts on adapter HTTP calls and catch network errors explicitly.
- Limit concurrency of cron processing using an in-process lock or Redis lock (to avoid duplicate runs when scaling to multiple instances).
- Ensure cron jobs are idempotent and log a correlation id for each run.

---

**Error Handling & Observability**

Observability plan:
- P1: Add structured logs with context (deviceId, userId, runId) using a standard logger wrapper.
- P1: Export metrics to Prometheus for: polls processed, poll failures, Tuya calls, DB errors, anomalies flagged.
- P1: Integrate Sentry (or equivalent) for exception tracking; attach tags for `deviceId` and `module`.

Error handling rules:
- Never crash background jobs on missing DB records — updates must be tolerant (see earlier changes). Background jobs must log and skip when expected data missing.
- All thrown exceptions in Cron should be captured and reported, but not cause the process to exit.

---

**Security, Auth & Guards**

- Validate that all controller routes that require authentication use `@UseGuards(JwtAuthGuard)`; confirm public routes are annotated with `@Public()`.
- Ensure role checks use `@Roles()` / `role.guard.ts` for admin operations.
- Consider rate-limiting user-facing endpoints (`@nestjs/throttler` already included in deps).

---

**Testing: Missing tests & Coverage Plan**

Critical test needs (P1):
- Unit tests for:
  - `src/modules/Heating/engine/flow-temperature.engine.ts` — full coverage of algorithm inputs (edge cases)
  - `src/modules/ThermostatPoll/thermostat.polling.service.ts` — simulate adapter snapshots to validate state transitions
  - `src/modules/HeatingRecommendation/heating.recommendation.service.ts` — interval learning math, upsert flows
  - `src/modules/HeatingAnomalyCheckerService/heating.anomayl.checker.service.ts` — anomaly detection thresholds and notification triggers
- Integration tests (P1/P2):
  - poll -> DB end-to-end using a test database (Dockerized MariaDB or in-memory sqlite if feasible)
  - Tuya adapter mocked to assert no extra calls during heavy test runs

Test files to add (suggestion):
- `test/unit/flow-temperature.engine.spec.ts`
- `test/unit/thermostat.polling.service.spec.ts`
- `test/unit/heating.recommendation.service.spec.ts`
- `test/unit/heating.anomaly.checker.service.spec.ts`
- `test/integration/polling.e2e-spec.ts`

CI integration:
- Run unit tests and contract tests in CI.
- Generate and publish OpenAPI spec and run contract tests against frontend fixtures.

---

**File-by-file Actionable Recommendations (selected high-value items)**

- `src/modules/ThermostatPoll/thermostat.polling.service.ts`:
  - Ensure all `prisma.update()` are tolerant (already changed in some locations). If the update's return value is required, add a pre-check (`findUnique`) and if absent silently skip.
  - Wrap `handleHeatingStart` DB writes in `prisma.$transaction()` and move heavy processing (recommendation calculation) to a queue.
  - Add adapter call timeouts and a per-device in-memory cache to coalesce near-simultaneous requests.

- `src/modules/Boiler/adapter/tuya.adapter.ts`:
  - Centralize all Tuya calls here, add retry/backoff, counters and circuit breaker. Export a `tuyaRequestCounter()` hook.

- `src/modules/HeatingRecommendation/heating.recommendation.service.ts`:
  - Use `updateMany()` for DB updates where missing records are expected, or pre-check with `findUnique` and skip.
  - Consider moving recommendation upsert into `$transaction` or queue for offline processing.

- `src/modules/HeatingAnomalyCheckerService/heating.anomayl.checker.service.ts`:
  - Ensure anomaly updates use `updateMany()` and notifications are debounced and logged.

- `src/modules/Notification/notifications.service.ts`:
  - Ensure `markAsRead()` is no-op if the notification missing. Add telemetry for notifications sent.

- `src/prisma/prisma.service.ts`:
  - Monitor connection pool usage; consider increasing `connectionLimit` for production depending on concurrency.

---

## Prioritized Task Plan (P1/P2/P3)

P1 (Immediate / Safety + API contract):
- [ ] Audit all `prisma.*.update()` usages and make tolerant (`updateMany()` or pre-check). (owner: backend)
- [ ] Enforce Tuya single-adapter rule and add request accounting + budget alerts. (owner: backend)
- [ ] Wrap heating lifecycle DB writes in transactions and add idempotency keys. (owner: backend)
- [ ] Add structured logging and Prometheus metrics for poll runs and Tuya usage. (owner: backend/ops)
- [ ] Add contract tests between backend controllers and `frontend/src/api` expected response shapes. (owner: backend+frontend)

P2 (High value / reliability, tests):
- [ ] Add unit tests for engine, polling, recommendation, anomaly checker. (owner: backend/test)
- [ ] Add integration tests for end-to-end poll flows on CI using a containerized DB. (owner: backend/test)
- [ ] Add adapter timeouts and circuit breaker. (owner: backend)

P3 (Operational / enhancements):
- [ ] Add Sentry and tracing; expose dashboards for Tuya usage and poll success-rate. (owner: ops)
- [ ] Consider moving recommendations to background queue for resilience at scale. (owner: backend)

---

## Next Steps I can take now
- Run a complete code scan to modify remaining unsafe `prisma.update()` calls (I previously changed several files) — I can finish the audit and open a PR with consistent patterns.
- Start scaffolding unit tests for `flow-temperature.engine` and `thermostat.polling`.

If you want, I will now proceed to complete the audit of `prisma.update()` usages across the repository and open a PR, or start implementing the P1 test coverage. Which should I do next?
