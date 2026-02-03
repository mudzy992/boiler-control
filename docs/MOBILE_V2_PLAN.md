# Boiler Control Mobile App V2 - Implementation Plan

## 📋 Executive Summary

This document outlines the comprehensive implementation plan for the Boiler Control Mobile App V2, built from scratch in the monorepo under `apps/mobile/`. The app will achieve **feature parity with the web frontend** while leveraging mobile-native capabilities like push notifications.

---

## 🎯 Core Objectives

1. **Feature Parity**: Match all web app functionality on mobile
2. **Push Notifications**: Full integration with backend notification system
3. **Professional UI**: NativeBase + NativeWind with light/dark themes
4. **Monorepo Integration**: Seamless integration with existing backend
5. **Modern Architecture**: TypeScript, React Query, proper state management

---

## 🏗️ Architecture Overview

### Technology Stack

```yaml
Core:
  - Expo SDK 52 (latest stable)
  - React Native 0.76
  - TypeScript 5.x

UI Framework:
  - NativeBase 3.4.x (primary component library)
  - NativeWind 4.x (Tailwind CSS for RN)
  - React Native SVG (charts/icons)
  - Expo Vector Icons (icon library)

Navigation:
  - React Navigation 6.x
  - Stack Navigator (auth flow)
  - Bottom Tab Navigator (main app)
  - Material Top Tabs (nested navigation)

State Management:
  - React Context (auth, theme)
  - TanStack Query v5 (API state, caching)
  - AsyncStorage (persistence)

API & Services:
  - Axios (HTTP client)
  - Expo Notifications (push notifications)
  - Expo Device (device info)
  - Expo Constants (config)

Development:
  - ESLint + Prettier
  - Jest + React Native Testing Library
  - EAS Build (CI/CD)
```

---

## 📁 Folder Structure

