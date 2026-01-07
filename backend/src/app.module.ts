import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/Auth/auth.module';
import { BoilerModule } from './modules/Boiler/boiler.module';
import { WeatherModule } from './modules/Weather/weather.module';
import { SchedulerModule } from './modules/Schedule/schedule.module';
import { DashboardModule } from './modules/Dashboard/dashboard.module';
import { HomeProfileModule } from './modules/HomeProfile/home.profile.module';
import { ReadonlyModule } from './modules/Readonly/readonly.module';
import { ThermostatDeviceModule } from './modules/ThermostatDevice/thermostat.device.module';
import { UserModule } from './modules/User/user.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    BoilerModule,
    WeatherModule,
    SchedulerModule,
    DashboardModule,
    HomeProfileModule,
    ReadonlyModule,
    ThermostatDeviceModule,
    UserModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
