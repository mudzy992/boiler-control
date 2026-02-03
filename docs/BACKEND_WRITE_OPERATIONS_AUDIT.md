# Backend Write Operations Audit - Phase 3 Implications

**Date:** February 3, 2026
**Purpose:** Verify backend capabilities for heating program management and thermostat control
**Conclusion:** ⚠️ **READ-ONLY SYSTEM** - App must remain informational

---

## Executive Summary

**The backend system does NOT support write operations to Tuya devices or heating programs.**

The system is architecturally **read-only** regarding:
- ❌ Creating/updating/deleting heating schedules on Tuya devices
- ❌ Changing thermostat target temperatures via the app
- ❌ Sending any commands to Tuya Cloud API
- ❌ Modifying device configuration remotely

The system **only supports**:
- ✅ Reading thermostat status from Tuya Cloud (polling)
- ✅ Calculating boiler flow temperature recommendations
- ✅ Tracking heating events and anomalies
- ✅ Local database CRUD for metadata (homes, device aliases, modes)

---

## Detailed Findings

### 1. Tuya Adapter Analysis

**File:** `backend/src/modules/Boiler/adapter/tuya.adapter.ts`

#### Public Methods
```typescript
async fetchSnapshot(deviceId: string, runId?: string): Promise<ThermostatSnapshot>
  - READS ONLY: status from Tuya API (GET request)
  - Decodes program data from device
  - Calculates target temperature recommendations
  - Returns: { currentTemp, targetTemp, powerOn, timestamp, ... }
```

#### Private Methods (Internal Use Only)
- `private async generateHeaders()` - Signs requests (can handle POST, but unused)
- `private async fetchStatus()` - GET only from Tuya API
- `private async getTargetFromStatus()` - Calculates recommendations (no write)

#### Verdict
**Zero write operations.** The POST capability in `generateHeaders()` is implemented but never invoked. No methods send commands to Tuya devices.

---

### 2. Program Sync Service

**File:** `backend/src/modules/Boiler/adapter/program.sync.service.ts`

#### Purpose
**Synchronizes programs FROM Tuya TO local database** (one-way read)

#### Operations
- `syncProgram()` → decodes Tuya program data
- `syncDay()` → compares with local DB
- `insertAll()`, `upsertAll()` → local database operations only
- `cleanupRemovedIntervals()` → removes stale local records

#### Verdict
**Database synchronization only.** No write operations to Tuya. Receives decoded program binary from device, stores locally.

---

### 3. Thermostat Device Controller

**File:** `backend/src/modules/ThermostatDevice/thermostat.device.controller.ts`

#### Endpoints Implemented
```
GET    /api/devices              - List all devices
GET    /api/devices/:id          - Get single device
POST   /api/devices              - Create device record
PATCH  /api/devices/:id          - Update device metadata
DELETE /api/devices/:id          - Delete device record
```

#### UpdateThermostatDeviceDto (What Can Be Updated)
```typescript
{
  alias?: string;              // Device nickname (local only)
  mode?: ThermostatMode;       // MANUAL | PROGRAM (local mode tracking)
  vendor?: string;             // Device vendor (local only)
  deviceId?: string;           // Device ID (local only)
  homeProfileId?: number;      // Home association (local only)
}
```

#### Service Implementation
```typescript
async update(userId, id, dto: UpdateThermostatDeviceDto) {
  // Only updates local Prisma database records
  return this.prisma.thermostatDevice.update({
    where: { id },
    data: dto,  // ← Local database only
  });
}
```

#### Verdict
**Local metadata only.** Updates to `mode` don't send commands to Tuya. The database just tracks user preference, but thermostat control is read-only.

---

### 4. Boiler Controller

**File:** `backend/src/modules/Boiler/boiler.controller.ts`

#### Endpoints
```
GET    /api/boiler/history      - Read only
POST   /api/boiler/sync         - Triggers calculation only
```

#### Sync Endpoint Behavior
```typescript
@Post('sync')
async manualSync(@Req() req) {
  // Does NOT send commands
  // Only calculates flow temperature
  const history = await this.boilerService.calculateFlowTemp(userId);
  // Returns calculated recommendations
}
```

#### Verdict
**Read and calculate only.** No write operations to devices.

---

### 5. Heating Controller

**File:** `backend/src/modules/Heating/heating.controller.ts`

#### Endpoints
```
GET    /api/heating-events      - Read events
POST   /api/heating-events      - Create test event (stub for P2c)
```

#### Create Endpoint
```typescript
@Post()
async createHeatingEvent(@Req() req, @Body() body) {
  // Comment says: "Full implementation deferred to P2c/P3a"
  // Currently returns stub data
  return {
    id: Math.floor(Math.random() * 10000),
    // ← No actual write to thermostat
  };
}
```

