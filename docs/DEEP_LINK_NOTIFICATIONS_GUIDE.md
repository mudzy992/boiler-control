# Deep Link Notifications - Implementation Guide

## Overview

Gas reading reminders are now sent from the backend at **6:30 AM UTC daily**. When users tap the notification, the app automatically opens and navigates directly to the **GasReadingsScreen** with the add reading modal open.

## Implementation Details

### Backend Changes

#### Gas Reminder Service (`backend/src/modules/Schedule/gas.reminder.service.ts`)

Updated notification payload to include deep link:

```typescript
{
  title: 'Gas Reading Reminder',
  message: 'Tap to add your gas meter reading',
  data: {
    type: NotificationType.GAS_READING_REMINDER,
    screen: 'Gas',
    deepLink: 'myapp://gas/add-reading',
    timestamp: new Date().toISOString(),
  }
}
```

**Key Points:**
- Deep link: `myapp://gas/add-reading`
- Runs at 6:30 AM UTC daily (configurable via `GAS_REMINDER_CRON` env var)
- Only sends to users with `GAS_READING_REMINDER` preference enabled
- Respects 24-hour debounce window

### Mobile App Changes

#### 1. App Configuration (`app.config.js`)

Added URL scheme for deep linking:

```javascript
scheme: ['myapp', 'exp']
```

This registers the app to handle `myapp://` links.

#### 2. Root Navigator (`src/navigation/RootNavigator.tsx`)

Configured React Navigation linking with URL patterns:

```typescript
const linking: LinkingOptions<any> = {
  prefixes: ['myapp://', 'exp://'],
  config: {
    screens: {
      Main: {
        screens: {
          Gas: {
            screens: {
              'add-reading': 'add-reading',
              GasReadings: 'readings',
              GasAnalysis: 'analysis',
            },
          },
          Dashboard: 'dashboard',
          Heating: 'heating',
          Settings: 'settings',
        },
      },
      Login: 'login',
      Register: 'register',
    },
  },
};
```

**Supported Deep Links:**
- `myapp://gas/add-reading` → Opens Gas tab and triggers add modal
- `myapp://gas/readings` → Opens Gas readings list
- `myapp://gas/analysis` → Opens gas analytics
- `myapp://dashboard` → Opens dashboard
- `myapp://heating` → Opens heating
- `myapp://settings` → Opens settings

#### 3. Notification Service (`src/services/notifications/notificationService.ts`)

New deep link handler function:

```typescript
const handleDeepLink = (deepLink: string) => {
  if (!navigationRef) {
    console.warn('Navigation ref not available for deep link handling');
    return;
  }

  if (deepLink.includes('gas/add-reading')) {
    navigationRef.navigate('Main', {
      screen: 'Gas',
      params: {
        screen: 'GasReadings',
        params: {
          openAddModal: true,  // Triggers modal opening
        },
      },
    });
  }
  // ... other routes
};
```

Listens for notification taps in `listenForNotifications()`:

```typescript
const responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
  const deepLink = response.notification.request.content.data?.deepLink;

  if (deepLink) {
    handleDeepLink(deepLink);
  }
});
```

#### 4. GasReadingsScreen (`src/screens/gas/GasReadingsScreen.tsx`)

Listens for deep link route params and opens modal:

```typescript
const route = useRoute<RouteProp<any, 'GasReadings'>>();

useEffect(() => {
  if (route.params?.openAddModal) {
    setShowAddModal(true);
  }
}, [route.params?.openAddModal]);
```

#### 5. App Entry Point (`App.tsx`)

Passes navigation ref to notification service:

```typescript
const navigationRef = useRef<NavigationContainerRef<any>>(null);

useEffect(() => {
  configureNotificationHandler();
  const cleanup = listenForNotifications();

  if (navigationRef.current) {
    setNavigationRef(navigationRef as React.RefObject<NavigationContainerRef<any>>);
  }

  return () => {
    cleanup();
  };
}, []);

return (
  <NavigationContainer ref={navigationRef} ...>
    {/* App navigation */}
  </NavigationContainer>
);
```

## Testing Deep Links

### Manual Testing on Android Emulator

1. **Using ADB (Android Debug Bridge):**

```bash
# Open the app with deep link
adb shell am start -a android.intent.action.VIEW -d "myapp://gas/add-reading" com.mudzy.BoilerControlMobileV1b1

# Navigate to different screens
adb shell am start -a android.intent.action.VIEW -d "myapp://dashboard" com.mudzy.BoilerControlMobileV1b1
adb shell am start -a android.intent.action.VIEW -d "myapp://heating" com.mudzy.BoilerControlMobileV1b1
```

2. **Using Expo CLI:**

```bash
# In project root
npx expo start

# When Expo server is running, press 'a' to open Android emulator
# Then in another terminal:
adb shell am start -a android.intent.action.VIEW -d "myapp://gas/add-reading" <package-name>
```

### Manual Testing on iOS Simulator

1. **Using xcrun:**

```bash
# Open with deep link (iPhone 15 simulator example)
xcrun simctl openurl booted "myapp://gas/add-reading"

# Other screens
xcrun simctl openurl booted "myapp://dashboard"
xcrun simctl openurl booted "myapp://heating"
```