```
apps/mobile/
├── app.json                      # Expo configuration
├── app.config.ts                 # Dynamic Expo config
├── eas.json                      # EAS build configuration
├── babel.config.js               # Babel with NativeWind
├── metro.config.js               # Metro bundler config
├── package.json                  # Dependencies
├── tsconfig.json                 # TypeScript config
├── .env.example                  # Environment variables template
│
├── assets/                       # Static assets
│   ├── icon.png                  # App icon (1024x1024)
│   ├── splash.png                # Splash screen
│   ├── adaptive-icon.png         # Android adaptive icon
│   ├── notification-icon.png     # Notification icon (Android)
│   └── fonts/                    # Custom fonts (if needed)
│
├── src/
│   ├── App.tsx                   # Root component with providers
│   │
│   ├── navigation/               # Navigation configuration
│   │   ├── RootNavigator.tsx     # Root stack (auth flow)
│   │   ├── MainTabNavigator.tsx  # Bottom tabs (Dashboard, Heating, Gas, Profile)
│   │   ├── types.ts              # Navigation type definitions
│   │   └── linking.ts            # Deep linking configuration
│   │
│   ├── screens/                  # Screen components
│   │   ├── auth/
│   │   │   ├── LoginScreen.tsx
│   │   │   └── RegisterScreen.tsx
│   │   │
│   │   ├── dashboard/
│   │   │   ├── DashboardScreen.tsx       # Main dashboard (Today, Week, Month tabs)
│   │   │   ├── DashboardTodayTab.tsx     # Today's data
│   │   │   ├── DashboardWeekTab.tsx      # Weekly graph
│   │   │   └── DashboardMonthTab.tsx     # Monthly trends
│   │   │
│   │   ├── heating/
│   │   │   ├── HeatingScreen.tsx         # Heating events list
│   │   │   ├── HeatingEventDetails.tsx   # Event detail modal
│   │   │   └── HeatingStatsScreen.tsx    # Heating statistics
│   │   │
│   │   ├── gas/
│   │   │   ├── GasScreen.tsx             # Gas readings list
│   │   │   ├── AddGasReadingScreen.tsx   # Add new reading
│   │   │   └── GasAnalysisScreen.tsx     # Gas analysis chart
│   │   │
│   │   ├── boiler/
│   │   │   └── BoilerHistoryScreen.tsx   # Boiler event history
│   │   │
│   │   ├── notifications/
│   │   │   ├── NotificationsScreen.tsx   # Notification inbox
│   │   │   └── NotificationSettings.tsx  # Notification preferences
│   │   │
│   │   ├── profile/
│   │   │   ├── ProfileScreen.tsx         # User profile & settings
│   │   │   ├── HomeProfileScreen.tsx     # Home profile settings
│   │   │   └── AccountSettingsScreen.tsx # Account details
│   │   │
│   │   └── recommendations/
│   │       └── RecommendationsScreen.tsx # Heating recommendations
│   │
│   ├── components/               # Reusable components
│   │   ├── common/               # Generic components
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── LoadingSpinner.tsx
│   │   │   ├── EmptyState.tsx
│   │   │   ├── ErrorBoundary.tsx
│   │   │   └── RefreshControl.tsx
│   │   │
│   │   ├── dashboard/            # Dashboard-specific components
│   │   │   ├── MetricCard.tsx            # Large metric display
│   │   │   ├── SplitMetricCard.tsx       # Split metric card
│   │   │   ├── WeatherCard.tsx           # Weather display
│   │   │   ├── BoilerCard.tsx            # Boiler status
│   │   │   ├── ThermostatCard.tsx        # Thermostat display
│   │   │   ├── AlertsCard.tsx            # Alerts/warnings
│   │   │   └── HeatingChart.tsx          # Column chart wrapper
│   │   │
│   │   ├── heating/              # Heating-specific components
│   │   │   ├── HeatingEventCard.tsx      # Event list item
│   │   │   ├── AnomalyBadge.tsx          # Anomaly indicator
│   │   │   └── HeatingStatusIndicator.tsx
│   │   │
│   │   ├── gas/                  # Gas-specific components
│   │   │   ├── GasReadingCard.tsx        # Reading list item
│   │   │   └── GasForm.tsx               # Reading input form
│   │   │
│   │   ├── notifications/        # Notification components
│   │   │   ├── NotificationCard.tsx      # Notification list item
│   │   │   ├── NotificationBadge.tsx     # Unread count badge
│   │   │   └── NotificationPreference.tsx # Preference toggle item
│   │   │
│   │   └── layout/               # Layout components
│   │       ├── Screen.tsx                # Standard screen wrapper
│   │       ├── ScrollContainer.tsx       # Scrollable container
│   │       └── SafeArea.tsx              # Safe area wrapper
│   │
│   ├── services/                 # API and external services
│   │   ├── api/
│   │   │   ├── client.ts                 # Axios client configuration
│   │   │   ├── auth.api.ts               # Auth endpoints
│   │   │   ├── dashboard.api.ts          # Dashboard endpoints
│   │   │   ├── heating.api.ts            # Heating endpoints
│   │   │   ├── gas.api.ts                # Gas endpoints
│   │   │   ├── boiler.api.ts             # Boiler endpoints
│   │   │   ├── notifications.api.ts      # Notification endpoints
│   │   │   ├── profile.api.ts            # Profile endpoints
│   │   │   └── types.ts                  # API type definitions
│   │   │
│   │   ├── notifications/
│   │   │   ├── NotificationService.ts    # Push notification handler
│   │   │   ├── registerForPush.ts        # Token registration
│   │   │   └── handlers.ts               # Notification tap handlers
│   │   │
│   │   └── storage/
│   │       ├── SecureStorage.ts          # Secure token storage
│   │       └── AppStorage.ts             # General app storage
│   │
│   ├── hooks/                    # Custom React hooks
│   │   ├── useAuth.ts                    # Authentication hook
│   │   ├── useColorMode.ts               # Theme hook
│   │   ├── useNotifications.ts           # Notification hooks
│   │   ├── useDashboard.ts               # Dashboard data hook (React Query)
│   │   ├── useHeating.ts                 # Heating data hook
│   │   ├── useGas.ts                     # Gas data hook
│   │   ├── useRefresh.ts                 # Pull-to-refresh hook
│   │   └── useDebounce.ts                # Debounce hook
│   │
│   ├── context/                  # React Context providers
│   │   ├── AuthContext.tsx               # Auth state + actions
│   │   ├── ThemeContext.tsx              # Theme state (if needed beyond NativeBase)
│   │   └── NotificationContext.tsx       # Notification state
│   │
│   ├── theme/                    # Theming configuration
│   │   ├── theme.ts                      # NativeBase theme extension
│   │   ├── colors.ts                     # Color palette
│   │   ├── colorModeManager.ts           # Dark mode persistence
│   │   └── tailwind.config.js            # NativeWind config
│   │
│   ├── utils/                    # Utility functions
│   │   ├── date.ts                       # Date formatting helpers
│   │   ├── format.ts                     # Number/text formatting
│   │   ├── validation.ts                 # Form validation
│   │   ├── constants.ts                  # App constants
│   │   └── env.ts                        # Environment variable helpers
│   │
│   ├── types/                    # TypeScript type definitions
│   │   ├── api.ts                        # API response types
│   │   ├── models.ts                     # Data models
│   │   ├── navigation.ts                 # Navigation types (if not in navigation/)
│   │   └── index.ts                      # Barrel exports
│   │
│   └── config/                   # App configuration
│       ├── api.config.ts                 # API base URLs
│       ├── app.config.ts                 # App constants
│       └── notifications.config.ts       # Notification settings
│
└── __tests__/                    # Test files
    ├── components/
    ├── hooks/
    ├── screens/
    └── utils/
```

