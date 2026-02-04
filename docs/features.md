# Boiler Control System - Features Guide

**Last Updated:** February 4, 2026 | **Status:** Mostly Complete (Phase 5 In Progress)

---

## 📋 Quick Overview

The boiler control system manages residential heating with intelligent scheduling, anomaly detection, and multi-platform access. Features are organized by category below.

---

## 🔐 Authentication & User Management

### Login & Registration
- **Status**: ✅ Complete
- **Frontend**: `/frontend/src/pages/LoginPage.tsx`, `AuthContext.tsx`
- **Mobile**: `apps/mobile/src/screens/LoginScreen.tsx`
- **Backend**: `backend/src/modules/Auth/`
- **Endpoints**:
  - `POST /auth/login` - Login user
  - `POST /auth/register` - Register new account
  - `GET /auth/profile` - Get current user

**Features**:
- Email/password authentication
- JWT token persistence (localStorage web, AsyncStorage mobile)
- Auto-logout on 401 (token expiry)
- Automatic token injection via interceptor
- Error handling with user-friendly messages

---

## 📊 Dashboard

### Main Dashboard
- **Status**: ✅ Complete
- **Frontend**: `/frontend/src/pages/DashboardPage.tsx`
- **Mobile**: `apps/mobile/src/screens/DashboardScreen.tsx`
- **Backend**: `backend/src/modules/Dashboard/`
- **Endpoint**: `GET /dashboard`

**Data Displayed**:
- Health score (system status)
- Active alerts count
- Recent heating events (7-day window)
- Thermostat status
- Weather data (temperature, humidity, conditions)
- Boiler status
- Notifications drawer (unread only by default)

**Features**:
- Real-time status cards
- Event timeline
- Weather widget
- Dark mode support
- Responsive design
- Loading skeletons
- Consistent spacing (8px grid)

---

## 🌡️ Heating & Thermostat

### Thermostat Status
- **Status**: ✅ Complete (Live Data)
- **Frontend**: `/frontend/src/pages/HeatingPage.tsx`
- **Mobile**: `apps/mobile/src/screens/HeatingScreen.tsx` (NEW - live data)
- **Backend**: `backend/src/modules/Dashboard/` (provides heating status)
- **Endpoint**: `GET /dashboard` (includes heating status)

**Data Tracked**:
- Current temperature
- Target temperature
- Heating active/idle state
- Temperature difference
- Thermostat name
- Last update time

**Features**:
- Real-time status from dashboard API
- Auto-refresh every 1 minute
- Pull-to-refresh manual update
- Color-coded heating status (red = active, blue = idle)
- Loading states
- Error handling

### Heating Schedules (Read-Only)
- **Status**: ✅ Complete
- **Frontend**: `/frontend/src/pages/HeatingSchedulePage.tsx`
- **Mobile**: `apps/mobile/src/screens/ScheduleManagementScreen.tsx`
- **Backend**: `backend/src/modules/Boiler/`
- **Endpoints**:
  - `GET /thermostat-device` - List thermostats
  - `GET /thermostat-device/:id/programs` - Get programs

**Features**: Program display, auto-refresh, Tuya sync

---

## ⛽ Gas Readings & Analytics

### Gas Readings Management
- **Status**: ✅ Complete
- **Frontend**: `/frontend/src/pages/GasReadingsPage.tsx`
- **Mobile**: `apps/mobile/src/screens/GasReadingsScreen.tsx`
- **Backend**: `backend/src/modules/Gas/`
- **Endpoints**:
  - `GET /gas/readings` - List all readings
  - `POST /gas/readings` - Add reading (with daily limit check)
  - `DELETE /gas/readings/:id` - Delete reading

**Features**:
- ✅ View all readings (sorted newest first)
- ✅ Add readings with date/time picker
- ✅ Delete readings with confirmation
- ✅ Automatic consumption calculation
- ✅ Daily average calculation
- ✅ CSV export (web)
- ✅ Dark mode support
- 🔄 **Daily Limit** (NEW): One reading per day enforced by backend (409 Conflict if duplicate)
- 🔄 **Mobile UI Check**: Shows warning if today's entry exists before submission
- ✅ Responsive design

