# Phase 3+ Implementation Plan
## Tuya Device Write API & Frontend Integration

**Date**: February 3, 2026
**Phase**: Phase 3+ Backend & Frontend Integration
**Duration**: 2-3 weeks (Backend) + 1 week (Frontend) = 3-4 weeks total
**Status**: 🟢 Ready to Start (Parallel with Phase 3 QA)

---

## Executive Summary

Phase 3+ enables users to control heating devices directly from the mobile app:
1. **Adjust target temperature (setpoint)**
2. **Switch heating mode (PROGRAM / MANUAL / OFF)**
3. **Create/edit/delete heating schedules**

All Phase 3+ features are **blocked** by missing backend Tuya device write API. This plan outlines backend implementation (Tuya command encoder, device write endpoints, audit logging) and frontend wiring (edit modals, controls, integration with React Query).

**Critical Path**: Backend Tuya API must ship before frontend integration can complete. Estimated timeline: **2-3 weeks (backend) + 1 week (frontend) = 3-4 weeks total**.

---

## Architecture Overview

### Current State (Phase 3)
```
User
  ↓
Mobile App (React Native)
  ↓
Backend NestJS API
  ↓
Tuya Adapter (READ-ONLY)
  ├── fetchSnapshot() → GET /v1.0/devices/:id
  ├── TuyaProgram decode
  └── Cache + Circuit Breaker (no writes)
  ↓
Tuya Cloud API
```

### Phase 3+ State
```
User (Mobile App)
  ↓
Frontend Controls (NEW)
  ├── SetpointControl
  ├── ModeSelector
  └── EditScheduleModal
  ↓
Backend Device Write API (NEW)
  ├── POST /api/boiler/{homeId}/setpoint
  ├── POST /api/boiler/{homeId}/mode
  ├── PATCH /api/thermostat-device/{id}/programs
  └── Audit Logging + Rollback
  ↓
Tuya Command Encoder (NEW)
  ├── Build device command payload
  ├── Send to Tuya Cloud /v1.0/devices/:id/commands
  └── Verify success
  ↓
Tuya Cloud API
```

---

## Backend Implementation (2-3 weeks)

### Phase 3+ Backend Deliverables

| Deliverable | File | Effort | Dependencies | Status |
|-------------|------|--------|--------------|--------|
| **Tuya Command Encoder** | `backend/src/modules/Boiler/adapter/tuya-command.encoder.ts` | 3 days | TuyaAdapter | 🔄 Not Started |
| **Device Write Service** | `backend/src/modules/Boiler/device-write.service.ts` | 3 days | TuyaAdapter, TuyaCommandEncoder | 🔄 Not Started |
| **Setpoint API Endpoint** | `backend/src/modules/Boiler/controller +setpoint method` | 1 day | DeviceWriteService | 🔄 Not Started |
| **Mode Switch Endpoint** | `backend/src/modules/Boiler/controller +mode method` | 1 day | DeviceWriteService | 🔄 Not Started |
| **Program Edit Endpoint** | `backend/src/modules/Boiler/controller +updatePrograms method` | 2 days | DeviceWriteService, ProgramSyncService | 🔄 Not Started |
| **Audit Logging** | `backend/src/modules/Boiler/audit-log.service.ts` | 2 days | PrismaService | 🔄 Not Started |
| **Rollback / Error Recovery** | `backend/src/modules/Boiler/device-rollback.service.ts` | 2 days | DeviceWriteService | 🔄 Not Started |
| **Unit + Integration Tests** | `backend/test/unit/device-write.spec.ts` + integration tests | 3 days | All above | 🔄 Not Started |

**Total Backend Effort**: 17 days (~2.5 weeks)

---

## 1. Tuya Command Encoder

### Purpose
Build Tuya device command payloads and send them to Tuya Cloud API.

### File: `backend/src/modules/Boiler/adapter/tuya-command.encoder.ts`

### Requirements

```typescript
// Command types supported by Tuya smart thermostats
enum TuyaCommandType {
  SET_TEMPERATURE = 'set_temperature',      // code: 'temp_set'
  SET_MODE = 'set_mode',                    // code: 'mode'
  SET_PROGRAM = 'set_program',              // code: 'program_data'
  POWER_ON_OFF = 'power_on_off',           // code: 'power'
}

// Example: Set temperature to 22°C
POST /v1.0/devices/{deviceId}/commands
{
  "commands": [
    {
      "code": "temp_set",
      "value": 22
    }
  ]
}

// Example: Set mode to PROGRAM
{
  "commands": [
    {
      "code": "mode",
      "value": "program"  // or "manual" or "off"
    }
  ]
}

// Example: Update schedule programs (base64 encoded)
{
  "commands": [
    {
      "code": "program_data",
      "value": "base64_encoded_program_data"
    }
  ]
}
```

