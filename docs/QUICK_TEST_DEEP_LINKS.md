# Quick Testing Guide - Deep Link Notifications

## Prerequisites

1. Backend running: `cd backend && npm run start:dev`
2. Mobile app running: `cd apps/mobile && npx expo start`
3. You have a test user account (default: `test@example.com` / `password123`)
4. Push token registered (happens automatically when app starts)

## Quick Test Flow

### Step 1: Enable Notification Preference

```bash
# Get auth token
TOKEN=$(curl -s -X POST http://localhost:3020/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}' | jq -r '.access_token')

# Enable gas reminders
curl -X PATCH http://localhost:3020/api/notifications/preferences \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"GAS_READING_REMINDER","enabled":true}'
```

### Step 2: Send Test Notification

```bash
curl -X POST http://localhost:3020/api/notifications/test-gas-reminder \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

**Response:**
```json
{
  "success": true,
  "message": "Test reminder sent to user X"
}
```

### Step 3: Verify on Mobile

**On Android Emulator:**
- Notification should appear in notification center
- Tap the notification → App opens → Navigates to Gas tab → Modal opens

**On iOS Simulator:**
- Notification appears in lock screen or notification center
- Tap → App opens → Navigates to Gas tab → Modal opens

**Expected Behavior:**
- ✅ App opens (even if closed)
- ✅ GasReadingsScreen is visible
- ✅ Add reading modal is open
- ✅ Can enter counter value and date
- ✅ Submit works with existing validation

### Step 4: Verify Notification Content

Check mobile logs for:
```
Notification tapped: {
  type: 'GAS_READING_REMINDER',
  screen: 'Gas',
  deepLink: 'myapp://gas/add-reading',
  timestamp: '2026-02-04T06:30:00.000Z',
  test: true
}
```

## Manual Deep Link Testing (Without Notification)

### Android Emulator
```bash
adb shell am start -a android.intent.action.VIEW -d "myapp://gas/add-reading" com.mudzy.BoilerControlMobileV1b1
```

### iOS Simulator
```bash
xcrun simctl openurl booted "myapp://gas/add-reading"
```

**Expected:** App opens with Gas tab active and add modal open

## Test All Deep Links

```bash
# Dashboard
adb shell am start -a android.intent.action.VIEW -d "myapp://dashboard" com.mudzy.BoilerControlMobileV1b1

# Heating
adb shell am start -a android.intent.action.VIEW -d "myapp://heating" com.mudzy.BoilerControlMobileV1b1

# Settings
adb shell am start -a android.intent.action.VIEW -d "myapp://settings" com.mudzy.BoilerControlMobileV1b1
```

## Trigger All Reminders (Batch)

```bash
curl -X POST http://localhost:3020/api/notifications/test-trigger-all-gas-reminders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

**Response:**
```json
{
  "success": true,
  "summary": "Sent to X users, Y failed"
}
```

## Troubleshooting

### Notification Not Appearing

```bash
# Check preference is enabled
curl -X GET http://localhost:3020/api/notifications/preferences \
  -H "Authorization: Bearer $TOKEN" | jq '.[] | select(.type=="GAS_READING_REMINDER")'

# Should return: { "type": "GAS_READING_REMINDER", "enabled": true, ... }
```

### Deep Link Not Working

1. Close and reopen app
2. Check React Navigation logs in console
3. Verify `myapp://` scheme is registered:
   - Android: Check `app.config.js` has `scheme: ['myapp', 'exp']`
   - iOS: Check provisioning profile supports custom schemes

### Modal Not Opening

1. Check GasReadingsScreen logs
2. Verify navigation path: `Main` → `Gas` → `GasReadings` → modal
3. Clear app cache: `npx expo start -c`

## Success Criteria

- [ ] Notification received on device
- [ ] Message says "Tap to add your gas meter reading"
- [ ] Tapping notification opens app
- [ ] Gas tab becomes active
- [ ] Add reading modal opens automatically
- [ ] Can enter counter value and date
- [ ] Submit button works
- [ ] Data saved to database

## One-Command Test

```bash
#!/bin/bash

# Get token
TOKEN=$(curl -s -X POST http://localhost:3020/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}' | jq -r '.access_token')

# Enable preference
curl -s -X PATCH http://localhost:3020/api/notifications/preferences \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"GAS_READING_REMINDER","enabled":true}' > /dev/null

# Send notification
echo "Sending test notification..."
curl -X POST http://localhost:3020/api/notifications/test-gas-reminder \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq '.'

echo "✅ Check your mobile device for notification"
echo "📱 Tap to open app and navigate to Gas reading screen"
```

## Notes

- Test notifications bypass the 24-hour debounce
- Notifications only work if app has registered a push token
- Deep links work even if app is closed
- Existing validation and error handling preserved
- All changes are backward compatible
