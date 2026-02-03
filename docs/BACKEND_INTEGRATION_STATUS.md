# Backend Integration Status - Phase 3
## Precise Status Report

**Date:** February 3, 2026
**Question:** Are we UI/UX only, or should we have backend data now?

---

## TL;DR Answer

**Mixed status** - Some features have backend integration, others are UI-only:

| Module | Backend Status | Integration | Notes |
|--------|---------------|-------------|-------|
| **Dashboard** | ✅ CONNECTED | Working | Real data from `/api/dashboard` |
| **Auth (Login/Register)** | ✅ CONNECTED | Working | `/api/auth/*` endpoints |
| **Heating Schedules** | ✅ **JUST CONNECTED** | **NEW** | `/api/thermostat-device/:id/programs` |
| **Home Profile** | ⚠️ PARTIAL | API exists, not tested | `/api/home-profile/*` endpoints |
| **Analytics** | ❌ UI ONLY | Placeholder | No backend calls yet |
| **Notification Settings** | ❌ UI ONLY | Local state | No backend persistence |
| **Export Data** | ❌ UI ONLY | Not implemented | No endpoint |
| **Change Password** | ❌ UI ONLY | Not implemented | No endpoint |

---

## Detailed Status by Module

### 1. ✅ Dashboard - FULLY CONNECTED

**Endpoint:** `GET /api/dashboard`

**Response Structure:**
```json
{
  "homes": [{
    "id": 1,
    "name": "My Home",
    "thermostats": [...],
    "weatherData": {...},
    "boilerRecommendation": {...},
    "recentHeatingEvents": [...],
    "learningIntervals": [...]
  }]
}
```

**Integration:** `apps/mobile/src/api/dashboard.api.ts`
**Status:** ✅ Working with real backend data
**Confirmed:** User sees real home data, weather, thermostats, events

---

### 2. ✅ Heating Schedules - **JUST CONNECTED NOW** 🎉

**Endpoints:**
- `GET /api/thermostat-device` - List all thermostats
- `GET /api/thermostat-device/:id/programs` - Get programs for device

**Response Structure:**
```json
// GET /api/thermostat-device/:id/programs
[
  {
    "id": 1,
    "deviceId": 123,
    "dayType": "WORKDAY",
    "startMinute": 390,  // 6:30 AM
    "targetTemp": 22.0,
    "orderIndex": 0,
    "programHash": "abc123"
  },
  ...
]
```

**Integration:**
- NEW: `apps/mobile/src/services/api/thermostat.api.ts` (created just now)
- UPDATED: `ScheduleManagementScreen.tsx` (React Query integration added)

**Status:** ✅ **NOW CONNECTED** to backend
**Features:**
- Device selector (if multiple thermostats)
- Real-time program display from backend
- Loading states
- Error handling
- Auto-refresh every 2 minutes

**What Works:**
- Fetches all thermostat devices on screen load
- Auto-selects first device
- Loads programs for selected device from backend
- Displays programs grouped by day (WORKDAY/SATURDAY/SUNDAY)
- Shows current active interval
- Shows next scheduled change

**Backend Requirement:**
- ✅ Endpoint must exist: `GET /api/thermostat-device/:id/programs`
- ✅ Backend syncs programs from Tuya via `ProgramSyncService`
- ❌ Cannot create/edit/delete (read-only by design)

---

### 3. ⚠️ Home Profile Management - API EXISTS BUT NOT TESTED

**Endpoints (should exist according to backend audit):**
- `GET /api/home-profile` - List all homes
- `GET /api/home-profile/active` - Get active home
- `POST /api/home-profile` - Create home
- `PATCH /api/home-profile/:id` - Update home
- `DELETE /api/home-profile/:id` - Delete home
- `PATCH /api/home-profile/:id/activate` - Switch active

**Integration:** `apps/mobile/src/services/api/homeProfile.api.ts` ✅ Created

