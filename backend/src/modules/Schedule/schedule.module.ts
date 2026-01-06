import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TuyaAdapter } from '../Boiler/adapter/tuya.adapter';
import { TuyaAuthService } from '../Tuya/tuya.auth.service';
import { ThermostatPollingService } from '../ThermostatPoll/thermostat.polling.service';
import { BoilerModule } from '../Boiler/boiler.module';
import { DailyRecommendationService } from './daily.recommendation.service';

@Module({
  imports: [ScheduleModule.forRoot(), BoilerModule],
  providers: [
    ThermostatPollingService,
    TuyaAuthService,
    { provide: 'IThermostatAdapter', useClass: TuyaAdapter },
    DailyRecommendationService,
  ],
  exports: [ThermostatPollingService],
})
export class SchedulerModule {}
