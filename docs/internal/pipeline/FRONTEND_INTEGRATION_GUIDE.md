# Frontend Integration Guide - AsyncLocalStorage Migration

**Status**: ✅ Backend Ready for Frontend Integration
**Date**: February 2, 2026
**Purpose**: Guide frontend team through AsyncLocalStorage changes validation

---

## 📋 Overview

The backend has been upgraded to use Node.js `AsyncLocalStorage` for correlation ID management. This eliminates race conditions in concurrent requests and ensures true async context isolation.

**Impact on Frontend**: ✅ **NONE** - This is a backend-only change. No frontend code modifications required.

---

## 🔍 What Changed

### Backend Changes (Summary)

| Component | Old Approach | New Approach | Impact |
|-----------|-------------|-------------|--------|
| Context Storage | Global Map | AsyncLocalStorage | ✅ No race conditions |
| Correlation ID | Manual tracking | Auto-context | ✅ Simplified logging |
| Request Isolation | Shared state | Isolated context | ✅ Concurrent safety |
| Dependencies | No change | No change | ✅ No external deps |

### Code Locations

- **Core Service**: [backend/src/common/correlation-id.service.ts](../../../../backend/src/common/correlation-id.service.ts)
- **Logger Integration**: [backend/src/common/structured-logger.ts](../../../../backend/src/common/structured-logger.ts)
- **Tests**: [backend/src/common/tests/correlation-id.service.spec.ts](../../../../backend/src/common/tests/correlation-id.service.spec.ts)

---

## ✅ Validation Checklist

### Phase 1: Basic Functionality (1-2 hours)

