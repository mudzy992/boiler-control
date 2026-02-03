import { Module } from '@nestjs/common';
import { BoilerService } from './boiler.service';
import { WeatherModule } from '../Weather/weather.module';
import { TuyaAdapter } from './adapter/tuya.adapter';
import { PrismaService } from '../../prisma/prisma.service';
import { TuyaAuthService } from '../Tuya/tuya.auth.service';
import { ProgramSyncService } from './adapter/program.sync.service';
import { BoilerController } from './boiler.controller';
import { NotificationsModule } from '../Notification/notifications.module';
import { TuyaHttpAdapter } from '../Tuya/tuya-http.adapter';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [NotificationsModule, WeatherModule, CommonModule],
  providers: [
    ProgramSyncService,
    BoilerService,
    PrismaService,
    TuyaAuthService,
    TuyaHttpAdapter,
    { provide: 'IThermostatAdapter', useClass: TuyaAdapter },
  ],
  controllers: [BoilerController],
  exports: [BoilerService],
})
export class BoilerModule {}
