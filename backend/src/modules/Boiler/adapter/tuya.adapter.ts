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

  async getDeviceStatus(deviceId: string): Promise<Record<string, any>> {
    const path = `/v1.0/devices/${deviceId}`;
    const headers = await this.generateHeaders(path, 'GET');

    const res = await axios.get(`${this.baseUrl}${path}`, { headers });
    if (!res.data.success) {
      throw new Error(`Tuya device fetch failed: ${JSON.stringify(res.data)}`);
    }

    const statusArray: Array<{ code: string; value: any }> =
      res.data.result.status ?? [];
    return statusArray.reduce(
      (acc, s) => {
        acc[s.code] = s.value;
        return acc;
      },
      {} as Record<string, any>,
    );
  }

  /** Glavna funkcija koja vraća target temperaturu */
  async getTargetTemperature(deviceId: string): Promise<TargetTempInfo> {
    const status = await this.getDeviceStatus(deviceId);
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

      const interval = await this.prisma.thermostatProgram.findFirst({
        where: {
          deviceId: existingDevice.id,
          dayType,
          startMinute: { lte: currentMinutes },
        },
        orderBy: { startMinute: 'desc' },
      });

      return {
        targetTemp: interval ? interval.targetTemp : 0,
        dayType,
        interval: interval
          ? {
              startMinute: interval.startMinute,
              targetTemp: interval.targetTemp,
              orderIndex: interval.orderIndex,
            }
          : undefined,
      };
    }

    return { targetTemp: status['TempSet'] ?? 0 };
  }

  async getCurrentTemperature(deviceId: string): Promise<number> {
    const status = await this.getDeviceStatus(deviceId);
    return status['TempCurrent'] ?? 0;
  }

  async fetchSnapshot(deviceId: string): Promise<ThermostatSnapshot> {
    const currentTemp = await this.getCurrentTemperature(deviceId);
    const targetInfo = await this.getTargetTemperature(deviceId);
    const status = await this.getDeviceStatus(deviceId);
    const powerOn = status['Power'] === true;

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

    // Svaki dan ima 6 intervala → fleksibilno
    dayTypes.forEach((dayType, dayIdx) => {
      const start = dayIdx * 6;
      const end = start + 6;
      tuyaProgram[dayType] = intervals.slice(start, end).map((i, idx) => ({
        dayType, // obavezno za TuyaProgramInterval
        orderIndex: idx,
        startMinute: i.startMinute,
        targetTemp: i.temp / 2, // skaliranje ako je temp*2
      }));
    });

    return tuyaProgram;
  }

  private getDayType(day: number): DayType {
    if (day === 0) return 'SUNDAY';
    if (day === 6) return 'SATURDAY';
    return 'WORKDAY';
  }
}