#### Verdict
**Incomplete/stub.** Not implemented for actual thermostat control.

---

### 6. Home Profile Controller

**File:** `backend/src/modules/HomeProfile/home.profile.controller.ts`

#### Endpoints (Verified)
```
GET    /api/home-profile              - List homes
GET    /api/home-profile/:id          - Get home
GET    /api/home-profile/active       - Get active home
POST   /api/home-profile              - Create home
PATCH  /api/home-profile/:id          - Update home (name, location)
DELETE /api/home-profile/:id          - Delete home
PATCH  /api/home-profile/:id/activate - Switch active home
```

#### Verdict
**Local database only.** Homes are user-defined profiles, not Tuya device management. Switching doesn't control devices.

---

### 7. No Write Operations to Tuya Cloud API

#### Search Results Summary
- ❌ No controllers expose thermostat program update endpoints
- ❌ No services send PATCH/PUT/POST to Tuya `/devices/*/commands` endpoints
- ❌ No adapters implement "set temperature" functionality
- ❌ No background jobs push configurations to devices
- ✅ All Tuya interactions are read-only (status, program decode, temperature fetch)

---

## Database Schema Confirmation

### ThermostatProgram Model (Read-Only)
```prisma
model ThermostatProgram {
  id          Int      @id @default(autoincrement())
  deviceId    Int
  dayType     DayType  // WORKDAY | SATURDAY | SUNDAY
  startMinute Int      // 6:30 = 390
  targetTemp  Float    // 22.5°C
  orderIndex  Int      // 0..5
  programHash String?  // Hash for change detection

  device ThermostatDevice @relation(fields: [deviceId])
  @@unique([deviceId, dayType, orderIndex])
}
```

**Inference:** Programs come FROM Tuya, not TO Tuya. The `programHash` is for detecting changes in Tuya data, then syncing locally.

---

## API Capabilities Matrix

| Operation | Capability | Implementation | Notes |
|-----------|-----------|-----------------|-------|
| Read thermostat status | ✅ YES | TuyaAdapter.fetchSnapshot() | GET from Tuya Cloud |
| Read programs from device | ✅ YES | Decoded in fetchSnapshot() | Binary protocol |
| Create local home profile | ✅ YES | HomeProfile controller | Database only |
| Update device alias | ✅ YES | ThermostatDevice controller | Database only |
| **Send command to change temp** | ❌ NO | Not implemented | No Tuya API calls |
| **Create/update schedule on device** | ❌ NO | Not implemented | No Tuya API calls |
| **Change device mode via app** | ❌ NO | Not implemented | Mode in DB ≠ Device control |
| **Sync programs TO device** | ❌ NO | Not implemented | One-way read only |
| Calculate boiler recommendation | ✅ YES | BoilerService | Math-based, not device control |

---

## Architecture Constraints

### Why Write Operations Are Missing

1. **Tuya API Complexity**
   - Tuya devices require complex protocol encoding
   - Program formats vary by device model
   - No abstraction layer for safe command sending

2. **Safety & Reliability**
   - Direct thermostat control is high-risk
   - Requires device-specific validation
   - No error recovery mechanisms

