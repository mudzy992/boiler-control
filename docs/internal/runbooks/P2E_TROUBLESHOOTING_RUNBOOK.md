# P2e Troubleshooting Runbook

**Purpose**: Quick reference for common issues and resolution steps
**For**: On-call engineer, DevOps, Operations team
**Date**: February 2, 2026

---

## 🚨 Issue: Correlation IDs Not Appearing in Logs

### Severity
⚠️ **Warning** - Observability degraded but system still operational

### Symptoms
- Backend logs don't show correlation IDs
- Distributed tracing impossible
- Frontend console shows X-Correlation-ID header but backend doesn't log it

### Root Causes
1. StructuredLogger not properly injected
2. Correlation ID service not initialized
3. Request middleware not running
4. Wrong log format

### Resolution Steps

**Step 1: Verify StructuredLogger Initialization** (5 min)
```bash
# Check if StructuredLogger has CorrelationIdService injected
grep -r "StructuredLogger" src/ --include="*.ts" | grep -i "inject"
# Expected output: @Inject(CorrelationIdService)

# Verify in service
cat src/common/structured-logger.ts | grep -A5 "constructor"
# Expected: CorrelationIdService parameter
```

**Step 2: Check Request Middleware** (5 min)
```bash
# Verify middleware is registered
grep -r "middleware" src/app.module.ts
# Expected: CorrelationIdMiddleware or RequestIdMiddleware

# Check middleware exists
ls -la src/common/middleware/
# Expected: correlation-id.middleware.ts exists
```

**Step 3: Review Log Format** (5 min)
```bash
# Check backend logs in real-time
npm run start:dev 2>&1 | grep -i "correlation"

# Make a test request in another terminal
curl -H "X-Correlation-ID: test-123" http://localhost:3020/api/dashboard

# Check if correlation ID appears
# Expected log line: "...test-123... Processing dashboard request"
```

**Step 4: Verify AsyncLocalStorage State** (5 min)
```bash
# Check correlation-id.service.ts for setRunId implementation
cat src/common/correlation-id.service.ts | grep -A3 "setRunId()"
# Expected: asyncLocalStorage.enterWith(...)

# Check getRunId implementation
cat src/common/correlation-id.service.ts | grep -A3 "getRunId()"
# Expected: asyncLocalStorage.getStore()
```

**Step 5: Debug Logging Method** (10 min)

Add temporary debug logging:
```typescript
// In src/common/structured-logger.ts, add:
constructor(
  @Inject(CorrelationIdService)
  private correlationIdService: CorrelationIdService,
) {
  console.log('✅ StructuredLogger initialized with CorrelationIdService');
}

log(message: string, context?: string) {
  const correlationId = this.correlationIdService?.getRunId();
  console.log(`DEBUG: correlationId = ${correlationId}`);
  // ... rest of method
}
```

Then restart: `npm run start:dev`

**Step 6: Check Application Logs** (5 min)
```bash
# Look for specific correlation ID in logs
CORR_ID="abc-123-def"
grep "$CORR_ID" app.log
# Should find multiple entries with same ID across services

# If nothing found:
# - Correlation ID may not be generating
# - Check Step 7
```

**Step 7: Verify ID Generation** (5 min)
```bash
# Check UUID generation in correlation-id.service.ts
cat src/common/correlation-id.service.ts | grep -i "uuid\|randomUUID"
# Expected: Using v4() from uuid library or crypto.randomUUID()

# Test ID generation in isolation
node -e "console.log(require('crypto').randomUUID())"
# Should output valid UUID
```

### Escalation
If still not working:
1. Check git log for recent changes to CorrelationIdService
2. Review unit tests: `npm test -- correlation-id.service.spec.ts`
3. Compare with backup: `git diff HEAD~1 src/common/correlation-id.service.ts`

---

## 🚨 Issue: Metrics Endpoint Returning Empty or 404

### Severity
⚠️ **Warning** - Monitoring unavailable but system operational

### Symptoms
- `curl http://localhost:3020/metrics` returns 404
- Prometheus scrape job failing
- `/metrics/reporting` endpoint unavailable
- Grafana dashboard shows "No data"

### Root Causes
1. Metrics controller not registered
2. Prom client not initialized
3. Middleware not applied to metrics routes
4. Wrong port/URL

### Resolution Steps

**Step 1: Verify Metrics Controller Exists** (5 min)
```bash
# Check if controller exists
ls -la src/common/metrics.controller.ts
# Expected: File exists

# Check if registered in app.module.ts
grep -i "MetricsController" src/app.module.ts
# Expected: MetricsController in imports/controllers
```

**Step 2: Test Metrics Endpoint Directly** (5 min)
```bash
# Test from localhost
curl -v http://localhost:3020/metrics
# Expected: 200 OK, Prometheus format text

# If 404:
curl -v http://localhost:3020/health
# Should be 200. If both 404, controller not registered.
```