### Implementation Steps

1. **Create TuyaCommandEncoder injectable service**
   - Encode setpoint (temp_set code)
   - Encode mode switch (mode code: program/manual/off)
   - Encode program schedule (program_data code with base64 encoding)

2. **Build signature & headers** (reuse from TuyaAdapter)
   - Generate HMAC-SHA256 signature
   - Timestamp-based request headers
   - Access token from TuyaAuthService

3. **Send command to Tuya**
   - POST to `/v1.0/devices/{deviceId}/commands`
   - 30-second timeout (use TuyaHttpAdapter)
   - Retry logic + circuit breaker

4. **Validate response**
   ```typescript
   interface TuyaCommandResponse {
     success: boolean;
     msg?: string;
     data?: {
       result: boolean;
       [key: string]: any;
     };
   }
   ```

### Pseudo Code

```typescript
@Injectable()
export class TuyaCommandEncoder {
  constructor(
    private readonly tokenService: TuyaAuthService,
    private readonly tuyaHttpAdapter: TuyaHttpAdapter,
    private readonly structuredLogger: StructuredLogger,
    private readonly prisma: PrismaService,
  ) {}

  // Set target temperature
  async setTemperature(
    deviceId: string,
    targetTemp: number,
    homeId: number,
    userId: number,
  ): Promise<boolean> {
    const token = await this.tokenService.getAccessToken();
    const command = {
      commands: [
        {
          code: 'temp_set',
          value: targetTemp,
        },
      ],
    };

    const response = await this.sendCommand(deviceId, command, token);

    if (response.success) {
      // Log audit trail
      await this.auditLog('SET_TEMPERATURE', deviceId, homeId, userId, {
        targetTemp,
        success: true,
      });
      return true;
    }

    // Log failure
    await this.auditLog('SET_TEMPERATURE', deviceId, homeId, userId, {
      targetTemp,
      success: false,
      error: response.msg,
    });
    return false;
  }

  // Switch heating mode
  async setMode(
    deviceId: string,
    mode: 'program' | 'manual' | 'off',
    homeId: number,
    userId: number,
  ): Promise<boolean> {
    // Similar structure...
  }

  // Update heating schedules (program data)
  async setProgram(
    deviceId: string,
    programBase64: string,
    homeId: number,
    userId: number,
  ): Promise<boolean> {
    // Similar structure...
  }

  // Private: Send command to Tuya Cloud
  private async sendCommand(
    deviceId: string,
    payload: any,
    token: string,
  ): Promise<TuyaCommandResponse> {
    const path = `/v1.0/devices/${deviceId}/commands`;
    const headers = await this.generateHeaders(path, 'POST', payload, token);

    try {
      const result = await this.tuyaHttpAdapter.post(
        `${process.env.TUYA_BASE_URL}${path}`,
        payload,
        { headers, timeout: 30000 },
      );
      return result.data;
    } catch (error) {
      this.structuredLogger.error('Tuya command failed', error, {
        deviceId,
        action: 'send_command',
      });
      throw error;
    }
  }

  private async generateHeaders(
    path: string,
    method: 'POST',
    body: any,
    token: string,
  ): Promise<Record<string, string>> {
    // Same logic as TuyaAdapter.generateHeaders
    // Return signed headers for Tuya API
  }
}
```

---

## 2. Device Write Service

### Purpose
Orchestrate device write operations with audit logging, rollback, and error recovery.

### File: `backend/src/modules/Boiler/device-write.service.ts`

### Features

1. **Transactional writes**
   - Write to local DB + Tuya Cloud in one transaction
   - Rollback on failure

2. **Audit logging**
   - Every write operation logged with timestamp, user, device, action, result

3. **Error recovery**
   - Verify write success with snapshot fetch (read-after-write)
   - Automatic retry with backoff
   - Rollback if verification fails

4. **Rate limiting**
   - Prevent too many writes per device per minute (configurable)

### Pseudo Code

