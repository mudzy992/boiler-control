# P2E Readiness Checklist

Purpose: pre-production verification steps for backend (do not mark ready until frontend sign-off).

Status: Draft — follow each step and record results in `/docs/internal/pipeline/run.log`.

## 1. Build & Type Safety
- [ ] Run `npm run start:dev` — ensure TypeScript compilation shows 0 errors.
- [ ] Run `npm run build` — production build completes without errors.
- [ ] Run `npm run lint` — address any lint failures that block CI.
- [ ] Verify `tsconfig.json` settings: `strict`, `isolatedModules`, `emitDecoratorMetadata` as intended.

Commands:

```powershell
npm run start:dev
npm run build
npm run lint
```

## 2. Tests & CI
- [ ] Unit tests: `npm test` — all unit tests pass; check coverage thresholds (baseline: 80%).
- [ ] Integration tests: `npm run test:integration` — expect 46/46 passing.
- [ ] CI pipeline configured to run: lint → typecheck → unit → integration → build.
- [ ] Add smoke test job that hits `/health`, `/metrics`, `/metrics/reporting`, and a couple of API endpoints.

Smoke test example (run during deploy):

```bash
curl -f http://localhost:3020/health
curl -f http://localhost:3020/metrics
curl -f http://localhost:3020/metrics/reporting
```

## 3. Runtime Health & Endpoints
- [ ] Confirm app starts and listens on configured port.
- [ ] Verify Swagger UI available at `/api/docs`.
- [ ] Confirm `GET /health` returns 200 and basic diagnostics.
- [ ] Confirm `GET /metrics` and `GET /metrics/reporting` return Prometheus text format.

## 4. Metrics, Logging & Observability
- [ ] Validate Prometheus metrics present and labeled:
  - `reporting_home_health_score`
  - `reporting_anomaly_rate_per_hour`
  - `reporting_fallback_rate_per_hour`
  - `reporting_active_alerts`
  - Anomaly/fallback counters from earlier phases
- [ ] Validate structured logs include `runId`, `deviceId`, `userId`, `eventId`, `action`.
- [ ] Provide sample Prometheus scrape config and Grafana panel suggestions in `metrics-validation.md`.

## 5. Correlation & Async Context
- [ ] Plan migration: change `CorrelationIdService` to `AsyncLocalStorage` for production tracing.
- [ ] Add unit tests for ALS context propagation (sync, async, nested).
- [ ] Ensure StructuredLogger reads context when `runId` is not explicitly passed.

## 6. Security & Configuration
- [ ] Verify required env vars documented; ensure `NODE_ENV`, DB credentials, JWT secret, API keys present in deployment config.
- [ ] Remove secrets from repo; use secret manager in CI/CD.
- [ ] Validate CORS, rate-limiting, and auth guards operate as expected.

## 7. CI/CD & Staging
- [ ] Add staging deployment job that runs smoke tests post-deploy.
- [ ] Configure health checks for load balancer.
- [ ] Configure canary or rolling rollout (recommended 10%→100%).

## 8. Runbooks & Documentation
- [ ] Create `P2E_READINESS_CHECKLIST.md` (this file).
- [ ] Create `P2E_ROLLBACK_PLAN.md` (runbook for rollback — see sibling file).
- [ ] Add `run.log` artifacts to `/docs/internal/snapshots/`.

## 9. Sign-off
- [ ] Backend owner review
- [ ] Frontend owner review (required)
- [ ] Ops/Oncall review


Notes:
- Do NOT mark production-ready until frontend integration and joint sign-off are completed.
- If Prisma WASM dynamic imports are needed in CI, prefer configuring Node or Prisma engine selection in CI instead of requiring `--experimental-vm-modules` in production.
