import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import crypto from 'crypto';
import { TuyaAuthService } from '../../../modules/Tuya/tuya.auth.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { DayType } from '../../../generated/prisma/enums';
import { ThermostatSnapshot } from './thermostat-adapter.interface';
import { TuyaProgramByDay } from './program-sync.types';
import { ProgramSyncService } from './program.sync.service';
import { StructuredLogger } from '../../../common/structured-logger';

interface TargetTempInfo {
  targetTemp: number;
  dayType?: DayType;
  interval?: {
    startMinute: number;
    targetTemp: number;
    orderIndex: number;
  };
}

interface CircuitBreakerState {
  failureCount: number;
  lastFailureTime: number;
  isOpen: boolean;
}

interface CachedSnapshot {
  timestamp: number;
  data: ThermostatSnapshot;
}

interface TuyaRequestMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  circuitBreakerTrips: number;
}

@Injectable()
export class TuyaAdapter {
  private readonly logger = new Logger(TuyaAdapter.name);
  private readonly structuredLogger = new StructuredLogger(TuyaAdapter.name);
  private readonly baseUrl = process.env.TUYA_BASE_URL!;

  // Cache: 5s TTL for read coalescing
  private readonly snapshotCache = new Map<string, CachedSnapshot>();
  private readonly SNAPSHOT_CACHE_TTL = 5 * 1000; // 5 seconds

  // Circuit breaker: prevent cascade failures
  private readonly circuitBreaker = new Map<string, CircuitBreakerState>();
  private readonly CB_FAILURE_THRESHOLD = 3;
  private readonly CB_RESET_TIME = 60 * 1000; // 60 seconds

