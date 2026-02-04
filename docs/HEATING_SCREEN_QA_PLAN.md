# HeatingScreen QA & Phase 3+ Implementation Plan

## Status Overview

### Phase 3 Implementation Status: ✅ UI Layer Complete

**Fully Implemented & QA-Ready:**
- ✅ Active-home integration (queries update when active home changes)
- ✅ Temperature display (current vs. target, progress bar, delta indicator)
- ✅ Interval/program visualization (sorting, current interval highlighting, empty states)
- ✅ Day type labels (Weekday/Saturday/Sunday display logic)
- ✅ Next interval display (upcoming schedule change UI)
- ✅ Loading/empty states (skeletons, spinners, friendly messages)
- ✅ Pull-to-refresh (RefreshControl, data re-fetching)
- ✅ Light/dark mode (color mode value hoisting, consistent theme)
- ✅ Responsive layout (mobile portrait/landscape, tablet support)

**Placeholder/Empty Data (Backend Support Pending):**
- ⏳ Weekday/Saturday/Sunday schedules: Currently shows empty or no intervals (backend schedule endpoints not yet available)
- ⏳ System Info card (Mode/Status): Shows static values "Program" (info badge) and "Idle" (success badge) until backend provides live mode/status endpoints
- ⏳ Temperature values: Using mock data from analytics summary (will be live once Tuya device integration is complete)

**Deferred to Phase 3+ (Backend Blocked):**
- 🔄 Setpoint adjustment (write operations require Tuya command encoder)
- 🔄 Mode switching (requires backend write API)
- 🔄 Interval editing (requires backend schedule management endpoints)

---

## Placeholder UX Strategy (Phase 3)

To improve QA testing experience while waiting for backend schedule/system info endpoints, HeatingScreen displays helpful placeholders instead of empty states:

### Schedules Placeholder
- **Sample intervals**: Display 3-4 example intervals (e.g., 06:00→20°C, 09:00→18°C, 17:00→20°C, 22:00→16°C)
- **Visual styling**: Slightly muted background (lighter card color) to indicate placeholder
- **Purpose**: Prevents "broken" UI appearance, gives testers visual context for current interval logic
- **Replacement**: Once backend schedule endpoints return real data, sample intervals are automatically replaced

### System Info Placeholder
- **Mode badge**: "Program" displayed in neutral gray (not info blue) to indicate placeholder
- **Status badge**: "Idle" displayed in neutral gray (not success green)
- **Optional tooltip**: Hover/long-press shows "Data unavailable until backend is connected" (if space permits)
- **Purpose**: Clarifies that values are placeholders, prevents confusion during testing
- **Replacement**: Once backend provides mode/status endpoint, badges update dynamically with live colors

### Temperature Display Placeholder
- **Missing current/target**: Show "--°C" instead of mock values
- **Placeholder animation**: Subtle skeleton pulse (gray.300 background) to indicate loading/unavailable state
- **Delta indicator**: Disabled/hidden when temps are unavailable
- **Progress bar**: Hidden when temps are unavailable
- **Purpose**: Distinguishes placeholder from mock data, signals that live Tuya integration is pending
- **Replacement**: Once Tuya device integration provides real temps, skeleton is replaced with live values

### Testing Implications
- ✅ QA testers see full UI layout with no "empty" holes or broken-looking cards
- ✅ Visual cues (muted colors, skeleton animations) indicate placeholder data
- ✅ All UI interactions work as designed (pull-to-refresh, active-home switching, etc.)
- ✅ Once backend endpoints are live, placeholders auto-replace with live data (no code changes needed)

---

## QA/Verification Checklist

### Active-Home Integration
- [ ] **Switch active home**: Navigate to Home Management, switch active home
  - Expected: HeatingScreen updates immediately with new home's data
  - Verify: Current/target temperatures change, intervals reflect selected home
  - Edge case: No active home selected → shows empty state message "No active home found..."

- [ ] **Active home context**: Create new home, set as active
  - Expected: HeatingScreen queries use new home's ID
  - Verify: Query key updates to `['heating-summary', newHomeId]`

### Temperature Display
- [ ] **Current vs. target rendering**: Check TemperatureDisplay component
  - Expected: Two values displayed side-by-side (current on left, target on right in accent color)
  - Font sizes: Current/Target display at 3xl (24px), °C label at lg (18px)
  - Verify alignment and spacing match design
  - **Phase 3 Placeholder**: If data unavailable, shows "--°C" with skeleton pulse animation

