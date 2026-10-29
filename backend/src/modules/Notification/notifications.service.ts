import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ExpoPushService } from '../ExpoPush/expo.push.notification.service';
import { NOTIFICATION_DEBOUNCE } from './util/debounce';
import { NotificationType } from 'src/generated/prisma';

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private expoPushService: ExpoPushService,
  ) {}

  async registerToken(userId: number, expoPushToken: string, platform: string) {
    const existing = await this.prisma.userDevice.findFirst({
      where: { userId, platform },
    });

    if (existing) {
      return this.prisma.userDevice.update({
        where: { id: existing.id },
        data: { expoPushToken },
      });
    }

    return this.prisma.userDevice.create({
      data: { userId, expoPushToken, platform },
    });
  }

  async getUserTokens(userId: number): Promise<string[]> {
    const devices = await this.prisma.userDevice.findMany({
      where: {
        userId,
        expoPushToken: { not: undefined },
      },
      select: {
        expoPushToken: true,
      },
    });

    return devices.map((d) => d.expoPushToken);
  }

  // 🔑 DEBOUNCE CHECK
  async canSendNotification(
    userId: number,
    type: NotificationType,
  ): Promise<boolean> {
    const debounceMs = NOTIFICATION_DEBOUNCE[type];
    if (!debounceMs) return true;

    const last = await this.prisma.notification.findFirst({
      where: { userId, type },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    if (!last) return true;

    return Date.now() - last.createdAt.getTime() > debounceMs;
  }

  // ✅ JEDINA TAČKA ZA SLANJE
  async notifyUser(params: {
    userId: number;
    type: NotificationType;
    title: string;
    message: string;
    data?: any;
  }) {
    const { userId, type, title, message, data } = params;

    const enabled = await this.isNotificationEnabled(userId, type);
    if (!enabled) return;

    const canSend = await this.canSendNotification(userId, type);
    if (!canSend) return;

    const tokens = await this.getUserTokens(userId);
    if (tokens.length === 0) return;

    await this.expoPushService.sendPushToTokens(tokens, title, message, data);

    await this.prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        data: data ?? {},
      },
    });
  }

  async getUserNotifications(userId: number) {
    return await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markAsRead(notificationId: number, userId: number) {
    // SEC-1: uslov mora biti atomski `id + userId`. Prijašnja verzija je tražila
    // samo po `id`, pa je bilo koji prijavljeni korisnik mogao označiti tuđu
    // notifikaciju pogađanjem ID-a (IDOR).
    //
    // `updateMany` s oba uslova je jedan atomski upis i NE otkriva postojanje
    // tuđeg zapisa: `count === 0` je isti ishod i za "ne postoji" i za "nije
    // tvoje", pa napadač ne može enumerirati tuđe notifikacije.
    const result = await this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });

    // Neotkrivajući odgovor: identičan za tuđi i nepostojeći ID.
    // Baca 404 (a ne 403) namjerno — 403 bi potvrdio da zapis postoji.
    if (result.count === 0) {
      throw new NotFoundException('Notification not found');
    }

    return await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });
  }

  async markAllAsRead(userId: number) {
    return await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  async isNotificationEnabled(
    userId: number,
    type: NotificationType,
  ): Promise<boolean> {
    const pref = await this.prisma.notificationPreference.findUnique({
      where: {
        userId_type: {
          userId,
          type,
        },
      },
      select: { enabled: true },
    });

    // default: enabled
    return pref?.enabled ?? true;
  }
}