2. **Using Expo:**

```bash
# Start Expo
npx expo start

# Press 'i' to open iOS simulator
# From another terminal:
xcrun simctl openurl booted "myapp://gas/add-reading"
```

### Testing with Backend Notifications

#### 1. Enable Gas Reading Reminder Preference

```bash
# Login first to get token
curl -X POST http://localhost:3020/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Update notification preferences
curl -X PATCH http://localhost:3020/api/notifications/preferences \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"type":"GAS_READING_REMINDER","enabled":true}'
```

#### 2. Send Test Notification with Deep Link

```bash
# Test endpoint to send reminder to yourself
curl -X POST http://localhost:3020/api/notifications/test-gas-reminder \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Test reminder sent to user 42"
}
```

#### 3. Trigger All Reminders

```bash
# Manually trigger all daily reminders (useful for QA)
curl -X POST http://localhost:3020/api/notifications/test-trigger-all-gas-reminders \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "success": true,
  "summary": "Sent to 156 users, 2 failed"
}
```

### Verification Steps

After sending a test notification:

1. **On Mobile:**
   - Notification should appear in notification center
   - Tap the notification
   - App should open
   - App should navigate to Gas tab
   - GasReadingsScreen should be open
   - Add reading modal should be automatically opened
   - Existing validation and API calls should work

2. **In Logs:**
   - Check backend logs for: `✅ Sent reminder to user X`
   - Check app logs for: `Notification tapped:` followed by deep link payload

3. **Edge Cases:**
   - If modal is already open, it should stay open
   - If user swipes away notification, app should still work normally
   - If user is not authenticated, notification tap should not crash app

## Notification Payload Structure

```typescript
{
  title: string;              // "Gas Reading Reminder"
  message: string;            // "Tap to add your gas meter reading"
  data: {
    type: string;             // "GAS_READING_REMINDER"
    screen: string;           // "Gas"
    deepLink: string;         // "myapp://gas/add-reading"
    timestamp: string;        // ISO 8601 timestamp
    test?: boolean;           // Only present in test notifications
  }
}
```

## Troubleshooting

### Deep Link Not Working

1. **Check app scheme registration:**
   ```bash
   # Android
   adb shell pm dump com.mudzy.BoilerControlMobileV1b1 | grep -A 5 "myapp"

   # iOS
   xcrun simctl openurl booted "myapp://test"
   ```

2. **Check notification payload:**
   - Verify `deepLink` field exists in notification data
   - Ensure deep link format is correct: `myapp://gas/add-reading`

3. **Check navigation ref:**
   - Verify `navigationRef` is passed correctly in App.tsx
   - Check that `setNavigationRef()` is called in useEffect

### Modal Not Opening

1. **Check route params:**
   - Verify `route.params?.openAddModal` is being set
   - Add console.log in GasReadingsScreen useEffect

2. **Check screen hierarchy:**
   - Ensure navigation path is correct: `Main` → `Gas` → `GasReadings`
   - Verify GasScreen uses BottomTabNavigator (nested navigation)

### Notification Not Appearing

1. **Check notification preferences:**
   ```bash
   curl -X GET http://localhost:3020/api/notifications/preferences \
     -H "Authorization: Bearer <token>"
   ```

2. **Check user has devices:**
   - Verify push token is registered: `POST /api/notifications/register-token`
   - Check device is stored in database

3. **Check debounce limit:**
   - User can only receive one reminder per 24 hours
   - Test endpoint bypasses debounce

## Production Deployment

### Environment Variables

```bash
# Set custom cron schedule (optional)
GAS_REMINDER_CRON=30 6 * * *  # Default: 6:30 AM UTC

# For timezone support in future
USER_TIMEZONE_ENABLED=false
```

### Release Checklist

- [ ] Backend: Deploy with updated notification service
- [ ] Mobile: Build and deploy with new deep link configuration
- [ ] Test: Run test endpoints on staging
- [ ] Verify: Check notification delivery on actual devices
- [ ] Monitor: Watch logs for success/failure counts

## Future Enhancements

1. **Per-User Timezone:**
   - Store user timezone in profile
   - Calculate cron time based on user's local time
   - Send reminder at user's preferred time (e.g., 6:30 AM local time)

2. **Multiple Reminders:**
   - Morning reminder (6:30 AM)
   - Evening reminder (8:00 PM)
   - Configurable per user in settings

3. **Smart Reminders:**
   - Only send if user hasn't submitted reading today
   - Escalate frequency if reading is overdue (3+ days)
   - Skip weekends if configured

4. **Rich Notifications:**
   - Add actions (Open App, Dismiss, Reschedule)
   - Include last reading date/value in notification
   - Show countdown to next reminder

## References

- [Expo Notifications Docs](https://docs.expo.dev/push-notifications/)
- [React Navigation Linking](https://reactnavigation.org/docs/linking)
- [NestJS Schedule Docs](https://docs.nestjs.com/techniques/task-scheduling)
- [Android Deep Linking](https://developer.android.com/training/app-links/deep-linking)
- [iOS Universal Links](https://developer.apple.com/ios/universal-links/)