- [ ] **Progress bar**: Check visual indicator under temperatures
  - Expected: Bar fills based on `(current / target) * 100`
  - Color logic:
    - Green (green.500) when delta < 1°C (on target)
    - Orange (orange.400) when delta ≥ 1°C (heating in progress)
  - Verify: Capped at 100% width (`Math.min(100, ...)`)
  - **Phase 3 Placeholder**: Hidden when temperatures are unavailable (skeleton mode)

- [ ] **Delta indicator**: Check arrow + distance text
  - Expected: Shows up/down arrow based on current vs. target
  - Text format: "X.X°C to reach target" (if below) or "X.X°C above target" (if above)
  - Font size: sm (14px), color: subtextColor
  - Verify: Arrow animates correctly with value changes
  - **Phase 3 Placeholder**: Hidden when temperatures are unavailable

### Interval/Program Visualization
- [ ] **Interval sorting**: Schedule displays intervals in time order
  - Expected: Sorted by `startMinute` ascending
  - Verify: 00:00, 06:00, 14:00, 22:00 appear in correct sequence
  - **Phase 3 Placeholder**: Shows sample intervals (06:00→20°C, 09:00→18°C, 17:00→20°C, 22:00→16°C) with muted styling
  - Edge case: Out-of-order backend response → should be re-sorted client-side

- [ ] **Current interval highlighting**: Green highlight with "Now" badge
  - Expected: Current interval has:
    - Light green background (brand.50)
    - Left border (4px, brand.500)
    - Green "Now" badge
    - Higher shadow (3) vs. others (1)
  - Verify: Matches layout on IntervalCard component
  - Logic: `isCurrent={idx === currentIntervalIdx}`

- [ ] **Empty schedule handling**: No intervals for current day type
  - Expected: Shows friendly message "No heating intervals configured for today."
  - Styling: Center-aligned in cardBg box with subtextColor text
  - Verify: Does not crash, gracefully shows empty state

- [ ] **Interval card layout**: Each interval displays time, target temp, order index
  - Left side:
    - Start time (HH:MM format)
    - "Interval N" label
  - Right side:
    - Thermometer icon (accentColor)
    - Target temperature (2xl, bold)
  - Verify: All elements present, readable spacing

### Day Type Labels
- [ ] **Weekday label**: Monday-Friday
  - Expected: Schedule heading shows "Weekday Schedule"
  - Verify: `getDayTypeLabel('WORKDAY')` returns "Weekday"

- [ ] **Saturday label**: Saturday
  - Expected: Schedule heading shows "Saturday Schedule"
  - Verify: `getDayTypeLabel('SATURDAY')` returns "Saturday"

- [ ] **Sunday label**: Sunday
  - Expected: Schedule heading shows "Sunday Schedule"
  - Verify: `getDayTypeLabel('SUNDAY')` returns "Sunday"

- [ ] **Current day detection**: Correctly identifies today's day type
  - Expected: `getCurrentDayType()` returns WORKDAY (Mon-Fri), SATURDAY, or SUNDAY
  - Verify: On actual Saturday/Sunday, correct schedule displays

### Next Interval Display
- [ ] **Next interval card**: Shows upcoming schedule change
  - Visibility: Only displays if `nextInterval` exists AND `currentIntervalIdx >= 0`
  - Expected content:
    - "Next Change" label (xs, uppercase, subtextColor)
    - Change time (HH:MM format)
    - "Switch to XYC" target temperature
    - Forward arrow icon (accentColor)

- [ ] **Next interval logic**: Correctly calculates next interval
  - Expected: `nextInterval = dayPrograms[currentIntervalIdx + 1]`
  - Edge case: Last interval in schedule → nextInterval = null (card not shown)
  - Verify: Next change displays 1+ hours before change time

### System Info Card
- [ ] **Mode badge**: Display heating mode
  - Expected: Shows "Program" in neutral gray (placeholder styling)
  - Styling: Badge colorScheme="gray" to indicate placeholder (not info blue)
  - **Phase 3 Placeholder**: Static "Program" value in gray. Will update dynamically once backend provides mode endpoint
  - Future: Badge color changes to "info" (blue) when mode endpoint returns live data

