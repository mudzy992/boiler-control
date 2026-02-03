import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { BoilerService } from '../Boiler/boiler.service';
import { WeatherModule } from '../Weather/weather.module';
import { TuyaAdapter } from '../Boiler/adapter/tuya.adapter';
import { TuyaAuthService } from '../Tuya/tuya.auth.service';
import { ProgramSyncService } from '../Boiler/adapter/program.sync.service';
import { NotificationsModule } from '../Notification/notifications.module';
import { TuyaHttpAdapter } from '../Tuya/tuya-http.adapter';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [WeatherModule, NotificationsModule, CommonModule],
  controllers: [DashboardController],
  providers: [
    ProgramSyncService,
    DashboardService,
    PrismaService,
    BoilerService,
    TuyaAuthService,
    TuyaHttpAdapter,
    { provide: 'IThermostatAdapter', useClass: TuyaAdapter },
  ],
})
export class DashboardModule {}
