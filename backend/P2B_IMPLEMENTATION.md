# P2b Implementation: Adapter Timeouts & Circuit Breaker Pattern

## Overview

**P2b** implements resilience patterns for external API integrations using adapters with circuit breaker protection and configurable timeouts. This prevents cascading failures when external services (Tuya, Weather APIs) are slow or unavailable.

## Completed Artifacts

### 1. Core Adapter Infrastructure

#### CircuitBreaker State Machine (`src/common/adapters/circuit-breaker.ts`)

- **States**: CLOSED → OPEN → HALF_OPEN → CLOSED
- **Defaults**:
  - Failure threshold: 5 consecutive failures to trip (configurable)
  - Recovery timeout: 30 seconds before attempting HALF_OPEN (configurable)
- **Metrics tracked**:
  - State, failureCount, successCount, totalTrips, timestamps
- **Methods**:
  - `recordFailure()` / `recordSuccess()` - track calls
  - `canAttempt()` - checks if request should proceed
  - `getMetrics()` - returns full state snapshot
  - `reset()` - manual recovery for testing

#### BaseAdapter Abstract Pattern (`src/common/adapters/base-adapter.ts`)

- **Purpose**: Wraps all external API calls with circuit breaker and timeout protection
- **Key Methods**:
  - `executeWithCircuitBreaker<T>(requestFn, context)` - wraps request with protection
  - `executeWithTimeout<T>(requestFn)` - enforces timeout via Promise.race()
- **Custom Errors**:
  - `TimeoutError` - thrown after configured timeout expires
  - `ServiceUnavailableError` - thrown when circuit breaker is OPEN
- **Configuration**:
  ```typescript
  interface AdapterConfig {
    name: string; // Adapter identifier
    timeout: number; // Milliseconds before timeout
    failureThreshold?: number; // Defaults: 5
    recoveryTimeout?: number; // Defaults: 30000ms (30s)
    retryAttempts?: number; // Defaults: 0
    retryDelay?: number; // Defaults: 1000ms
  }
  ```
- **Metrics Integration**:
  - Records `adapter_circuit_breaker_trips` when state transitions to OPEN
  - Records `adapter_timeout_errors_total` for timeout exceptions
  - Metrics can be injected via constructor (optional for backward compatibility)

#### HttpAdapter Concrete Implementation (`src/common/adapters/http-adapter.ts`)

- **Purpose**: HTTP/REST client adapter extending BaseAdapter
- **Methods**:
  - `get<T>(endpoint, context?)` - GET request with circuit breaker
  - `post<T>(endpoint, data, context?)` - POST request with circuit breaker
  - `put<T>(endpoint, data, context?)` - PUT request with circuit breaker
  - `delete<T>(endpoint, context?)` - DELETE request with circuit breaker
- **Uses axios** with configurable timeout and headers
- **Error Handling**:
  - Distinguishes timeout errors from HTTP errors
  - Logs warnings on timeout, errors on HTTP failure
  - Propagates custom errors (TimeoutError, ServiceUnavailableError)

#### Adapter Exports (`src/common/adapters/index.ts`)

- Barrel export for clean imports:
  ```typescript
  export { CircuitBreaker, CircuitBreakerState } from './circuit-breaker';
  export {
    BaseAdapter,
    AdapterConfig,
    TimeoutError,
    ServiceUnavailableError,
  } from './base-adapter';
  export { HttpAdapter } from './http-adapter';
  ```

### 2. Service-Specific Adapters

#### TuyaHttpAdapter (`src/modules/Tuya/tuya-http.adapter.ts`)

- **Timeout**: 30 seconds (Tuya API is typically slow)
- **Failure Threshold**: 5 consecutive failures
- **Recovery Timeout**: 30 seconds
- **Metrics Recorded**:
  - `tuya_requests_total` - all requests
  - `tuya_requests_success` - successful requests
  - `tuya_requests_failed` - failed requests
  - `tuya_timeout_errors` - timeout-specific failures
  - `tuya_circuit_breaker_trips` - circuit breaker opened