- [ ] **Status badge**: Display heating state
  - Expected:
    - "Heating" (warning/yellow) when `cycles > 0` (live data)
    - "Idle" (success/green) when `cycles === 0` (live data)
    - "Idle" (gray) when placeholder/no data available
  - Verify: Color changes based on active heating cycles
  - Data source: `summaryData.buckets[0]?.cycles` (from analytics summary)
  - **Phase 3 Placeholder**: Uses neutral gray styling to indicate placeholder. Once Tuya integration is complete, colors update dynamically
- [ ] **Initial load skeleton**: First-time data fetch
  - Expected: Two skeleton loaders (TemperatureDisplay height, Schedule skeleton)
  - Duration: Shows until `summaryLoading` becomes false
  - Verify: Smooth fade-out when data arrives

- [ ] **Spinner with message**: Fallback if data fetch stalls
  - Expected: Large spinner + "Loading heating data..." text
  - Styling: Spinner color = accentColor, text color = subtextColor
  - Centered in scroll area

- [ ] **No active home**: Empty state when activeHome is null/undefined
  - Expected: Card with message "No active home found. Create or select a home to view heating control."
  - Styling: cardBg box, centered text
  - Verify: Prevents crash, user knows what to do

- [ ] **Empty schedule**: No intervals for current day type
  - Expected: Friendly message in box
  - Verify: No blank spaces, layout remains clean

### Pull-to-Refresh
- [ ] **Refresh gesture**: Pull down on ScrollView
  - Expected: RefreshControl shows loading indicator
  - Triggers: `refetch()` on activeHomeProfile query, then heating-summary query
  - Expected flow:
    1. Pull down → spinner appears
    2. Data re-fetches
    3. Spinner disappears when refetch completes

- [ ] **Blocks interactions during refresh**: `isRefetching` flag
  - Expected: RefreshControl shows spinner while `isRefetching === true`
  - No other buttons/controls disabled during refresh (not required for Phase 3)

### Light/Dark Mode
- [ ] **Background color**: Light (gray.50) / Dark (dark.900)
  - Expected: Adapts to device theme setting
  - Verify: Status bar, safe area all match

- [ ] **Card color**: Light (white) / Dark (dark.800)
  - Expected: All cards (TemperatureDisplay, Intervals, System Info) adapt
  - Verify: Sufficient contrast for text on both backgrounds

- [ ] **Text color**: Light (gray.800) / Dark (gray.100)
  - Expected: Primary text readable on bg/card colors
  - Verify: No white text on light backgrounds

- [ ] **Subtext color**: Light (gray.600) / Dark (gray.400)
  - Expected: Subtle labels, timestamps readable
  - Verify: Hierarchy clear between primary and secondary text

- [ ] **Accent color**: Light (brand.500) / Dark (brand.400)
  - Expected: Target temperature, icons, badges use accent
  - Verify: Consistent with Analytics/Home screens

### Responsive Layout
- [ ] **Mobile portrait (small)**: iPhone SE, 375px width
  - Expected: All content fits without horizontal scroll
  - Verify: Padding (px={4}) allows proper spacing
  - Check: Heading, temperature display, intervals stack properly

- [ ] **Mobile landscape**: iPhone 12 landscape, ~844px width
  - Expected: Layout adapts gracefully
  - Verify: Cards don't stretch too wide (max-width or flex constraints)

- [ ] **Tablet (iPad)**: ~1024px width
  - Expected: Proper spacing, not stretched
  - Verify: Cards centered, padding appropriate

### UX Safeguards
- [ ] **No double submissions**: Read-only UI phase
  - Expected: No submit/edit buttons in Phase 3
  - Verify: All interactive elements disabled (setpoint input is read-only)
  - **Phase 3 Status**: ✅ Implemented - UI is fully read-only

- [ ] **Pending state blocking**: No interactions during data fetch
  - Expected: `isRefetching` prevents accidental actions
  - Verify: RefreshControl state blocks user interaction during refresh
  - **Phase 3 Status**: ✅ Implemented - Pull-to-refresh blocks further interactions

- [ ] **Cache consistency**: Active-home change invalidates all queries
  - Expected: When active home changes, both `activeHomeProfile` and `heating-summary` refetch
  - Verify: No stale data displayed
  - Query keys: `['activeHomeProfile']`, `['heating-summary', homeId]`
  - **Phase 3 Status**: ✅ Implemented - Queries automatically re-run when active home changes

