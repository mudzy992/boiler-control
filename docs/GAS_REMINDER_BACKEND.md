# Daily Gas Reading Reminder - Backend Implementation

## Overview

The gas reading reminder has been moved from the mobile frontend to the backend. The backend now sends daily push notifications to users reminding them to add their gas meter reading.

## Architecture

### Components

1. **GasReminderService** (`backend/src/modules/Schedule/gas.reminder.service.ts`)
   - Scheduled cron job that runs daily at 6:30 AM UTC
   - Fetches all users with `GAS_READING_REMINDER` notifications enabled
   - Sends push notifications via the existing `NotificationsService`
   - Logs all events (success/failure)

2. **Integration Points**
   - Uses existing `NotificationsService` for push delivery
   - Uses `ExpoPushService` (Expo push provider)
   - Respects user notification preferences in DB
   - Inherits notification debouncing logic

3. **Test Endpoints**
   - Manual trigger endpoints in `NotificationsController`
   - Allows QA to test notifications without waiting

## Configuration

### Environment Variables

```bash
# Custom cron schedule (optional, default: 30 6 * * *)
GAS_REMINDER_CRON=30 6 * * *

# Cron format: minute hour day-of-month month day-of-week
# Example cron schedules:
# "30 6 * * *"     = Every day at 06:30 UTC
# "0 9 * * *"      = Every day at 09:00 UTC
# "0 */6 * * *"    = Every 6 hours
# "0 0 * * 0"      = Every Sunday at 00:00 UTC
```

### Disabling in Development

The cron job is automatically disabled in `development` and `test` environments. Use the manual test endpoints instead.

## How It Works

### Daily Automatic Job

1. **Schedule**: Runs at 06:30 AM UTC every day (configurable)
2. **Query**: Fetches users where:
   - `notificationPreferences.type = GAS_READING_REMINDER`
   - `notificationPreferences.enabled = true`
3. **Send**: For each user:
   - Check if they have push tokens registered
   - Use `NotificationsService.notifyUser()` to send
   - Automatically respects debounce settings
   - Log success/failure
4. **Logging**: All events logged with timestamp and user ID

### Notification Payload

```typescript
{
  title: "Gas Reading Reminder",
  message: "Please add your gas meter reading for today.",
  data: {
    type: "GAS_READING_REMINDER",
    screen: "Gas",           // Opens Gas screen on tap
    timestamp: "2026-02-04T06:30:00Z",
    test?: true              // Only in test endpoint
  }
}
```

### Error Handling

- Failures are logged but don't crash the job
- Individual user failures don't prevent other users from receiving notifications
- Failed sends are logged with full error context
- Summary stats logged at job completion

## API Endpoints

### Test Gas Reminder (Current User)

```http
POST /api/notifications/test-gas-reminder
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "message": "Test reminder sent to user 42"
}
```

**Use Cases:**
- QA wants to test on their own device
- Verify push configuration works
- Test notification display format

### Trigger All Gas Reminders (Manual)

```http
POST /api/notifications/test-trigger-all-gas-reminders
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "summary": "Sent to 156 users, 2 failed"
}
```

**Use Cases:**
- Test job execution without waiting for scheduler
- Force send in staging/QA environment
- Verify notification preferences work correctly

## Database Schema

### NotificationPreference Table

```prisma
model NotificationPreference {
  userId    Int
  type      NotificationType
  enabled   Boolean
  @@unique([userId, type])
}

enum NotificationType {
  DAILY_RECOMMENDATION
  FLOW_TEMP_CHANGED
  HEATING_STARTED
  HEATING_ENDED
  SYSTEM_ALERT
  GAS_READING_REMINDER  // ← Gas reminders
}
```

### Notification Table (Audit Log)

All notifications sent are logged:

```prisma
model Notification {
  id        Int
  userId    Int
  type      NotificationType
  title     String
  message   String
  data      Json
  createdAt DateTime
}
```

## Monitoring & Logging

### Log Levels

```
INFO:   Starting job, found X users
DEBUG:  ✅ Sent reminder to user Y
ERROR:  ❌ Failed to send to user Z: [error message]
INFO:   ✅ Completed: X sent, Y failed
ERROR:  ❌ Critical error: [error message]
```

### Example Logs

