import { Injectable } from '@nestjs/common';
import axios from 'axios';
import crypto from 'crypto';
import { TuyaAuthService } from '../../../modules/Tuya/tuya.auth.service';
import { ThermostatSnapshot } from './thermostat-adapter.interface';

@Injectable()
export class TuyaAdapter {
  private readonly baseUrl = process.env.TUYA_BASE_URL!;

  constructor(private readonly tokenService: TuyaAuthService) {}

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

  /**
   * Dohvati kompletnu mapu statusa uređaja sa Tuya platforme
   */
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

  async getTargetTemperature(deviceId: string): Promise<number> {
    const status = await this.getDeviceStatus(deviceId);
    const targetTemp =
      status['Mode'] === '0' && status['program']
        ? getCurrentProgramTemp(status['program'])
        : (status['TempSet'] ?? 0);
    return targetTemp;
  }

  async getCurrentTemperature(deviceId: string): Promise<number> {
    const status = await this.getDeviceStatus(deviceId);
    return status['TempCurrent'] ?? 0;
  }

  async fetchSnapshot(deviceId: string): Promise<ThermostatSnapshot> {
    const status = await this.getDeviceStatus(deviceId);

    const currentTemp = await this.getCurrentTemperature(deviceId);
    const targetTemp = await this.getTargetTemperature(deviceId);
    const powerOn = status['Power'] === true;

    return {
      currentTemp,
      targetTemp,
      timestamp: new Date(),
      powerOn,
    };
  }
}

/**
 * Dekodira Tuya program
 * Format: [minute, hour, temp*2] x 6 intervala po danu
 */
function parseProgram(programB64: string) {
  const buf = Buffer.from(programB64, 'base64');
  const intervals: Array<{ startMinute: number; temp: number }> = [];

  for (let i = 0; i + 2 < buf.length; i += 3) {
    const minute = buf[i];
    const hour = buf[i + 1];
    const temp = buf[i + 2];
    const startMinute = hour * 60 + minute;
    intervals.push({ startMinute, temp });
  }

  return intervals;
}

/**
 * Dobija aktivnu temperaturu iz programa po trenutnom vremenu i danu
 */
function getCurrentProgramTemp(programB64: string): number {
  const intervals = parseProgram(programB64);

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // Dan u sedmici: 0 = Sunday, 1 = Monday ... 6 = Saturday
  const dayOfWeek = now.getDay();

  // Svaki dan ima 6 intervala
  const startIndex = dayOfWeek === 0 ? 12 : dayOfWeek === 6 ? 6 : 0;
  const dayIntervals = intervals.slice(startIndex, startIndex + 6);

  // Default na prvu temp
  let activeTemp = dayIntervals[0].temp;

  for (const interval of dayIntervals) {
    if (currentMinutes >= interval.startMinute) {
      activeTemp = interval.temp;
    } else {
      break;
    }
  }

  return activeTemp;
}