---

## 🔐 Authentication Flow

### Implementation Strategy

```typescript
// src/context/AuthContext.tsx

export interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
}

export const AuthProvider: React.FC = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session from AsyncStorage on app launch
  const restoreSession = async () => {
    try {
      const savedToken = await SecureStorage.getToken();
      if (savedToken) {
        setToken(savedToken);
        apiClient.setToken(savedToken);
        // Fetch user profile
        const userData = await apiClient.getMe();
        setUser(userData);
      }
    } catch (error) {
      await logout(); // Clear invalid token
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const response = await apiClient.login(email, password);
    setToken(response.token);
    setUser(response.user);
    await SecureStorage.setToken(response.token);
    apiClient.setToken(response.token);
  };

  const logout = async () => {
    setUser(null);
    setToken(null);
    await SecureStorage.removeToken();
    apiClient.clearToken();
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, isAuthenticated: !!token, login, register, logout, restoreSession }}>
      {children}
    </AuthContext.Provider>
  );
};
```

### Navigation Flow

```typescript
// src/navigation/RootNavigator.tsx

export const RootNavigator = () => {
  const { isAuthenticated, isLoading, restoreSession } = useAuth();

  useEffect(() => {
    restoreSession();
  }, []);

  if (isLoading) {
    return <SplashScreen />; // Or loading spinner
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          // Auth Stack
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        ) : (
          // Main App Stack
          <>
            <Stack.Screen name="Main" component={MainTabNavigator} />
            <Stack.Screen name="HeatingEventDetails" component={HeatingEventDetailsScreen} />
            <Stack.Screen name="AddGasReading" component={AddGasReadingScreen} />
            <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
            {/* Other modal screens */}
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};
```

---

## 📱 Screen Implementations

### 1. Dashboard Screen (Main)

**Layout**: Material Top Tabs (Today | Week | Month)

#### **Today Tab**
- Hero metric: Home Health Score (large colored card)
- Weather card (current conditions)
- Boiler status card (flow temps, external temp)
- Thermostats grid (2 columns)
- Active Alerts card
- Recent recommendations
- Pull-to-refresh

#### **Week Tab**
- Column chart (heating duration per day)
- Weekly statistics (total hours, avg cycles, efficiency)
- Date range selector

#### **Month Tab**
- Monthly trends chart
- Comparison with previous month
- Cost estimates (if gas data available)

**Data Source**: Web app `DashboardPage.tsx` patterns

```typescript
// Use React Query for data fetching
const { data, isLoading, refetch } = useQuery({
  queryKey: ['dashboard'],
  queryFn: () => apiClient.getDashboard(),
  staleTime: 1000 * 60, // 1 minute
});
```

---

### 2. Heating Events Screen

**Features**:
- FlatList with heating events
- Filter by date range (modal picker)
- Search by temperature range
- Anomaly badge (red/green)
- Tap event → Detail modal with:
  - Duration graph
  - Temperature timeline
  - Anomaly explanation (if applicable)
  - Cycle details

