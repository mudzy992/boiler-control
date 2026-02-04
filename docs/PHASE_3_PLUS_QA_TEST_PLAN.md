# Phase 3+ QA Test Plan - Day 2 Update

**Date**: Wednesday, February 5, 2026
**Status**: 40% Complete (38 test cases drafted)
**Target**: 100% Complete by end of Day 3 (Feb 6)

---

## Test Coverage by Feature

### 1. Setpoint (Temperature) Tests (10 scenarios)

#### Valid Operations
- [ ] **TC_SETPOINT_001**: Set temperature within range (10°C → 22°C)
  - Expected: Success, new temperature reflects in read-after-write snapshot
  - Validation: Response.success === true, Response.newTemp === 22

- [ ] **TC_SETPOINT_002**: Set temperature to boundary (5°C minimum)
  - Expected: Success, device accepts minimum value
  - Validation: Response.success === true, Device sets to 5°C

- [ ] **TC_SETPOINT_003**: Set temperature to boundary (35°C maximum)
  - Expected: Success, device accepts maximum value
  - Validation: Response.success === true, Device sets to 35°C

- [ ] **TC_SETPOINT_004**: Set temperature with decimal (22.5°C)
  - Expected: Success, accepts half-degree increments
  - Validation: Response.success === true, Setpoint reads 22.5°C

#### Invalid Operations
- [ ] **TC_SETPOINT_005**: Set temperature below range (4°C)
  - Expected: 400 Bad Request error
  - Validation: Response.status === 400, Error message mentions range

- [ ] **TC_SETPOINT_006**: Set temperature above range (36°C)
  - Expected: 400 Bad Request error
  - Validation: Response.status === 400, Error message mentions range

- [ ] **TC_SETPOINT_007**: Send non-numeric temperature value
  - Expected: 400 Bad Request with validation error
  - Validation: Response.status === 400

#### Error Scenarios
- [ ] **TC_SETPOINT_008**: Network timeout during setpoint change
  - Expected: Error after 30 seconds, device returns to previous temperature
  - Validation: Rollback verification succeeds, previous temp restored