```typescript
@Injectable()
export class DeviceWriteService {
  constructor(
    private readonly commandEncoder: TuyaCommandEncoder,
    private readonly tuyaAdapter: TuyaAdapter,
    private readonly auditLogService: AuditLogService,
    private readonly prisma: PrismaService,
  ) {}

  async setTemperature(
    homeId: number,
    userId: number,
    targetTemp: number,
  ): Promise<{ success: boolean; message: string; timestamp: Date }> {
    const startTime = Date.now();

    // 1. Get device for this home
    const device = await this.prisma.thermostatDevice.findFirst({
      where: { homeProfileId: homeId },
    });

    if (!device) {
      throw new NotFoundException('Device not found for home');
    }

    // 2. Validate temperature range
    if (targetTemp < 5 || targetTemp > 35) {
      throw new BadRequestException('Temperature must be 5–35°C');
    }

    // 3. Send command to Tuya
    try {
      const commandSuccess = await this.commandEncoder.setTemperature(
        device.tuyaDeviceId,
        targetTemp,
        homeId,
        userId,
      );

      if (!commandSuccess) {
        throw new Error('Tuya command rejected');
      }

      // 4. Verify write with read-after-write (after 2-3s delay)
      await new Promise(resolve => setTimeout(resolve, 2000));
      const snapshot = await this.tuyaAdapter.fetchSnapshot(device.tuyaDeviceId);

      if (Math.abs(snapshot.targetTemp - targetTemp) > 1) {
        // Verification failed, rollback
        throw new Error(
          `Setpoint mismatch: expected ${targetTemp}, got ${snapshot.targetTemp}`,
        );
      }

      // 5. Update local DB
      await this.prisma.thermostatDevice.update({
        where: { id: device.id },
        data: { targetTemp },
      });

      // 6. Log success
      await this.auditLogService.log({
        action: 'SET_TEMPERATURE',
        deviceId: device.id,
        homeId,
        userId,
        data: { targetTemp },
        result: 'SUCCESS',
        duration: Date.now() - startTime,
      });

      return {
        success: true,
        message: `Temperature set to ${targetTemp}°C`,
        timestamp: new Date(),
      };
    } catch (error) {
      // 7. Log failure
      await this.auditLogService.log({
        action: 'SET_TEMPERATURE',
        deviceId: device.id,
        homeId,
        userId,
        data: { targetTemp },
        result: 'FAILED',
        error: error.message,
        duration: Date.now() - startTime,
      });

      // 8. Attempt rollback if needed
      // (depends on error type)

      throw error;
    }
  }

  async setMode(
    homeId: number,
    userId: number,
    mode: 'program' | 'manual' | 'off',
  ): Promise<{ success: boolean; message: string; timestamp: Date }> {
    // Similar structure
  }

  async updatePrograms(
    homeId: number,
    userId: number,
    programs: ThermostatProgram[],
  ): Promise<{ success: boolean; message: string; timestamp: Date }> {
    // Similar structure
    // But also: re-sync with ProgramSyncService after successful write
  }
}
```

---

## 3. Backend API Endpoints

### New Routes in BoilerController

```typescript
@ApiTags('Boiler')
@ApiBearerAuth()
@Controller('api/boiler')
export class BoilerController {
  constructor(
    private readonly boilerService: BoilerService,
    private readonly deviceWriteService: DeviceWriteService,
  ) {}

  // ... existing endpoints (history, sync)

  /**
   * Set target temperature (setpoint)
   *
   * Request: PATCH /api/boiler/{homeId}/setpoint
   * Auth: JWT required
   * Body: { "targetTemp": 22 }
   *
   * Response:
   * {
   *   "success": true,
   *   "message": "Temperature set to 22°C",
   *   "timestamp": "2026-02-03T14:30:00Z"
   * }
   */
  @UseGuards(JwtAuthGuard)
  @Patch(':homeId/setpoint')
  async setSetpoint(
    @Param('homeId', ParseIntPipe) homeId: number,
    @Body() body: SetSetpointDto,
    @Req() req,
  ) {
    const userId = req.user.userId;
    return this.deviceWriteService.setTemperature(
      homeId,
      userId,
      body.targetTemp,
    );
  }

  /**
   * Switch heating mode (PROGRAM / MANUAL / OFF)
   *
   * Request: POST /api/boiler/{homeId}/mode
   * Auth: JWT required
   * Body: { "mode": "program" }
   *
   * Response:
   * {
   *   "success": true,
   *   "message": "Mode set to PROGRAM",
   *   "timestamp": "2026-02-03T14:30:00Z"
   * }
   */
  @UseGuards(JwtAuthGuard)
  @Post(':homeId/mode')
  async setMode(
    @Param('homeId', ParseIntPipe) homeId: number,
    @Body() body: SetModeDto,
    @Req() req,
  ) {
    const userId = req.user.userId;
    return this.deviceWriteService.setMode(homeId, userId, body.mode);
  }

  /**
   * Update heating programs (schedules)
   *
   * Request: PATCH /api/boiler/{homeId}/programs
   * Auth: JWT required
   * Body: {
   *   "programs": [
   *     { "dayType": "WORKDAY", "startMinute": 360, "targetTemp": 20 },
   *     ...
   *   ]
   * }
   *
   * Response:
   * {
   *   "success": true,
   *   "message": "Programs updated and synced",
   *   "timestamp": "2026-02-03T14:30:00Z"
   * }
   */
  @UseGuards(JwtAuthGuard)
  @Patch(':homeId/programs')
  async updatePrograms(
    @Param('homeId', ParseIntPipe) homeId: number,
    @Body() body: UpdateProgramsDto,
    @Req() req,
  ) {
    const userId = req.user.userId;
    return this.deviceWriteService.updatePrograms(
      homeId,
      userId,
      body.programs,
    );
  }
}
```