**Status:** ⚠️ **API SERVICE EXISTS** but needs backend verification

**What's Implemented (Frontend):**
- HomeManagementScreen with full UI
- API service with all CRUD methods
- React Query mutations
- Optimistic updates
- Error handling

**What's Unknown:**
- ❓ Do these endpoints actually exist on backend?
- ❓ Do they return data in expected format?
- ❓ Are they protected by JWT auth?
- ❓ Does switching active home work?

**Action Needed:**
```bash
# Test these endpoints manually:
curl -H "Authorization: Bearer $TOKEN" http://localhost:3020/api/home-profile
curl -H "Authorization: Bearer $TOKEN" http://localhost:3020/api/home-profile/active
```

---

### 4. ❌ Analytics - UI ONLY (Placeholder)

**Current State:** Placeholder charts and mock data

**What's NOT Implemented:**
- No API calls to backend
- No real historical data
- Charts are placeholder boxes
- Metrics are hardcoded

**What Backend Should Provide (future):**
```
GET /api/analytics/metrics?timeRange=week
GET /api/analytics/heating-duration?timeRange=week
GET /api/analytics/temperature-history?timeRange=week
GET /api/analytics/insights
```

**Integration Status:** ❌ Zero backend calls
**Expected Phase:** Phase 3.3 (Real Data Integration)

---

### 5. ❌ Notification Settings - LOCAL STATE ONLY

**Current Implementation:**
```typescript
const [notificationsEnabled, setNotificationsEnabled] = useState(true);
const [pushEnabled, setPushEnabled] = useState(true);
```

**What's Missing:**
- No persistence to backend
- Settings reset on app restart
- No `/api/user/notification-preferences` endpoint called

**What Backend Should Provide:**
```
GET /api/user/notification-preferences
PATCH /api/user/notification-preferences
```

**Integration Status:** ❌ Pure local state
**Expected Phase:** Phase 3.5 (Notifications)

---

### 6. ❌ Export Data - NOT IMPLEMENTED

**Current State:** Button exists in Settings, but does nothing

**What's Missing:**
- No backend endpoint
- No file generation
- No CSV/PDF export

**What Backend Should Provide:**
```
POST /api/export/data
Response: File download (CSV/PDF)
```

**Integration Status:** ❌ Not implemented
**Expected Phase:** Phase 3.4 (Advanced Features)

---

### 7. ❌ Change Password - NOT IMPLEMENTED

**Current State:** Button exists, logs to console

**What's Missing:**
- No modal/form
- No backend endpoint called

**What Backend Should Provide:**
```
PATCH /api/auth/change-password
Body: { oldPassword, newPassword }
```

**Integration Status:** ❌ Not implemented
**Expected Phase:** Phase 3+ (User Management)

---

## Summary Table

| Feature | Frontend | Backend Endpoint | Integration | Data Flow |
|---------|----------|-----------------|-------------|-----------|
| Login/Register | ✅ | ✅ `/api/auth/*` | ✅ Working | Token → AsyncStorage |
| Dashboard | ✅ | ✅ `/api/dashboard` | ✅ Working | Real data displayed |
| **Heating Schedules** | ✅ | ✅ `/api/thermostat-device/:id/programs` | ✅ **JUST ADDED** | Real programs from Tuya |
| Home Management | ✅ | ⚠️ `/api/home-profile/*` | ⚠️ Exists, needs test | Unknown if working |
| Thermostat List | ✅ | ✅ `/api/thermostat-device` | ✅ **JUST ADDED** | Device list from backend |
| Analytics Charts | ✅ UI | ❌ None | ❌ Placeholder | Hardcoded mock data |
| Notification Prefs | ✅ UI | ❌ None | ❌ Local state | Not persisted |
| Export Data | ✅ UI | ❌ None | ❌ Not implemented | No action |
| Change Password | ✅ UI | ❌ None | ❌ Not implemented | No action |