3. **Authentication Lifecycle**
   - Tuya tokens expire/rotate
   - Requires refresh token management
   - Currently only reads (doesn't modify state)

4. **Design Decision**
   - MVP focuses on data collection and recommendations
   - Control features deferred to future phase
   - Current setup prevents accidental device misconfiguration

---

## Phase 3 Impact Assessment

### ❌ Cannot Implement

**These features require backend write operations that don't exist:**

1. **Heating Schedule Editor**
   - Creating/editing programs requires Tuya API integration
   - UI can collect data, but nowhere to send it

2. **Manual Temperature Override**
   - Changing target temp requires device command protocol
   - Database PATCH only changes local record

3. **Program Templates & Quick Apply**
   - Templates can exist locally, but won't push to device
   - One-way sync means app sees programs, doesn't create them

4. **Thermostat Mode Switching**
   - UI can show MANUAL/PROGRAM toggle
   - But doesn't actually change device mode

### ✅ Can Implement (Read-Only Mode)

1. **Heating Schedule Viewer**
   - Display current programs read from device
   - Show active interval and next scheduled change

2. **Historical Analytics**
   - Chart temperature trends
   - Analyze heating efficiency

3. **Recommendations Display**
   - Show boiler flow temp suggestions
   - Alert on anomalies

4. **Home Profile Management**
   - Create/edit/delete homes (local database)
   - Switch between homes (update dashboard)

5. **Device Status Monitor**
   - Current temp, target temp, power state
   - Last seen timestamp
   - Connection status

---

## Recommended Phase 3 Approach

### Option A: Read-Only Informational App (RECOMMENDED)
**Keep current architecture, extend read features:**

```
✅ Home Management → Profile switching
✅ Analytics Screen → Temperature history, efficiency metrics
✅ Alerts System → Anomaly detection
❌ Schedule Editor → Remove (can't write to device)
❌ Manual Controls → Remove (no write capability)
```

### Option B: Mock/Simulation Mode
**Add simulation layer for UI testing:**

```
✅ Implement all Phase 3 screens
✅ Store schedules locally (device doesn't see them)
⚠️ Mark as "Simulation Mode" in UI
✅ Document that actual device integration requires backend work
```

### Option C: Backend Enhancement Required
**If write operations are needed:**

```
📋 Must implement:
  1. Tuya command protocol encoder
  2. Device-specific program formats
  3. Error recovery & validation
  4. Authorization checks
  5. Audit logging
  6. Rollback mechanisms

⏱️  Estimated: 2-3 weeks backend development
```

---

## Summary Table: What Exists vs What's Missing

| Feature | Backend | Status | Phase 3 Ready? |
|---------|---------|--------|---|
| Home Profiles (CRUD) | ✅ Implemented | Local DB | ✅ YES |
| Thermostat Device (CRUD) | ✅ Implemented | Local DB | ✅ YES |
| Dashboard (read) | ✅ Implemented | Tuya + calc | ✅ YES |
| Heating Events (read) | ✅ Implemented | Tuya + DB | ✅ YES |
| Analytics | ❌ Partial | Dashboard only | ⚠️ LIMITED |
| **Schedules (write)** | ❌ **NOT IMPLEMENTED** | — | ❌ NO |
| **Temperature control** | ❌ **NOT IMPLEMENTED** | — | ❌ NO |
| **Program editor** | ❌ **NOT IMPLEMENTED** | — | ❌ NO |
| Boiler recommendations | ✅ Implemented | Calc only | ✅ YES |

---

## Recommendations for Phase 3 UI

### Reposition Features Based on Capabilities

**Schedule Management Screen**
```
Current: "Create/edit heating programs"
Should be: "View current heating schedules"
- Display programs from device
- Show next scheduled change
- Alert if manual override is active
```

**Home Management Screen** ✅
```
No change needed - this is local DB management
- Create/edit/delete homes (pure local)
- Switch active home (updates context)
- Persists across sessions
```

**Analytics Screen** ✅ (With adjustments)
```
Keep as designed
- Temperature history (read from DB)
- Heating duration analysis
- Efficiency trends
- Cost estimation (calculation only)
```

**Settings Screen** ✅
```
No changes needed
- User preferences (local)
- Notification settings (local)
- Home management (local DB)
- About/Help
```

---

## Files to Update for Phase 3

### Phase 3 Guide Update Needed

File: `PHASE_3_GUIDE.md`

**Changes Required:**
1. Update Schedule Management description to "View-Only"
2. Add note: "Schedule editing requires backend API implementation"
3. Remove references to "create/edit programs on device"
4. Update API section: note read-only endpoints
5. Add "Future Backend Work" section with requirements

### Frontend Files (Affected)

```
apps/mobile/src/screens/schedule/ScheduleManagementScreen.tsx
  → Remove edit/create modals
  → Add "View Current Schedules" mode
  → Show programs fetched from device

apps/mobile/src/screens/settings/SettingsScreen.tsx
  → Remove "Change Temperature" link (if planned)
  → Keep "Manage Homes" (local DB)

apps/mobile/src/services/api/homeProfile.api.ts
  → ✅ No changes needed (local DB only)

apps/mobile/PHASE_3_GUIDE.md
  → Update architecture section
  → Add limitations note
  → Clarify read-only design
```

---

## Next Steps

### For Phase 3 Launch (Read-Only)
1. ✅ Update PHASE_3_GUIDE.md with backend limitations
2. ✅ Modify ScheduleManagementScreen to display-only
3. ✅ Keep Home Management (local DB operations work fine)
4. ✅ Keep Analytics (can aggregate read-only data)
5. ✅ Test with actual backend APIs

### For Future Phase (Write Capabilities)
1. 📋 Design Tuya command protocol encoder
2. 📋 Implement `/api/devices/:id/programs` PATCH endpoint
3. 📋 Add device-specific program formatters
4. 📋 Create safety validators and error recovery
5. 📋 Re-enable UI controls with full backend support

---

## Conclusion

**The backend is read-only by design.** The Phase 3 UI components must be adjusted to reflect actual backend capabilities:

- ✅ **Keep:** Home Management, Analytics, Dashboard
- ⚠️ **Adjust:** Schedule Viewer (read-only), Thermostat display (info-only)
- ❌ **Remove:** Schedule Editor, Temperature controls, Program creation

The app should remain **informational and non-invasive**, displaying thermostat data without attempting to control devices. This is actually a good design choice for a beta system.