  // Request accounting for budget monitoring
  private requestMetrics: TuyaRequestMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    circuitBreakerTrips: 0,
  };

  constructor(
    private readonly tokenService: TuyaAuthService,
    private readonly programSyncService: ProgramSyncService,
    private readonly prisma: PrismaService,
  ) {}

  /** Get current request metrics for Prometheus export */
  getMetrics(): TuyaRequestMetrics {
    return { ...this.requestMetrics };
  }

  /** Reset metrics (useful for testing) */
  resetMetrics(): void {
    this.requestMetrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      circuitBreakerTrips: 0,
    };
  }

  /** Check circuit breaker state and throw if open */
  private checkCircuitBreaker(deviceId: string): void {
    const state = this.circuitBreaker.get(deviceId);
    if (!state) return;

    if (state.isOpen) {
      const timeSinceLastFailure = Date.now() - state.lastFailureTime;
      if (timeSinceLastFailure > this.CB_RESET_TIME) {
        // Reset circuit breaker
        this.logger.debug(
          `[CB] Resetting circuit breaker for device ${deviceId}`,
        );
        this.circuitBreaker.delete(deviceId);
        return;
      }
      this.requestMetrics.circuitBreakerTrips++;
      this.logger.warn(
        `[CB] Circuit breaker OPEN for device ${deviceId}. Failing fast.`,
      );
      throw new Error(`Circuit breaker open for device ${deviceId}`);
    }
  }

  /** Record failure and update circuit breaker state */
  private recordFailure(deviceId: string): void {
    let state = this.circuitBreaker.get(deviceId);
    if (!state) {
      state = { failureCount: 0, lastFailureTime: 0, isOpen: false };
      this.circuitBreaker.set(deviceId, state);
    }

    state.failureCount++;
    state.lastFailureTime = Date.now();

    if (state.failureCount >= this.CB_FAILURE_THRESHOLD) {
      state.isOpen = true;
      this.logger.warn(
        `[CB] Opening circuit breaker for device ${deviceId} after ${state.failureCount} failures`,
      );
    }
  }

  /** Record success and reset circuit breaker */
  private recordSuccess(deviceId: string): void {
    const state = this.circuitBreaker.get(deviceId);
    if (state) {
      state.failureCount = 0;
      state.isOpen = false;
    }
  }

  private async generateHeaders(
    path: string,
    method: 'GET' | 'POST',
    body?: any,
  ) {
    const token = await this.tokenService.getAccessToken();
    const timestamp = Date.now().toString();
    const nonce = '';

    const bodyStr = body ? JSON.stringify(body) : '';
    const sha256Body = crypto
      .createHash('sha256')
      .update(bodyStr)
      .digest('hex');
    const signStr = `${method}\n${sha256Body}\n\n${path}`;

    const sign = crypto
      .createHmac('sha256', process.env.TUYA_CLIENT_SECRET!)
      .update(process.env.TUYA_CLIENT_ID! + token + timestamp + nonce + signStr)
      .digest('hex')
      .toUpperCase();

    return {
      client_id: process.env.TUYA_CLIENT_ID!,
      access_token: token,
      t: timestamp,
      sign_method: 'HMAC-SHA256',
      sign,
      nonce,
    };
  }

  /** JEDAN GET koji vraća kompletan status uređaja — s cache-om od 5s i circuit breakerom */
  private async fetchStatus(
    deviceId: string,
    runId?: string,
  ): Promise<Record<string, any>> {
    // Check circuit breaker first
    const cbState = this.circuitBreaker.get(deviceId);
    if (cbState?.isOpen) {
      // If we have a recent cached snapshot, return it instead of failing hard
      const cached = this.snapshotCache.get(deviceId);
      if (cached && Date.now() - cached.timestamp < this.SNAPSHOT_CACHE_TTL) {
        this.structuredLogger.warn(
          'Returning cached snapshot due to open circuit',
          {
            deviceId,
            runId,
            module: 'tuya-adapter',
            action: 'circuit_open_return_cache',
          },
        );
        this.requestMetrics.circuitBreakerTrips++;
        return cached.data as Record<string, any>;
      }
      this.checkCircuitBreaker(deviceId);
    }

    // Check snapshot cache (5s TTL for coalescing)
    const cached = this.snapshotCache.get(deviceId);
    if (cached && Date.now() - cached.timestamp < this.SNAPSHOT_CACHE_TTL) {
      this.structuredLogger.debug('Snapshot from cache', {
        deviceId,
        runId,
        module: 'tuya-adapter',
        action: 'cache_hit',
      });
      return cached.data;
    }

    const path = `/v1.0/devices/${deviceId}`;
    const headers = await this.generateHeaders(path, 'GET');

    const startTime = Date.now();
    this.requestMetrics.totalRequests++;

    try {
      const timeoutMs = Number(process.env.TUYA_REQUEST_TIMEOUT_MS) || 10000;
      const res = await axios.get(`${this.baseUrl}${path}`, {
        headers,
        timeout: timeoutMs, // configurable timeout
      });

      const duration = Date.now() - startTime;
      this.structuredLogger.log('Tuya request success', {
        deviceId,
        runId,
        module: 'tuya-adapter',
        action: 'tuya_request_success',
        durationMin: duration / 1000 / 60,
      });

      if (!res.data.success) {
        this.recordFailure(deviceId);
        this.structuredLogger.error('Tuya response unsuccessful', undefined, {
          deviceId,
          runId,
          module: 'tuya-adapter',
          action: 'tuya_response_error',
        });
        throw new Error(
          `Tuya device fetch failed: ${JSON.stringify(res.data)} after ${duration}ms`,
        );
      }

      this.requestMetrics.successfulRequests++;
      this.recordSuccess(deviceId);

      const statusArray: Array<{ code: string; value: any }> =
        res.data.result.status ?? [];
      const statusMap = statusArray.reduce(
        (acc, s) => {
          acc[s.code] = s.value;
          return acc;
        },
        {} as Record<string, any>,
      );

      return statusMap;
    } catch (err) {
      this.requestMetrics.failedRequests++;
      this.recordFailure(deviceId);

      const errMsg = err instanceof AxiosError ? err.message : String(err);
      this.structuredLogger.error('Tuya request failed', new Error(errMsg), {
        deviceId,
        runId,
        module: 'tuya-adapter',
        action: 'tuya_request_error',
      });

      throw err;
    }
  }

  /** Dobijamo target temperaturu iz statusa, bez dodatnog fetch-a */
  private async getTargetFromStatus(
    deviceId: string,
    status: Record<string, any>,
  ): Promise<TargetTempInfo> {
    const existingDevice = await this.prisma.thermostatDevice.findFirst({
      where: { deviceId },
    });

    if (!existingDevice) {
      throw new Error(`Termostat device fetch failed.`);
    }

    if (status['Mode'] === '0' && status['program']) {
      const tuyaProgram = this.decodeTuyaProgram(status['program']);
      await this.programSyncService.syncProgram(existingDevice.id, tuyaProgram);

      const now = new Date();
      const dayType = this.getDayType(now.getDay());
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      let activeInterval = await this.prisma.thermostatProgram.findFirst({
        where: {
          deviceId: existingDevice.id,
          dayType,
          startMinute: { lte: currentMinutes },
        },
        orderBy: { startMinute: 'desc' },
      });

      if (!activeInterval) {
        const previousDayType = this.getPreviousDayType(dayType);
        activeInterval = await this.prisma.thermostatProgram.findFirst({
          where: {
            deviceId: existingDevice.id,
            dayType: previousDayType,
          },
          orderBy: { startMinute: 'desc' },
        });
      }

      return {
        targetTemp: activeInterval?.targetTemp ?? 0,
        dayType,
        interval: activeInterval
          ? {
              startMinute: activeInterval.startMinute,
              targetTemp: activeInterval.targetTemp,
              orderIndex: activeInterval.orderIndex,
            }
          : undefined,
      };
    }

    // fallback
    return {
      targetTemp: status['TempSet'] ?? 0,
    };
  }

  /** FETCH SNAPSHOT – SADA SAMO JEDAN API poziv s 5s cache-om */
  async fetchSnapshot(
    deviceId: string,
    runId?: string,
  ): Promise<ThermostatSnapshot> {
    const status = await this.fetchStatus(deviceId, runId); // <-- samo JEDAN GET

    const currentTemp = (status['TempCurrent'] ?? null) / 2;
    const powerOn = status['Power'] === true;

    const targetInfo = await this.getTargetFromStatus(deviceId, status);

    const snapshot: ThermostatSnapshot = {
      currentTemp,
      targetTemp: targetInfo.targetTemp,
      timestamp: new Date(),
      powerOn,
      dayType: targetInfo.dayType,
      activeInterval: targetInfo.interval,
    };

    // Cache the snapshot result (not the status, but the full snapshot)
    this.snapshotCache.set(deviceId, {
      timestamp: Date.now(),
      data: snapshot,
    });

    this.structuredLogger.log('Snapshot fetched', {
      deviceId,
      runId,
      module: 'tuya-adapter',
      action: 'snapshot_fetched',
    });

    return snapshot;
  }

  // ----------------- HELPERS -----------------

  private decodeTuyaProgram(programB64: string): TuyaProgramByDay {
    const buf = Buffer.from(programB64, 'base64');
    const intervals: Array<{ startMinute: number; temp: number }> = [];

    for (let i = 0; i + 2 < buf.length; i += 3) {
      const minute = buf[i];
      const hour = buf[i + 1];
      const temp = buf[i + 2];
      const startMinute = hour * 60 + minute;
      intervals.push({ startMinute, temp });
    }

    const dayTypes: DayType[] = ['WORKDAY', 'SATURDAY', 'SUNDAY'];
    const tuyaProgram: TuyaProgramByDay = {} as any;

    dayTypes.forEach((dayType, dayIdx) => {
      const start = dayIdx * 6;
      const end = start + 6;
      tuyaProgram[dayType] = intervals.slice(start, end).map((i, idx) => ({
        dayType,
        orderIndex: idx,
        startMinute: i.startMinute,
        targetTemp: i.temp / 2, // normalizacija ostaje ista
      }));
    });

    return tuyaProgram;
  }

  private getDayType(day: number): DayType {
    if (day === 0) return 'SUNDAY';
    if (day === 6) return 'SATURDAY';
    return 'WORKDAY';
  }

  private getPreviousDayType(dayType: DayType): DayType {
    if (dayType === 'WORKDAY') return 'SUNDAY';
    if (dayType === 'SATURDAY') return 'WORKDAY';
    return 'SATURDAY';
  }
}
