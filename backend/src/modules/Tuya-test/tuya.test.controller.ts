// src/modules/tuya-test/tuya-test.controller.ts
import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { TuyaTestService } from './tuya.test.service';

@Controller('api/tuya-test')
export class TuyaTestController {
  constructor(private readonly service: TuyaTestService) {}

  /**
   * Vraća kompletnu status mapu sa Tuya Clouda
   * GET /api/tuya-test/status?deviceId=xxxx
   */
  @Get('status')
  async getDeviceStatus(@Query('deviceId') deviceId: string) {
    if (!deviceId) {
      throw new BadRequestException('deviceId is required');
    }

    return {
      deviceId,
      status: await this.service.getRawDeviceStatus(deviceId),
    };
  }

  /**
   * Vraća normalizirani snapshot (temp, target, heatingOn)
   * GET /api/tuya-test/snapshot?deviceId=xxxx
   */
  @Get('snapshot')
  async getSnapshot(@Query('deviceId') deviceId: string) {
    if (!deviceId) {
      throw new BadRequestException('deviceId is required');
    }

    return await this.service.getSnapshot(deviceId);
  }
}