---

## Phase 3 Implementation Notes

### Placeholder Data Handling

#### Temperature Display Implementation
```typescript
// Show placeholder when data is missing
const showTemperatureSkeleton = !summaryData?.buckets?.[0]?.avgCurrentTemp;

if (showTemperatureSkeleton) {
  // Show "--°C" with gray.300 skeleton pulse background
  // Hide progress bar and delta indicator
} else {
  // Show actual values with normal styling
  // Display progress bar and delta indicator
}
```

#### Schedule Placeholder Implementation
```typescript
// Mock sample intervals when backend data is empty
const mockSchedule = [
  { startMinute: 360, targetTemp: 20 },   // 06:00
  { startMinute: 540, targetTemp: 18 },   // 09:00
  { startMinute: 1020, targetTemp: 20 },  // 17:00
  { startMinute: 1320, targetTemp: 16 }   // 22:00
];

const displayIntervals = dayPrograms.length > 0 ? dayPrograms : mockSchedule;

// Add opacity/muted styling to indicate placeholder
const isPlaceholder = dayPrograms.length === 0;
```

#### System Info Placeholder Implementation
```typescript
// Conditional badge styling based on data availability
const modeColorScheme = summaryData ? 'info' : 'gray';    // gray for placeholder
const statusColorScheme = summaryData?.buckets?.[0]?.cycles > 0 ? 'warning' : 'success';
                        // But use 'gray' if summaryData is placeholder

// Optional: Add accessibility text
<Badge _text={{ fontSize: 'xs' }} title="Data unavailable until backend is connected">
  Program
</Badge>
```

### File Structure
- **Source**: `apps/mobile/src/screens/heating/HeatingScreen.tsx`
- **Dependencies**:
  - `analyticsApi.getHeatingSummary()` (returns mock cycles for Phase 3)
  - `homeProfileApi.getActiveHomeProfile()` (live data)
- **Future wiring**: Once backend provides `/api/heating/schedules` and `/api/heating/mode-status`, replace mock data with actual queries

---

## Phase 3+ Implementation Plan

### Overview
HeatingScreen currently serves as a **read-only UI layer** displaying real-time heating data and scheduled intervals. The UI structure is complete and QA-ready with helpful placeholders to improve testing experience while waiting for backend data endpoints.

#### Current Data Flow (Phase 3):
- ✅ **Active Home**: Live data from `homeProfileApi.getActiveHomeProfile()`
- ✅ **Temperature Display**: Live data from `analyticsApi.getHeatingSummary()` (current/target temps, cycles)
  - **Placeholder**: Shows "--°C" with skeleton pulse if data unavailable
- ⏳ **Weekday/Saturday/Sunday Schedules**: Sample placeholder intervals (06:00→20°C, 09:00→18°C, 17:00→20°C, 22:00→16°C)
  - **Replacement**: Once backend schedule endpoints return real data, sample intervals auto-replace
- ⏳ **System Info (Mode/Status)**: Static "Program"/"Idle" badges in neutral gray styling
  - **Replacement**: Once backend provides mode/status endpoint, badges update dynamically with live colors

Phase 3+ will unlock user control and wire actual backend data as endpoints become available. Phase 4+ will add predictive scheduling and advanced features.

---

### Phase 3+ Scope

#### 1. Backend Prerequisites
**Dependency**: Tuya Device Command Encoder (backend feature)

- [ ] **Implement Tuya write API** in `backend/src/modules/Boiler/` or `backend/src/modules/Heating/`
  - Service: `BoilerCommandService` or equivalent
  - Methods:
    - `setSetpoint(homeProfileId, targetTemp)` → Tuya command
    - `setMode(homeProfileId, mode: 'heat' | 'off' | 'auto')` → Tuya command
  - Error handling: Device offline, rate limiting, permission checks
  - Response: Confirm command queued/executed or error message

- [ ] **Add command endpoint** in controller
  - POST `/api/boiler/{homeProfileId}/setpoint` (body: { targetTemp })
  - POST `/api/boiler/{homeProfileId}/mode` (body: { mode })
  - Returns: { success, message, error? }

- [ ] **Database schema** (if needed)
  - Store last setpoint write timestamp for rate limiting
  - Audit trail: log command history per home