**Data Source**: `/api/dashboard/heating-events` endpoint

---

### 3. Gas Readings Screen

**Features**:
- List of gas readings (FlatList)
- FAB (Floating Action Button) to add reading
- Add reading modal:
  - Date picker
  - Number input (meter reading)
  - Confirm button
- Analysis tab:
  - Usage chart
  - Cost calculation
  - Trends

**Data Source**: `/api/gas/readings` and `/api/gas/analysis`

---

### 4. Notifications Screen

**Features**:
- List of notifications (grouped by date)
- Unread count badge on tab icon
- Mark as read on tap
- Swipe actions (mark read, delete)
- Settings icon → Notification Preferences screen
  - 6 toggles (matching backend notification types)
  - Croatian labels
  - Info banner explaining each type

**Data Source**: `/api/notifications` and `/api/notifications/preferences`

**Integration**: Matches web app `DashboardPage.tsx` notification drawer

---

### 5. Profile Screen

**Sections**:
1. **User Info** (card)
   - Name, email
   - Edit button → Account Settings

2. **Home Profile** (card)
   - Floor area, location
   - Edit button → Home Profile Screen

3. **Appearance** (card)
   - Dark mode toggle
   - Theme selector (if multiple themes)

4. **Notifications** (card)
   - Push notification status
   - Link to notification settings

5. **About** (card)
   - App version
   - Backend API version
   - Terms & Privacy links

6. **Sign Out** (button)

---

## 🔔 Push Notifications Implementation

### Registration Flow

```typescript
// src/services/notifications/registerForPush.ts

export async function registerForPushNotifications(): Promise<string | null> {
  // 1. Check if physical device
  if (!Device.isDevice) {
    console.warn('Push notifications only work on physical devices');
    return null;
  }

  // 2. Request permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    Alert.alert('Permission Required', 'Please enable notifications in settings');
    return null;
  }

  // 3. Get Expo push token
  const token = await Notifications.getExpoPushTokenAsync({
    projectId: Constants.expoConfig?.extra?.eas?.projectId,
  });

  // 4. Configure Android notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Boiler Alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#ff6b3d',
      sound: 'default',
    });
  }

  // 5. Send token to backend
  try {
    await apiClient.registerPushToken(token.data);
    await AppStorage.set('push_token', token.data);
  } catch (error) {
    console.error('Failed to register push token:', error);
  }

  return token.data;
}
```

### Notification Handler

```typescript
// src/services/notifications/NotificationService.ts

export class NotificationService {
  private notificationListener: Subscription | null = null;
  private responseListener: Subscription | null = null;

  initialize() {
    // Set notification handler (foreground behavior)
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });

    // Listen for notifications received while app is foregrounded
    this.notificationListener = Notifications.addNotificationReceivedListener(
      this.handleNotificationReceived
    );

    // Listen for user interactions with notifications
    this.responseListener = Notifications.addNotificationResponseReceivedListener(
      this.handleNotificationResponse
    );

    // Register for push on app launch
    registerForPushNotifications();
  }

  private handleNotificationReceived = (notification: Notification) => {
    console.log('Notification received:', notification);
    // Update badge count, show in-app banner, etc.
  };

  private handleNotificationResponse = (response: NotificationResponse) => {
    const data = response.notification.request.content.data;

    // Navigate based on notification type
    switch (data.type) {
      case 'HEATING_ANOMALY_DETECTED':
        navigationRef.navigate('HeatingEventDetails', { eventId: data.eventId });
        break;
      case 'BOILER_RECOMMENDATION_READY':
        navigationRef.navigate('Recommendations');
        break;
      case 'GAS_READING_REMINDER':
        navigationRef.navigate('AddGasReading');
        break;
      default:
        navigationRef.navigate('Notifications');
    }
  };

  cleanup() {
    this.notificationListener?.remove();
    this.responseListener?.remove();
  }
}

export const notificationService = new NotificationService();
```

### Integration in App.tsx

```typescript
// src/App.tsx

export default function App() {
  useEffect(() => {
    notificationService.initialize();

    return () => {
      notificationService.cleanup();
    };
  }, []);

  return (
    <NativeBaseProvider theme={theme} colorModeManager={colorModeManager}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </QueryClientProvider>
    </NativeBaseProvider>
  );
}
```

