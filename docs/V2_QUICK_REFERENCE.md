# V2 Frontend - Quick Reference Card

## 🚀 Quick Start Commands

### Web Application
```bash
# Start dev server
cd apps/web && npm run dev
# → http://localhost:5173

# Build for production
cd apps/web && npm run build
```

### Mobile Application
```bash
# Start Expo dev server
cd apps/mobile && npm start

# Run on Android Emulator (in Expo CLI)
Press 'a'

# Run on iOS Simulator (in Expo CLI)
Press 'i'

# Run in Web Browser (in Expo CLI)
Press 'w'
```

---

## 🔐 Test Credentials
```
Email: test@example.com
Password: password123
```

---

## 📱 Navigation

### Web App Routes
```
/login              → Login page
/dashboard          → Main dashboard (default after login)
/boiler             → Boiler history
/heating            → Heating events
/reports            → Daily recommendations
/profile            → User profile
```

### Mobile App Tabs
```
Tab 1: Dashboard     (Speedometer icon)
Tab 2: Boiler       (Flame icon)
Tab 3: Heating      (Thermometer icon)
Tab 4: Profile      (Person icon)
```

---

## 🎨 Theme Toggle

### Web
- Click **Moon/Sun icon** in top-right header
- Theme persists via localStorage

### Mobile
- Go to **Profile screen** (person icon tab)
- Toggle the **Switch** at the bottom
- Theme persists via AsyncStorage

---

## 🔗 API Base URLs

### Web
```
http://localhost:3020/api
```

### Mobile
```
Android:  http://10.0.2.2:3020/api
iOS:      http://localhost:3020/api
```

---

## 📁 Key Files

### Web App
| File | Purpose |
|------|---------|
| `src/services/api.ts` | Global HTTP client |
| `src/context/AuthContext.tsx` | Auth state management |
| `src/context/ThemeContext.tsx` | Dark mode state |
| `src/App.tsx` | Route configuration |
| `src/components/MainLayout.tsx` | App shell |
| `src/pages/*.tsx` | Page components |

### Mobile App
| File | Purpose |
|------|---------|
| `src/services/api.ts` | Global HTTP client |
| `src/context/AuthContext.tsx` | Auth state management |
| `src/theme/theme.ts` | NativeBase theme |
| `src/theme/colorModeManager.ts` | Theme persistence |
| `src/RootNavigator.tsx` | Navigation setup |
| `src/screens/*.tsx` | Screen components |

---

## 🎯 Using the API Client

### Web
```typescript
import { apiClient } from '../services/api';

// Login
const { token } = await apiClient.login('test@example.com', 'password123');

// Get data
const dashboard = await apiClient.getDashboard();
const boiler = await apiClient.getBoilerEvents();
const heating = await apiClient.getHeatingEvents();
const reports = await apiClient.getReports();
const user = await apiClient.getUserProfile();

// Update data
await apiClient.updateUserProfile({
  name: 'New Name',
  homeLocation: 'New Location'
});

// Logout
await apiClient.logout();
```

### Mobile
```typescript
import { mobileApiClient } from '../services/api';

// Same interface as web!
const { token } = await mobileApiClient.login('test@example.com', 'password123');
const dashboard = await mobileApiClient.getDashboard();
// ... etc
```

---

## 🪝 Using Auth Hook

### Web & Mobile
```typescript
import { useAuth } from '../hooks/useAuth'; // or context

export const MyComponent = () => {
  const { user, isAuthenticated, login, logout } = useAuth();

  if (!isAuthenticated) {
    return <div>Please login</div>;
  }

  return <div>Hello, {user?.name}</div>;
};
```

---

## 🎨 Using Theme Hook

### Web
```typescript
import { useThemeMode } from '../context/ThemeContext';

export const MyComponent = () => {
  const { mode, toggleMode } = useThemeMode();

  return (
    <div className={mode === 'dark' ? 'dark' : ''}>
      <button onClick={toggleMode}>Toggle Theme</button>
    </div>
  );
};
```

### Mobile
```typescript
import { useColorMode } from 'native-base';

export const MyScreen = () => {
  const { colorMode, toggleColorMode } = useColorMode();

  return (
    <Box>
      <Button onPress={toggleColorMode}>
        Switch to {colorMode === 'light' ? 'dark' : 'light'}
      </Button>
    </Box>
  );
};
```

---

## 📊 Common Data Types

```typescript
interface User {
  id: string;
  email: string;
  name: string;
  homeLocation?: string;
  timezone?: string;
  locale?: string;
}

interface DashboardData {
  healthScore: number;
  anomalyRate: number;
  activeAlerts: number;
  lastUpdate: string;
  recentEvents: Event[];
}

interface BoilerEvent {
  id: string;
  startTime: string;
  endTime: string;
  outsideTemp: number;
  suggestedFlowTemp: number;
  actualFlowTemp: number;
}

interface HeatingEvent {
  id: string;
  startTime: string;
  endTime: string;
  roomTemp: number;
  targetTemp: number;
  hasAnomaly: boolean;
}
```

