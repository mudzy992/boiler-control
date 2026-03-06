# API Reference - Boiler Control System

**Backend**: NestJS API running on `http://localhost:3020/api`
**Documentation**: Auto-generated Swagger at `http://localhost:3020/api` when backend is running

---

## Authentication

### Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}

Response: 200 OK
{
  "token": "eyJhbGc...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

### Register
```http
POST /auth/register
Content-Type: application/json

{
  "email": "newuser@example.com",
  "password": "password123",
  "name": "Jane Doe"
}

Response: 201 Created
{
  "token": "eyJhbGc...",
  "user": { ... }
}
```

### Get Current User
```http
GET /auth/profile
Authorization: Bearer {token}

Response: 200 OK
{
  "id": 1,
  "email": "user@example.com",
  "name": "John Doe"
}
```

---

## Dashboard

### Get Dashboard Data
```http
GET /dashboard
Authorization: Bearer {token}

Response: 200 OK
{
  "homes": [
    {
      "id": 1,
      "name": "My Home",
      "location": "123 Main St",
      "thermostats": [
        {
          "id": 101,
          "name": "Living Room",
          "currentTemp": 22.5,
          "targetTemp": 21.0,
          "isHeating": true
        }
      ],
      "weather": {
        "temp": 5.2,
        "humidity": 65,
        "condition": "Partly Cloudy"
      },
      "recentHeatingEvents": [ ... ],
      "healthScore": 85,
      "activeAlerts": 0
    }
  ]
}
```

---

## Heating Events

### Get Heating Events
```http
GET /heating/events?startDate=2026-02-01&endDate=2026-02-04
Authorization: Bearer {token}

Query Parameters:
- startDate (optional): Start date (YYYY-MM-DD)
- endDate (optional): End date (YYYY-MM-DD)

Response: 200 OK
[
  {
    "id": 1001,
    "deviceId": 101,
    "startTime": "2026-02-04T06:00:00Z",
    "endTime": "2026-02-04T09:30:00Z",
    "outsideTemp": 3.5,
    "suggestedFlowTemp": 50.0,
    "actualFlowTemp": 49.5,
    "duration": 210,
    "isAnomaly": false
  }
]
```

### Get Heating Anomalies
```http
GET /heating/anomalies
Authorization: Bearer {token}

Response: 200 OK
[
  {
    "eventId": 1001,
    "startTime": "2026-02-04T18:00:00Z",
    "anomalyType": "LONG_DURATION",
    "suggestedEndTime": "2026-02-04T20:00:00Z",
    "reason": "Heating cycle 45 minutes longer than normal"
  }
]
```

---

## Thermostat & Schedules

### List All Thermostats
```http
GET /thermostat-device
Authorization: Bearer {token}

Response: 200 OK
[
  {
    "id": 101,
    "deviceId": "abc123xyz",
    "name": "Living Room",
    "currentTemp": 22.5,
    "targetTemp": 21.0,
    "lastSync": "2026-02-04T10:15:00Z",
    "isOnline": true
  }
]
```

### Get Device Programs
```http
GET /thermostat-device/:id/programs
Authorization: Bearer {token}

Response: 200 OK
[
  {
    "id": 1,
    "dayType": "WORKDAY",
    "startMinute": 390,
    "targetTemp": 22.0,
    "orderIndex": 0
  }
]
```

---

## Boiler

### Get Boiler History
```http
GET /boiler/history?hours=24
Authorization: Bearer {token}

Query Parameters:
- hours (optional): Historical range in hours (default: 24)

Response: 200 OK
[
  {
    "id": 5001,
    "timestamp": "2026-02-04T09:00:00Z",
    "isOn": true,
    "flowTemp": 49.5,
    "outsideTemp": 5.2,
    "systemLoad": 80
  }
]
```

### Set Current Boiler Flow Temperature
```http
PATCH /boiler/current-temp
Authorization: Bearer {token}
Content-Type: application/json

{
  "currentFlowTemp": 52.5
}

Response: 200 OK
{
  "success": true,
  "data": {
    "userId": 1,
    "currentFlowTemp": 52.5,
    "setAt": "2026-03-06T10:15:00.000Z",
    "latestBoilerHistoryId": 5001,
    "latestBoilerHistoryUpdated": true
  }
}

Response: 400 Bad Request (out of range)
{
  "statusCode": 400,
  "message": [
    "currentFlowTemp must not be greater than 55",
    "currentFlowTemp must not be less than 48"
  ],
  "error": "Bad Request"
}
```

---

## Gas Readings

### Get All Gas Readings
```http
GET /gas/readings
Authorization: Bearer {token}

Response: 200 OK
[
  {
    "id": 1,
    "counterValue": 12456.85,
    "readingDate": "2026-02-04T19:00:00Z",
    "consumption": 0.25,
    "dailyAverage": 0.85,
    "createdAt": "2026-02-04T19:05:00Z"
  }
]
```

### Add Gas Reading
```http
POST /gas/readings
Authorization: Bearer {token}
Content-Type: application/json

{
  "counterValue": 12456.85,
  "readingDate": "2026-02-04T19:00:00Z"
}

Response: 201 Created
{
  "id": 1,
  "counterValue": 12456.85,
  "readingDate": "2026-02-04T19:00:00Z",
  "consumption": 0.25,
  "dailyAverage": 0.85
}

Response: 409 Conflict (if duplicate for same day)
{
  "statusCode": 409,
  "message": "A gas reading for this date already exists. Please update the existing entry.",
  "error": "ConflictException"
}
```

### Delete Gas Reading
```http
DELETE /gas/readings/:id
Authorization: Bearer {token}

Response: 200 OK
{ "success": true }
```

### Get Gas Analysis
```http
GET /gas/analysis?from=2026-02-01&to=2026-02-04
Authorization: Bearer {token}

Query Parameters:
- from (optional): Start date (YYYY-MM-DD)
- to (optional): End date (YYYY-MM-DD)

Response: 200 OK
{
  "totalGas": 12.5,
  "totalHeatingHours": 48,
  "avgFlowTemp": 50.2,
  "efficiency": {
    "m3PerHour": 0.26,
    "trend": "EXCELLENT"
  }
}
```

---

## Weather

### Get Current Weather
```http
GET /weather/current/:homeProfileId
Authorization: Bearer {token}

Response: 200 OK
{
  "temperature": 5.2,
  "feelslike": 2.1,
  "humidity": 65,
  "condition_text": "Partly Cloudy",
  "wind_kph": 12,
  "temp_min": 2.0,
  "temp_max": 8.5
}
```

---

## Recommendations

### Get Daily Recommendations
```http
GET /recommendations
Authorization: Bearer {token}

Response: 200 OK
[
  {
    "id": 1,
    "date": "2026-02-04",
    "title": "Optimize Flow Temperature",
    "description": "Based on weather trends, consider increasing flow temp by 2°C",
    "priority": "MEDIUM",
    "category": "EFFICIENCY"
  }
]
```

---

## User Profile

### Get User Profile
```http
GET /user
Authorization: Bearer {token}

Response: 200 OK
{
  "id": 1,
  "email": "user@example.com",
  "name": "John Doe",
  "timezone": "Europe/London"
}
```

### Update User Profile
```http
PATCH /user
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Jane Doe",
  "timezone": "America/New_York"
}

Response: 200 OK
{ ... updated user object }
```

---

## Home Profile

### Get All Homes
```http
GET /home-profile
Authorization: Bearer {token}

Response: 200 OK
[
  {
    "id": 1,
    "name": "My Home",
    "address": "123 Main St, London",
    "isActive": true
  }
]
```

### Get Active Home
```http
GET /home-profile/active
Authorization: Bearer {token}

Response: 200 OK
{
  "id": 1,
  "name": "My Home",
  "address": "123 Main St, London",
  "isActive": true
}
```

### Create Home
```http
POST /home-profile
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Summer House",
  "address": "456 Beach Rd, Brighton"
}

Response: 201 Created
{
  "id": 2,
  "name": "Summer House",
  "address": "456 Beach Rd, Brighton",
  "isActive": false
}
```

### Update Home
```http
PATCH /home-profile/:id
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Updated Home Name",
  "address": "789 New Rd, London"
}

Response: 200 OK
{ ... updated home object }
```

### Activate Home
```http
PATCH /home-profile/:id/activate
Authorization: Bearer {token}

Response: 200 OK
{ "success": true, "activeHomeId": 2 }
```

### Delete Home
```http
DELETE /home-profile/:id
Authorization: Bearer {token}

Response: 200 OK
{ "success": true }
```

---

## Notifications

### Get All Notifications
```http
GET /notifications
Authorization: Bearer {token}

Response: 200 OK
[
  {
    "id": 1,
    "userId": 1,
    "title": "Heating Started",
    "message": "Heating cycle started at 06:00",
    "isRead": false,
    "createdAt": "2026-02-04T06:00:00Z"
  }
]
```

### Mark Notification as Read
```http
POST /notifications/:id/read
Authorization: Bearer {token}

Response: 200 OK
{
  "id": 1,
  "isRead": true
}
```

### Mark All Notifications as Read
```http
POST /notifications/mark-all-read
Authorization: Bearer {token}

Response: 200 OK
{
  "count": 5
}
```

### Register Push Token
```http
POST /notifications/register-token
Authorization: Bearer {token}
Content-Type: application/json

{
  "expoPushToken": "ExponentPushToken[...",
  "platform": "android"
}

Response: 201 Created
{
  "id": 1,
  "userId": 1,
  "token": "ExponentPushToken[...",
  "platform": "android",
  "isActive": true
}
```

### Get Notification Preferences (Planned)
```http
GET /notifications/preferences
Authorization: Bearer {token}

Response: 200 OK
[
  {
    "type": "GAS_READING_REMINDER",
    "enabled": true
  }
]
```

### Update Notification Preferences (Planned)
```http
PATCH /notifications/preferences
Authorization: Bearer {token}
Content-Type: application/json

{
  "type": "GAS_READING_REMINDER",
  "enabled": false
}

Response: 200 OK
{ ... updated preference }
```

### Test Gas Reminder
```http
POST /notifications/test-gas-reminder
Authorization: Bearer {token}

Response: 200 OK
{
  "success": true,
  "message": "Test reminder sent"
}
```

### Trigger All Gas Reminders (Admin)
```http
POST /notifications/test-trigger-all-gas-reminders
Authorization: Bearer {token}

Response: 200 OK
{
  "success": true,
  "summary": "Sent to 156 users, 2 failed"
}
```

---

## Error Responses

All errors follow standard HTTP status codes:

```http
400 Bad Request
{
  "statusCode": 400,
  "message": "Invalid request parameters",
  "error": "BadRequestException"
}

401 Unauthorized
{
  "statusCode": 401,
  "message": "Unauthorized - invalid or expired token",
  "error": "UnauthorizedException"
}

409 Conflict
{
  "statusCode": 409,
  "message": "A gas reading for this date already exists",
  "error": "ConflictException"
}

500 Internal Server Error
{
  "statusCode": 500,
  "message": "Internal server error",
  "error": "InternalServerErrorException"
}
```

---

## Authentication

All protected endpoints require:
```http
Authorization: Bearer {jwt_token}
```

Token obtained from `/auth/login` endpoint. Expires after 24 hours.

---

## Client SDK Methods

### Web (React)
```typescript
import { apiClient } from 'services/api';

const { token } = await apiClient.login('email@example.com', 'pass');
const dashboard = await apiClient.getDashboard();
const readings = await apiClient.getGasReadings();
await apiClient.addGasReadingPayload({ counterValue: 12456.85, readingDate: '2026-02-04' });
await apiClient.markAllNotificationsRead();
```

### Mobile (React Native)
```typescript
import { apiClient } from 'services/api/client';

const dashboard = await apiClient.getDashboard();
const readings = await apiClient.getGasReadings();
await apiClient.markAllNotificationsRead();
```

---

## Testing Endpoints

### Health Check
```http
GET /health

Response: 200 OK
{
  "status": "healthy",
  "timestamp": "2026-02-04T10:15:00Z"
}
```

### Swagger UI
```
GET /api
```

Open in browser for interactive API documentation and testing.