### DTOs

```typescript
// backend/src/modules/Boiler/dto/set-setpoint.dto.ts
import { IsNumber, Min, Max, IsNotEmpty } from 'class-validator';

export class SetSetpointDto {
  @IsNumber()
  @IsNotEmpty()
  @Min(5)
  @Max(35)
  targetTemp: number;
}

// backend/src/modules/Boiler/dto/set-mode.dto.ts
import { IsEnum, IsNotEmpty } from 'class-validator';

export enum HeatingMode {
  PROGRAM = 'program',
  MANUAL = 'manual',
  OFF = 'off',
}

export class SetModeDto {
  @IsEnum(HeatingMode)
  @IsNotEmpty()
  mode: HeatingMode;
}

// backend/src/modules/Boiler/dto/update-programs.dto.ts
import { IsArray, ValidateNested, IsEnum, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { DayType } from '../../../generated/prisma/enums';

export class ProgramIntervalDto {
  @IsEnum(DayType)
  dayType: DayType;

  @IsNumber()
  @Min(0)
  @Max(1439)
  startMinute: number;

  @IsNumber()
  @Min(5)
  @Max(35)
  targetTemp: number;

  @IsNumber()
  @Min(0)
  orderIndex: number;
}

export class UpdateProgramsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProgramIntervalDto)
  programs: ProgramIntervalDto[];
}
```

---

## 4. Audit Logging Service

### File: `backend/src/modules/Boiler/audit-log.service.ts`

### Schema Addition

```prisma
// backend/prisma/schema.prisma
model DeviceAuditLog {
  id              Int       @id @default(autoincrement())
  userId          Int
  homeProfileId   Int
  thermostatId    Int
  action          String    // SET_TEMPERATURE, SET_MODE, UPDATE_PROGRAMS
  data            Json      // Action-specific data: { targetTemp: 22 }
  result          String    // SUCCESS, FAILED
  error           String?   // Error message if failed
  timestamp       DateTime  @default(now())
  duration        Int?      // Milliseconds taken
  ipAddress       String?   // For security audit
  userAgent       String?   // For security audit

  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  home            HomeProfile @relation(fields: [homeProfileId], references: [id], onDelete: Cascade)
  device          ThermostatDevice @relation(fields: [thermostatId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([homeProfileId])
  @@index([thermostatId])
  @@index([timestamp])
}
```

### Implementation

```typescript
@Injectable()
export class AuditLogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly structuredLogger: StructuredLogger,
  ) {}

  async log(params: {
    action: string;
    deviceId: number;
    homeId: number;
    userId: number;
    data: Record<string, any>;
    result: 'SUCCESS' | 'FAILED';
    error?: string;
    duration?: number;
    ipAddress?: string;
  }): Promise<void> {
    try {
      await this.prisma.deviceAuditLog.create({
        data: {
          userId: params.userId,
          homeProfileId: params.homeId,
          thermostatId: params.deviceId,
          action: params.action,
          data: params.data,
          result: params.result,
          error: params.error,
          duration: params.duration,
          ipAddress: params.ipAddress,
        },
      });

      this.structuredLogger.log(`Device audit logged: ${params.action}`, {
        action: params.action,
        result: params.result,
        userId: params.userId,
        homeId: params.homeId,
        module: 'device-write',
      });
    } catch (error) {
      this.structuredLogger.error('Failed to log audit', error, {
        action: params.action,
        module: 'device-write',
      });
      // Don't throw; audit logging failure should not block device writes
    }
  }
}
```

---

## 5. Rollback & Error Recovery Service

### File: `backend/src/modules/Boiler/device-rollback.service.ts`