### Gas Analytics
- **Status**: ✅ Complete
- **Frontend**: `/frontend/src/pages/GasAnalyticsPage.tsx`
- **Mobile**: `apps/mobile/src/screens/GasAnalyticsScreen.tsx`
- **Backend**: `backend/src/modules/Gas/`

**Metrics**:
- Total consumption (m³)
- Average daily consumption
- Min/max readings
- Median consumption
- Standard deviation
- Trend analysis

---

## 🔔 Notifications

### Notification Management
- **Status**: ✅ Complete
- **Frontend**: `/frontend/src/pages/NotificationsPage.tsx`
- **Mobile**: `apps/mobile/src/screens/NotificationsScreen.tsx`
- **Backend**: `backend/src/modules/Notification/`
- **Endpoints**:
  - `GET /notifications` - Get all notifications
  - `POST /notifications/:id/read` - Mark as read
  - `POST /notifications/mark-all-read` - Mark all as read

**Features**:
- ✅ Unread/all toggle view
- ✅ Mark individual notifications as read (click/tap)
- ✅ Mark all as read (bulk action)
- ✅ Badge showing unread count
- ✅ Automatic polling (1 min stale time)
- ✅ isRead field distinguishes read/unread state
- ✅ Dark mode support
- ✅ Cross-platform parity

### Push Notifications
- **Status**: ✅ Complete
- **Backend**: `backend/src/modules/Notification/`

**Types**:
- System alerts
- Heating status changes
- Anomaly detection
- Recommendations
- Gas reading reminders (daily at 6:30 AM UTC)

**Features**: Debouncing, auto-retry, payload with navigation data

### Gas Reading Reminders
- **Status**: ✅ Complete
- **Backend Cron**: Daily at 6:30 AM UTC
- **Mobile Channel**: 'gas_reminder' (Android)
- **Deep Link**: Opens GasReadingsScreen with add modal

**Test Endpoints**:
- `POST /notifications/test-gas-reminder` - Send test reminder
- `POST /notifications/test-trigger-all-gas-reminders` - Send all reminders

---

## 🌤️ Weather Integration

### Current Weather
- **Status**: ✅ Complete
- **Backend**: `backend/src/modules/Weather/`
- **Endpoint**: `GET /weather/current/:homeProfileId`

**Data**: Temperature, feels-like, condition, humidity, wind speed, min/max

**Features**:
- Real-time updates
- Location-based (from HomeProfile)
- Fallback chain: currentWeather → dashboard weather → null
- Integration with flow temperature engine

---

## 💡 Boiler & Heating Logic

### Flow Temperature Engine
- **Status**: ✅ Complete
- **Backend**: `backend/src/modules/Heating/engine/`

**Features**:
- AI-driven optimal flow temperature calculation
- Seasonal adjustment
- Weather-based adaptation
- Machine learning integration

### Boiler History
- **Status**: ✅ Complete
- **Backend**: `backend/src/modules/Boiler/`

**Features**: Hourly logging, trend analysis, performance metrics

---

## 📈 Recommendations

### Daily Recommendations
- **Status**: ✅ Complete
- **Backend**: `backend/src/modules/HeatingRecommendation/`

**Features**:
- Daily generation at midnight
- Machine learning based
- 7-day history analysis
- Actionable insights

### Anomaly Detection
- **Status**: ✅ Complete
- **Backend**: `backend/src/modules/HeatingAnomalyCheckerService/`

**Features**:
- Real-time detection
- Heating cycle analysis
- Suggested corrective actions
- Alert notifications

---

## 👤 User Profile & Settings

### Home Profile Management
- **Status**: ⚠️ Partial
- **Frontend**: `/frontend/src/pages/HomeManagementPage.tsx`
- **Mobile**: `apps/mobile/src/screens/HomeManagementScreen.tsx`
- **Backend**: `backend/src/modules/HomeProfile/`

**Features**: Multiple homes, active home switching, location-based features

**Known Issues**: API endpoints need verification

