# V2 Frontend Architecture Documentation

## 📐 System Overview

The v2 frontend consists of two parallel applications (web and mobile) sharing a unified architecture pattern:
- Single API client per platform
- Centralized auth state management
- Consistent theme system
- Feature-parity screens/pages
- Type-safe API communication

## 🏗️ Architecture Patterns

### 1. Global API Client Pattern

Both web and mobile use an **axios-based service class** with centralized concerns:

**Benefits**:
- Single point of failure handling
- Consistent error management (401 redirects)
- Token injection via interceptors
- Request/response transformation
- No repeated API logic

**Web Implementation** (`apps/web/src/services/api.ts`):
```typescript
export class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3020/api',
    });

    // Request interceptor: inject auth header
    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Response interceptor: handle 401
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          localStorage.removeItem('token');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // Typed endpoint methods
  async login(email: string, password: string) { /* ... */ }
  async getDashboard() { /* ... */ }
  async getBoilerEvents() { /* ... */ }
  // ... more methods
}

export const apiClient = new ApiClient();
```

**Mobile Implementation** (`apps/mobile/src/services/api.ts`):
```typescript
const API_BASE_URL = Platform.OS === 'android'
  ? 'http://10.0.2.2:3020/api'  // Android emulator special URL
  : 'http://localhost:3020/api';

export class MobileApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: process.env.EXPO_PUBLIC_API_URL || API_BASE_URL,
    });

    // Same interceptor pattern as web
    // Plus AsyncStorage for token persistence
  }

  // Identical method signatures as web for consistency
  async login(email: string, password: string) { /* ... */ }
  async getDashboard() { /* ... */ }
  // ... same methods
}

export const mobileApiClient = new MobileApiClient();
```

**Key Differences**:
- Web uses `localStorage` (browser API)
- Mobile uses `AsyncStorage` (React Native API)
- Mobile detects Android and uses special localhost address
- Otherwise, API interface is identical

### 2. Context API for State Management

**Auth Context** - Manages user login state and profile

```typescript
// Web: apps/web/src/context/AuthContext.tsx
// Mobile: apps/mobile/src/context/AuthContext.tsx

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // On mount, restore token and load user profile
  useEffect(() => {
    const restoreToken = async () => {
      const token = await getToken(); // localStorage/AsyncStorage
      if (token) {
        apiClient.setToken(token);
        const profile = await apiClient.getUserProfile();
        setUser(profile);
        setIsAuthenticated(true);
      }
      setIsLoading(false);
    };
    restoreToken();
  }, []);

  const login = async (email: string, password: string) => {
    const { token } = await apiClient.login(email, password);
    apiClient.setToken(token);
    const profile = await apiClient.getUserProfile();
    setUser(profile);
    setIsAuthenticated(true);
  };

  const logout = async () => {
    await apiClient.logout();
    clearToken();
    setUser(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
```

**Theme Context** - Manages light/dark mode

```typescript
// Web: apps/web/src/context/ThemeContext.tsx

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC = ({ children }) => {
  const [mode, setMode] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('boiler.theme') as any) || 'light';
  });

  useEffect(() => {
    localStorage.setItem('boiler.theme', mode);
    if (mode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [mode]);

  const toggleMode = () => {
    setMode(prev => prev === 'light' ? 'dark' : 'light');
  };

  return (
    <ThemeContext.Provider value={{ mode, toggleMode }}>
      <ConfigProvider
        theme={mode === 'dark' ? darkTheme : lightTheme}
      >
        {children}
      </ConfigProvider>
    </ThemeContext.Provider>
  );
};

export const useThemeMode = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useThemeMode must be used within ThemeProvider');
  return context;
};
```

### 3. Route Protection Pattern

**Web - Protected Routes** (`apps/web/src/components/ProtectedRoute.tsx`):
```typescript
export const ProtectedRoute: React.FC<Props> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <Spin size="large" />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

// Usage in App.tsx:
<Route
  path="/dashboard"
  element={
    <ProtectedRoute>
      <MainLayout>
        <DashboardPage />
      </MainLayout>
    </ProtectedRoute>
  }
/>
```

**Mobile - Navigator Check** (`apps/mobile/src/RootNavigator.tsx`):
```typescript
export const RootNavigator = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <ActivityIndicator />;
  }

  if (!isAuthenticated) {
    return <LoginStack />;
  }

  return <AppTabs />;
};
```

### 4. Data Fetching Pattern

All pages/screens follow this pattern:

```typescript
// Standard React pattern
const [data, setData] = useState<DataType[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

useEffect(() => {
  const fetchData = async () => {
    try {
      setLoading(true);
      const result = await apiClient.getBoilerEvents();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err.message);
      // For mobile: also show toast
      // For web: error caught by interceptor if 401
    } finally {
      setLoading(false);
    }
  };

  fetchData();
}, []);

// Render
if (loading) return <Spinner />;
if (error) return <ErrorMessage message={error} />;
return <DataDisplay data={data} />;
```