---

## 🛠️ Common Tasks

### Add a New Page (Web)

1. **Create component** in `src/pages/MyNewPage.tsx`
2. **Fetch data** using apiClient
3. **Add route** in `src/App.tsx`:
```typescript
<Route
  path="/my-new-page"
  element={
    <ProtectedRoute>
      <MainLayout>
        <MyNewPage />
      </MainLayout>
    </ProtectedRoute>
  }
/>
```

### Add a New Screen (Mobile)

1. **Create component** in `src/screens/MyNewScreen.tsx`
2. **Fetch data** using mobileApiClient
3. **Add to navigation** in `src/RootNavigator.tsx`:
```typescript
<Tab.Screen
  name="MyScreen"
  component={MyNewScreen}
  options={{
    tabBarIcon: ({ color, size }) => (
      <Ionicons name="icon-name" size={size} color={color} />
    ),
  }}
/>
```

### Add an API Endpoint

1. **Add method** to `src/services/api.ts` (web & mobile):
```typescript
async getMyNewData() {
  const response = await this.client.get('/my-endpoint');
  return response.data;
}
```

2. **Use in component**:
```typescript
const data = await apiClient.getMyNewData();
```

---

## ❌ Troubleshooting Quick Fixes

| Issue | Fix |
|-------|-----|
| Port 5173 in use | Kill process on 5173 or use `npm run dev -- --port 5174` |
| 401 errors | Login again, clear localStorage |
| Dark mode not visible | Ensure `html.dark` class is applied |
| Mobile can't reach API | Verify Android is using `10.0.2.2` |
| Theme not persisting | Check localStorage/AsyncStorage keys |
| Dependencies error | Run `npm install --legacy-peer-deps` |
| Metro bundler error | Run `npm start -- --reset-cache` |

---

## 📦 Dependencies Overview

### Web
- **react**: UI library
- **axios**: HTTP client
- **react-router-dom**: Navigation
- **antd**: UI components
- **tailwindcss**: Styling
- **typescript**: Type safety

### Mobile
- **react-native**: Mobile framework
- **expo**: Development platform
- **axios**: HTTP client
- **native-base**: UI components
- **react-navigation**: Navigation
- **typescript**: Type safety

---

## 🔄 Data Flow

```
User Action
    ↓
Hook/Component triggered
    ↓
Call apiClient.getData()
    ↓
Axios sends request with token header
    ↓
Interceptor adds Authorization header
    ↓
Backend processes, returns data/error
    ↓
Interceptor catches 401 → redirect to login
    ↓
Component receives data/error
    ↓
setState(data) or showError(error)
    ↓
Component re-renders with new data
    ↓
User sees results
```

---

## 🧪 Testing Checklist Quick Form

**Web App Testing**:
- [ ] Login works
- [ ] All pages load
- [ ] Theme toggle works
- [ ] Dark mode looks good
- [ ] Logout works
- [ ] Refresh maintains login

**Mobile App Testing**:
- [ ] Login works
- [ ] All screens load
- [ ] Tab navigation works
- [ ] Theme toggle works
- [ ] Dark mode looks good
- [ ] Logout works

---

## 🎓 Learning Resources

**For Web Developers**:
- Ant Design: https://ant.design
- React Router: https://reactrouter.com
- Tailwind CSS: https://tailwindcss.com

**For Mobile Developers**:
- React Native: https://reactnative.dev
- Expo: https://expo.dev
- NativeBase: https://nativebase.io
- React Navigation: https://reactnavigation.org

---

## 📋 Important Notes

1. **Environment Variables**:
   - Web: `VITE_API_URL` in `.env.local`
   - Mobile: `EXPO_PUBLIC_API_URL` in `.env`

2. **Token Storage**:
   - Web: localStorage (key: `'token'`)
   - Mobile: AsyncStorage (key: `'@auth.token'`)

3. **Theme Storage**:
   - Web: localStorage (key: `'boiler.theme'`)
   - Mobile: AsyncStorage (key: `'@boiler-theme-mode'`)

4. **Both apps use SAME API endpoints**:
   - `/auth/login`
   - `/dashboard`
   - `/boiler/history`
   - `/heating-events`
   - `/recommendations`
   - `/user/profile`
   - etc.

---

## 🚀 Ready to Deploy?

When ready for production:

1. **Web**:
   ```bash
   cd apps/web
   npm run build
   # Upload dist/ folder to hosting
   ```

2. **Mobile**:
   ```bash
   cd apps/mobile
   eas build  # Or: expo build
   # Follow prompts for App Store/Play Store
   ```

3. **Environment URLs**:
   - Update API URLs to production server
   - Verify HTTPS is enabled
   - Test on real devices

---

**V2 Frontend Quick Reference - Complete ✅**
**Last Updated: 2025-02-02**
**Status: Ready for Testing & Deployment** 🚀