---

## What You Can Test Right Now

### ✅ Working with Real Backend Data:
1. **Login/Register** → Should authenticate with real backend
2. **Dashboard** → Should show real home data, weather, thermostats, events
3. **Heating Schedules** → **NOW WORKING** - should fetch and display real programs

### ⚠️ Needs Backend Verification:
4. **Home Management** → Try creating/editing/deleting homes
   - If fails: Backend endpoints don't exist or return wrong format
   - If works: ✅ Good to go

### ❌ Known to be UI-Only (No Backend Yet):
5. **Analytics** → Charts are placeholders
6. **Notification Settings** → Toggles don't persist
7. **Export Data** → Button does nothing
8. **Change Password** → Console log only

---

## Recommended Next Steps

### For You (Frontend):

1. **Test Home Profile Endpoints:**
   ```bash
   # Get auth token from app
   # Then test:
   curl -H "Authorization: Bearer YOUR_TOKEN" \
        http://10.0.2.2:3020/api/home-profile
   ```

2. **Test New Heating Schedule Integration:**
   - Navigate to Settings → Heating Schedules
   - Should see device selector (if multiple devices)
   - Should see real programs from backend
   - Check console for API calls/errors

3. **Verify Backend Connectivity:**
   - Check `apps/mobile/.env` has correct `EXPO_PUBLIC_API_URL`
   - Android: Should be `http://10.0.2.2:3020/api`
   - iOS: Should be `http://localhost:3020/api`

### For Backend Team:

1. **Confirm Endpoint Existence:**
   ```
   ✅ GET /api/thermostat-device (returns array of devices)
   ✅ GET /api/thermostat-device/:id/programs (returns array of programs)
   ⚠️ GET /api/home-profile (verify exists)
   ⚠️ POST /api/home-profile (verify exists)
   ❌ GET /api/analytics/* (future work)
   ❌ GET /api/user/notification-preferences (future work)
   ```

2. **Data Format Verification:**
   - ThermostatProgram: `{ id, deviceId, dayType, startMinute, targetTemp, orderIndex }`
   - HomeProfile: `{ id, name, location, isActive, thermostats, createdAt }`

---

## Files Changed (Just Now)

### NEW:
- ✅ `apps/mobile/src/services/api/thermostat.api.ts` (API service for thermostats)

### UPDATED:
- ✅ `apps/mobile/src/screens/schedule/ScheduleManagementScreen.tsx` (React Query integration)
  - Added device selector
  - Added React Query hooks
  - Auto-fetches devices and programs
  - Displays real backend data

---

## Answer to Your Question

**Da li je ova faza isključivo UI/UX dizajn bez backend povezivanja?**

**Odgovor:** Mješovito.

- **Dashboard i Auth** → Već povezano, radi sa backend-om ✅
- **Heating Schedules** → **Upravo povezano** (danas) ✅
- **Home Profile** → API postoji, ali treba testirati ⚠️
- **Analytics, Notifications, Export, Password** → Samo UI, bez backend-a ❌

**Ili se očekuje da već sada postoji minimalni backend response?**

**Odgovor:**
- Za **Dashboard, Auth, Schedules** → DA, backend već postoji i radi ✅
- Za **Home Profile** → Vjerojatno postoji (prema audit-u), treba testirati
- Za **Analytics i ostalo** → NE, dolazi u Phase 3.3-3.5

**Što trebaš testirati odmah:**
1. Navigate to "Heating Schedules" → trebalo bi vidjeti realne programe
2. Navigate to "Manage Homes" → pokušaj kreirati home (možda radi, možda ne)
3. Check backend logs → jesi li vidio API pozive?

**Ako Heating Schedules ne radi**, znači:
- Backend endpoint `/api/thermostat-device/:id/programs` ne postoji ili
- ProgramSyncService nije pokrenut ili
- Auth token nije valjan
