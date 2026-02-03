import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TuyaAdapter } from '../Boiler/adapter/tuya.adapter';
import { TuyaAuthService } from '../Tuya/tuya.auth.service';
import { ThermostatPollingService } from '../ThermostatPoll/thermostat.polling.service';
import { BoilerModule } from '../Boiler/boiler.module';
import { DailyRecommendationService } from './daily.recommendation.service';
import { ProgramSyncService } from '../Boiler/adapter/program.sync.service';
import { NotificationsModule } from '../Notification/notifications.module';
import { TuyaHttpAdapter } from '../Tuya/tuya-http.adapter';
import { HeatingRecommendationService } from '../HeatingRecommendation/heating.recommendation.service';
import { CommonModule } from '../../common/common.module';

const IS_TEST = process.env.NODE_ENV === 'test';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    NotificationsModule,
    BoilerModule,
    CommonModule,
  ],
  providers: IS_TEST
    ? [
        ProgramSyncService,
        TuyaAuthService,
        TuyaHttpAdapter,
        HeatingRecommendationService,
        { provide: 'IThermostatAdapter', useClass: TuyaAdapter },
        DailyRecommendationService,
      ]
    : [
        ProgramSyncService,
        ThermostatPollingService,
        TuyaAuthService,
        TuyaHttpAdapter,
        HeatingRecommendationService,
        { provide: 'IThermostatAdapter', useClass: TuyaAdapter },
        DailyRecommendationService,
      ],
  exports: IS_TEST ? [] : [ThermostatPollingService],
})
export class SchedulerModule {}