```
2026-02-04 06:30:00 INFO  GasReminderService: 🔥 Starting daily gas reading reminders...
2026-02-04 06:30:00 INFO  GasReminderService: Found 156 users with gas reminder enabled
2026-02-04 06:30:00 DEBUG GasReminderService: ✅ Sent reminder to user 42
2026-02-04 06:30:00 DEBUG GasReminderService: ✅ Sent reminder to user 43
2026-02-04 06:30:01 ERROR GasReminderService: ❌ Failed to send to user 44: User has no devices
2026-02-04 06:30:02 INFO  GasReminderService: ✅ Completed: 155 sent, 1 failed
```

## Debouncing

The notification system includes built-in debouncing to prevent spam:

```typescript
// NOTIFICATION_DEBOUNCE configuration
GAS_READING_REMINDER: 24 * 60 * 60 * 1000  // 24 hours
```

- If user receives a gas reminder, they won't get another for 24 hours
- Debounce check happens in `NotificationsService.canSendNotification()`
- Manual test endpoints bypass debounce check (for QA testing)

## Testing

### Unit Testing

```bash
npm run test -- gas.reminder.service
```

### Integration Testing

```bash
# Run test endpoint
curl -X POST http://localhost:3020/api/notifications/test-gas-reminder \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json"
```

### Manual Verification

1. **Enable notification preference:**
   ```bash
   PATCH /api/notifications/preferences
   { "type": "GAS_READING_REMINDER", "enabled": true }
   ```

2. **Send test reminder:**
   ```bash
   POST /api/notifications/test-gas-reminder
   ```

3. **Verify on device:**
   - Check push notification appears
   - Verify payload data (title, message, screen navigation)
   - Test notification tap behavior

## Frontend Changes

The mobile app no longer needs to:
- Schedule local notifications
- Manage notification timing
- Handle reminder logic

All gas reading reminder logic is now backend-driven.

### Frontend Only Needs To:

1. Register push token (already done):
   ```typescript
   POST /api/notifications/register-token
   { expoPushToken: "...", platform: "android/ios" }
   ```

2. Respect notification preference settings (already done)

3. Handle incoming push notifications (already implemented)

## Troubleshooting

### Notifications Not Sending

1. **Check notification preference is enabled:**
   ```bash
   GET /api/notifications/preferences
   ```

2. **Verify push token is registered:**
   - Check device registered token
   - Test with manual endpoint

3. **Check logs:**
   ```bash
   tail -f logs/application.log | grep GasReminderService
   ```

### Cron Not Running

1. **Verify not in development mode:**
   ```bash
   echo $NODE_ENV  # Should be production, not development
   ```

2. **Check ScheduleModule is imported in main app module**

3. **Verify @nestjs/schedule is installed:**
   ```bash
   npm list @nestjs/schedule
   ```

### Users Not Getting Reminders

1. **Check notification preference is enabled for user**
2. **Verify user has registered push tokens**
3. **Check debounce limit hasn't been exceeded**
4. **Review logs for errors**

## Future Enhancements

1. **Per-user timezone support:**
   - Store user timezone in profile
   - Calculate cron time per user
   - Send at user's local time (not UTC)

2. **Multiple reminder times:**
   - Morning reminder (6:30 AM)
   - Evening reminder (8:00 PM)
   - Configurable per user

3. **Smart reminders:**
   - Only send if user hasn't submitted reading today
   - Increase frequency if reading is overdue
   - Skip weekends if configured

4. **Notification preferences UI:**
   - Let users choose reminder time
   - Enable/disable per day of week
   - Set timezone preference

## Related Files

- `backend/src/modules/Schedule/gas.reminder.service.ts` - Main service
- `backend/src/modules/Notification/notifications.controller.ts` - Test endpoints
- `backend/src/modules/Notification/notifications.service.ts` - Core notification logic
- `backend/src/modules/ExpoPush/expo.push.notification.service.ts` - Push provider
- `backend/src/modules/Schedule/schedule.module.ts` - Module registration

## References

- [NestJS Schedule Docs](https://docs.nestjs.com/techniques/task-scheduling)
- [Cron Expression Syntax](https://crontab.guru/)
- [Expo Push Notifications](https://docs.expo.dev/push-notifications/)
