import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/Auth/auth.module';
import { BoilerModule } from './modules/Boiler/boiler.module';
import { WeatherModule } from './modules/Weather/weather.module';
import { SchedulerModule } from './modules/Schedule/schedule.module';
import { DashboardModule } from './modules/Dashboard/dashboard.module';
import { HomeProfileModule } from './modules/HomeProfile/home.profile.module';
import { ThermostatDeviceModule } from './modules/ThermostatDevice/thermostat.device.module';
import { UserModule } from './modules/User/user.module';
import { NotificationsModule } from './modules/Notification/notifications.module';
import { HeatingAnomalyModule } from './modules/HeatingAnomalyCheckerService/heating.anomaly.checker.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { GasReadingModule } from './modules/Gas/gas.reading.module';
import { CommonModule } from './common/common.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    PrismaModule,
    AuthModule,
    BoilerModule,
    WeatherModule,
    SchedulerModule,
    DashboardModule,
    HomeProfileModule,
    ThermostatDeviceModule,
    UserModule,
    NotificationsModule,
    HeatingAnomalyModule,
    GasReadingModule,
    CommonModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
