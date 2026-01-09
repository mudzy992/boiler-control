import { Module } from '@nestjs/common';
import { BoilerService } from './boiler.service';
import { WeatherModule } from '../Weather/weather.module';
import { TuyaAdapter } from './adapter/tuya.adapter';
import { PrismaService } from '../../prisma/prisma.service';
import { TuyaAuthService } from '../Tuya/tuya.auth.service';
import { ProgramSyncService } from './adapter/program.sync.service';

@Module({
  imports: [WeatherModule],
  providers: [
    ProgramSyncService,
    BoilerService,
    PrismaService,
    TuyaAuthService,
    { provide: 'IThermostatAdapter', useClass: TuyaAdapter },
  ],
  controllers: [],
  exports: [BoilerService],
})
export class BoilerModule {}