### Strategy

1. **Read-after-write verification**
   - After setting temperature, fetch snapshot and verify
   - If mismatch, retry once
   - If still fails, rollback to previous state

2. **Program-specific rollback**
   - Programs stored locally in DB
   - On write failure: restore previous program version

3. **Error categorization**
   - Transient errors (timeout, network) → Retry with backoff
   - Permanent errors (invalid temp range) → Fail immediately
   - Unknown errors → Rollback to known good state

### Pseudo Code

```typescript
@Injectable()
export class DeviceRollbackService {
  constructor(
    private readonly tuyaAdapter: TuyaAdapter,
    private readonly commandEncoder: TuyaCommandEncoder,
    private readonly prisma: PrismaService,
    private readonly structuredLogger: StructuredLogger,
  ) {}

  async rollbackSetpoint(
    deviceId: string,
    previousTargetTemp: number,
    homeId: number,
    userId: number,
  ): Promise<boolean> {
    this.structuredLogger.warn('Initiating temperature rollback', {
      deviceId,
      previousTargetTemp,
      module: 'device-rollback',
    });

    try {
      const success = await this.commandEncoder.setTemperature(
        deviceId,
        previousTargetTemp,
        homeId,
        userId,
      );

      if (success) {
        this.structuredLogger.log('Temperature rollback successful', {
          deviceId,
          previousTargetTemp,
        });
        return true;
      }
    } catch (error) {
      this.structuredLogger.error('Temperature rollback failed', error, {
        deviceId,
      });
    }

    return false;
  }

  // Similar for mode and program rollbacks
}
```

---

## Frontend Implementation (1 week)

### Phase 3+ Frontend Deliverables

| Deliverable | File | Component | Effort | Status |
|-------------|------|-----------|--------|--------|
| **Setpoint Control Component** | `apps/mobile/src/components/heating/SetpointControl.tsx` | Slider + Number Input | 1 day | 🔄 Not Started |
| **Mode Selector Component** | `apps/mobile/src/components/heating/ModeSelector.tsx` | Segmented Control | 0.5 day | 🔄 Not Started |
| **Edit Schedule Modal** | `apps/mobile/src/components/heating/EditScheduleModal.tsx` | Form modal | 2 days | 🔄 Not Started |
| **Add Program Modal** | `apps/mobile/src/components/heating/AddProgramModal.tsx` | Form modal | 1 day | 🔄 Not Started |
| **Delete Program Action** | `apps/mobile/src/components/heating/DeleteProgramButton.tsx` | Confirmation | 0.5 day | 🔄 Not Started |
| **HeatingScreen Refactor** | `apps/mobile/src/screens/heating/HeatingScreen.tsx` | Integration | 1 day | 🔄 Not Started |
| **API Client Methods** | `apps/mobile/src/services/api/heating.api.ts` | New file | 0.5 day | 🔄 Not Started |
| **Loading/Error States** | Throughout components | UI states | 1 day | 🔄 Not Started |

**Total Frontend Effort**: 7 days (~1 week)

---

## Frontend Components Specification

### 1. SetpointControl Component

```tsx
// apps/mobile/src/components/heating/SetpointControl.tsx

interface SetpointControlProps {
  currentTemp: number;
  targetTemp: number;
  minTemp?: number;        // Default: 5
  maxTemp?: number;        // Default: 35
  onSetpoint: (temp: number) => Promise<void>;
  loading?: boolean;
  error?: string;
  homeId: number;
}

// UI Pattern:
// [Current: 18°C]
//
// Target: [22°C] [+] [-]
//
// ────────────────────────
//  5°C          [●●●●]         35°C
// ────────────────────────
//
// [Save]  [Cancel]

// Features:
// - Slider for continuous input
// - Direct number input field
// - +/- buttons for 0.5°C increments
// - Loading spinner while saving
// - Error toast on failure
// - Automatic retry with backoff
```

### 2. ModeSelector Component

```tsx
// apps/mobile/src/components/heating/ModeSelector.tsx

interface ModeSelectorProps {
  currentMode: 'PROGRAM' | 'MANUAL' | 'OFF';
  onModeChange: (mode: 'PROGRAM' | 'MANUAL' | 'OFF') => Promise<void>;
  loading?: boolean;
  error?: string;
  homeId: number;
}

// UI Pattern:
// Current Mode: PROGRAM
//
// ┌─────────────┬─────────────┬─────────────┐
// │  PROGRAM    │  MANUAL     │    OFF      │
// │  (Active)   │             │             │
// └─────────────┴─────────────┴─────────────┘
//
// Mode Description (below):
// PROGRAM: Use schedule intervals
// MANUAL: Hold fixed temperature
// OFF: Stop heating

// Features:
// - Three-segment control
// - Visual feedback on active mode
// - Description text for each mode
// - Loading state during switch
// - Prevents accidental clicks during operation
```

