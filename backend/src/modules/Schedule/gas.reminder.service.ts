import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../Notification/notifications.service';
import { NotificationType } from '../../generated/prisma/enums';

@Injectable()
export class GasReminderService {
  private readonly logger = new Logger(GasReminderService.name);

  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationsService,
  ) {}

  /**
   * Daily gas reading reminder at configured time (default: 6:30 AM UTC)
   * Cron expression: 30 6 * * * = every day at 06:30 UTC
   * Can be overridden via GAS_REMINDER_CRON env variable
   */
  @Cron(process.env.GAS_REMINDER_CRON || '30 6 * * *', {
    name: 'gas-reading-reminder',
    disabled:
      process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test',
  })
  async sendGasReminders() {
    this.logger.log('🔥 Starting daily gas reading reminders...');

    try {
      // Get all users with gas reading notification preferences enabled
      const users = await this.prisma.user.findMany({
        where: {
          notificationPreferences: {
            some: {
              type: NotificationType.GAS_READING_REMINDER,
              enabled: true,
            },
          },
        },
        include: {
          notificationPreferences: {
            where: {
              type: NotificationType.GAS_READING_REMINDER,
            },
          },
        },
      });

      this.logger.log(`Found ${users.length} users with gas reminder enabled`);

      let successCount = 0;
      let failureCount = 0;

      for (const user of users) {
        try {
          await this.notificationService.notifyUser({
            userId: user.id,
            type: NotificationType.GAS_READING_REMINDER,
            title: 'Gas Reading Reminder',
            message: 'Tap to add your gas meter reading',
            data: {
              type: NotificationType.GAS_READING_REMINDER,
              screen: 'Gas',
              deepLink: 'myapp://gas/add-reading',
              timestamp: new Date().toISOString(),
            },
          });

          successCount++;
          this.logger.debug(`✅ Sent reminder to user ${user.id}`);
        } catch (error) {
          failureCount++;
          this.logger.error(
            `❌ Failed to send reminder to user ${user.id}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      this.logger.log(
        `✅ Gas reminders completed: ${successCount} sent, ${failureCount} failed`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Critical error in gas reminder job: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Test endpoint - send gas reminder to specific user
   */
  async sendTestReminder(
    userId: number,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return {
          success: false,
          message: `User ${userId} not found`,
        };
      }

      // Send regardless of preferences for testing
      await this.notificationService.notifyUser({
        userId: user.id,
        type: NotificationType.GAS_READING_REMINDER,
        title: 'Gas Reading Reminder (Test)',
        message: 'Tap to add your gas meter reading',
        data: {
          type: NotificationType.GAS_READING_REMINDER,
          screen: 'Gas',
          deepLink: 'myapp://gas/add-reading',
          timestamp: new Date().toISOString(),
          test: true,
        },
      });

      this.logger.log(`✅ Test reminder sent to user ${userId}`);

      return {
        success: true,
        message: `Test reminder sent to user ${userId}`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `❌ Test reminder failed for user ${userId}: ${message}`,
      );

      return {
        success: false,
        message: `Failed to send test reminder: ${message}`,
      };
    }
  }

  /**
   * Manually trigger the daily gas reminder job for all users (admin only)
   */
  async triggerDailyReminders(): Promise<{
    success: boolean;
    summary: string;
  }> {
    try {
      this.logger.log(
        '🔥 Manual trigger: Starting daily gas reading reminders...',
      );

      const users = await this.prisma.user.findMany({
        where: {
          notificationPreferences: {
            some: {
              type: NotificationType.GAS_READING_REMINDER,
              enabled: true,
            },
          },
        },
      });

      let successCount = 0;
      let failureCount = 0;

      for (const user of users) {
        try {
          await this.notificationService.notifyUser({
            userId: user.id,
            type: NotificationType.GAS_READING_REMINDER,
            title: 'Gas Reading Reminder',
            message: 'Tap to add your gas meter reading',
            data: {
              type: NotificationType.GAS_READING_REMINDER,
              screen: 'Gas',
              deepLink: 'myapp://gas/add-reading',
              timestamp: new Date().toISOString(),
            },
          });

          successCount++;
        } catch (error) {
          failureCount++;
          this.logger.error(
            `Failed to send to user ${user.id}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      const summary = `Sent to ${successCount} users, ${failureCount} failed`;
      this.logger.log(`✅ Manual trigger completed: ${summary}`);

      return {
        success: true,
        summary,
      };
    } catch (error) {
      this.logger.error(
        `Manual trigger failed: ${error instanceof Error ? error.message : String(error)}`,
      );

      return {
        success: false,
        summary: `Error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}
