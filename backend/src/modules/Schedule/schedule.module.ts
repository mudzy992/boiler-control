import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TuyaAdapter } from '../Boiler/adapter/tuya.adapter';
import { TuyaAuthService } from '../Tuya/tuya.auth.service';
import { ThermostatPollingService } from '../ThermostatPoll/thermostat.polling.service';
import { BoilerModule } from '../Boiler/boiler.module';
import { DailyRecommendationService } from './daily.recommendation.service';
import { ProgramSyncService } from '../Boiler/adapter/program.sync.service';
import { NotificationsModule } from '../Notification/notifications.module';
import { HeatingRecommendationService } from '../HeatingRecommendation/heating.recommendation.service';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    NotificationsModule,
    BoilerModule,
    CommonModule,
  ],
  providers: [
    ProgramSyncService,
    ThermostatPollingService,
    TuyaAuthService,
    HeatingRecommendationService,
    { provide: 'IThermostatAdapter', useClass: TuyaAdapter },
    DailyRecommendationService,
  ],
  exports: [ThermostatPollingService],
})
export class SchedulerModule {}