## 🎨 Theme System Architecture

### Web Theme Flow

1. **User toggles** moon/sun icon in MainLayout
2. **ThemeContext.toggleMode()** called
3. **State updated** → renders with opposite mode
4. **localStorage** saved (`'boiler.theme'` = 'light'|'dark')
5. **HTML class** added/removed (`<html class="dark">`)
6. **Tailwind** applies dark: variant styles
7. **Ant Design ConfigProvider** applies algorithm colors

**Example Dark Mode Styling**:
```tsx
// Tailwind dark mode
<div className="bg-white dark:bg-slate-950 text-black dark:text-white">
  {/* Renders different colors based on html.dark class */}
</div>

// Ant Design algorithm
const darkTheme = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: '#ff6b3d',
    // ... other tokens
  }
};
```

### Mobile Theme Flow

1. **User toggles** switch in ProfileScreen
2. **useColorMode().toggleColorMode()** called
3. **NativeBase theme** updates across app
4. **colorModeManager** saves to AsyncStorage
5. **useColorModeValue()** provides responsive colors
6. **Navigation theme** updates (DarkTheme/DefaultTheme)

**Example Color Mode Value**:
```tsx
const bgColor = useColorModeValue('white', 'dark.900');
return (
  <Box bg={bgColor}>
    {/* Renders white in light mode, dark.900 in dark mode */}
  </Box>
);
```

## 🔄 Authentication Flow

### Login Flow (Both Platforms)

```
User Input Email/Password
         ↓
apiClient.login(email, password)
         ↓
POST /auth/login { email, password }
         ↓
Backend returns { token, user }
         ↓
apiClient.setToken(token)
  → localStorage/AsyncStorage: 'token' = token
         ↓
apiClient.getUserProfile()
         ↓
GET /user/profile (with Authorization header)
         ↓
Update Auth Context
  → isAuthenticated = true
  → user = profile data
         ↓
Navigate to Dashboard/DashboardScreen
```

### Logout Flow

```
User clicks Logout Button
         ↓
AuthContext.logout()
         ↓
apiClient.clearToken()
  → Remove from localStorage/AsyncStorage
         ↓
Update Auth Context
  → isAuthenticated = false
  → user = null
         ↓
Navigate to /login / LoginScreen
```

### Token Restoration (On App Load)

```
App mounts
         ↓
AuthProvider useEffect runs
         ↓
Check localStorage/AsyncStorage for 'token'
         ↓
If exists:
  → apiClient.setToken(token)
  → apiClient.getUserProfile()
  → Update Auth Context with user data
  → setIsLoading(false)
         ↓
Render App with authenticated state
```

## 📊 API Client Methods

### Both Platforms Export Same Methods

```typescript
// auth
login(email: string, password: string): Promise<{ token: string; user: User }>
logout(): Promise<void>

// dashboard
getDashboard(): Promise<DashboardData>

// boiler
getBoilerEvents(): Promise<BoilerEvent[]>
getBoilerStatus(): Promise<BoilerStatus>

// heating
getHeatingEvents(): Promise<HeatingEvent[]>
getHeatingAnomalies(): Promise<Anomaly[]>

// weather
getWeather(): Promise<WeatherData>

// recommendations
getReports(): Promise<Recommendation[]>

// user
getUserProfile(): Promise<User>
updateUserProfile(data: Partial<User>): Promise<User>

// gas
getGasReadings(): Promise<GasReading[]>
```

## 🧩 Component Architecture

### Web Components

**Presentational** (No data fetching):
- `StatCard` - Reusable stat display
- `MainLayout` - App shell/header/sidebar

**Container/Smart** (Data fetching):
- `DashboardPage` - Fetches dashboard data, renders StatCard + Table
- `BoilerPage` - Fetches boiler events, renders table
- `HeatingPage` - Fetches heating events, renders table
- `ReportsPage` - Fetches recommendations, renders table
- `ProfilePage` - Loads user profile, handles form submission

### Mobile Screens

**All screens follow same pattern**:
1. Fetch data in useEffect
2. Show loading spinner
3. Display error message if failed
4. Render data with NativeBase components

```typescript
export const BoilerScreen = () => {
  const [data, setData] = useState<BoilerEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const bgColor = useColorModeValue('white', 'dark.900');

  useEffect(() => {
    const load = async () => {
      try {
        const events = await mobileApiClient.getBoilerHistory();
        setData(events);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <Spinner color="brand.400" />;

  return (
    <Box flex={1} bg={bgColor}>
      <FlatList
        data={data}
        renderItem={({ item }) => (
          <Box p={4} borderBottomWidth={1}>
            <Text>{item.startTime}</Text>
          </Box>
        )}
        keyExtractor={item => `${item.id}`}
      />
    </Box>
  );
};
```

