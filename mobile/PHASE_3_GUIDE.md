# Phase 3: Advanced Features - Implementation Guide

## Overview

Phase 3 adds multi-home management, heating schedules, analytics, and advanced settings to the mobile app. This document outlines the architecture and implementation details.

## Architecture Changes

### ⚠️ READ-ONLY DESIGN CONSTRAINT

**Important**: This app is designed as a **read-only information system**. The backend does NOT support write operations to Tuya devices. All Phase 3 screens reflect this constraint:

- ✅ **Home Management** → Local database CRUD (safe to write)
- ✅ **Analytics** → Display only (read-only aggregations)
- ✅ **Settings** → User preferences (local database)
- ✅ **Schedule Viewer** → Display current programs (read-only display)
- ❌ **Schedule Editor** → NOT IMPLEMENTED (backend limitation)
- ❌ **Device Control** → NOT IMPLEMENTED (backend limitation)

This is by design: the system prioritizes safe information delivery over remote device control.

### Navigation Structure

The app now has a **Settings Stack Navigator** that provides access to multiple configuration screens:

```
MainTabNavigator (5 tabs)
├── Dashboard
│   └── Quick Analytics Button → Settings/Analytics
├── Heating
├── Gas
├── Settings (Stack Navigator)
│   ├── SettingsScreen (main)
│   ├── HomeManagementScreen (local DB CRUD)
│   ├── ScheduleManagementScreen (view-only display)
│   └── AnalyticsScreen (read-only visualization)
└── (Reserved for future)
```

### New Screens

#### 1. Settings Screen (`src/screens/settings/SettingsScreen.tsx`)

Main settings hub with 6 sections:

- **Account**: User info, password change
- **Appearance**: Dark mode toggle
- **Notifications**: Enable/disable, push settings, preferences
- **Homes**: Quick link to home management
- **Data & Privacy**: Export data, clear cache
- **About**: App version, help, terms
- **Logout Button**: Sign out of the app

**Navigation Pattern**:

- Uses `useNavigation()` hook to navigate to child screens
- Reachable from MainTabNavigator as "Settings" tab

#### 2. Home Management Screen (`src/screens/home/HomeManagementScreen.tsx`)

Multi-home profile management interface:

- **View all homes**: Cards showing name, location, thermostat count
- **Active home indicator**: Green "Active" badge on selected home
- **Add home**: Modal form (name + location)
- **Edit home**: Tap pencil icon to modify details
- **Delete home**: Remove non-active homes (active home cannot be deleted)
- **Switch home**: Tap any inactive home to make it active
  - Automatically refreshes dashboard with new home's data
  - Invalidates React Query cache for dashboard, homeProfiles

**API Integration**:

- Uses `homeProfileApi` service with methods:
  - `getAllHomeProfiles()` - List all homes
  - `getActiveHomeProfile()` - Current active home
  - `createHomeProfile(data)` - Add new home
  - `updateHomeProfile(id, data)` - Edit existing home
  - `deleteHomeProfile(id)` - Remove home
  - `switchActiveHome(id)` - Make home active

**React Query Pattern**:

- Query key: `['homeProfiles']` (stale time: 2min)
- Mutations with optimistic updates
- Auto-refetch dashboard data on home switch

#### 3. Schedule Management Screen (`src/screens/schedule/ScheduleManagementScreen.tsx`)

**⚠️ VIEW-ONLY SCHEDULE DISPLAY**

Displays current heating programs from the thermostat. **NO CREATE/EDIT/DELETE OPERATIONS**.

**Backend Status**:

- ✅ Programs fetched from Tuya Cloud via backend `ProgramSyncService`
- ✅ Stored in local Prisma database
- ❌ **No write operations** - backend does NOT support sending commands to Tuya devices
- ❌ **Cannot modify schedules** - requires future backend implementation

**Display Features**:

- **View programs by day type**:
  - Grouped by WORKDAY / SATURDAY / SUNDAY
  - Sorted by start time (earliest first)
  - Shows target temperature for each interval

- **Active interval highlight**:
  - Green badge showing current active interval
  - Updates based on current time and day type
  - Shows target temperature for "right now"

- **Next scheduled change**:
  - Shows when the next program interval begins
  - Displays time and target temperature
  - Updates in real-time

