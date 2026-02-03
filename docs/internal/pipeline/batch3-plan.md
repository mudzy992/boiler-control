# Batch 3 Implementation Plan (P2a–P2d)

**Status:** Planning & Pre-Implementation
**Target Completion:** Next phase
**Dependency:** Batch 2 ✅ Complete (P1c, P1d, P1e)
**Backend State:** Running with idempotency, logging, metrics from Batch 2

---

## Executive Summary

Batch 3 implements **high-value reliability features** that harden the boiler-control backend for production:
- **P2a:** Integration tests validating poll→DB end-to-end flows
- **P2b:** Request timeout + circuit breaker for Tuya adapter
- **P2c:** Structured logging across Tuya adapter and anomaly detection
- **P2d:** Performance baseline metrics (query latency, API response times)

All tasks build on Batch 2 foundations (structured logging, Prometheus metrics, transactions).

---

## Task Breakdown & Acceptance Criteria

### P2a: Integration Tests (Poll → DB End-to-End)

#### Objective
Validate that a complete polling cycle from Tuya adapter → DB writes → recommendation computation produces expected state changes with transactional safety.

#### Acceptance Criteria

✅ **Test Database Setup:**
- [ ] `test/integration/setup.ts` creates isolated MariaDB or test SQLite per test
- [ ] Schema migrations applied to test DB before each test suite
- [ ] Cleanup occurs after tests (DB destroyed)

✅ **Polling Flow Simulation:**
- [ ] Mock `TuyaAdapter` with deterministic snapshot data
- [ ] Trigger `thermostat.polling.service.pollDevice(device)` with mocked snapshot
- [ ] Assert Prisma transaction completed: `HeatingEvent` + `BoilerHistory` created
- [ ] Verify metrics incremented: `heating_events_created`, `poll_runs_success`
- [ ] Verify idempotency: second poll with same snapshot does NOT create duplicate event

✅ **State Transition Tests:**
1. **Heating Start:**
   - Device state: `isHeating: false` → snapshot shows temp rising
   - Expected: `HeatingEvent` created with `timestampStart`, no `timestampEnd`
   - Verify: `BoilerHistory` linked to event
   - Verify: Recommendations computed and stored

2. **Heating End:**
   - Device state: `isHeating: true` + `activeEvent` exists
   - Snapshot shows heating stopped
   - Expected: `HeatingEvent.timestampEnd` set, duration calculated
   - Verify: Duration logged in structured log with `durationMin`
   - Verify: Anomaly check runs post-heating

3. **Target Temp Change:**
   - Device state: `isHeating: true` + `activeEvent` exists
   - Snapshot shows new `targetTemp`
   - Expected: `HeatingEvent.roomTargetTemp` updated
   - Verify: Change logged with context

✅ **Error Scenarios:**
- [ ] Adapter returns error → polling skipped, metrics show failure
- [ ] DB transaction fails (constraint violated) → rollback, no partial state
- [ ] Recommendation computation fails → heating event still created (async resilience)

#### File(s) to Create

**`backend/test/integration/polling.e2e-spec.ts`** (~200 lines)

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ThermostatPollingService } from '../../src/modules/ThermostatPoll/thermostat.polling.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { TuyaAdapter } from '../../src/modules/Boiler/adapter/tuya.adapter';

