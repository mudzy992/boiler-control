import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { ExpoPushService } from '../ExpoPush/expo.push.notification.service';

@Module({
  controllers: [NotificationsController],
  providers: [ExpoPushService, NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