### 3. EditScheduleModal Component

```tsx
// apps/mobile/src/components/heating/EditScheduleModal.tsx

interface EditScheduleModalProps {
  visible: boolean;
  program: ThermostatProgram;
  onSave: (program: UpdatedProgram) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
  error?: string;
  homeId: number;
}

// UI Pattern:
// ┌─────────────────────────────┐
// │   Edit Program Interval     │
// ├─────────────────────────────┤
// │                             │
// │ Day Type: [WORKDAY ▼]       │
// │                             │
// │ Start Time: [06:00 ▼]       │
// │                             │
// │ Target Temp: [20°C]         │
// │              ────────────   │
// │              [+] 20 [-]     │
// │                             │
// │ [Save] [Cancel]             │
// │                             │
// └─────────────────────────────┘

// Validation:
// - Start time must be unique per day type
// - Temperature range 5-35°C
// - 15-minute increments for time

// Features:
// - Day type selector (dropdown)
// - Time picker (minutes, 15-min steps)
// - Temperature slider + input
// - Form validation
// - Loading spinner
// - Error display with retry
```

### 4. API Client Extension

```typescript
// apps/mobile/src/services/api/heating.api.ts

class HeatingApi {
  private baseURL = process.env.EXPO_PUBLIC_API_URL;

  async setTemperature(
    homeId: number,
    targetTemp: number,
  ): Promise<{ success: boolean; message: string; timestamp: string }> {
    const response = await apiClient.patch(
      `${this.baseURL}/boiler/${homeId}/setpoint`,
      { targetTemp },
    );
    return response.data;
  }

  async setMode(
    homeId: number,
    mode: 'program' | 'manual' | 'off',
  ): Promise<{ success: boolean; message: string; timestamp: string }> {
    const response = await apiClient.post(
      `${this.baseURL}/boiler/${homeId}/mode`,
      { mode },
    );
    return response.data;
  }

  async updatePrograms(
    homeId: number,
    programs: ProgramIntervalDto[],
  ): Promise<{ success: boolean; message: string; timestamp: string }> {
    const response = await apiClient.patch(
      `${this.baseURL}/boiler/${homeId}/programs`,
      { programs },
    );
    return response.data;
  }
}

export const heatingApi = new HeatingApi();
```

### 5. HeatingScreen Integration

```tsx
// Modified apps/mobile/src/screens/heating/HeatingScreen.tsx

export const HeatingScreen = () => {
  const [showSetpointControl, setShowSetpointControl] = useState(false);
  const [showModeSelector, setShowModeSelector] = useState(false);
  const [editingProgram, setEditingProgram] = useState<ThermostatProgram | null>(null);
  const [activeHomeId, setActiveHomeId] = useState<number>(null);

  const { data: summary } = useQuery({
    queryKey: ['heatingSummary', activeHomeId],
    queryFn: () => analyticsApi.getHeatingSummary(activeHomeId),
  });

  const setpointMutation = useMutation({
    mutationFn: (temp: number) => heatingApi.setTemperature(activeHomeId, temp),
    onSuccess: () => {
      // Refresh snapshot
      queryClient.invalidateQueries(['heatingSummary', activeHomeId]);
      toast.show({
        title: 'Success',
        description: 'Temperature updated',
        status: 'success',
      });
    },
    onError: (error) => {
      toast.show({
        title: 'Error',
        description: error.message,
        status: 'error',
      });
    },
  });

  const modeMutation = useMutation({
    mutationFn: (mode: string) => heatingApi.setMode(activeHomeId, mode),
    onSuccess: () => {
      queryClient.invalidateQueries(['heatingSummary', activeHomeId]);
      toast.show({
        title: 'Success',
        description: 'Mode updated',
        status: 'success',
      });
    },
  });

  return (
    <ScrollView>
      {/* Temperature Display + Control */}
      <TemperatureDisplay
        currentTemp={summary?.currentTemp}
        targetTemp={summary?.targetTemp}
        onEditPress={() => setShowSetpointControl(true)}
      />

      {/* Mode Selector */}
      <ModeSelector
        currentMode={summary?.mode}
        onModeChange={(mode) => modeMutation.mutate(mode)}
        loading={modeMutation.isLoading}
        error={modeMutation.error?.message}
        homeId={activeHomeId}
      />

      {/* Schedule Display + Edit */}
      <ScheduleCard
        programs={summary?.programs}
        onEditPress={(program) => setEditingProgram(program)}
        onAddPress={() => setEditingProgram(null)} // null = new program
      />

      {/* Modals */}
      <SetpointControl
        visible={showSetpointControl}
        currentTemp={summary?.currentTemp}
        targetTemp={summary?.targetTemp}
        onSetpoint={(temp) => setpointMutation.mutate(temp)}
        loading={setpointMutation.isLoading}
        error={setpointMutation.error?.message}
        homeId={activeHomeId}
      />

      <EditScheduleModal
        visible={!!editingProgram}
        program={editingProgram}
        onSave={handleSaveProgram}
        onCancel={() => setEditingProgram(null)}
        homeId={activeHomeId}
      />
    </ScrollView>
  );
};
```