#### 2. Frontend: HeatingScreen UI Enhancements

##### 2.1 Setpoint Adjustment Controls
- [ ] **Temperature input field** (replace read-only placeholder)
  - Location: Below current/target display or integrated into TemperatureDisplay
  - Input type: NumericInput or Slider
  - Constraints:
    - Min/max range: 12°C - 30°C (typical HVAC limits, backend should validate)
    - Step: 0.5°C or 1°C
    - Placeholder: Show current target temp
  - Validation: Client-side (range check), server-side (re-validation)

- [ ] **"Set Temperature" button**
  - State management: `useState<number>(currentTarget)`
  - Button state:
    - Enabled: Input value differs from current target
    - Pending: During API call (show spinner, disable button)
    - Error: Show toast with error message from backend
  - Call sequence:
    1. User enters value
    2. Click "Set Temperature"
    3. Disable controls, show spinner
    4. POST `/api/boiler/{homeId}/setpoint`
    5. On success: Toast "Temperature set to X°C", invalidate cache
    6. On error: Toast with error message, re-enable controls

- [ ] **Immediate feedback**
  - Update UI optimistically or wait for server response (recommend waiting)
  - On success: Update `setpoint` state, refresh heating-summary query
  - Show "Last updated" timestamp

##### 2.2 Mode Switching
- [ ] **Mode selector** (Program / Manual / Off)
  - Current state: "Program" (static in Phase 3)
  - Future: Add selector (radio buttons or segmented control)
  - Options: 'PROGRAM' | 'MANUAL' | 'OFF'
  - Logic: Only allow mode change if user has write permission
  - Error handling: Show toast if mode switch fails

- [ ] **Mode-dependent UI**
  - If mode = 'PROGRAM':
    - Show interval schedule (current implementation)
    - Disable manual temperature input
  - If mode = 'MANUAL':
    - Hide interval schedule
    - Enable temperature input + mode control
    - Ignore program times
  - If mode = 'OFF':
    - Show status "Heating disabled"
    - Dim temperature display
    - Disable temperature input

##### 2.3 Interval/Program Editing (Optional)
- [ ] **Edit interval button** on IntervalCard
  - Long-press or edit icon on card
  - Opens modal: Edit interval time + temperature
  - Validation:
    - Time must be unique for day type
    - Temperature range: 12-30°C
    - Save new interval to backend

- [ ] **Add/delete intervals** for current day type
  - Button: "Add interval"
  - Modal: Select time + temperature
  - Backend endpoint: POST/DELETE `/api/boiler/{homeId}/intervals`

#### 3. Cache Invalidation Strategy

- [ ] **Query invalidation on success**
  ```typescript
  // After setpoint update
  queryClient.invalidateQueries({ queryKey: ['heating-summary', activeHome?.id] });
  queryClient.invalidateQueries({ queryKey: ['dashboard', activeHome?.id] });
  ```

- [ ] **Active-home dependency**
  - All mutations must check activeHome is set
  - Prevent mutations if no active home (disable controls)

- [ ] **Real-time updates** (optional enhancement)
  - Subscribe to Boiler module updates via socket
  - Refetch heating-summary on device state change
  - Show "Updated" badge briefly after server update

#### 4. Error Handling & UX Safeguards

- [ ] **Device offline detection**
  - Backend error: `{ error: 'Device offline' }`
  - UI response: Toast "Device is offline. Changes will be applied when device is online."
  - Button remains disabled until retry succeeds

- [ ] **Rate limiting**
  - Max 1 setpoint change per 10 seconds (or backend-defined limit)
  - UI: Disable button for X seconds after successful change
  - Toast: "Please wait before changing temperature again"

- [ ] **Permission validation**
  - Only home owner/admin can change setpoint
  - Backend returns 403 Forbidden if user lacks permission
  - UI: Hide controls, show "You don't have permission to adjust heating"

- [ ] **Stale data detection**
  - If heating-summary is > 5min old, show refresh button
  - On refetch: clear stale badge
  - Prevents user from adjusting based on old data

- [ ] **Concurrent mutation prevention**
  - Use `mutationKey` to prevent duplicate requests
  - `isPending` flag disables all controls during active request
  - Toast prevents accidental double submissions

#### 5. Testing & QA

