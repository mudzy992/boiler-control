// src/modules/tuya-test/tuya-test.module.ts
import { Module } from '@nestjs/common';
import { TuyaAuthService } from '../Tuya/tuya.auth.service';
import { TuyaAdapter } from '../Boiler/adapter/tuya.adapter';
import { TuyaTestController } from './tuya.test.controller';
import { TuyaTestService } from './tuya.test.service';
import { ProgramSyncService } from '../Boiler/adapter/program.sync.service';

@Module({
  imports: [],
  controllers: [TuyaTestController],
  providers: [
    TuyaTestService,
    TuyaAuthService,
    TuyaAdapter,
    ProgramSyncService,
  ],
})
export class TuyaTestModule {}