**Step 3: Check Prom Client Initialization** (5 min)
```bash
# Verify metrics are being registered
grep -r "register\|collectDefaultMetrics" src/ --include="*.ts"
# Expected: Multiple matches for prom client usage

# Check package.json for dependency
cat package.json | grep prom
# Expected: "prom-client": "^15.0.0" (or similar)
```

**Step 4: Review Application Logs** (5 min)
```bash
# Start dev server with debug
NODE_DEBUG=* npm run start:dev 2>&1 | grep -i "metric"

# Make test request
curl http://localhost:3020/metrics 2>&1 | head -20

# Check for errors in output
# Expected: Valid Prometheus format text starting with "# HELP"
```

**Step 5: Verify Port Configuration** (5 min)
```bash
# Check if server is running on correct port
netstat -tlnp 2>/dev/null | grep node
# Or on Windows PowerShell:
netstat -ano | findstr :3020
# Expected: Shows PID listening on port 3020

# If not on 3020, check .env or config
cat .env | grep PORT
cat src/main.ts | grep listen
# Expected: Port 3020 configured
```

**Step 6: Check Prometheus Config** (5 min)
```bash
# Verify Prometheus config points to correct URL
cat docs/internal/monitoring/prometheus.yml | grep -A3 "backend-metrics"
# Expected: targets: ['localhost:3020']

# Verify metrics path
cat docs/internal/monitoring/prometheus.yml | grep metrics_path
# Expected: '/metrics'
```

**Step 7: Test with Prometheus CLI** (10 min)
```bash
# If Prometheus is running, check scrape status
curl http://localhost:9090/api/v1/targets
# Should list backend-metrics job with status "up"

# Check recent scrapes
curl http://localhost:9090/api/v1/targets?state=active
# Look for your backend in the list
```

### Escalation
If still not working:
1. Check git log: `git log --oneline src/common/metrics* | head -5`
2. Restore from backup: `git checkout HEAD~1 src/common/metrics.controller.ts`
3. Rebuild and restart: `npm run build && npm run start`

---

## 🚨 Issue: API Response Time Degraded (> 200ms p95)

### Severity
⚠️ **Warning** - User experience may be impacted

### Symptoms
- API requests taking > 200ms (slow)
- Grafana dashboard p95 latency chart red
- Users report slow page loads
- Prometheus shows histogram_quantile(0.95) > 200ms

### Root Causes
1. High database load
2. Slow queries
3. Memory pressure (GC pauses)
4. Network issues
5. CPU saturation

### Resolution Steps

**Step 1: Check Current Metrics** (5 min)
```bash
# Check p95 latency
curl http://localhost:3020/metrics | grep "http_request_duration_ms_bucket"
# Look for increasing buckets

# Check memory usage
curl http://localhost:3020/metrics | grep "nodejs_memory_usage_bytes"
# Convert to MB: value / 1024 / 1024

# Check request rate
curl http://localhost:3020/metrics | grep "http_requests_total" | head -5
```

**Step 2: Correlate with Recent Changes** (5 min)
```bash
# Check recent code changes
git log --oneline -10
# Any recent changes to:
# - Database queries
# - API endpoints
# - Middleware
# - Logging

# Review diff if suspicious commit found
git show <commit-sha> | head -50
```

**Step 3: Check System Resources** (5 min)
```bash
# CPU usage
top -b -n 1 | head -15
# Look for: %CPU column (should be < 50%)

# Memory usage
free -h
# Or on Windows: Get-Process | Where {$_.ProcessName -match 'node'} | Select WorkingSet

# Disk I/O
iostat -x 1 5
# Look for await time (should be < 10ms)
```

**Step 4: Identify Slow Queries** (10 min)

Using correlation IDs:
```bash
# Find all slow requests (> 200ms)
grep "duration.*[2-9][0-9][0-9]\|[1-9][0-9]{3}" app.log | head -10

# Extract correlation ID
grep "duration.*[2-9][0-9][0-9]" app.log | grep -oE "[a-f0-9]{8}-[a-f0-9]{4}" | head -1
# Example: f47ac10b-58cc

# Trace full request
grep "f47ac10b-58cc" app.log
# See what the request did
```

**Step 5: Analyze Database Slow Log** (10 min)
```bash
# If using PostgreSQL with slow query log:
grep "duration: [2-9][0-9]{2}" /var/log/postgresql/postgresql.log
# Look for duration > 200ms

# Or check Prisma logs:
grep "PrismaClient.*duration" app.log | tail -10
```

**Step 6: Check for Memory Pressure** (5 min)
```bash
# Check heap usage trend
curl http://localhost:3020/metrics | grep "nodejs_heap_space_used_bytes"
# If increasing, possible memory leak

# Check GC activity
node --expose-gc -e "setInterval(() => { gc(); }, 5000)" &
npm run start:dev
# Monitor if GC pauses improve latency
```

