// src/modules/tuya-test/tuya-test.service.ts
import { Injectable } from '@nestjs/common';
import { TuyaAdapter } from '../Boiler/adapter/tuya.adapter';

@Injectable()
export class TuyaTestService {
  constructor(private readonly tuyaAdapter: TuyaAdapter) {}

  async getRawDeviceStatus(deviceId: string) {
    return this.tuyaAdapter.getDeviceStatus(deviceId);
  }

  async getSnapshot(deviceId: string) {
    return this.tuyaAdapter.fetchSnapshot(deviceId);
  }
}
