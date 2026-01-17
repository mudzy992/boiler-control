import { Controller, Get, Post, Body, Param, UseGuards, Patch } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../Auth/jwt-auth.guard';
import { User } from '../Auth/user.decorator';
import { RegisterDeviceDTO } from './dto/register-device.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { NotificationType } from 'src/generated/prisma/enums';

@UseGuards(JwtAuthGuard)
@Controller('api/notifications')
export class NotificationsController {
  constructor(
    private notificationsService: NotificationsService,
    private prisma: PrismaService,
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

  // Dohvati sve notifikacije korisnika
  @Get()
  async getNotifications(@Param('userId') userId: number) {
    return this.notificationsService.getUserNotifications(userId);
  }

  // Označi notifikaciju kao pročitanu
  @Post(':id/read')
  async markAsRead(@Param('id') id: number) {
    return this.notificationsService.markAsRead(id);
  }

  @Get('preferences')
  getPreferences(@User() userId: number) {
    return this.prisma.notificationPreference.findMany({
      where: { userId: userId },
    });
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
}