**Step 7: Compare to Baseline** (5 min)
```bash
# Run 100 requests and measure
ab -n 100 http://localhost:3020/api/dashboard 2>&1 | grep -E "Time per request|Requests per second"

# Compare to BASELINE_METRICS.md:
# - p50 should be ~30ms
# - p95 should be ~80ms
# - p99 should be ~150ms

# If significantly higher, investigate root cause
```

**Step 8: Increase Logging** (5 min)
```typescript
// Add to structured-logger.ts or query service
const startTime = Date.now();
// ... execute query
const duration = Date.now() - startTime;
if (duration > 100) {
  logger.warn(`SLOW_QUERY: ${duration}ms`, { correlationId });
}
```

Restart and monitor:
```bash
npm run start:dev 2>&1 | grep SLOW_QUERY
```

### Escalation
1. If consistently > 300ms: May need database optimization
2. If spikes to 500ms+: Check for lock contention
3. If memory growing: Investigate memory leak
4. If CPU high: Check for N+1 query problems

---

## 🚨 Issue: Memory Usage Increasing (Possible Memory Leak)

### Severity
🔴 **Critical** - Will eventually cause out-of-memory crash

### Symptoms
- Prometheus shows nodejs_memory_usage_bytes increasing
- Never goes down (even after requests complete)
- Grafana memory usage chart: line going up
- Eventually app crashes with "FATAL ERROR: CALL_AND_RETRY_LAST"

### Root Causes
1. Uncleaned event listeners
2. Growing caches without eviction
3. Circular references preventing GC
4. Large objects stored in module scope
5. Connection leaks

### Resolution Steps

**Step 1: Identify Memory Growth** (5 min)
```bash
# Measure over 1 hour
curl http://localhost:3020/metrics | grep nodejs_memory_usage_bytes
# Note: X MB

# Wait 30 minutes with moderate load

curl http://localhost:3020/metrics | grep nodejs_memory_usage_bytes
# Note: X+Y MB

# If Y > 50 MB increase, likely memory leak
```

**Step 2: Check for Event Listener Leaks** (10 min)
```bash
# In app.module.ts or services, look for:
emitter.on('event', callback)  // ❌ No cleanup

// Should be:
emitter.once('event', callback)  // ✅ Auto-cleanup
// OR
const listener = emitter.on('event', callback)
ngOnDestroy() { emitter.off('event', listener) }  // ✅ Manual cleanup
```

Run check:
```bash
grep -r "\.on(" src/ --include="*.ts" | grep -v "\.once(" | head -10
# Review each match for proper cleanup
```

**Step 3: Check Cache Implementation** (10 min)
```bash
# Look for in-memory caches
grep -r "new Map()\|new Set()\|cache.*=" src/ --include="*.ts" | head -10

# Check if they have size limits
grep -r "cache.*size\|cache.*length" src/ --include="*.ts"

# If caches have no limit, add eviction:
// Example:
const cache = new Map();
const MAX_SIZE = 1000;
function set(key, value) {
  if (cache.size >= MAX_SIZE) {
    cache.delete(cache.keys().next().value); // FIFO eviction
  }
  cache.set(key, value);
}
```

**Step 4: Enable Heap Snapshot** (10 min)
```bash
# Start server with heap snapshot support
node --expose-gc $(npm bin)/nest start 2>&1 &
NODE_PID=$!

# After some requests
sleep 30

# Take snapshot
kill -USR2 $NODE_PID

# Find snapshot file
ls -lah heap-*
# Should be in current directory
```

**Step 5: Analyze with Chrome DevTools** (15 min)
```bash
# Open Chrome DevTools
# chrome://inspect

# Add Node.js app
# click "inspect" on your app

# Go to Memory tab
# Take heap snapshot 1
# Make 100 requests
# Take heap snapshot 2
# Compare snapshots

# Look for:
# - Growing object counts
# - Large arrays
# - Unreleased event listeners
```

**Step 6: Check for Circular References** (10 min)
```bash
# Look for object structures that reference each other
grep -r "this\." src/ --include="*.ts" | grep -E "parent|root|container" | head -10

# Verify they're properly cleaned up on service destroy:
ngOnDestroy() {
  this.parent = null;  // ✅ Clear circular reference
  this.children = null;
}
```

**Step 7: Force Garbage Collection and Restart** (5 min)
```bash
# Restart the application
npm run start:dev

# Monitor memory for next hour
watch -n 10 'curl http://localhost:3020/metrics | grep nodejs_memory_usage_bytes'

# If memory stable: Issue resolved
# If memory still growing: Likely still has leak
```

