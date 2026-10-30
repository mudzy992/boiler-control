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
import { HeatingModule } from './modules/Heating/heating.module';
import { HeatingRecommendationModule } from './modules/HeatingRecommendation/heating.recommendation.module';
import { ThrottlerModule, ThrottlerGuard, seconds } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { GasReadingModule } from './modules/Gas/gas.reading.module';
import { CommonModule } from './common/common.module';

@Module({
  imports: [
    ...(process.env.NODE_ENV === 'test'
      ? []
      : [
          ThrottlerModule.forRoot({
            // SEC-3 / R-004: `ttl` je u MILISEKUNDAMA od @nestjs/throttler v5.
            // Prijašnja golobrojna vrijednost od 60 značila je 60 ms, pa je 100
            // zahtjeva bilo dopušteno unutar 60 milisekundi — praktično bez
            // ograničenja. `seconds(60)` daje 60000 ms.
            throttlers: [
              {
                ttl: seconds(60),
                limit: 100,
              },
            ],
          }),
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
    HeatingModule,
    HeatingRecommendationModule,
    GasReadingModule,
    CommonModule,
  ],
  controllers: [],
  providers: [
    ...(process.env.NODE_ENV === 'test'
      ? []
      : [
          {
            provide: APP_GUARD,
            useClass: ThrottlerGuard,
          },
        ]),
  ],
})
export class AppModule {}
