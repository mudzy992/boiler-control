# Backend Thermostat Programs Endpoint Fix

## Problem Identified
The frontend was attempting to fetch thermostat programs from the endpoint `GET /api/devices/:id/programs`, but this endpoint didn't exist in the backend. The backend had the infrastructure to sync programs from Tuya Cloud (via ProgramSyncService) but didn't expose them via REST API.

## Root Cause Analysis
1. **Mobile app**: Used wrong endpoint path `/thermostat-device/:id/programs`
2. **Backend**: No GET endpoint to retrieve synced programs from database
3. **Frontend**: No API service to interact with thermostat endpoints
4. **Controller route**: Was `api/devices` but thermostat programs endpoint was missing

## Changes Made

### 1. Backend Service Implementation
**File**: `backend/src/modules/ThermostatDevice/thermostat.device.service.ts`

Added new method:
```typescript
async getPrograms(userId: number, deviceId: number) {
  const device = await this.prisma.thermostatDevice.findUnique({
    where: { id: deviceId },
  });

  if (!device) throw new NotFoundException('Thermostat not found');
  if (device.userId !== userId) throw new ForbiddenException('Access denied');

  return this.prisma.thermostatProgram.findMany({
    where: { deviceId },
    orderBy: [
      { dayType: 'asc' },
      { orderIndex: 'asc' },
    ],
  });
}
```

**Features**:
- Validates device ownership (userId check)
- Throws NotFoundException if device doesn't exist
- Throws ForbiddenException if user doesn't own the device
- Returns programs sorted by day type and order index

### 2. Backend Controller Implementation
**File**: `backend/src/modules/ThermostatDevice/thermostat.device.controller.ts`

Added new endpoint:
```typescript
@Get(':id/programs')
getPrograms(@Req() req, @Param('id') id: string) {
  return this.service.getPrograms(req.user.userId, +id);
}
```

**Route**: `GET /api/devices/:id/programs`
**Auth**: Requires JWT token (JwtAuthGuard)
**Response**: Array of ThermostatProgram objects

### 3. Frontend Web API Service
**File**: `frontend/src/api/thermostat.api.ts` (NEW)

Created comprehensive API service:
```typescript
export const getAllDevices = async (): Promise<ThermostatDevice[]>
export const getDeviceById = async (deviceId: number): Promise<ThermostatDevice>
export const getDevicePrograms = async (deviceId: number): Promise<ThermostatProgram[]>
export const updateDevice = async (deviceId: number, payload): Promise<ThermostatDevice>
export const deleteDevice = async (deviceId: number): Promise<void>
```

**Base Endpoint**: `/devices` (relative to API base URL)

### 4. Frontend TypeScript Interfaces
**File**: `frontend/src/interfaces/ThermostatDevice.ts` (NEW)

Created type definitions:
- `DayType` enum: WORKDAY, SATURDAY, SUNDAY
- `ThermostatProgram`: Program object with id, deviceId, dayType, startMinute, targetTemp, etc.
- `ThermostatDevice`: Device object with id, userId, homeProfileId, name, currentTemp, etc.
- `UpdateThermostatDevice`: Update payload type

### 5. Mobile App API Service Update
**File**: `apps/mobile/src/services/api/thermostat.api.ts`

Fixed endpoint paths:
- Changed `/thermostat-device` → `/devices`
- Changed `/thermostat-device/:id` → `/devices/:id`
- Changed `/thermostat-device/:id/programs` → `/devices/:id/programs`

## Testing Instructions

### 1. Start Backend
```bash
cd backend
npm run start:dev
```

### 2. Reset Database with Seed Data
```bash
cd backend
npm run db:reset:seed
```

### 3. Test Endpoint with cURL
```bash
# Get all devices
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:3020/api/devices

# Get programs for device 1
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:3020/api/devices/1/programs
```

### 4. Frontend Testing
- Web app: Navigate to Heating Schedules page
- Mobile app: Navigate to Heating Schedules tab
- Both should now load and display thermostat programs

## Endpoint Specifications

### GET /api/devices
- **Description**: Fetch all thermostat devices for authenticated user
- **Auth**: Required (JWT)
- **Response**: Array of ThermostatDevice objects with homeProfile

### GET /api/devices/:id
- **Description**: Fetch single thermostat device with details
- **Auth**: Required (JWT)
- **Response**: ThermostatDevice object with homeProfile and heatingEvents

### GET /api/devices/:id/programs
- **Description**: Fetch all programs for a thermostat device
- **Auth**: Required (JWT)
- **Response**: Array of ThermostatProgram objects sorted by dayType and orderIndex
- **Error**: 404 if device not found, 403 if user doesn't own device

## Security Considerations
✅ All endpoints protected by JWT guard
✅ User ownership validation on all device operations
✅ userId extracted from JWT token
✅ Proper error responses (400, 403, 404, 500)

## Database Queries
Programs are fetched directly from `ThermostatProgram` table in Prisma:
- Where: `deviceId` matches
- OrderBy: `dayType` ASC, then `orderIndex` ASC
- Includes: All program fields including programHash for sync tracking

## Integration Status
✅ Backend endpoint implemented and tested
✅ Frontend API services created
✅ Mobile app API paths fixed
✅ TypeScript types defined
✅ No compilation errors
⏳ Ready for frontend testing

## Notes
- Programs are synced from Tuya Cloud via ProgramSyncService background job
- Frontend displays read-only programs (no editing yet)
- Thermal programs respect the DayType enum (WORKDAY, SATURDAY, SUNDAY)
- Programs ordered by dayType then orderIndex for logical display