- **Interval details**:
  - Time (HH:MM format from startMinute)
  - Target temperature (°C)
  - Interval order (#1, #2, etc.)

**Data Source**:

- Implements `ProgramViewProps` interface with:
  - `programs[]` - Array of ThermostatProgram objects from backend
  - `isLoading` - Loading state during fetch
  - `error` - Error display if fetch fails

**Important Limitations**:

- ❌ Cannot create new schedules
- ❌ Cannot edit existing schedules
- ❌ Cannot delete schedules
- ❌ Cannot pause/resume schedules
- ❌ Cannot apply templates (removed)
- ❌ Cannot send commands to thermostat

**How It Works**:

```
Tuya Cloud Device
  ↓ (Program stored in device)
Backend Sync (ProgramSyncService)
  ↓ (One-way read)
Local Database (Prisma)
  ↓ (Query)
ScheduleManagementScreen
  ↓ (Display only)
User views current schedule
```

**Future Enhancement**:
When backend implements Tuya command API, this screen can be enhanced with editing capabilities. Currently designed for information display only.

**State Management**:

- Props-based data flow (no local state mutations)
- Accepts backend-fetched programs as props
- Calculates current/next intervals dynamically

#### 4. Analytics Screen (`src/screens/analytics/AnalyticsScreen.tsx`)

System performance and insights dashboard:

**Time Range Selector**:

- Day / Week / Month / Year filters
- Affects all metrics display

**Key Metrics** (4 stat cards):

1. **Heating Hours** - Total active heating time, trend vs previous period
2. **Energy Used** - kWh consumption with trend
3. **Est. Cost** - Estimated cost with trend
4. **Efficiency** - System efficiency percentage with trend

**Charts** (placeholder layout):

1. **Temperature History** - Line chart of temp trends
2. **Daily Heating Duration** - Bar chart of heating hours per day
3. **Energy Consumption** - Combined view

**AI Insights Section**:
Three insight cards with different severity levels:

- **Success** (green): Optimization opportunities
- **Warning** (orange): Anomalies detected
- **Info** (blue): Weather-based suggestions

**Comparison Metrics**:

- vs. Similar Homes
- vs. Last Year/Period
- Shows improvement percentages

**Export**: Download analytics report button

### API Services

#### `src/services/api/homeProfile.api.ts` (NEW)

Home profile API client with TypeScript interfaces:

```typescript
interface HomeProfile {
  id: number;
  name: string;
  location: string;
  isActive: boolean;
  thermostats: number;
  createdAt: string;
}

// Methods:
- getAllHomeProfiles(): Promise<HomeProfile[]>
- getHomeProfileById(id): Promise<HomeProfile>
- getActiveHomeProfile(): Promise<HomeProfile>
- createHomeProfile(data): Promise<HomeProfile>
- updateHomeProfile(id, data): Promise<HomeProfile>
- deleteHomeProfile(id): Promise<void>
- switchActiveHome(id): Promise<HomeProfile>
```

### Component Patterns Used

#### 1. Controlled Forms

- `FormControl` wrapper with labels
- Modal for create/edit dialogs
- Form state management with `useState`
- Validation before submission

#### 2. List Rendering

- `.map()` instead of FlatList for flexibility
- Dynamic styling based on state (active/inactive)
- Action icons (edit, delete, pause/play)

#### 3. React Query Integration

- Queries with stale/cache times
- Mutations with `isPending` for loading states
- `invalidateQueries()` for cache invalidation
- Toast notifications for feedback

#### 4. Navigation

- Stack navigator for hierarchy
- Deep linking via `navigate('Screen', { screen: 'SubScreen' })`
- Header customization per screen

#### 5. Theming

- `useColorModeValue()` for light/dark support
- Consistent color palette:
  - Primary: `brand.500` / `brand.400`
  - Success: `green.500`
  - Warning: `orange.500`
  - Error: `red.500`
  - Text: `textColor` / `subtextColor`

## Implementation Steps Completed

✅ Created Settings screen with all sections
✅ Created Home Management with CRUD operations
✅ Created Schedule Management with program templates
✅ Created Analytics with metrics and insights
✅ Created home profile API service
✅ Integrated navigation stack
✅ Added Analytics button to Dashboard
✅ Implemented React Query patterns
✅ Added form validation and error handling
✅ Theme/dark mode support across all screens

## Future Enhancements

### ⚠️ CRITICAL: Backend Limitations

**Current State: READ-ONLY SYSTEM**

The backend integration with Tuya Cloud is **fundamentally read-only**. Phase 3 screens have been designed to respect this constraint:

| Feature                   | Status             | Details                                 |
| ------------------------- | ------------------ | --------------------------------------- |
| Fetch thermostat status   | ✅ Implemented     | TuyaAdapter.fetchSnapshot()             |
| Display programs          | ✅ Implemented     | ProgramSyncService syncs FROM device    |
| Fetch analytics data      | ✅ Implemented     | Dashboard queries stored events         |
| Manage home profiles      | ✅ Implemented     | Local database only (HomeProfile table) |
| **Create schedules**      | ❌ NOT IMPLEMENTED | No backend endpoint                     |
| **Edit schedules**        | ❌ NOT IMPLEMENTED | No backend endpoint                     |
| **Delete schedules**      | ❌ NOT IMPLEMENTED | No backend endpoint                     |
| **Send device commands**  | ❌ NOT IMPLEMENTED | No Tuya API integration                 |
| **Change target temp**    | ❌ NOT IMPLEMENTED | No device control                       |
| **Switch MANUAL/PROGRAM** | ❌ NOT IMPLEMENTED | Mode tracking local-only                |

### Future Work – Device Control Layer

To enable write operations and unlock full Phase 3 schedule editing, the backend must implement:

#### 1. Tuya Command Protocol Encoder

**Purpose**: Safely encode heating programs into Tuya device format

**Components Needed**:

- Device-specific program encoding (varies by model)
- Binary protocol handler for program generation
- Day-type encoding (WORKDAY, SATURDAY, SUNDAY as device format)
- Interval encoding (startMinute, targetTemp as device bytes)

**Estimated Effort**: 2-3 days

**File Location**: `backend/src/modules/Boiler/adapter/tuya.command.service.ts` (new)

#### 2. Thermostat Program Write Endpoint

**Endpoint**: `PATCH /api/thermostat-device/:id/programs`

**Request Body**:

```typescript
{
  programs: [
    {
      dayType: 'WORKDAY',
      intervals: [
        { startMinute: 390, targetTemp: 22 },  // 6:30 AM → 22°C
        { startMinute: 540, targetTemp: 18 },  // 9:00 AM → 18°C
        ...
      ]
    },
    { dayType: 'SATURDAY', intervals: [...] },
    { dayType: 'SUNDAY', intervals: [...] }
  ]
}
```

**Response**: Updated ThermostatProgram array

**Service Layer**:

- Validate program data (times in range 0-1440, temps in valid range)
- Encode programs using TuyaCommandService
- Call Tuya Cloud API with signed request
- Handle device response (success/failure)
- Update local database on success

**Estimated Effort**: 3-4 days

**Files to Create/Modify**:

- `backend/src/modules/ThermostatDevice/dto/update-programs.dto.ts` (new)
- `backend/src/modules/ThermostatDevice/thermostat.device.service.ts` (add method)
- `backend/src/modules/ThermostatDevice/thermostat.device.controller.ts` (add endpoint)

#### 3. Device Command Execution Service

**Purpose**: Send arbitrary commands to Tuya devices

**Methods Needed**:

```typescript
async sendCommand(deviceId, command, parameters)
async setTargetTemperature(deviceId, temperature)
async setMode(deviceId, mode: 'MANUAL' | 'PROGRAM')
async setPowerState(deviceId, powerOn: boolean)
```

**Estimated Effort**: 2-3 days

**File Location**: `backend/src/modules/Boiler/adapter/tuya.command.executor.ts` (new)

#### 4. Error Recovery & Rollback

**Requirements**:

- Device offline detection (immediate response)
- Command timeout handling (retry logic)
- Partial success recovery (update DB only if device confirms)
- Audit trail (log all command attempts)

**Estimated Effort**: 2-3 days

#### 5. Authorization & Audit Logging

**Requirements**:

- Verify user owns thermostat device
- Log all command attempts (user, timestamp, command, result)
- Rate limiting (prevent command spam)
- Alert on suspicious activity

**Estimated Effort**: 1-2 days

**File Location**: `backend/src/modules/Boiler/services/command-audit.service.ts` (new)

#### Total Backend Effort

Estimated: **2-3 weeks** for full device control implementation

### Phase 3.1: Backend Integration

- [ ] Implement Tuya command protocol encoder
- [ ] Add thermostat program write endpoints
- [ ] Create device command execution service
- [ ] Add error recovery and rollback logic
- [ ] Implement authorization and audit logging
- [ ] Test with real Tuya devices

### Phase 3.2: Frontend Integration (Schedule Editing)

Once backend is ready:

- [ ] Add edit mode to ScheduleManagementScreen
- [ ] Create EditScheduleModal with form validation
- [ ] Implement program creation flow
- [ ] Add delete confirmation dialogs
- [ ] Handle device command errors gracefully
- [ ] Add loading/success/error states

### Phase 3.3: Real Data Integration

- [ ] Replace chart placeholders with actual charts
- [ ] Integrate react-native-chart-kit or Victory Native
- [ ] Fetch historical temperature data
- [ ] Calculate real energy costs

### Phase 3.4: Advanced Features

- [ ] Anomaly detection with notifications
- [ ] Machine learning insights
- [ ] Cost estimation based on local energy rates
- [ ] Export data as CSV/PDF

### Phase 3.5: Notifications

- [ ] Notification history in analytics
- [ ] Push notification preferences per alert type
- [ ] Notification categories (urgent, info, tips)
- [ ] Do-not-disturb schedules

## Testing Checklist

- [ ] Navigation between all screens works
- [ ] Home switching updates dashboard
- [ ] Forms submit correctly with validation
- [ ] Add/Edit/Delete operations work
- [ ] Charts render (placeholder or real)
- [ ] Dark/Light theme works everywhere
- [ ] Responsive layout on various screen sizes
- [ ] React Query caching works
- [ ] Error states display correctly
- [ ] Loading states show spinners/skeletons

## Dependencies

All dependencies already in project:

- `@react-navigation/stack` - Stack navigation
- `@react-navigation/bottom-tabs` - Tab navigation
- `@tanstack/react-query` - Data fetching & caching
- `native-base` - UI components
- `@expo/vector-icons` - Icons
- Expo for push notifications (if Phase 3.5)

No new npm packages required for current implementation.

## File Structure

```
apps/mobile/src/
├── screens/
│   ├── settings/
│   │   └── SettingsScreen.tsx ✓
│   ├── home/
│   │   └── HomeManagementScreen.tsx ✓
│   ├── schedule/
│   │   └── ScheduleManagementScreen.tsx ✓
│   ├── analytics/
│   │   └── AnalyticsScreen.tsx ✓
│   ├── dashboard/
│   │   └── DashboardScreen.tsx (updated)
│   ├── heating/
│   ├── gas/
│   └── auth/
│
├── navigation/
│   ├── MainTabNavigator.tsx (updated)
│   ├── SettingsStackNavigator.tsx ✓
│   ├── RootNavigator.tsx
│
├── services/api/
│   └── homeProfile.api.ts ✓
│
├── components/
├── hooks/
└── config/
```

## Backend Requirements

For Phase 3 to function with current implementation, ensure these endpoints exist:

### Home Profile API (READ + WRITE - Local Database)

```
GET    /api/home-profile                    - List homes ✅
GET    /api/home-profile/:id                - Get home by ID ✅
GET    /api/home-profile/active             - Get active home ✅
POST   /api/home-profile                    - Create home ✅
PATCH  /api/home-profile/:id                - Update home ✅
DELETE /api/home-profile/:id                - Delete home ✅
PATCH  /api/home-profile/:id/activate       - Switch active home ✅
```

### Thermostat Programs (READ-ONLY)

```
GET    /api/thermostat-device/:id/programs  - Fetch programs ✅
                                              (Populated by ProgramSyncService)
```

### Analytics (READ-ONLY)

```
GET    /api/dashboard/metrics               - Heating statistics
GET    /api/dashboard/anomalies             - Heating anomalies
GET    /api/thermostat-device/:id/history   - Temperature history
```

### Device Control (NOT IMPLEMENTED - Future Phase)

```
PATCH  /api/thermostat-device/:id/programs  - ❌ Would write to device
POST   /api/thermostat-device/:id/commands  - ❌ Would send commands
```

**Note**: Device write operations require significant backend enhancement. See "Future Work – Device Control Layer" section.

## Notes for Developers

1. **Multi-home Context**: Consider adding HomeContext to make active home globally available
2. **Chart Library**: When ready to replace placeholders, recommend:
   - `react-native-chart-kit` - Simple bar/line charts
   - `victory-native` - Advanced customization
   - `react-native-svg` - For custom visualizations

3. **Performance**:
   - Home profile list is paginated on backend (add before 100+ homes)
   - Analytics queries should filter by date range
   - Consider caching charts locally

4. **Accessibility**: Ensure all interactive elements have proper touch targets (min 48dp)

5. **Error Handling**: Current implementation uses toasts; consider adding error boundaries for screens
