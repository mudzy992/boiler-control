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

  async getCurrentTemperature(deviceId: string): Promise<number> {
    const status = await this.getDeviceStatus(deviceId);
    return status['TempCurrent'] ?? NaN;
  }

  async getTargetTemperature(deviceId: string): Promise<number> {
    const status = await this.getDeviceStatus(deviceId);
    return status['TempSet'] ?? NaN;
  }

  async fetchSnapshot(deviceId: string): Promise<ThermostatSnapshot> {
    const status = await this.getDeviceStatus(deviceId);

    const currentTemp = status['TempCurrent'] ?? 0;
    const targetTemp = status['TempSet'] ?? 0;
    const powerOn = status['Power'] === true;

    return {
      currentTemp,
      targetTemp,
      timestamp: new Date(),
      powerOn
    };
  }
}