---

## 🎨 Theming & Styling

### Color Palette

```typescript
// src/theme/colors.ts

export const colors = {
  // Primary brand (orange/flame theme)
  brand: {
    50: '#fff1ec',
    100: '#ffd9c8',
    200: '#ffb39c',
    300: '#ff8c6f',
    400: '#ff6b3d',  // Primary
    500: '#e85223',
    600: '#c1411c',
    700: '#993316',
    800: '#70240f',
    900: '#471607',
  },

  // Dark mode palette
  dark: {
    50: '#f8fafc',
    100: '#e2e8f0',
    200: '#cbd5e1',
    300: '#94a3b8',
    400: '#64748b',
    500: '#475569',
    600: '#334155',
    700: '#1e293b',  // Card background
    800: '#0f172a',  // Page background
    900: '#0b0f1a',
  },

  // Semantic colors
  success: { /* NativeBase default */ },
  warning: { /* NativeBase default */ },
  error: { /* NativeBase default */ },
  info: { /* NativeBase default */ },
};
```

### Component Styling Patterns

```typescript
// Use useColorModeValue for conditional styling
const bgColor = useColorModeValue('white', 'dark.700');
const textColor = useColorModeValue('gray.800', 'gray.100');
const borderColor = useColorModeValue('gray.200', 'dark.600');

// Card component pattern
<Box
  bg={bgColor}
  rounded="xl"
  shadow={2}
  p={4}
  borderWidth={1}
  borderColor={borderColor}
>
  <Text color={textColor}>Content</Text>
</Box>
```

### NativeWind Classes

```typescript
// Combine NativeBase with Tailwind classes
<View className="flex-1 px-4 py-2">
  <Text className="text-lg font-bold">Hybrid Styling</Text>
</View>
```

---

## 📊 Charts & Data Visualization

### Library: `react-native-svg-charts` or `victory-native`

**Recommendation**: Use `victory-native` for consistency with web's `@ant-design/plots`

```bash
npm install victory-native react-native-svg
```

### Example: Heating Duration Chart

```typescript
// src/components/dashboard/HeatingChart.tsx

import { VictoryBar, VictoryChart, VictoryTheme, VictoryAxis } from 'victory-native';

export const HeatingChart: React.FC<{ data: BucketData[] }> = ({ data }) => {
  const chartData = data.map(item => ({
    x: item.bucketLabel,
    y: item.totalDurationHours,
  }));

  return (
    <VictoryChart theme={VictoryTheme.material} domainPadding={10}>
      <VictoryAxis />
      <VictoryAxis dependentAxis />
      <VictoryBar
        data={chartData}
        style={{
          data: { fill: '#ff6b3d' },
        }}
      />
    </VictoryChart>
  );
};
```

---

## 🧪 Testing Strategy

### Unit Tests (Jest)

```typescript
// __tests__/hooks/useAuth.test.ts

describe('useAuth', () => {
  it('should login successfully', async () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await act(async () => {
      await result.current.login('test@example.com', 'password');
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).not.toBeNull();
  });
});
```

### Integration Tests

```typescript
// __tests__/screens/DashboardScreen.test.tsx

describe('DashboardScreen', () => {
  it('should render dashboard metrics', async () => {
    const { getByText, findByText } = render(<DashboardScreen />);

    await waitFor(() => {
      expect(getByText(/Home Health Score/i)).toBeTruthy();
    });
  });
});
```

---

## 🚀 Build & Deployment

### EAS Configuration

```json
// eas.json
{
  "cli": {
    "version": ">= 7.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "simulator": true
      }
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "autoIncrement": true,
      "env": {
        "EXPO_PUBLIC_API_URL": "https://api.yourbackend.com"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your-email@example.com",
        "ascAppId": "123456789",
        "appleTeamId": "ABCDE12345"
      },
      "android": {
        "serviceAccountKeyPath": "./secrets/google-service-account.json",
        "track": "internal"
      }
    }
  }
}
```

### Environment Variables