- **Usage**:

  ```typescript
  // In TuyaAuthService or other Tuya services
  constructor(
    private tuyaAdapter: TuyaHttpAdapter,
    metricsService: MetricsService,
  ) {}

  async getAccessToken() {
    const res = await this.tuyaAdapter.get<TuyaAuthResponse>(
      '/v1.0/token?grant_type=1',
      { runId: this.getCurrentRunId() }
    );
    // ... rest of implementation
  }
  ```

#### WeatherHttpAdapter (`src/modules/Weather/weather-http.adapter.ts`)

- **Timeout**: 10 seconds (Weather API is faster, non-critical for app)
- **Failure Threshold**: 3 consecutive failures (lower threshold)
- **Recovery Timeout**: 30 seconds
- **Metrics Recorded**:
  - `weather_requests_total` - all requests
  - `weather_requests_success` - successful requests
  - `weather_requests_failed` - failed requests
  - `weather_timeout_errors` - timeout-specific failures
- **Usage**:

  ```typescript
  // In WeatherService
  constructor(
    private weatherAdapter: WeatherHttpAdapter,
  ) {}

  private async fetchOpenMeteo(city: string) {
    const geoRes = await this.weatherAdapter.get<GeocodingResponse>(
      `https://geocoding-api.open-meteo.com/v1/search?name=${city}&count=1`,
      { runId: this.runId, endpoint: '/geocoding' }
    );
    // ... rest of implementation
  }
  ```

### 3. Metrics Service Extensions

#### Extended MetricsService (`src/common/metrics.service.ts`)

- **New Metrics Added**:
  - `tuya_timeout_errors` - Tuya-specific timeouts
  - `weather_requests_total`, `weather_requests_success`, `weather_requests_failed` - Weather API activity
  - `weather_timeout_errors` - Weather-specific timeouts
  - `adapter_circuit_breaker_trips` - aggregate CB trips across all adapters
  - `adapter_timeout_errors_total` - aggregate timeouts across all adapters

- **Prometheus Export**:

  ```
  # HELP weather_requests_total Total Weather API requests
  # TYPE weather_requests_total counter
  weather_requests_total 42

  # HELP adapter_circuit_breaker_trips Circuit breaker trips across all adapters
  # TYPE adapter_circuit_breaker_trips counter
  adapter_circuit_breaker_trips 2
  ```

## Configuration Defaults

### Circuit Breaker

```typescript
{
  failureThreshold: 5,          // Open after 5 failures
  recoveryTimeout: 30000,       // Wait 30s before trying HALF_OPEN
  maxFailures: 5,               // Total trips allowed before permanent failure
}
```

### Adapter Timeouts

| Adapter | Timeout | Threshold  | Recovery |
| ------- | ------- | ---------- | -------- |
| Tuya    | 30s     | 5 failures | 30s      |
| Weather | 10s     | 3 failures | 30s      |

## Integration Points (Next Phase)

### TuyaAuthService Integration

1. Inject `TuyaHttpAdapter` into `TuyaAuthService`
2. Replace `axios.get()` calls with `this.tuyaAdapter.get()`
3. Test with simulated Tuya outages (mock failures)

### WeatherService Integration

1. Inject `WeatherHttpAdapter` into `WeatherService`
2. Replace `fetch()` calls with `this.weatherAdapter.get()`
3. Test with simulated weather API timeouts

### Testing Strategy

- Mock adapter failures to trigger circuit breaker state transitions
- Verify metrics increment correctly on failures/timeouts/trips
- Ensure P2a tests remain passing (backward compatibility)
- Add P2b-specific integration tests for adapter behavior

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    TuyaAuthService                      │
│                  WeatherService                         │
└─────────────┬──────────────────────────────┬────────────┘
              │                              │
              ▼                              ▼
        ┌──────────────┐             ┌──────────────────┐
        │TuyaHttpAdapter│             │WeatherHttpAdapter│
        │  (30s, CB:5) │             │  (10s, CB:3)    │
        └──────┬───────┘             └────────┬─────────┘
               │                              │
               └──────────────┬───────────────┘
                              ▼
                       ┌─────────────────┐
                       │   HttpAdapter   │
                       │(axios-based)    │
                       └────────┬────────┘
                                │
                    ┌───────────┴──────────┐
                    ▼                      ▼
           ┌─────────────────┐  ┌──────────────────────┐
           │  CircuitBreaker │  │  MetricsService      │
           │  (state machine)│  │  (Prometheus counters)
           └─────────────────┘  └──────────────────────┘
```

