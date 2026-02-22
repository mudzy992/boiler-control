import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Patch,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../Auth/jwt-auth.guard';
import { User } from '../Auth/user.decorator';
import { RegisterDeviceDTO } from './dto/register-device.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { GasReminderService } from '../Schedule/gas.reminder.service';
import { NotificationType } from 'src/generated/prisma';

interface ManualNotificationDTO {
  userId: number;
  type: NotificationType;
  title: string;
  message: string;
  data?: any;
}

@UseGuards(JwtAuthGuard)
@Controller('api/notifications')
export class NotificationsController {
  constructor(
    private notificationsService: NotificationsService,
    private prisma: PrismaService,
    private gasReminderService: GasReminderService,
  ) {}

  // Registracija tokena
  @Post('register-token')
  async registerToken(@User() userId: number, @Body() body: RegisterDeviceDTO) {
    return this.notificationsService.registerToken(
      userId,
      body.expoPushToken,
      body.platform,
    );
  }

  @Post('manual')
  async sendManualNotification(
    @User() userId: number,
    @Body() body: ManualNotificationDTO,
  ) {
    await this.notificationsService.notifyUser({
      userId: userId,
      type: body.type,
      title: body.title,
      message: body.message,
      data: body.data,
    });
    return { success: true, message: 'Notification sent manually' };
  }

  // Dohvati sve notifikacije korisnika
  @Get()
  async getNotifications(@User() userId: number) {
    return this.notificationsService.getUserNotifications(userId);
  }

  // Označi notifikaciju kao pročitanu
  @Post(':id/read')
  async markAsRead(@Param('id') id: number) {
    return this.notificationsService.markAsRead(id);
  }

  // Označi sve notifikacije kao pročitane
  @Post('mark-all-read')
  async markAllRead(@User() userId: number) {
    return this.notificationsService.markAllAsRead(userId);
  }

  @Get('types')
  getNotificationTypes() {
    // Return all available notification types
    return [
      { value: 'DAILY_RECOMMENDATION', label: 'Daily Recommendations' },
      { value: 'FLOW_TEMP_CHANGED', label: 'Flow Temperature Changes' },
      { value: 'HEATING_STARTED', label: 'Heating Started' },
      { value: 'HEATING_ENDED', label: 'Heating Ended' },
      { value: 'SYSTEM_ALERT', label: 'System Alerts' },
      { value: 'GAS_READING_REMINDER', label: 'Gas Reading Reminders' },
    ];
  }

  @Get('preferences')
  async getPreferences(@User() userId: number) {
    // Get existing preferences
    const preferences = await this.prisma.notificationPreference.findMany({
      where: { userId: userId },
    });

    // If no preferences exist, create defaults for all types
    if (preferences.length === 0) {
      const notificationTypes = [
        'DAILY_RECOMMENDATION',
        'FLOW_TEMP_CHANGED',
        'HEATING_STARTED',
        'HEATING_ENDED',
        'SYSTEM_ALERT',
        'GAS_READING_REMINDER',
      ] as NotificationType[];

      const defaultPreferences = await Promise.all(
        notificationTypes.map((type) =>
          this.prisma.notificationPreference.create({
            data: {
              userId: userId,
              type: type,
              enabled: true, // All enabled by default
            },
          }),
        ),
      );

      return defaultPreferences;
    }

    return preferences;
  }

  @Patch('preferences')
  updatePreference(
    @User() userId: number,
    @Body() body: { type: NotificationType; enabled: boolean },
  ) {
    return this.prisma.notificationPreference.upsert({
      where: {
        userId_type: {
          userId: userId,
          type: body.type,
        },
      },
      update: { enabled: body.enabled },
      create: {
        userId: userId,
        type: body.type,
        enabled: body.enabled,
      },
    });
  }

  /**
   * 🧪 TEST ENDPOINT: Send a test gas reminder to the current user
   * Useful for QA to verify push notifications work
   *
   * Example: POST /api/notifications/test-gas-reminder
   */
  @Post('test-gas-reminder')
  async testGasReminder(@User() userId: number) {
    return this.gasReminderService.sendTestReminder(userId);
  }

  /**
   * 🧪 TEST ENDPOINT: Trigger all daily gas reminders immediately (admin only)
   * This will send the reminder to all users who have it enabled
   *
   * Example: POST /api/notifications/test-trigger-all-gas-reminders
   */
  @Post('test-trigger-all-gas-reminders')
  async testTriggerAllReminders() {
    return this.gasReminderService.triggerDailyReminders();
  }
}
