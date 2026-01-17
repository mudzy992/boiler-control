import { Module } from '@nestjs/common';
import { NotificationsModule } from '../Notification/notifications.module';
import { ExpoPushService } from './expo.push.notification.service';

@Module({
  imports: [NotificationsModule],
  providers: [ExpoPushService],
  exports: [ExpoPushService],
})
export class ExpoPushModule {}