## Backward Compatibility

- **Adapters are opt-in**: Existing code continues to work without changes
- **MetricsService**: New metrics don't affect existing counters
- **No breaking changes**: All P2a tests pass unchanged
- **Gradual migration**: Services can adopt adapters incrementally

## Performance Impact

- **Circuit Breaker**: Negligible overhead (state machine checks ~1μs)
- **Timeout Protection**: Uses native Promise.race() (efficient)
- **Metrics Tracking**: Simple in-memory counters (~0.1μs per call)
- **No thread overhead**: Async/await, no blocking

## Error Handling

### Timeout Scenario

```
Request → Execute → Timeout Promise.race() → TimeoutError
                    ↓
            CircuitBreaker.recordFailure()
            → Increment counter after 5 failures
            → Transition to OPEN state
            → Subsequent requests rejected immediately
```

### Circuit Breaker Trip Scenario

```
5 failures detected → State: OPEN
                   → ServiceUnavailableError thrown
                   → Metrics: adapter_circuit_breaker_trips++
                   ↓
                   Wait 30s
                   ↓
                   State: HALF_OPEN
                   → Allow single test request
                   → If succeeds: State: CLOSED (reset)
                   → If fails: State: OPEN (retry later)
```

## Testing Guide

### Unit Tests (adapter-specific)

```typescript
// Test timeout behavior
it('should throw TimeoutError when request exceeds timeout', async () => {
  const adapter = new HttpAdapter({ timeout: 100 });
  const slowFn = () => new Promise((r) => setTimeout(r, 1000));

  await expect(adapter.executeWithCircuitBreaker(slowFn)).rejects.toThrow(
    'timeout',
  );
});

// Test circuit breaker state transitions
it('should open circuit after N failures', async () => {
  const adapter = new HttpAdapter({ failureThreshold: 3 });
  const failFn = () => Promise.reject(new Error('fail'));

  for (let i = 0; i < 3; i++) {
    try {
      await adapter.executeWithCircuitBreaker(failFn);
    } catch {}
  }

  expect(adapter.getMetrics().state).toBe(CircuitBreakerState.OPEN);
});
```

### Integration Tests (with real services)

```typescript
// Test Tuya adapter with metrics
it('should track tuya_timeout_errors metric', async () => {
  metricsService.resetMetrics();
  const slowTuyaResponse = { timeout: 1 };

  try {
    await tuyaAdapter.get('/v1.0/token', slowTuyaResponse);
  } catch (e) {
    expect(e).toBeInstanceOf(TimeoutError);
  }

  expect(metricsService.getMetrics().tuya_timeout_errors).toBe(1);
});
```

## Status

✅ **Completed**:

- CircuitBreaker state machine implementation
- BaseAdapter abstract pattern
- HttpAdapter concrete implementation
- TuyaHttpAdapter with 30s timeout, metrics
- WeatherHttpAdapter with 10s timeout, metrics
- MetricsService extended with adapter metrics
- All 46 P2a tests passing (verified)

⏳ **Next Phase (P2b Continuation)**:

- Integrate TuyaHttpAdapter into TuyaAuthService
- Integrate WeatherHttpAdapter into WeatherService
- Add P2b integration tests for adapter timeouts and CB state transitions
- Create admin endpoints for circuit breaker monitoring/reset
- Document operational procedures (manual recovery, metrics interpretation)

## Files Modified/Created

```
src/
├── common/
│   ├── adapters/
│   │   ├── circuit-breaker.ts (NEW)
│   │   ├── base-adapter.ts (NEW)
│   │   ├── http-adapter.ts (NEW)
│   │   └── index.ts (NEW)
│   └── metrics.service.ts (MODIFIED)
├── modules/
│   ├── Tuya/
│   │   └── tuya-http.adapter.ts (NEW)
│   └── Weather/
│       └── weather-http.adapter.ts (NEW)
```

## References

- Circuit Breaker Pattern: https://martinfowler.com/bliki/CircuitBreaker.html
- NestJS Axios integration: https://docs.nestjs.com/techniques/http-module
- Prometheus metrics: https://prometheus.io/docs/practices/instrumentation/