```bash
# .env.example
EXPO_PUBLIC_API_URL=http://localhost:3020/api
EXPO_PUBLIC_API_URL_ANDROID=http://10.0.2.2:3020/api
EXPO_PUBLIC_API_URL_IOS=http://localhost:3020/api
```

### Build Commands

```bash
# Development build
eas build --profile development --platform all

# Preview build (APK for testing)
eas build --profile preview --platform android

# Production build
eas build --profile production --platform all

# Submit to stores
eas submit --platform all
```

---

## 📅 Implementation Roadmap

### Phase 1: Foundation (Week 1)

**Goals**: Setup project structure, authentication, navigation

- [x] Review existing mobile app
- [ ] Create project structure in `apps/mobile/`
- [ ] Setup Expo + EAS configuration
- [ ] Install dependencies (NativeBase, Navigation, etc.)
- [ ] Configure TypeScript, ESLint, Prettier
- [ ] Implement authentication flow
  - [ ] AuthContext
  - [ ] SecureStorage service
  - [ ] Login screen
  - [ ] Register screen
- [ ] Setup navigation
  - [ ] RootNavigator
  - [ ] MainTabNavigator
  - [ ] Auth flow conditional rendering
- [ ] Implement theming
  - [ ] NativeBase theme customization
  - [ ] Color mode manager
  - [ ] Dark mode toggle
- [ ] Create API client
  - [ ] Axios instance with interceptors
  - [ ] Token injection
  - [ ] 401 handling

**Deliverables**: Users can login and see empty main screens

---

### Phase 2: Dashboard (Week 2)

**Goals**: Complete dashboard with all tabs and metrics

- [ ] Create reusable components
  - [ ] MetricCard
  - [ ] SplitMetricCard
  - [ ] Card
  - [ ] LoadingSpinner
  - [ ] EmptyState
- [ ] Implement Dashboard Today tab
  - [ ] Fetch dashboard data
  - [ ] Display metrics (health score, anomaly rate, alerts)
  - [ ] Weather card
  - [ ] Boiler card
  - [ ] Thermostats grid
  - [ ] Pull-to-refresh
- [ ] Implement Dashboard Week tab
  - [ ] Integrate Victory charts
  - [ ] Heating duration chart
  - [ ] Weekly statistics
- [ ] Implement Dashboard Month tab
  - [ ] Monthly trends
  - [ ] Comparison data
- [ ] Setup React Query
  - [ ] Query client configuration
  - [ ] Dashboard queries
  - [ ] Caching strategy

**Deliverables**: Full-featured dashboard matching web app

---

### Phase 3: Heating & Boiler (Week 3)

**Goals**: Heating events, boiler history, anomaly detection

- [ ] Heating Events Screen
  - [ ] FlatList with events
  - [ ] Date range filter
  - [ ] Anomaly badges
  - [ ] Pull-to-refresh
- [ ] Heating Event Detail Modal
  - [ ] Event details
  - [ ] Temperature timeline
  - [ ] Anomaly explanation
- [ ] Boiler History Screen
  - [ ] Boiler events list
  - [ ] Flow temperature data
  - [ ] External temperature
- [ ] Create heating components
  - [ ] HeatingEventCard
  - [ ] AnomalyBadge
  - [ ] HeatingStatusIndicator
- [ ] Heating API integration
  - [ ] Heating queries (React Query)
  - [ ] Error handling

**Deliverables**: Complete heating and boiler features

---

### Phase 4: Gas Readings (Week 4)

**Goals**: Gas reading management and analysis

- [ ] Gas Readings Screen
  - [ ] FlatList of readings
  - [ ] FAB to add reading
  - [ ] Delete swipe action
- [ ] Add Gas Reading Screen
  - [ ] Date picker
  - [ ] Meter reading input
  - [ ] Form validation
  - [ ] Submit handler
- [ ] Gas Analysis Screen
  - [ ] Usage chart
  - [ ] Cost calculation
  - [ ] Monthly trends
- [ ] Gas components
  - [ ] GasReadingCard
  - [ ] GasForm
- [ ] Gas API integration
  - [ ] Gas queries
  - [ ] Mutations (add/delete)

**Deliverables**: Full gas reading functionality

---

### Phase 5: Push Notifications (Week 5)

**Goals**: Complete push notification system