## 🔗 Dependency Injection

### Web
```typescript
// App.tsx wraps entire tree
<AuthProvider>
  <ThemeProvider>
    <Router>
      {/* All components have access to useAuth(), useThemeMode() */}
    </Router>
  </ThemeProvider>
</AuthProvider>
```

### Mobile
```typescript
// App.tsx wraps entire tree
<NativeBaseProvider theme={theme} colorModeManager={colorModeManager}>
  <AuthProvider>
    <RootNavigator />
  </AuthProvider>
</NativeBaseProvider>
```

## 📦 Type Safety

### Shared Types (Should be extracted to types package)

```typescript
// types.ts
export interface User {
  id: string;
  email: string;
  name: string;
  homeLocation?: string;
  timezone?: string;
  locale?: string;
}

export interface DashboardData {
  healthScore: number;
  anomalyRate: number;
  activeAlerts: number;
  lastUpdate: string;
  recentEvents: Event[];
}

export interface BoilerEvent {
  id: string;
  startTime: string;
  endTime: string;
  outsideTemp: number;
  suggestedFlowTemp: number;
  actualFlowTemp: number;
}

// ... more types
```

## 🚀 Performance Considerations

### Web
- **Code Splitting**: React Router lazy loads pages
- **CSS**: Tailwind tree-shakes unused styles
- **Bundle**: Ant Design components are tree-shakeable
- **Caching**: API responses can be cached in Context

### Mobile
- **Metro Bundler**: Automatically optimizes for target platform
- **Image Optimization**: Use Expo's image caching
- **FlatList**: Virtualization for long lists (already used in screens)
- **useCallback**: Wrap callbacks to prevent re-renders

## 🔍 Error Handling Strategy

### Network Errors
```typescript
try {
  await apiClient.getDashboard();
} catch (error) {
  if (error.response?.status === 401) {
    // Handled by interceptor - redirects to login
  } else if (error.response?.status === 500) {
    // Server error - show to user
    setError('Server error. Please try again.');
  } else if (error.message === 'Network Error') {
    // No internet - show to user
    setError('No internet connection.');
  } else {
    // Other errors
    setError('Something went wrong.');
  }
}
```

### Component Errors
- Web: Could add error boundaries
- Mobile: Already has JS error handling via Expo

## 📈 Scaling Considerations

### When Adding New Features

1. **Add to API Client**: New method in `apiClient`/`mobileApiClient`
2. **Add Type**: Define interface in `types.ts`
3. **Add Page/Screen**: Create component file
4. **Add Route**: Register in `App.tsx` / `RootNavigator.tsx`
5. **Test**: Manual testing on both platforms

### Sharing Code

Create `apps/shared/` package for:
- Type definitions
- API client base (extend per platform)
- Theme tokens
- Constants/enums

```typescript
// apps/shared/src/types.ts
export interface BoilerEvent { /* ... */ }

// apps/web/src/services/api.ts
import { BoilerEvent } from '@shared/types';

// apps/mobile/src/services/api.ts
import { BoilerEvent } from '@shared/types';
```

## ✅ Implementation Checklist

- ✅ Global API clients created (web + mobile)
- ✅ Auth context with token persistence
- ✅ Theme context with localStorage/AsyncStorage persistence
- ✅ Protected routes for web
- ✅ Route protection for mobile navigator
- ✅ 5 pages created for web
- ✅ 5 screens created for mobile
- ✅ All components connected to API client
- ✅ Dark/light theme support on both platforms
- ✅ Error handling with 401 redirects
- ✅ Responsive design patterns
- ✅ Loading states and spinners
- ✅ Type safety with TypeScript

## 🎯 Next Steps for Production

1. **Extract Shared Types**: Move types to monorepo package
2. **Add Error Boundaries**: Web error boundary component
3. **Add Loading Skeletons**: Better loading experience
4. **Add Toast Notifications**: Mobile: react-native-toast, Web: antd message
5. **Add Analytics**: Sentry or LogRocket for error tracking
6. **Setup CI/CD**: GitHub Actions for build/deploy
7. **Add E2E Tests**: Cypress for web, Detox for mobile
8. **Setup API Mocking**: MSW for development/testing

---

**Architecture Pattern**: Service Layer + Context API + Component-based
**State Management**: Context API (simple, sufficient for current needs)
**API Communication**: Axios with interceptors
**Type Safety**: TypeScript across all platforms
**Styling**: Tailwind (web) + NativeWind (mobile) + NativeBase theme
**Build Tools**: Vite (web), Metro (mobile), Expo