### User Profile
- **Status**: ✅ Mostly Complete
- **Features**: Profile view, theme selector, language selector (NEW)

### Settings
- **Status**: 🔄 In Progress (Phase 5)
- **Features**:
  - Dark mode toggle ✅
  - Language selector (en-US, bs-BS) 🔄 NEW
  - Daily gas reminder toggle (deduplicated) 🔄
  - Logout 🔄

---

## 🌐 Localization (Phase 5 - NEW)

### i18n Support
- **Status**: ✅ Complete (Phase 5)
- **Framework**: i18next + react-i18next
- **Locales**: en-US (default), bs-BS
- **Scope**: All user-facing screens

**Translated Sections**:
- ✅ Authentication (login, register, errors)
- ✅ Dashboard (title, overview, cards)
- ✅ Heating (status, temperatures, messages)
- ✅ Gas (readings, analytics, forms)
- ✅ Notifications (preferences, messages)
- ✅ Settings (all options)
- ✅ Errors (all error messages)

**Implementation**:
- Config: `apps/mobile/src/locales/config.ts`
- Hook: `apps/mobile/src/hooks/useTranslation.ts`
- Usage: `const { t } = useTranslation(); t('dashboard.title')`
- Web: `frontend/src/locales/config.ts`

---

## 🔧 Error Handling (Phase 5 - NEW)

### Mobile Error Handler
- **Status**: ✅ Complete (Phase 5)
- **Location**: `apps/mobile/src/services/api/error.handler.ts`
- **Features**:
  - Centralized error parsing
  - User-friendly messages
  - Network error detection
  - HTTP status mapping
  - Toast notifications
  - Console logging

**Usage**:
```typescript
const { showError } = useErrorHandler();
showError(error, 'Custom message');
```

---

## 🎯 Feature Status Summary

| Feature | Status | Web | Mobile | Backend | Notes |
|---------|--------|-----|--------|---------|-------|
| **Auth** | ✅ | ✅ | ✅ | ✅ | Full JWT flow |
| **Dashboard** | ✅ | ✅ | ✅ | ✅ | Real data, responsive |
| **Heating Status** | ✅ | ✅ | ✅ | ✅ | Live data, auto-refresh |
| **Gas Readings** | ✅ | ✅ | ✅ | ✅ | Daily limit enforced |
| **Gas Analytics** | ✅ | ✅ | ✅ | ✅ | Trend analysis |
| **Notifications** | ✅ | ✅ | ✅ | ✅ | Read/unread, mark all |
| **Gas Reminders** | ✅ | — | ✅ | ✅ | Daily cron, channels |
| **Weather** | ✅ | — | ✅ | ✅ | Real-time, fallback |
| **Recommendations** | ✅ | ✅ | ✅ | ✅ | ML-based |
| **Anomalies** | ✅ | ✅ | ✅ | ✅ | Real-time detection |
| **Heating Schedules** | ✅ | ✅ | ✅ | ✅ | Read-only |
| **Boiler History** | ✅ | ✅ | ✅ | ✅ | Hourly logging |
| **Home Profiles** | ⚠️ | ✅ UI | ✅ UI | ⚠️ | API verify needed |
| **User Profile** | ✅ | ✅ | ✅ | ✅ | Edit partial |
| **i18n** | ✅ | ✅ | ✅ | — | en-US, bs-BS |
| **Error Handling** | ✅ | — | ✅ | — | Mobile focused |
| **Localization** | ✅ | ✅ | ✅ | — | Complete Phase 5 |

---

## 📋 Phase Status

- **Phase 1-3**: ✅ Complete (Core features, gas, heating)
- **Phase 4**: ✅ Complete (Production build fix, notifications)
- **Phase 5**: 🔄 In Progress (Docs, i18n, error handling, gas daily limit)
  - ✅ Docs reorganization (copilot-instructions, features, api-reference)
  - ✅ Global error handling (mobile)
  - ✅ HeatingScreen live data
  - ✅ i18n setup (en-US, bs-BS)
  - ✅ Gas daily limit validation
  - ✅ Gas reminder channels
  - 🔄 Settings deduplication
  - 🔄 Dashboard UI polish