describe('ThermostatPolling E2E (P2a Integration Tests)', () => {
  let app: INestApplication;
  let pollingService: ThermostatPollingService;
  let prisma: PrismaService;
  let mockTuyaAdapter: Partial<TuyaAdapter>;

  beforeAll(async () => {
    // Create test module with real services
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [/* AppModule or subset */],
      providers: [
        // Override TuyaAdapter with mock
        {
          provide: TuyaAdapter,
          useValue: mockTuyaAdapter,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    pollingService = moduleFixture.get<ThermostatPollingService>(ThermostatPollingService);
    prisma = moduleFixture.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Heating Start Flow', () => {
    it('should create HeatingEvent + BoilerHistory on device heating start', async () => {
      // Arrange: device with no active heating
      const device = await createTestDevice(prisma, { isHeating: false });

      // Mock Tuya snapshot: heating started
      mockTuyaAdapter.fetchSnapshot = jest.fn().mockResolvedValue({
        currentTemp: 20.5,
        targetTemp: 25.0,
        isHeating: true,
        flowTemp: 45.0,
      });

      // Act: trigger poll
      await pollingService.pollDevice(device, 'test_runId_001');

      // Assert: event created
      const event = await prisma.heatingEvent.findFirst({
        where: { deviceId: device.id },
      });
      expect(event).toBeDefined();
      expect(event!.timestampStart).toBeDefined();
      expect(event!.timestampEnd).toBeNull();
      expect(event!.roomCurrentTemp).toBe(20.5);
      expect(event!.roomTargetTemp).toBe(25.0);

      // Assert: boiler history linked
      const history = await prisma.boilerHistory.findFirst({
        where: { heatingEventId: event!.id },
      });
      expect(history).toBeDefined();
    });

    it('should prevent duplicate heating start within same minute', async () => {
      // Arrange: device with no active heating
      const device = await createTestDevice(prisma, { isHeating: false });
      const snapshot = {
        currentTemp: 20.5,
        targetTemp: 25.0,
        isHeating: true,
        flowTemp: 45.0,
      };

      mockTuyaAdapter.fetchSnapshot = jest.fn().mockResolvedValue(snapshot);

      // Act: first poll
      await pollingService.pollDevice(device, 'test_runId_001');
      const firstEventCount = await prisma.heatingEvent.count({
        where: { deviceId: device.id },
      });

      // Act: second poll in same minute
      await pollingService.pollDevice(device, 'test_runId_002');
      const secondEventCount = await prisma.heatingEvent.count({
        where: { deviceId: device.id },
      });

      // Assert: no duplicate created
      expect(secondEventCount).toBe(firstEventCount);
    });
  });

  describe('Heating End Flow', () => {
    it('should end active heating and log duration', async () => {
      // Arrange: device with active heating
      const device = await createTestDevice(prisma, { isHeating: true });
      const activeEvent = await prisma.heatingEvent.create({
        data: {
          deviceId: device.id,
          userId: device.userId,
          timestampStart: new Date(Date.now() - 12 * 60000), // 12 min ago
          roomCurrentTemp: 20.0,
          roomTargetTemp: 25.0,
          roomFlowTemp: 45.0,
        },
      });

      // Mock Tuya snapshot: heating stopped
      mockTuyaAdapter.fetchSnapshot = jest.fn().mockResolvedValue({
        currentTemp: 24.5,
        targetTemp: 25.0,
        isHeating: false,
        flowTemp: 40.0,
      });

      // Act: poll
      await pollingService.pollDevice(device, 'test_runId_003');

      // Assert: event ended
      const endedEvent = await prisma.heatingEvent.findUnique({
        where: { id: activeEvent.id },
      });
      expect(endedEvent!.timestampEnd).toBeDefined();
      expect(endedEvent!.durationMin).toBeCloseTo(12, 1); // ~12 minutes
    });
  });

  describe('Transaction Safety', () => {
    it('should rollback on DB constraint violation', async () => {
      // Arrange: create intentional constraint conflict
      const device = await createTestDevice(prisma);

      mockTuyaAdapter.fetchSnapshot = jest.fn().mockImplementation(async () => {
        throw new Error('DB constraint failure');
      });

      // Act: poll
      await pollingService.pollDevice(device, 'test_runId_004');

      // Assert: no partial state left behind
      const event = await prisma.heatingEvent.findFirst({
        where: { deviceId: device.id },
      });
      expect(event).toBeUndefined();
    });
  });
});

// Helper: Create test device with optional overrides
async function createTestDevice(
  prisma: PrismaService,
  overrides?: Partial<any>,
): Promise<any> {
  const user = await prisma.user.create({
    data: {
      email: `test_${Date.now()}@example.com`,
      password: 'hashed_pw',
      name: 'Test User',
    },
  });

  return prisma.thermostatDevice.create({
    data: {
      userId: user.id,
      deviceId: `test_device_${Date.now()}`,
      name: 'Test Device',
      isHeating: false,
      lastSnapshotAt: new Date(),
      ...overrides,
    },
  });
}
```

#### Dependencies & Libraries
- `@nestjs/testing` — NestJS test utilities (already in devDependencies)
- `jest` — test runner (already configured)
- For test DB: MariaDB Docker container OR SQLite in-memory
  - If Docker: `testcontainers` library for orchestration
  - If SQLite: Use `@sqlite/database` with test schema

#### Estimated Effort
- **Setup test DB + seed:** 2–3 hours
- **Write 3–4 core test cases:** 2–3 hours
- **Fix failures & edge cases:** 2–3 hours
- **Total:** ~6–9 hours

---

### P2b: Request Timeout + Circuit Breaker (Tuya Adapter)

#### Objective
Add resilience to Tuya API calls: automatic fallback on timeout, rate-limit recovery via circuit breaker, and request accounting for budget monitoring.

#### Acceptance Criteria

✅ **Timeout Protection:**
- [ ] All Tuya HTTP requests have 10s timeout (configurable via .env)
- [ ] Timeout error caught, logged with context, metric incremented
- [ ] Polling continues (no crash) — falls back to last known state

✅ **Circuit Breaker:**
- [ ] 3 consecutive failures → circuit opens for 60s (configurable)
- [ ] While open: requests fail fast without hitting Tuya (returns cached state)
- [ ] After 60s: circuit enters half-open, next request attempts recovery
- [ ] Success resets circuit to closed
- [ ] Metric: `tuya_circuit_breaker_trips` incremented on open

✅ **Request Accounting:**
- [ ] Counter: `tuya_requests_total` (all requests)
- [ ] Counter: `tuya_requests_success` (2xx responses)
- [ ] Counter: `tuya_requests_failed` (4xx/5xx errors)
- [ ] Counter: `tuya_requests_timeout` (timeout errors)
- [ ] Each counter tagged by endpoint (e.g., `fetchSnapshot`, `setDeviceProperty`)

✅ **Budget Monitoring (Daily Job):**
- [ ] Cron job (1x daily at 2 AM) calculates rolling 30-day Tuya usage
- [ ] If usage > 70% of 50k budget → log warning + send alert (Sentry, email, Slack)
- [ ] Metric: `tuya_budget_remaining_percent` exported via `/metrics`

✅ **Documentation:**
- [ ] `docs/tuya-api-resilience.md` explains circuit breaker, timeouts, budget limits
- [ ] Lists all configured thresholds (timeout, trips, open duration, budget%)

#### File(s) to Create/Modify

**Modify `backend/src/modules/Boiler/adapter/tuya.adapter.ts`**

```typescript
import * as opossum from 'opossum';
import { StructuredLogger } from '../../common/structured-logger';
import { MetricsService } from '../../common/metrics.service';

@Injectable()
export class TuyaAdapter {
  private circuitBreaker: any;

  constructor(
    private readonly logger: StructuredLogger,
    private readonly metricsService: MetricsService,
    private readonly configService: ConfigService,
  ) {
    // Circuit breaker: fail after 3 errors, open for 60s, half-open with 1 test request
    this.circuitBreaker = new opossum(
      (fn: () => Promise<any>) => fn(),
      {
        timeout: parseInt(process.env.TUYA_REQUEST_TIMEOUT_MS || '10000'),
        errorThresholdPercentage: 50, // Open if 50%+ fail
        resetTimeout: 60000, // Reset attempt after 60s
        name: 'tuya-adapter-circuit-breaker',
        fallback: this.handleCircuitBreakerFallback.bind(this),
      },
    );

    // Emulate circuit breaker events for metrics
    this.circuitBreaker.on('open', () => {
      this.metricsService.incrementCounter('tuya_circuit_breaker_trips');
      this.logger.warn('Tuya circuit breaker OPEN', {
        module: 'tuya-adapter',
        action: 'circuit_breaker_open',
      });
    });
  }

  async fetchSnapshot(deviceId: string, runId?: string): Promise<any> {
    const ctx = {
      deviceId,
      runId,
      module: 'tuya-adapter',
      action: 'fetch_snapshot',
    };

    try {
      this.metricsService.incrementCounter('tuya_requests_total');

      // Wrap call in circuit breaker
      const result = await this.circuitBreaker.fire(async () => {
        return await this.tuyaClient.request({
          method: 'GET',
          path: `/v1.0/iot-03/devices/${deviceId}/status`,
          timeout: parseInt(process.env.TUYA_REQUEST_TIMEOUT_MS || '10000'),
        });
      });

      this.metricsService.incrementCounter('tuya_requests_success');
      this.logger.log('Snapshot fetched', { ...ctx, deviceId });
      return result.data;
    } catch (error) {
      this.metricsService.incrementCounter('tuya_requests_failed');

      if (error.name === 'TimeoutError') {
        this.metricsService.incrementCounter('tuya_requests_timeout');
        this.logger.error('Tuya request timeout', { ...ctx, error: error.message });
      } else {
        this.logger.error('Tuya request failed', { ...ctx, error: error.message });
      }

      throw error;
    }
  }

  private handleCircuitBreakerFallback(): any {
    this.logger.warn('Circuit breaker fallback: returning cached state', {
      module: 'tuya-adapter',
      action: 'circuit_breaker_fallback',
    });
    // Return last known good state or null
    return this.lastKnownState || null;
  }
}
```

**Create `backend/src/modules/Boiler/jobs/tuya-budget-monitor.job.ts`** (~100 lines)

```typescript
@Injectable()
export class TuyaBudgetMonitorJob {
  constructor(
    private readonly metricsService: MetricsService,
    private readonly logger: StructuredLogger,
    private readonly notificationService: NotificationService,
  ) {}

  @Cron('0 2 * * *') // 2 AM daily
  async monitorBudget() {
    const totalRequests = this.metricsService.getCounter('tuya_requests_total');
    const budgetPerDay = 50000 / 30; // ~1,667 calls/day
    const budgetRemaining = 50000 - totalRequests;
    const percentRemaining = (budgetRemaining / 50000) * 100;

    this.metricsService.setGauge('tuya_budget_remaining_percent', percentRemaining);

    if (percentRemaining < 30) {
      this.logger.warn('Tuya budget critical', {
        module: 'tuya-budget-monitor',
        action: 'budget_critical',
        totalRequests,
        percentRemaining,
      });
      // Send alert via Sentry / email
      await this.notificationService.alertOps('Tuya API budget critical', {
        percentRemaining,
        totalRequests,
      });
    } else if (percentRemaining < 70) {
      this.logger.log('Tuya budget warning', {
        module: 'tuya-budget-monitor',
        action: 'budget_warning',
        totalRequests,
        percentRemaining,
      });
    }
  }
}
```

**Create `backend/docs/tuya-api-resilience.md`** (~50 lines)

```markdown
# Tuya API Resilience & Budget Management

## Request Timeout
- **Timeout:** 10 seconds per request (configurable via `TUYA_REQUEST_TIMEOUT_MS`)
- **Behavior:** If request exceeds timeout, error is caught, logged, and metric incremented
- **Fallback:** Polling continues; uses last known device state if timeout occurs

## Circuit Breaker Pattern
- **Configuration:**
  - Failure threshold: 3 consecutive errors
  - Open duration: 60 seconds
  - Half-open test: 1 request (if succeeds, circuit closes)

- **State Transitions:**
  - **Closed (normal):** Requests go through normally
  - **Open (failed):** All requests fail fast, use cached state, metric incremented
  - **Half-open (recovery):** Next request attempts recovery

## Budget Monitoring
- **Daily Check:** 2 AM UTC, calculates rolling 30-day Tuya usage
- **Budget:** 50,000 calls/month (~1,667/day)
- **Alerts:**
  - < 70%: Warning logged
  - < 30%: Critical alert sent to ops channel

## Metrics Exported
- `tuya_requests_total` — all requests
- `tuya_requests_success` — successful (2xx)
- `tuya_requests_failed` — failed (4xx/5xx)
- `tuya_requests_timeout` — timeout errors
- `tuya_circuit_breaker_trips` — circuit breaker activations
- `tuya_budget_remaining_percent` — budget remaining
```

#### Dependencies
- `opossum` — circuit breaker library
  ```bash
  npm install opossum
  npm install --save-dev @types/opossum
  ```

#### Environment Variables
```env
TUYA_REQUEST_TIMEOUT_MS=10000          # 10 second timeout
TUYA_CIRCUIT_BREAKER_FAILURES=3        # Fail after 3 errors
TUYA_CIRCUIT_BREAKER_RESET_MS=60000    # Reset after 60 seconds
TUYA_BUDGET_WARNING_PERCENT=70         # Warn at 70% usage
TUYA_BUDGET_CRITICAL_PERCENT=30        # Critical at 30% usage
```

#### Estimated Effort
- **Implement circuit breaker + timeouts:** 3–4 hours
- **Budget monitoring job + alerts:** 2–3 hours
- **Testing + integration:** 2–3 hours
- **Documentation:** 1 hour
- **Total:** ~8–11 hours

---

### P2c: Structured Logging Expansion (Tuya Adapter + Anomaly Checker)

#### Objective
Extend structured logging with correlation IDs and contextual fields across Tuya adapter and anomaly detection modules.

#### Acceptance Criteria

✅ **Tuya Adapter Logging:**
- [ ] All requests logged with: `deviceId`, `endpoint`, `requestId`, `duration`, `statusCode`
- [ ] Errors include: error type, message, circuit breaker state
- [ ] Example log: `"Tuya request" [deviceId=1] [endpoint=fetchSnapshot] [duration=245ms] [statusCode=200] [runId=poll_123]`

✅ **Anomaly Checker Logging:**
- [ ] Detection event logged: `"Anomaly detected" [deviceId=1] [userId=5] [anomalyType=unusual_heating_duration] [runId=poll_123]`
- [ ] Decision logged: `"Anomaly skipped (threshold not met)" [deviceId=1]`
- [ ] Notification sent logged: `"Anomaly notification sent" [eventId=42] [notificationId=123]`

✅ **Correlation ID Propagation:**
- [ ] `runId` from polling cycle passed to Tuya adapter
- [ ] `runId` passed to anomaly checker
- [ ] All logs within same poll cycle share same `runId` for traceability

✅ **No Performance Degradation:**
- [ ] Logging async (non-blocking)
- [ ] No extra Tuya calls or DB queries for logging

#### File(s) to Modify

**Modify `backend/src/modules/Boiler/adapter/tuya.adapter.ts`**

```typescript
export class TuyaAdapter {
  constructor(
    private readonly logger: StructuredLogger,
    private readonly metricsService: MetricsService,
  ) {}

  async fetchSnapshot(deviceId: string, runId?: string): Promise<any> {
    const startTime = Date.now();
    const ctx = {
      deviceId,
      runId,
      module: 'tuya-adapter',
      action: 'fetch_snapshot',
      endpoint: 'fetchSnapshot',
    };

    try {
      this.logger.log('Fetching Tuya snapshot', ctx);

      const result = await this.tuyaClient.request({
        /* ... */
      });

      const duration = Date.now() - startTime;
      this.logger.log('Tuya snapshot fetched', {
        ...ctx,
        statusCode: 200,
        duration,
      });

      return result.data;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error('Tuya request failed', {
        ...ctx,
        statusCode: error.statusCode || 500,
        duration,
        errorMessage: error.message,
      });

      throw error;
    }
  }
}
```

**Modify `backend/src/modules/HeatingAnomalyCheckerService/heating.anomaly.checker.service.ts`**

```typescript
export class HeatingAnomalyCheckerService {
  constructor(
    private readonly logger: StructuredLogger,
    private readonly metricsService: MetricsService,
    private readonly notificationService: NotificationService,
  ) {}

  async checkAndFlagAnomaly(event: HeatingEvent, runId?: string): Promise<void> {
    const ctx = {
      deviceId: event.deviceId,
      userId: event.userId,
      eventId: event.id,
      runId,
      module: 'anomaly-checker',
      action: 'anomaly_check',
    };

    const durationMin = event.durationMin || 0;
    const isAnomaly = this.detectAnomaly(event);

    if (isAnomaly) {
      this.metricsService.incrementCounter('anomalies_detected');
      this.logger.log('Anomaly detected', {
        ...ctx,
        action: 'anomaly_detected',
        anomalyType: 'unusual_heating_duration',
        durationMin,
      });

      const notification = await this.notificationService.notifyAnomaly(event);
      this.logger.log('Anomaly notification sent', {
        ...ctx,
        notificationId: notification?.id,
      });
    } else {
      this.logger.debug('Anomaly check: threshold not met', {
        ...ctx,
        action: 'anomaly_skipped',
        durationMin,
      });
    }
  }
}
```

#### Estimated Effort
- **Tuya adapter logging:** 1–2 hours
- **Anomaly checker logging:** 1–2 hours
- **Testing log output:** 1 hour
- **Documentation:** 30 minutes
- **Total:** ~3–5 hours

---

### P2d: Performance Baseline Metrics (Query Latency + API Response Time)

#### Objective
Collect and baseline performance metrics to identify slow queries and establish SLOs for API endpoints.

#### Acceptance Criteria

✅ **Metrics Collected:**
- [ ] DB query latency: `db_query_duration_seconds` (histogram, p50/p95/p99)
- [ ] Polling cycle time: `poll_cycle_duration_seconds`
- [ ] API endpoint latency: `http_request_duration_seconds` (by route)
- [ ] Tuya request latency: `tuya_request_duration_seconds`

✅ **Prometheus Histograms:**
```
# HELP db_query_duration_seconds Database query latency
# TYPE db_query_duration_seconds histogram
db_query_duration_seconds_bucket{le="0.01",query="findFirst"} 10
db_query_duration_seconds_bucket{le="0.05",query="findFirst"} 48
db_query_duration_seconds_bucket{le="0.1",query="findFirst"} 50
db_query_duration_seconds_bucket{le="+Inf",query="findFirst"} 50
db_query_duration_seconds_sum{query="findFirst"} 1.234
db_query_duration_seconds_count{query="findFirst"} 50
```

✅ **Baseline Documentation:**
- [ ] `docs/performance-baseline.md` records initial metrics (p50, p95, p99)
- [ ] Polling cycle: target < 5 seconds (per device)
- [ ] API endpoint: target < 200ms (p95)
- [ ] Tuya request: target < 3 seconds (p95)

✅ **Monitoring Integration:**
- [ ] Prometheus scrape config for histograms
- [ ] Grafana dashboard template with latency percentiles
- [ ] Alert rule: if p95 > 2x baseline → send alert

#### File(s) to Create

**Create `backend/src/common/metrics-interceptor.ts`** (~100 lines)

```typescript
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.getRequest();
    const { method, path } = request;
    const startTime = Date.now();

    return next.handle().pipe(
      tap(() => {
        const duration = (Date.now() - startTime) / 1000; // seconds
        this.metricsService.recordHistogram('http_request_duration_seconds', duration, {
          method,
          path,
        });
      }),
    );
  }
}
```

**Modify `backend/src/prisma/prisma.service.ts`** to track query latency

```typescript
export class PrismaService extends PrismaClient {
  constructor(private readonly metricsService: MetricsService) {
    super();

    this.$use(async (params, next) => {
      const startTime = Date.now();
      const result = await next(params);
      const duration = (Date.now() - startTime) / 1000; // seconds

      // Record histogram
      this.metricsService.recordHistogram('db_query_duration_seconds', duration, {
        model: params.model,
        action: params.action,
      });

      return result;
    });
  }
}
```

**Create `backend/docs/performance-baseline.md`** (~100 lines)

```markdown
# Performance Baseline Report (Batch 3)