---

## Testing Strategy

### Backend Testing

#### Unit Tests
- TuyaCommandEncoder command payload generation
- DeviceWriteService business logic
- AuditLogService logging
- Rollback service recovery scenarios

#### Integration Tests
- End-to-end setpoint change (mock Tuya API)
- Mode switch with verification
- Program update with ProgramSyncService
- Audit log persistence
- Error handling and rollback

#### Test Fixtures
- Mock Tuya responses (success, timeout, error)
- Mock device states (various temps, modes, programs)
- Test users and homes

### Frontend Testing

#### Component Tests
- SetpointControl slider interaction
- ModeSelector mode switching
- EditScheduleModal form validation
- Error state displays

#### Integration Tests
- HeatingScreen with mutations
- Query cache invalidation after write
- Error toast notifications
- Loading states during operations

#### E2E Tests (Post-Phase 3)
- User sets temperature end-to-end
- User switches mode
- User edits schedule
- Offline behavior (optimistic updates)

---

## Implementation Timeline

### Week 1: Backend (Day 1-5)
```
Day 1-2:  TuyaCommandEncoder implementation + unit tests
Day 2-3:  DeviceWriteService + endpoint DTOs
Day 3-4:  AuditLogService + Rollback service
Day 4-5:  Integration tests + error handling refinement
Day 5:    Code review + documentation
```

### Week 2: Frontend (Day 6-10)
```
Day 1-2:  SetpointControl + ModeSelector components
Day 2-3:  EditScheduleModal + API client integration
Day 3-4:  HeatingScreen refactor + mutations
Day 4-5:  Component tests + error states
Day 5:    Code review + QA coordination
```

### Week 3: QA & Polish (Day 11-15)
```
Day 1-2:  QA test plan execution
Day 2-3:  Bug fixes + edge case handling
Day 3-4:  Performance testing (socket choke, rate limiting)
Day 4-5:  Final review + release prep
```

---

## Coordination & Dependencies

### Backend → Frontend Handoff
1. **API Contract Delivery** (End of Week 1)
   - OpenAPI/Swagger spec for setpoint, mode, programs endpoints
   - Error response documentation
   - Rate limiting / retry guidance

2. **Mock API for Frontend** (Day 3)
   - Mock server responses matching spec
   - Allows frontend to start integration while backend completes

3. **Live API Switchover** (Start of Week 2)
   - Frontend swaps mock → real API endpoints
   - Both teams run parallel tests

### QA Coordination
- **Backend QA**: Test endpoints directly (Postman, curl)
- **Mobile QA**: Test full user flow (E2E on emulator)
- **Parallel Phase 3 QA**: No blocking; phase 3+ work happens in parallel

### Communication Plan
- **Daily standups**: 15 min sync (backend + frontend + QA)
- **Blocking issues**: Slack immediate escalation
- **API contract**: Shared Swagger doc in repo (auto-updated)

---

## Risk Mitigation

### Risk 1: Tuya API Command Encoding Bugs
**Mitigation**:
- Extensive unit tests for command payload generation
- Test with actual Tuya device in dev environment (if available)
- Fallback to read-only mode if write fails (app still functional)

### Risk 2: Race Conditions (Multiple Users Editing Same Program)
**Mitigation**:
- Optimistic locking on device update (version field in DB)
- Conflict detection: if user2 updates while user1 is editing, show conflict alert
- Last-write-wins with audit trail