- [ ] Setup Expo Notifications
  - [ ] Install dependencies
  - [ ] Configure app.json
  - [ ] Android notification channel
- [ ] Implement NotificationService
  - [ ] Token registration
  - [ ] Permission handling
  - [ ] Foreground notification handler
  - [ ] Background notification handler
  - [ ] Notification tap navigation
- [ ] Notifications Screen
  - [ ] Notification list (grouped by date)
  - [ ] Mark as read
  - [ ] Unread count badge
  - [ ] Swipe actions
- [ ] Notification Settings Screen
  - [ ] 6 notification type toggles
  - [ ] Croatian labels
  - [ ] Sync with backend preferences
- [ ] Backend integration
  - [ ] Register push token endpoint
  - [ ] Notification preferences endpoints
- [ ] Testing
  - [ ] Test notification delivery
  - [ ] Test notification tap navigation
  - [ ] Test preferences sync

**Deliverables**: Fully functional push notifications

---

### Phase 6: Profile & Settings (Week 6)

**Goals**: User profile, home profile, app settings

- [ ] Profile Screen
  - [ ] User info section
  - [ ] Home profile section
  - [ ] Appearance settings
  - [ ] Notification settings link
  - [ ] About section
  - [ ] Sign out button
- [ ] Account Settings Screen
  - [ ] Edit name
  - [ ] Edit email
  - [ ] Change password
- [ ] Home Profile Screen
  - [ ] Edit floor area
  - [ ] Edit location
  - [ ] Save changes
- [ ] Profile API integration
  - [ ] User profile queries
  - [ ] Update mutations
  - [ ] Home profile queries/mutations

**Deliverables**: Complete profile and settings functionality

---

### Phase 7: Polish & Testing (Week 7)

**Goals**: UI/UX refinement, testing, bug fixes

- [ ] UI/UX improvements
  - [ ] Animation polish (LayoutAnimation, Reanimated)
  - [ ] Loading states
  - [ ] Error boundaries
  - [ ] Empty states
  - [ ] Skeleton screens
- [ ] Accessibility
  - [ ] Screen reader support
  - [ ] Accessible labels
  - [ ] Color contrast
- [ ] Performance optimization
  - [ ] Memoization
  - [ ] FlatList optimization (windowSize, maxToRenderPerBatch)
  - [ ] Image optimization
- [ ] Testing
  - [ ] Unit tests for hooks
  - [ ] Component tests
  - [ ] Integration tests
  - [ ] E2E tests (Detox, if needed)
- [ ] Bug fixes
  - [ ] Address known issues
  - [ ] Test on physical devices (iOS/Android)

**Deliverables**: Production-ready mobile app

---

### Phase 8: Deployment (Week 8)

**Goals**: Deploy to app stores

- [ ] Prepare assets
  - [ ] App icon (1024x1024)
  - [ ] Splash screen
  - [ ] Screenshots (various sizes)
  - [ ] App preview video (optional)
- [ ] EAS Build
  - [ ] Production build for iOS
  - [ ] Production build for Android
- [ ] App Store submission (iOS)
  - [ ] Create App Store listing
  - [ ] Upload build
  - [ ] Submit for review
- [ ] Google Play submission (Android)
  - [ ] Create Play Store listing
  - [ ] Upload build
  - [ ] Submit for review
- [ ] Post-deployment
  - [ ] Monitor crash reports (Sentry)
  - [ ] Monitor analytics
  - [ ] User feedback collection

**Deliverables**: App live on iOS App Store and Google Play Store

---

## 📦 Dependencies

### Core Dependencies