## Collected Metrics (Prometheus)

### Database Queries
- **p50:** 5ms (median)
- **p95:** 45ms
- **p99:** 120ms

Slow queries (> 100ms):
- `HeatingIntervalLearning.findMany` (includes profile & learnings merge)
- `Recommendation.findMany` (joins with heating event)

Optimization candidates:
- Add index on `heatingEvent(deviceId, timestampStart DESC)`
- Cache interval learning in Redis

### Polling Cycle Time
- **p50:** 1.2s (per device)
- **p95:** 3.5s
- **p99:** 8.2s

With 3 devices: ~3.6s p95 per cycle

### API Endpoints
- `POST /api/auth/login`: p95 = 150ms
- `GET /api/dashboard`: p95 = 320ms (multiple queries)
- `GET /api/heating-events`: p95 = 280ms

### Tuya Requests
- **p50:** 800ms
- **p95:** 2.1s
- **p99:** 4.5s

## SLOs Recommended

| Metric | p95 Target | Alert Threshold |
|--------|-----------|-----------------|
| Polling cycle | 5s | > 10s |
| API endpoint | 200ms | > 400ms |
| Tuya request | 3s | > 5s |

## Next Steps

1. Monitor baselines over 1 week
2. If consistent, set alerts for 2x baseline
3. Identify slow queries and optimize
```

#### Dependencies
- Already using Prometheus; add histogram support to `MetricsService`

#### Estimated Effort
- **Metrics interceptor + DB logging:** 2–3 hours
- **Histogram implementation in MetricsService:** 1–2 hours
- **Prometheus config + Grafana dashboard:** 2–3 hours
- **Baseline collection + documentation:** 2–3 hours
- **Total:** ~7–11 hours

---

## Timeline & Dependencies

### Sequential Order (Recommended)

1. **P2a (Integration Tests)** — 6–9 hours
   - Blocks nothing; can run in parallel with others
   - Validates Batch 2 changes (idempotency, transactions)

2. **P2c (Structured Logging)** — 3–5 hours
   - Depends on: existing Batch 2 logging (ready)
   - Can run in parallel with P2b

3. **P2b (Circuit Breaker)** — 8–11 hours
   - Depends on: existing Tuya adapter
   - Can run in parallel with P2c

4. **P2d (Performance Metrics)** — 7–11 hours
   - Depends on: existing MetricsService
   - Can run after others or in parallel

### Parallelization Suggestion

**Phase 1 (Week 1):** P2a + P2c (9 hours total)
- Integration tests scaffold and execution
- Logging expansion in adapter and anomaly checker

**Phase 2 (Week 2):** P2b + P2d (18–22 hours total)
- Circuit breaker + budget monitoring
- Performance baselines + monitoring setup

**Total Batch 3:** ~33–48 hours (4–6 work days)

---

## Integration with Batch 2

### Batch 2 Foundations (Already Complete)

| Feature | File | Used By Batch 3 |
|---------|------|-----------------|
| Structured logging + LogContext | `src/common/structured-logger.ts` | P2c (extend) |
| Prometheus metrics | `src/common/metrics.service.ts` | P2a, P2d (extend) |
| Transactional wrapping | `src/modules/ThermostatPoll/thermostat.polling.service.ts` | P2a (validate) |
| Idempotency check | `src/modules/ThermostatPoll/thermostat.polling.service.ts` | P2a (validate) |

### No Breaking Changes

All Batch 3 changes are **backward compatible**:
- New parameters optional (e.g., `runId`)
- Metrics are additive (new counters)
- Logging is non-blocking
- Circuit breaker transparent to callers

---

## Acceptance & Sign-Off

### Prerequisites for Batch 3 Start

✅ Batch 2 complete and verified
✅ Backend running without DI errors
✅ TypeScript compilation: 0 errors
✅ Batch 2 documentation created

### Batch 3 Completion Criteria

- [ ] All P2a integration tests pass (transaction validation)
- [ ] All P2b timeout/circuit-breaker tests pass (resilience validation)
- [ ] All P2c logs include correlation IDs and context
- [ ] All P2d metrics collected and documented
- [ ] Batch 3 summary document created with results
- [ ] No regressions in Batch 2 features
- [ ] Backend still boots with zero errors

### Sign-Off Checklist

- [ ] Code review: logic, error handling, test coverage
- [ ] Integration testing: verify in staging environment
- [ ] Performance testing: confirm no degradation vs. Batch 2
- [ ] Documentation review: clarity and completeness
- [ ] Ready for production rollout

---

## Risk & Mitigation

### Risk 1: Test DB Setup Complexity
**Mitigation:** Use Docker testcontainers for isolated, reproducible test environments.

### Risk 2: Circuit Breaker False Positives
**Mitigation:** Tune thresholds (3 failures, 60s reset) based on observed Tuya error rates; monitor closely.

### Risk 3: Performance Overhead from Metrics
**Mitigation:** Use in-memory histograms; no external calls for metrics recording.

### Risk 4: Logging Volume Explosion
**Mitigation:** Use structured logging with sampling for high-frequency events; keep logs async.

---

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Integration test pass rate | 100% | Test suite run |
| Circuit breaker activation | < 5 times/day | Logs + metrics |
| API latency p95 | < 200ms | Prometheus |
| Polling cycle time p95 | < 5s | Metrics histogram |
| Log volume | < 100MB/day | Log retention storage |

---

## Next Steps

1. **User Confirmation:** Review this plan, provide feedback
2. **Start P2a:** Scaffold test DB and first integration test
3. **Parallel P2c:** Add logging to Tuya adapter and anomaly checker
4. **Review & Merge:** Code review, testing, Batch 3 summary

**Await User Confirmation to Proceed with Implementation.**

---

## Document Version

- **Version:** 1.0
- **Date:** February 1, 2026
- **Status:** Planning (Ready for Implementation)
- **Batch:** 3 (P2a–P2d)