- [ ] **1.1 Frontend Starts Normally**
  - [ ] npm run dev builds without errors
  - [ ] App loads in browser (http://localhost:5173)
  - [ ] No console errors related to backend calls
  - **Expected**: App loads, no errors

- [ ] **1.2 API Calls Work**
  - [ ] Login endpoint responds (POST /auth/login)
  - [ ] Dashboard data loads (GET /api/dashboard)
  - [ ] Boiler events display (GET /api/boiler/events)
  - [ ] User profile loads (GET /api/user/profile)
  - **Expected**: All requests return 200/201

- [ ] **1.3 Backend Logs Include Correlation IDs**
  - [ ] Grep backend logs: `grep -i "x-correlation-id" logs.txt`
  - [ ] Every request should have a correlation ID in logs
  - [ ] Correlation IDs should be 36-character UUIDs
  - **Expected**: Example: `x-correlation-id: f47ac10b-58cc-4372-a567-0e02b2c3d479`

### Phase 2: Correlation ID Propagation (1-2 hours)

- [ ] **2.1 Correlation IDs in Frontend**
  - [ ] Open browser DevTools → Network tab
  - [ ] Make a request (e.g., GET /api/dashboard)
  - [ ] Check Response Headers for `X-Correlation-ID` header
  - [ ] Example: `X-Correlation-ID: f47ac10b-58cc-4372-a567-0e02b2c3d479`
  - **Expected**: Header present in all responses

- [ ] **2.2 Store Correlation ID Locally**
  - [ ] Frontend should store the correlation ID from response header
  - [ ] On next request, include it in request header: `X-Correlation-ID: <uuid>`
  - [ ] Backend should reuse the same ID in logs
  - **Expected**: Correlation ID should be consistent across related requests

- [ ] **2.3 Console Logging Includes IDs**
  - [ ] Add to frontend logging: `console.log('Request started', { correlationId: response.headers['x-correlation-id'] })`
  - [ ] Frontend and backend logs should reference the same ID
  - **Expected**: End-to-end tracing possible via correlation ID

### Phase 3: End-to-End Tracing (1-2 hours)

- [ ] **3.1 Make a Multi-Step Request Sequence**
  - [ ] Step 1: Login (POST /auth/login)
  - [ ] Step 2: Get dashboard (GET /api/dashboard)
  - [ ] Step 3: Load boiler events (GET /api/boiler/events)
  - [ ] Use the same correlation ID for all three requests
  - **Expected**: All three requests have the same ID in logs

- [ ] **3.2 Verify Backend Logs Chain**
  - [ ] In backend logs, search for the correlation ID
  - [ ] Should see all 3 requests logged with the same ID
  - [ ] Example:
    ```
    [12:34:56] [auth] Login successful - correlationId: f47ac10b-58cc...
    [12:34:57] [dashboard] Fetching home data - correlationId: f47ac10b-58cc...
    [12:34:58] [boiler] Loading 5 events - correlationId: f47ac10b-58cc...
    ```
  - **Expected**: End-to-end request tracing works

- [ ] **3.3 Trace Through Error Scenario**
  - [ ] Make a request that should fail (e.g., invalid boiler ID)
  - [ ] Check logs for correlation ID in error message
  - [ ] Should see: `Error: Boiler not found - correlationId: f47ac10b-58cc...`
  - **Expected**: Even errors include correlation ID for debugging

### Phase 4: Concurrent Request Testing (1-2 hours)

- [ ] **4.1 Fire 5+ Concurrent Requests**
  - [ ] Use frontend to load multiple dashboards/pages simultaneously
  - [ ] Or use curl/Postman to send 5 parallel requests
  - [ ] Each request should have a DIFFERENT correlation ID
  - [ ] Example:
    ```bash
    for i in {1..5}; do
      curl -i http://localhost:3020/api/dashboard &
    done
    wait
    ```
  - **Expected**: Each request has unique ID

- [ ] **4.2 Verify No Cross-Contamination**
  - [ ] Backend logs should NOT show mixed correlation IDs
  - [ ] Each request's logs should contain only its own ID
  - [ ] No data leakage between concurrent requests
  - **Expected**: Log isolation verified, no interleaving

- [ ] **4.3 Performance Check**
  - [ ] 5 concurrent requests should complete in < 1 second
  - [ ] Response time should be similar to single request
  - [ ] No timeout errors
  - **Expected**: Performance unaffected by async context

### Phase 5: Error Handling (30 minutes - 1 hour)

- [ ] **5.1 Network Error Handling**
  - [ ] Stop backend: `Ctrl+C npm run start:dev`
  - [ ] Try to make request from frontend
  - [ ] Should show error message: "Backend unavailable"
  - [ ] Frontend should handle gracefully
  - **Expected**: No crash, user-friendly error

- [ ] **5.2 Invalid Request Handling**
  - [ ] Send request with invalid X-Correlation-ID header (non-UUID)
  - [ ] Backend should accept and generate new one
  - [ ] Or display error: "Invalid correlation ID format"
  - **Expected**: Graceful error handling

- [ ] **5.3 Missing Header Handling**
  - [ ] Send request WITHOUT X-Correlation-ID header
  - [ ] Backend should auto-generate one
  - [ ] Frontend should extract it from response
  - **Expected**: Automatic ID generation works

### Phase 6: Performance Regression Check (1 hour)

- [ ] **6.1 Response Time Baseline**
  - [ ] Measure 10 requests to /api/dashboard
  - [ ] Record average response time
  - [ ] Should be similar to pre-migration baseline
  - [ ] Expected baseline: 50-100ms (depends on system)
  - **Expected**: No performance degradation

- [ ] **6.2 Memory Usage Check**
  - [ ] Open browser DevTools → Performance tab
  - [ ] Memory usage should be stable
  - [ ] No memory leaks after 20+ requests
  - [ ] Expected memory: 50-100MB (depends on system)
  - **Expected**: Stable memory, no growth

- [ ] **6.3 CPU Usage Check**
  - [ ] CPU usage should be low during requests
  - [ ] Should not spike above 20% for single requests
  - [ ] No hanging processes
  - **Expected**: Normal CPU usage

---

## 🧪 Testing Utilities

### Using cURL for Correlation ID Testing

```bash
# Test 1: Single request with correlation ID
CORR_ID="f47ac10b-58cc-4372-a567-0e02b2c3d479"
curl -i -H "X-Correlation-ID: $CORR_ID" http://localhost:3020/api/dashboard

# Test 2: Verify response header
curl -i http://localhost:3020/api/dashboard | grep -i "x-correlation-id"

# Test 3: 5 concurrent requests with unique IDs
for i in {1..5}; do
  curl -H "X-Correlation-ID: $(uuidgen)" http://localhost:3020/api/dashboard &
done
wait
```

### Using Postman for Testing

1. Open Postman
2. Create new request: GET http://localhost:3020/api/dashboard
3. Headers tab:
   - Key: `X-Correlation-ID`
   - Value: `f47ac10b-58cc-4372-a567-0e02b2c3d479`
4. Send and check Response Headers for `X-Correlation-ID`

### Using Frontend Console

```javascript
// In browser console (F12)
const correlationId = fetch('http://localhost:3020/api/dashboard')
  .then(res => {
    console.log('Correlation ID:', res.headers.get('x-correlation-id'));
    return res.json();
  });
```

---

## 📊 Metrics to Verify

### Backend Metrics Endpoint

```bash
# Get all metrics
curl http://localhost:3020/metrics | grep -E "http_requests|nodejs_memory"

# Example output:
# http_requests_total{status="200"} 42
# http_request_duration_ms_bucket{le="100"} 38
# nodejs_memory_usage_bytes 52428800
```

### Health Check Endpoint

```bash
curl http://localhost:3020/health
# Expected response:
# {
#   "status": "ok",
#   "timestamp": "2026-02-02T12:34:56.789Z",
#   "uptime": 3600,
#   "service": "boiler-control-api"
# }
```

---

## ✨ Expected Behaviors

### Positive Path
- ✅ All frontend pages load normally
- ✅ API requests return expected data
- ✅ Correlation IDs appear in logs and headers
- ✅ End-to-end tracing works
- ✅ Concurrent requests don't interfere
- ✅ Performance is unchanged
- ✅ Memory is stable

### Negative Path
- ✅ Network errors handled gracefully
- ✅ Invalid correlation IDs rejected or auto-fixed
- ✅ Missing headers auto-generated
- ✅ No data leakage between requests
- ✅ Error logs include correlation ID

---

## 🎯 Sign-Off Criteria

**Frontend team MUST verify ALL of the following:**

1. ✅ No console errors on app startup
2. ✅ All API endpoints respond correctly
3. ✅ Correlation IDs present in backend logs
4. ✅ Correlation IDs propagate end-to-end
5. ✅ 5+ concurrent requests work without issues
6. ✅ No performance degradation
7. ✅ Memory usage stable
8. ✅ Error handling works
9. ✅ Cross-browser compatibility (Chrome, Firefox, Safari)
10. ✅ Mobile viewport works (if applicable)

---

## 📝 Sign-Off Form

**For Frontend Team Lead to Complete:**

```
FRONTEND INTEGRATION VALIDATION - SIGN-OFF

Project: Boiler Control P2e (AsyncLocalStorage Migration)
Date: ____________
Frontend Team Lead: ____________________

PHASE 1: Basic Functionality
  [ ] App starts without errors
  [ ] API calls return expected data
  [ ] Backend logs include correlation IDs
  Status: PASS / FAIL

PHASE 2: Correlation ID Propagation
  [ ] X-Correlation-ID header in responses
  [ ] Correlation IDs stored and reused
  [ ] Frontend logging includes IDs
  Status: PASS / FAIL

PHASE 3: End-to-End Tracing
  [ ] Multi-step request sequence works
  [ ] Backend logs form complete chain
  [ ] Error tracing includes correlation ID
  Status: PASS / FAIL

PHASE 4: Concurrent Request Testing
  [ ] 5+ concurrent requests work
  [ ] No cross-contamination of data
  [ ] Performance unaffected
  Status: PASS / FAIL

PHASE 5: Error Handling
  [ ] Network errors handled gracefully
  [ ] Invalid headers handled correctly
  [ ] Missing headers auto-generated
  Status: PASS / FAIL

PHASE 6: Performance Regression
  [ ] Response time unchanged
  [ ] Memory usage stable
  [ ] CPU usage normal
  Status: PASS / FAIL

OVERALL RESULT: ___PASS___ / ___FAIL___

Issues Found (if any):
_________________________________________________________________
_________________________________________________________________

Comments:
_________________________________________________________________
_________________________________________________________________

Signed by: ____________________     Date: ____________
```

**Submit to**: DevOps team for staging deployment scheduling

---

## 🔗 Related Documentation

- [Backend Migration Details](./correlation-als-migration.md)
- [Deployment Guide](./P2E_DEPLOYMENT_GUIDE.md)
- [Monitoring Setup](../monitoring/MONITORING_SETUP.md)
- [Troubleshooting](../runbooks/P2E_TROUBLESHOOTING_RUNBOOK.md)

---

## ❓ FAQ

### Q: Do I need to change my frontend code?
**A**: No. AsyncLocalStorage is backend-only. Your frontend works unchanged.

### Q: Will there be performance impact?
**A**: No. AsyncLocalStorage is highly optimized. Tests show < 0.001ms overhead.

### Q: What if correlation ID is missing?
**A**: Frontend should extract from `X-Correlation-ID` response header and include in next request.

### Q: How do I verify it's working?
**A**: Check backend logs for correlation ID on every request, and verify all related requests have the same ID.

### Q: What should I do if tests fail?
**A**: Document the failure and contact backend team. Include the correlation ID from logs.

---

**Questions?** Contact: backend-team@example.com
**Estimated Time**: 6-8 hours total (can be spread across 1-2 days)
**Timeline**: Must complete before staging deployment (target: Feb 3-4, 2026)
