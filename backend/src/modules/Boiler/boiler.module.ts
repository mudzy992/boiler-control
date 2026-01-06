import { Module } from '@nestjs/common';
import { BoilerService } from './boiler.service';
import { BoilerController } from './boiler.controller';
import { WeatherModule } from '../Weather/weather.module';
import { TuyaAdapter } from './adapter/tuya.adapter';
import { PrismaService } from '../../prisma/prisma.service';
import { TuyaAuthService } from '../Tuya/tuya.auth.service';

@Module({
  imports: [WeatherModule],
  providers: [
    BoilerService,
    PrismaService,
    TuyaAuthService,
    { provide: 'IThermostatAdapter', useClass: TuyaAdapter },
  ],
  controllers: [BoilerController],
  exports: [BoilerService],
})
export class BoilerModule {}
