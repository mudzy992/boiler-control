import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { ExpoPushService } from '../ExpoPush/expo.push.notification.service';
import { GasReminderService } from '../Schedule/gas.reminder.service';

@Module({
  controllers: [NotificationsController],
  providers: [ExpoPushService, NotificationsService, GasReminderService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