```json
{
  "dependencies": {
    "expo": "^52.0.0",
    "expo-constants": "~17.0.0",
    "expo-device": "~7.0.0",
    "expo-notifications": "~0.29.0",
    "expo-status-bar": "~2.0.0",
    "react": "18.3.1",
    "react-native": "0.76.0",

    "@react-navigation/native": "^7.0.0",
    "@react-navigation/stack": "^7.0.0",
    "@react-navigation/bottom-tabs": "^7.0.0",
    "@react-navigation/material-top-tabs": "^7.0.0",

    "native-base": "^3.4.28",
    "react-native-svg": "^15.0.0",
    "nativewind": "^4.0.0",

    "@tanstack/react-query": "^5.0.0",
    "axios": "^1.6.0",

    "@react-native-async-storage/async-storage": "^2.0.0",
    "expo-secure-store": "~14.0.0",

    "victory-native": "^37.0.0",
    "react-native-gesture-handler": "~2.20.0",
    "react-native-reanimated": "~3.16.0",
    "react-native-safe-area-context": "^5.0.0",
    "react-native-screens": "~4.3.0",

    "dayjs": "^1.11.0",
    "expo-linking": "~7.0.0"
  },
  "devDependencies": {
    "@babel/core": "^7.25.0",
    "@types/react": "~18.3.0",
    "typescript": "^5.3.0",

    "@testing-library/react-native": "^12.0.0",
    "@testing-library/jest-native": "^5.4.0",
    "jest": "^29.0.0",
    "jest-expo": "^52.0.0",

    "eslint": "^8.0.0",
    "prettier": "^3.0.0",

    "tailwindcss": "^3.4.0"
  }
}
```

---

## 🔒 Security Considerations

1. **Secure Token Storage**
   - Use `expo-secure-store` for JWT tokens (hardware-backed encryption on supported devices)
   - Fallback to AsyncStorage with warning on unsupported devices

2. **API Security**
   - HTTPS only in production
   - Certificate pinning (optional, advanced)
   - Token expiration handling

3. **Push Notification Security**
   - Validate notification payloads
   - Don't trust notification data blindly
   - Verify server signature (if implemented)

4. **Code Obfuscation**
   - Enable Hermes engine (better performance + bytecode)
   - ProGuard for Android release builds

---

## 📈 Performance Best Practices

1. **FlatList Optimization**
   ```typescript
   <FlatList
     data={items}
     renderItem={renderItem}
     keyExtractor={(item) => item.id.toString()}
     windowSize={5}
     maxToRenderPerBatch={10}
     removeClippedSubviews={true}
     initialNumToRender={10}
     getItemLayout={(data, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
   />
   ```

2. **Image Optimization**
   - Use `expo-image` (faster than Image)
   - Implement image caching
   - Resize images on backend

3. **Memoization**
   ```typescript
   const MemoizedCard = React.memo(MetricCard);
   const handlePress = useCallback(() => { /* ... */ }, [dependency]);
   const expensiveValue = useMemo(() => computeExpensiveValue(data), [data]);
   ```

4. **React Query Configuration**
   ```typescript
   const queryClient = new QueryClient({
     defaultOptions: {
       queries: {
         staleTime: 1000 * 60 * 5, // 5 minutes
         gcTime: 1000 * 60 * 30, // 30 minutes (formerly cacheTime)
         retry: 2,
       },
     },
   });
   ```

---

## ✅ Success Criteria

### Functional Requirements
- ✅ User can register and login
- ✅ Dashboard displays all metrics matching web app
- ✅ Charts render correctly with proper data
- ✅ Heating events list with filtering
- ✅ Gas readings can be added/viewed/deleted
- ✅ Push notifications received and handled
- ✅ Notification preferences sync with backend
- ✅ Profile can be viewed and edited
- ✅ Dark mode persists across app restarts
- ✅ Pull-to-refresh works on all list screens

### Non-Functional Requirements
- ✅ App loads in < 3 seconds
- ✅ API responses cached appropriately
- ✅ FlatLists scroll smoothly (60 FPS)
- ✅ Works offline with cached data
- ✅ Accessible (screen reader compatible)
- ✅ Error handling with user-friendly messages
- ✅ Responsive on various screen sizes (phones/tablets)

### Testing Requirements
- ✅ >80% code coverage for utilities/hooks
- ✅ All critical user flows have integration tests
- ✅ Tested on iOS and Android physical devices
- ✅ No memory leaks (tested with Flipper)

---

## 🎯 Next Steps

**Ready to proceed?** Please approve this plan, and I will:

1. **Initialize the project structure** in `apps/mobile/`
2. **Install all dependencies** and configure Expo/EAS
3. **Implement Phase 1** (authentication + navigation)
4. **Progress systematically** through Phases 2-8

Would you like me to start implementation, or do you have any changes to this plan?