### Escalation
1. If memory > 80 MB: Likely memory leak
2. If memory > 90 MB: Imminent crash risk, restart immediately
3. If continues after restart: Investigate specific request patterns

---

## 🚨 Issue: High Error Rate (> 1% 5xx Errors)

### Severity
🔴 **Critical** - Many user requests failing

### Symptoms
- Prometheus shows http_requests_total{status="5xx"} increasing
- Grafana error rate chart in red
- User reports: "API not working"
- Backend logs show many ERROR entries

### Root Causes
1. Database connection lost
2. External service unavailable
3. Code exception in endpoint
4. Out of memory/disk
5. Rate limiting too strict

### Resolution Steps

**Step 1: Check Backend Logs** (5 min)
```bash
# Get recent errors with correlation IDs
tail -100 app.log | grep ERROR | tail -5

# Extract correlation IDs
tail -100 app.log | grep ERROR | grep -oE "[a-f0-9]{8}-[a-f0-9]{4}" | uniq
```

**Step 2: Trace Using Correlation ID** (10 min)
```bash
# For each error correlation ID:
CORR_ID="f47ac10b-58cc"
grep "$CORR_ID" app.log

# Expected output showing:
# 1. Request received
# 2. Processing steps
# 3. Error with stack trace
# 4. Response sent
```

**Step 3: Check Database Connection** (5 min)
```bash
# Test database connectivity
psql -h localhost -U postgres -d boiler_control -c "SELECT 1"
# Expected: (1 row)

# If connection fails:
# - Check credentials in .env
# - Check if database service is running
# - Check firewall rules
```

**Step 4: Review Stack Trace** (10 min)
```bash
# From the correlation ID trace, get the error:
# Example: "TypeError: Cannot read property 'name' of undefined at ..."

# Identify:
# 1. File where error occurred
# 2. Line number
# 3. The operation that failed

# Navigate to file and review
cat src/<service>/<file>.ts | sed -n '100,120p'
# (adjust line numbers)
```

**Step 5: Check External Service Dependencies** (5 min)
```bash
# If error relates to external service:
# - Weather API
# - Tuya API
# - etc.

curl -v https://external-api.com/health
# Check if returns 200 OK

# If service down:
# - Check service status page
# - Check API credentials in .env
# - Consider fallback strategy
```

**Step 6: Check System Resources** (5 min)
```bash
# Disk space
df -h | grep -E "/$|/data"
# Warning if > 90% full

# File descriptors
lsof -p $(pgrep -f "node.*start") | wc -l
# Should be < 1024 (default limit)

# If resource constraint found:
# - Free up disk space
# - Increase file descriptor limit: ulimit -n 4096
```

**Step 7: Review Recent Changes** (5 min)
```bash
# Check what changed recently
git log --oneline -5

# If error coincides with recent change:
git revert <commit-sha>
npm run build
npm run start:dev
# Monitor error rate
```

**Step 8: Increase Logging Around Errors** (10 min)
```typescript
// Add detailed logging before error
logger.debug('About to process request', { correlationId, endpoint: req.path });
try {
  const result = await someOperation();
  logger.debug('Operation successful', { result });
} catch (error) {
  logger.error('Operation failed', {
    correlationId,
    error: error.message,
    stack: error.stack,
    input: { /* relevant input */ }
  });
  throw error;
}
```

Restart and observe:
```bash
npm run start:dev 2>&1 | grep -E "ERROR|Operation failed"
```

### Escalation
1. If > 5% errors: System not functional, immediate action
2. If errors persist after investigation: Rollback to previous version
3. If specific endpoint errors: Disable that endpoint until fixed

---

## 🟢 Verification: Checks After Any Fix

### Quick Health Check
```bash
# 1. Server responds
curl -v http://localhost:3020/health
# Expected: 200 OK, "status": "ok"

# 2. Metrics available
curl http://localhost:3020/metrics | head -10
# Expected: "# HELP" comments

# 3. API works
curl http://localhost:3020/api/dashboard 2>&1 | head -20
# Expected: JSON response

# 4. No errors in logs
grep ERROR app.log | wc -l
# Expected: 0 new errors
```

### Run Full Test Suite
```bash
# Unit tests
npm test
# Expected: All pass

# Integration tests
npm run test:integration
# Expected: 46/46 pass

# Smoke tests
npm run test:smoke
# Expected: 8/8 pass
```

---

## 📞 Escalation Contacts

| Issue | Owner | Contact |
|-------|-------|---------|
| Code/Logic | Backend Team | backend-team@example.com |
| Database | DBA | dba@example.com |
| Infrastructure | DevOps | devops@example.com |
| On-Call | On-Call Engineer | page via PagerDuty |

---

**Last Updated**: February 2, 2026
**Owner**: Backend Team
**Status**: ✅ Ready for Production Use