### Risk 3: Tuya API Rate Limiting
**Mitigation**:
- Implement local request queuing
- Client-side debouncing (don't send >1 req per 2 seconds)
- Exponential backoff on 429 responses
- Monitor Tuya API quota usage

### Risk 4: Device Command Timeout Recovery
**Mitigation**:
- Always do read-after-write verification
- If verification fails after 3 retries, rollback
- Log all timeouts for debugging
- Show user "Verify & Retry" button on persistent failures

### Risk 5: Frontend State Sync Issues
**Mitigation**:
- React Query mutation boundaries clear
- Cache invalidation on every write
- Snapshot refetch to sync UI with actual device state
- Optimistic updates with pessimistic rollback on error

---

## Success Criteria

### Backend Success
- ✅ All 3 endpoints implemented (setpoint, mode, programs)
- ✅ Tuya command encoding tested with mock + real API
- ✅ Audit logging for all writes
- ✅ Rollback mechanism working for failures
- ✅ 45+ integration tests passing
- ✅ No unhandled promise rejections
- ✅ Error messages clear to frontend

### Frontend Success
- ✅ All 4 components implemented (setpoint, mode, edit modal, add modal)
- ✅ Mutations handle loading/error/success states
- ✅ User can set temperature end-to-end
- ✅ User can switch mode
- ✅ User can add/edit/delete programs
- ✅ Offline handling (optimistic updates)
- ✅ All dark/light mode variations work

### QA Success
- ✅ 20+ test cases for Phase 3+ features
- ✅ All flows tested on iOS + Android
- ✅ Edge cases covered (invalid inputs, network errors, race conditions)
- ✅ No crashes or hangs
- ✅ Sign-off ready for release

---

## Deliverables Checklist

### Backend
- [ ] TuyaCommandEncoder service (command payload builder)
- [ ] DeviceWriteService (orchestrator)
- [ ] 3 BoilerController endpoints (setpoint, mode, programs)
- [ ] AuditLogService (logging)
- [ ] DeviceRollbackService (error recovery)
- [ ] Database migration (DeviceAuditLog schema)
- [ ] Unit + integration tests (45+)
- [ ] OpenAPI spec / Swagger docs
- [ ] Error handling documentation

### Frontend
- [ ] SetpointControl component
- [ ] ModeSelector component
- [ ] EditScheduleModal component
- [ ] AddProgramModal component
- [ ] HeatingScreen refactor (integrate modals)
- [ ] HeatingApi client methods
- [ ] React Query mutations
- [ ] Component tests
- [ ] E2E test scenarios

### Documentation
- [ ] Architecture diagram (updated)
- [ ] API contract / OpenAPI spec
- [ ] Implementation guide (this document)
- [ ] QA test plan for Phase 3+
- [ ] Troubleshooting guide (Tuya command failures)
- [ ] Rollback procedure documentation

---

## Next Steps

### Immediate (Today - February 3)
1. ✅ Share this plan with backend + frontend leads
2. ✅ Backend team: Design TuyaCommandEncoder API
3. ✅ Frontend team: Start component sketches
4. ✅ QA team: Prepare test environment for Phase 3+

### Tomorrow (February 4)
1. Backend: Begin TuyaCommandEncoder implementation
2. Frontend: Set up new component files
3. Both: Create mock API for integration testing

### By End of Week (February 7)
1. Backend: TuyaCommandEncoder complete + tested
2. Backend: 2 of 3 endpoints complete (setpoint, mode)
3. Frontend: SetpointControl + ModeSelector complete
4. Both: API contract finalized in OpenAPI

---

## Status Template (Daily Updates)

```
### Phase 3+ Daily Status - [Date]

**Backend Progress**:
- [ ] TuyaCommandEncoder: X% complete
- [ ] DeviceWriteService: X% complete
- [ ] Endpoints: X% complete
- Blockers: None | [describe]
- Next: [describe]

**Frontend Progress**:
- [ ] Components: X% complete
- [ ] Integration: X% complete
- Blockers: None | [describe]
- Next: [describe]

**QA Readiness**:
- [ ] Test plan: Ready | In Progress
- [ ] Test environment: Ready | In Progress
- Blockers: None | [describe]

**Overall Status**: 🟢 On Track | 🟡 At Risk | 🔴 Blocked
```

---

## References

- [Phase 3 Final Status](PHASE_3_FINAL_STATUS.md)
- [Phase 3 Guide](../apps/mobile/PHASE_3_GUIDE.md)
- [Heating Screen QA Plan](HEATING_SCREEN_QA_PLAN.md)
- [Backend Architecture](V2_ARCHITECTURE.md)

---

**Document Status**: 🟢 Ready for Implementation
**Last Updated**: February 3, 2026
**Owner**: Engineering Lead (Backend)
