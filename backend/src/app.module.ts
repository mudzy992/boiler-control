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
import { TuyaTestModule } from './modules/Tuya-test/tuya.test.module';
import { NotificationsModule } from './modules/Notification/notifications.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    BoilerModule,
    WeatherModule,
    SchedulerModule,
    DashboardModule,
    HomeProfileModule,
    ThermostatDeviceModule,
    UserModule,
    TuyaTestModule,
    NotificationsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