- [ ] **TC_SETPOINT_009**: Verification failure (device doesn't accept command)
  - Expected: Error, automatic rollback to previous value
  - Validation: Device temp returns to pre-change value

- [ ] **TC_SETPOINT_010**: Tuya API returns 401 Unauthorized
  - Expected: 401 error, token refresh triggers
  - Validation: Error message indicates auth issue

---

### 2. Mode Switch Tests (7 scenarios)

#### Valid Mode Switches
- [ ] **TC_MODE_001**: Switch from OFF → PROGRAM
  - Expected: Success, heating starts with schedule
  - Validation: Response.newMode === 'PROGRAM', Device enables schedule

- [ ] **TC_MODE_002**: Switch from PROGRAM → MANUAL
  - Expected: Success, heating holds current setpoint
  - Validation: Response.newMode === 'MANUAL', Device holds temp

- [ ] **TC_MODE_003**: Switch from MANUAL → OFF
  - Expected: Success, heating stops
  - Validation: Response.newMode === 'OFF', Device goes idle

- [ ] **TC_MODE_004**: Same mode switch (PROGRAM → PROGRAM)
  - Expected: No-op success, mode unchanged
  - Validation: Response.success === true, No device command sent

#### Invalid Operations
- [ ] **TC_MODE_005**: Send invalid mode value ("TURBO")
  - Expected: 400 Bad Request with enum error
  - Validation: Response.status === 400

#### Error Scenarios
- [ ] **TC_MODE_006**: Mode switch timeout during Tuya communication
  - Expected: Error after 30s, mode reverts to previous
  - Validation: Device mode returns to original state

- [ ] **TC_MODE_007**: Verification fails after mode switch
  - Expected: Error, automatic rollback
  - Validation: Device mode reverts to pre-change value

---

### 3. Program Management Tests (8 scenarios)

#### Add Program
- [ ] **TC_PROGRAM_ADD_001**: Add single program interval for WORKDAY
  - Expected: Success, program appears in list
  - Validation: Program stored, appears in next read

- [ ] **TC_PROGRAM_ADD_002**: Add program with earliest time (00:00)
  - Expected: Success, program starts at midnight
  - Validation: startMinute === 0

- [ ] **TC_PROGRAM_ADD_003**: Add program with latest time (23:45)
  - Expected: Success, program starts at 11:45 PM
  - Validation: startMinute === 1425

#### Edit Program
- [ ] **TC_PROGRAM_EDIT_001**: Edit existing program (change temperature)
  - Expected: Success, temperature updates
  - Validation: Program reflects new temp value

- [ ] **TC_PROGRAM_EDIT_002**: Edit program time slot
  - Expected: Success, time updates
  - Validation: Program shows new start time

#### Delete Program
- [ ] **TC_PROGRAM_DELETE_001**: Delete single program interval
  - Expected: Success, program removed from list
  - Validation: Program count decreases by 1

- [ ] **TC_PROGRAM_DELETE_002**: Delete program leaves other days intact
  - Expected: Success, other day schedules unchanged
  - Validation: Other WORKDAY/SATURDAY/SUNDAY programs persist

#### Validation
- [ ] **TC_PROGRAM_VALIDATION_001**: Prevent duplicate time on same day
  - Expected: 400 validation error when adding at existing time
  - Validation: Error message: "Schedule already exists..."

---

### 4. Error Handling Tests (8 scenarios)

#### Timeout Errors
- [ ] **TC_ERROR_TIMEOUT_001**: Setpoint request times out (>30s)
  - Expected: Timeout error after 30 seconds
  - Validation: Error.code === 'ECONNABORTED' or similar

- [ ] **TC_ERROR_TIMEOUT_002**: Mode request times out
  - Expected: Timeout error with automatic rollback
  - Validation: Device reverts to previous mode

#### Authentication Errors
- [ ] **TC_ERROR_AUTH_001**: Expired JWT token in header
  - Expected: 401 Unauthorized response
  - Validation: Response.status === 401

- [ ] **TC_ERROR_AUTH_002**: Missing Authorization header
  - Expected: 401 Unauthorized response
  - Validation: Response.status === 401

#### Rate Limiting
- [ ] **TC_ERROR_RATELIMIT_001**: Send 10 rapid requests (within 1s)
  - Expected: First succeeds, remainder get 429 Too Many Requests
  - Validation: Response.status === 429 for rate-limited requests

#### Tuya API Errors
- [ ] **TC_ERROR_TUYA_001**: Tuya Cloud API returns error
  - Expected: Detailed error message extracted from Tuya response
  - Validation: Error message is user-friendly, not raw API error

- [ ] **TC_ERROR_TUYA_002**: Device offline during command send
  - Expected: Error indicating device unavailable
  - Validation: Error message mentions device status

---

### 5. Concurrent Request Tests (5 scenarios)

- [ ] **TC_CONCURRENT_001**: Two setpoint changes simultaneously
  - Expected: First succeeds, second queued/rejected gracefully
  - Validation: No race condition, final state correct

- [ ] **TC_CONCURRENT_002**: Mode change during setpoint change
  - Expected: Both complete without interference
  - Validation: Final state reflects both changes

- [ ] **TC_CONCURRENT_003**: Add program while setpoint changing
  - Expected: All operations complete independently
  - Validation: No data corruption

- [ ] **TC_CONCURRENT_004**: Rapid edit operations on same program
  - Expected: Final value from last request wins
  - Validation: No partial updates

- [ ] **TC_CONCURRENT_005**: Delete program while editing
  - Expected: One operation succeeds, other fails gracefully
  - Validation: No crash, user gets clear error

---

### 6. Audit Logging Tests (5 scenarios)

- [ ] **TC_AUDIT_001**: Setpoint change logged
  - Expected: Audit log entry created with action, user, device, result
  - Validation: Audit log contains: action='SET_TEMPERATURE', success=true

- [ ] **TC_AUDIT_002**: Failed operation logged
  - Expected: Audit log records failure with error message
  - Validation: Audit log contains: success=false, error=[message]

- [ ] **TC_AUDIT_003**: Audit log tracks operation duration
  - Expected: Duration recorded in milliseconds
  - Validation: duration > 0, duration < 5000

- [ ] **TC_AUDIT_004**: Audit log associates user correctly
  - Expected: Logged operation shows which user made change
  - Validation: userId matches authenticated user

- [ ] **TC_AUDIT_005**: Audit log persisted to database
  - Expected: Query database for operation records
  - Validation: Records appear in device_audit_logs table

---

### 7. Data Integrity Tests (4 scenarios)

- [ ] **TC_INTEGRITY_001**: Verify read-after-write consistency
  - Expected: Setpoint changes, snapshot fetch confirms new value
  - Validation: Device snapshot matches sent command value (±1°C tolerance)

- [ ] **TC_INTEGRITY_002**: Verify no phantom writes
  - Expected: Failed command doesn't leave device in inconsistent state
  - Validation: Device reverts to previous state on failure

- [ ] **TC_INTEGRITY_003**: Verify program array integrity
  - Expected: All intervals persist, order maintained
  - Validation: Full program list matches sent request

- [ ] **TC_INTEGRITY_004**: Verify no data loss on rollback
  - Expected: Failed operation restores all original values
  - Validation: Device state matches pre-operation snapshot

---

### 8. API Contract Tests (3 scenarios)

- [ ] **TC_API_CONTRACT_001**: Setpoint response format
  - Expected: Response contains {success, message, timestamp, duration}
  - Validation: All fields present, correct types

- [ ] **TC_API_CONTRACT_002**: Mode response format
  - Expected: Response contains {success, message, timestamp, previousMode, newMode}
  - Validation: All fields present, correct enum values

- [ ] **TC_API_CONTRACT_003**: Programs response format
  - Expected: Response contains {success, message, timestamp, programsCount, intervalsCount}
  - Validation: All fields present, counts match actual arrays

---

## Testing Tools & Setup

### Postman Collection
Create `Phase_3_Plus_API_Tests.postman_collection.json`:

**Environment Variables**:
- `baseUrl`: `http://localhost:3020/api` (dev)
- `homeId`: `1` (test home)
- `token`: `[JWT token from login]`
- `targetTemp`: `22`
- `currentTemp`: `18`

**Request Templates**:

1. **Set Setpoint**
   ```
   PATCH {{baseUrl}}/boiler/{{homeId}}/setpoint
   Body: {"targetTemp": 22}
   ```

2. **Set Mode**
   ```
   POST {{baseUrl}}/boiler/{{homeId}}/mode
   Body: {"mode": "PROGRAM"}
   ```

3. **Update Programs**
   ```
   PATCH {{baseUrl}}/boiler/{{homeId}}/programs
   Body: {
     "programs": [
       {"dayType": "WORKDAY", "startMinute": 480, "targetTemp": 22}
     ]
   }
   ```

### Manual Testing Checklist
- [ ] Devices configured in test environment (home_id=1, boiler_id=1)
- [ ] Tuya mock server running or real Tuya Cloud credentials configured
- [ ] Test user account created (test@example.com, password123)
- [ ] Admin account created for audit log verification
- [ ] Database seeded with test data
- [ ] Backend server running on port 3020
- [ ] Mobile emulator/simulator ready for integration testing

---

## Test Execution Plan

### Day 3 (Thursday, Feb 6)
- **Morning** (2 hours):
  - Setup Postman collection
  - Run valid operation tests (TC_SETPOINT_001-004, TC_MODE_001-004, TC_PROGRAM_ADD_001-003)
  - Document results

- **Afternoon** (2 hours):
  - Run error handling tests (TC_ERROR_TIMEOUT_001, TC_ERROR_AUTH_001, TC_ERROR_RATELIMIT_001)
  - Run concurrent request tests (TC_CONCURRENT_001-005)
  - Document any issues

- **Late Afternoon** (1 hour):
  - Verify audit logging (TC_AUDIT_001-005)
  - Verify data integrity (TC_INTEGRITY_001-004)

### Day 4 (Friday, Feb 7)
- **Morning**:
  - Run complete end-to-end tests
  - Perform manual mobile app testing with HeatingScreen
  - Document all results

- **Afternoon**:
  - Regression testing (re-run Day 3 passing tests)
  - Bug triage and severity assessment
  - Create bug reports for any failures

---

## Known Issues & Workarounds

**TODO**: To be populated as testing progresses

---

## Sign-Off

**QA Lead**: [Name]
**Approval Date**: [Date]
**Test Coverage**: 40+ scenarios covering:
- ✅ Valid operations (15 tests)
- ✅ Invalid operations (5 tests)
- ✅ Error scenarios (8 tests)
- ✅ Concurrency (5 tests)
- ✅ Audit logging (5 tests)
- ✅ Data integrity (4 tests)
- ✅ API contracts (3 tests)

**Total Planned**: 45+ test cases
**Status**: 38 drafted, 7 remaining (finalize Day 3)

---

**Generated**: February 5, 2026
**Owner**: QA Lead
**Revision**: 1.1 (40% complete)
