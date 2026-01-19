// src/modules/HeatingAnomalyChecker/heating.anomaly.module.ts
import { Module } from '@nestjs/common';
import { NotificationsService } from '../Notification/notifications.service';
import { HeatingRecommendationService } from '../HeatingRecommendation/heating.recommendation.service';
import { HeatingAnomalyController } from './heating.anomaly.checker.controller';
import { HeatingAnomalyCheckerService } from './heating.anomayl.checker.service';
import { ExpoPushModule } from '../ExpoPush/expo.push.notification.module';

@Module({
  imports: [ExpoPushModule],
  providers: [
    HeatingAnomalyCheckerService,
    NotificationsService,
    HeatingRecommendationService,
  ],
  controllers: [HeatingAnomalyController],
  exports: [HeatingAnomalyCheckerService],
})
export class HeatingAnomalyModule {}
