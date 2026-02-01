import { Injectable } from '@nestjs/common';
import axios from 'axios';
import crypto from 'crypto';
import { TuyaAuthService } from '../../../modules/Tuya/tuya.auth.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { DayType } from '../../../generated/prisma/enums';
import { ThermostatSnapshot } from './thermostat-adapter.interface';
import { TuyaProgramByDay } from './program-sync.types';
import { ProgramSyncService } from './program.sync.service';

interface TargetTempInfo {
  targetTemp: number;
  dayType?: DayType;
  interval?: {
    startMinute: number;
    targetTemp: number;
    orderIndex: number;
  };
}

@Injectable()
export class TuyaAdapter {
  private readonly baseUrl = process.env.TUYA_BASE_URL!;
  private readonly statusCache = new Map<string, { timestamp: number; data: any }>();
  private readonly CACHE_TTL = 10 * 60 * 1000; // 10 minutes

  constructor(
    private readonly tokenService: TuyaAuthService,
    private readonly programSyncService: ProgramSyncService,
    private readonly prisma: PrismaService,
  ) {}

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

  /** JEDAN GET koji vraća kompletan status uređaja */
  private async fetchStatus(deviceId: string): Promise<Record<string, any>> {
    const cached = this.statusCache.get(deviceId);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    const path = `/v1.0/devices/${deviceId}`;
    const headers = await this.generateHeaders(path, 'GET');

    const res = await axios.get(`${this.baseUrl}${path}`, { headers });
    if (!res.data.success) {
      throw new Error(`Tuya device fetch failed: ${JSON.stringify(res.data)}`);
    }

    const statusArray: Array<{ code: string; value: any }> =
      res.data.result.status ?? [];
    const statusMap = statusArray.reduce(
      (acc, s) => {
        acc[s.code] = s.value;
        return acc;
      },
      {} as Record<string, any>,
    );

    this.statusCache.set(deviceId, { timestamp: Date.now(), data: statusMap });
    return statusMap;
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

  /** FETCH SNAPSHOT – SADA SAMO JEDAN API poziv */
  async fetchSnapshot(deviceId: string): Promise<ThermostatSnapshot> {
    const status = await this.fetchStatus(deviceId); // <-- samo JEDAN GET

    const currentTemp = (status['TempCurrent'] ?? null) / 2;
    const powerOn = status['Power'] === true;

    const targetInfo = await this.getTargetFromStatus(deviceId, status);

    return {
      currentTemp,
      targetTemp: targetInfo.targetTemp,
      timestamp: new Date(),
      powerOn,
      dayType: targetInfo.dayType,
      activeInterval: targetInfo.interval,
    };
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
