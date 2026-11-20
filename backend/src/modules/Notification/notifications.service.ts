import { randomBytes } from 'node:crypto';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ExpoPushService } from '../ExpoPush/expo.push.notification.service';
import { NOTIFICATION_DEBOUNCE } from './util/debounce';
import { NotificationType } from 'src/generated/prisma';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private expoPushService: ExpoPushService,
  ) {}

  async registerToken(
    userId: number,
    expoPushToken: string,
    platform: string,
    kind: 'PHONE' | 'TV' = 'PHONE',
  ) {
    // The Expo token is globally unique. Re-registering that exact token must
    // reactivate it and correct its owner/kind (for example after account
    // changes), rather than accidentally updating the other Android device.
    const tokenRow = await this.prisma.userDevice.findUnique({
      where: { expoPushToken },
      select: { id: true },
    });

    if (tokenRow) {
      return this.prisma.userDevice.update({
        where: { id: tokenRow.id },
        data: { userId, expoPushToken, platform, kind, isActive: true },
      });
    }

    // Android PHONE and Android TV share the platform value. Include `kind`
    // so registering the phone cannot select and overwrite the TV row.
    const existingDevice = await this.prisma.userDevice.findFirst({
      where: { userId, platform, kind },
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    });

    if (existingDevice) {
      return this.prisma.userDevice.update({
        where: { id: existingDevice.id },
        data: { expoPushToken, isActive: true },
      });
    }

    return this.prisma.userDevice.create({
      data: { userId, expoPushToken, platform, kind, isActive: true },
    });
  }

  /**
   * Tokeni na koje treba poslati push.
   *
   * **Dvije popravke (F16, 17.11.), obje izmjerene:**
   *
   * 1. `expoPushToken: { not: undefined }` **ne filtrira ništa** — Prisma
   *    `undefined` u filteru znači „ne filtriraj po ovom polju", pa su se
   *    vraćali i opozvani uređaji. Sada se traži `isActive: true`; opozvan
   *    token (odjava, reinstalacija) ne smije dobijati push.
   * 2. `kind` razdvaja telefon od TV-a. Bez toga bi notifikacija za TV otišla
   *    i na telefon i obrnuto, a korisnik ne bi mogao razlikovati odakle je.
   *
   * `kind` je opcion: bez njega se šalje na **sve** aktivne uređaje (postojeće
   * ponašanje), pa pozivaoci koji ne znaju za TV nastavljaju da rade isto.
   */
  async getUserTokens(
    userId: number,
    kind?: 'PHONE' | 'TV',
  ): Promise<string[]> {
    const devices = await this.prisma.userDevice.findMany({
      where: {
        userId,
        isActive: true,
        ...(kind ? { kind } : {}),
      },
      select: {
        expoPushToken: true,
      },
    });

    return devices.map((d) => d.expoPushToken);
  }

  /** Test-only delivery path: target only the current admin's chosen device class. */
  async sendTestPushToOwnDevices(params: {
    userId: number;
    kind: 'PHONE' | 'TV';
    title: string;
    message: string;
  }) {
    const diagnosticId = randomBytes(6).toString('hex');
    this.logger.log(
      `[push-test:${diagnosticId}] requested user=${params.userId} kind=${params.kind}`,
    );

    const tokens = await this.getUserTokens(params.userId, params.kind);
    if (tokens.length === 0) {
      this.logger.warn(
        `[push-test:${diagnosticId}] no active device tokens user=${params.userId} kind=${params.kind}`,
      );
      return {
        success: false,
        sent: 0,
        targeted: 0,
        rejected: 0,
        errors: [],
        diagnosticId,
        message: `No active ${params.kind} push devices are registered to this account.`,
      };
    }

    this.logger.log(
      `[push-test:${diagnosticId}] found ${tokens.length} active ${params.kind} token(s); submitting to Expo`,
    );
    const delivery = await this.expoPushService.sendPushToTokens(
      tokens,
      params.title,
      params.message,
      { test: true, target: params.kind },
      diagnosticId,
    );
    const success = delivery.accepted > 0;

    this.logger.log(
      `[push-test:${diagnosticId}] completed targeted=${delivery.targeted} accepted=${delivery.accepted} rejected=${delivery.rejected} errors=${delivery.errors.join(',') || 'none'}`,
    );

    return {
      success,
      // `sent` means Expo ticket acceptance, not confirmed device delivery.
      sent: delivery.accepted,
      targeted: delivery.targeted,
      rejected: delivery.rejected,
      errors: delivery.errors,
      diagnosticId,
      message: `Expo accepted ${delivery.accepted} of ${delivery.targeted} ${params.kind} push ticket(s). Rejected: ${delivery.rejected}${delivery.errors.length ? ` (${delivery.errors.join(', ')})` : ''}. Device delivery is not confirmed yet.`,
    };
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

    const devices = await this.prisma.userDevice.findMany({
      where: { userId, isActive: true },
      select: { expoPushToken: true, kind: true },
    });
    if (devices.length === 0) return;

    // PHONE and TV apps use different Expo projects. Expo rejects a single
    // push request containing tokens from more than one project, so submit
    // one request per registered device kind instead of mixing their tokens.
    const groupedTokens: Record<'PHONE' | 'TV', string[]> = {
      PHONE: [],
      TV: [],
    };
    for (const device of devices)
      groupedTokens[device.kind].push(device.expoPushToken);

    let accepted = 0;
    let targeted = 0;
    let rejected = 0;
    const errors = new Set<string>();

    for (const kind of ['PHONE', 'TV'] as const) {
      const tokens = groupedTokens[kind];
      if (tokens.length === 0) continue;

      const diagnosticId = randomBytes(6).toString('hex');
      const delivery = await this.expoPushService.sendPushToTokens(
        tokens,
        title,
        message,
        data,
        diagnosticId,
        type,
      );
      accepted += delivery.accepted;
      targeted += delivery.targeted;
      rejected += delivery.rejected;
      delivery.errors.forEach((error) => errors.add(error));

      this.logger.log(
        `[push:${diagnosticId}] business notification user=${userId} type=${type} kind=${kind} targeted=${delivery.targeted} accepted=${delivery.accepted} rejected=${delivery.rejected} errors=${delivery.errors.join(',') || 'none'}`,
      );
    }

    this.logger.log(
      `Business push aggregate user=${userId} type=${type} targeted=${targeted} accepted=${accepted} rejected=${rejected} errors=${[...errors].join(',') || 'none'}`,
    );

    await this.prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        data: data ?? {},
        // Expo ticket acceptance is not proof of device display, but do not
        // leave this field at its default true when every ticket was rejected.
        deliveryOk: accepted > 0,
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