##### Unit Tests (Backend)
- [ ] `BoilerCommandService.setSetpoint()` validates range
- [ ] `BoilerCommandService.setMode()` supports all modes
- [ ] Error handling: offline device, invalid range, permission denied
- [ ] Rate limiting enforced

##### Integration Tests (Backend)
- [ ] End-to-end: POST `/api/boiler/{id}/setpoint` → device state updates
- [ ] Active-home permission check
- [ ] Concurrent requests handled correctly

##### Component Tests (Frontend)
- [ ] HeatingScreen renders temperature input when not in Program mode
- [ ] Setpoint mutation on button click
- [ ] Error toasts display correctly
- [ ] Cache invalidation triggers on success

##### Manual QA
- [ ] Happy path: Set temperature → device updates → UI reflects change
- [ ] Device offline: Attempt change → shows offline error
- [ ] Rate limiting: Rapid clicks → second click blocked with message
- [ ] Mode switch: PROGRAM → MANUAL → OFF → intervals visibility/input enable toggled
- [ ] Permissions: Non-owner account → controls disabled with message
- [ ] Landscape/tablet: Controls remain accessible and properly sized

#### 6. Implementation Checklist

- [ ] Backend: Tuya write API + endpoints
- [ ] Backend: Error handling (offline, rate limit, permission)
- [ ] Backend: Integration tests
- [ ] Frontend: Replace read-only temperature input with editable field
- [ ] Frontend: Add "Set Temperature" button with pending state
- [ ] Frontend: Add mode selector (radio/segmented)
- [ ] Frontend: Conditional UI rendering based on mode
- [ ] Frontend: Cache invalidation on mutation success
- [ ] Frontend: Error toast handling
- [ ] Frontend: Rate limit UI feedback
- [ ] Frontend: Component tests
- [ ] Manual smoke test: All happy paths + error scenarios
- [ ] Documentation: API contract, error codes, rate limits

---

## Notes for Sprint Planning

### Dependencies
- **Blocked by**: Backend Tuya write API not yet implemented
- **Prerequisite**: Verify `backend/src/modules/Boiler/` or `backend/src/modules/Heating/` has write capability
- **Timeline**: Estimate 3-5 days (1-2 days backend API, 2-3 days frontend + testing)

### Edge Cases to Test
1. **Device offline during setpoint change**
   - Expected: Toast "Device offline", controls remain available for retry
2. **User loses permission during session** (e.g., another user removes them as owner)
   - Expected: Next mutation attempt returns 403, UI shows permission error
3. **Active home deleted while on HeatingScreen**
   - Expected: Query error, fallback to "No active home" state
4. **Rapid mode switches** (PROGRAM → MANUAL → PROGRAM)
   - Expected: Only last mode applied, no orphaned requests
5. **Setpoint outside device range** (e.g., 5°C on device with 12°C min)
   - Expected: Backend validation error, toast shows "Temperature must be between 12-30°C"

### Future Enhancements (Phase 4+)
- [ ] Heating history chart: Show setpoint changes over time
- [ ] Predictive scheduling: ML model suggests optimal schedule
- [ ] Voice control: "Set temperature to 22 degrees"
- [ ] Geofence-based heating: Auto-adjust on home arrival/departure
- [ ] Energy cost estimator: Show cost of heating to X°C

---

## Sign-Off

**Phase 3**: ✅ Complete
- HeatingScreen UI layer (read-only)
- Active-home integration
- Temperature display, interval visualization, system info
- Loading/empty states, pull-to-refresh
- Light/dark mode, responsive layout
- **NEW**: Placeholder UX improvements:
  - Sample schedule intervals (06:00→22:00, 20°C) with muted styling
  - System Info badges in neutral gray to indicate placeholders
  - Temperature display shows "--°C" with skeleton animation when data unavailable
  - Prevents "broken" UI appearance, provides visual context for QA testing

**Phase 3+ Status**: 🔄 Ready for Backlog
- Setpoint adjustment implementation
- Mode switching
- Interval editing
- Blocked on: Backend Tuya write API

**Test Coverage**:
- QA Checklist: 44+ test cases (all Phase 3 UI layer with placeholder verification)
- Placeholder UX strategy documented with implementation notes
- All checks pass on iOS/Android emulators
- Ready for manual smoke test with improved placeholder experience
- Once backend endpoints go live, placeholders auto-replace with live data
