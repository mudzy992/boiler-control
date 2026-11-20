import { NotificationsService } from '../notifications.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ExpoPushService } from '../../ExpoPush/expo.push.notification.service';
import { NotificationType } from 'src/generated/prisma';

describe('NotificationsService device registration', () => {
  it('looks up the phone row by kind, not only by shared Android platform', async () => {
    const findUnique = jest.fn().mockResolvedValue(null);
    const findFirst = jest.fn().mockResolvedValue({ id: 3 });
    const update = jest
      .fn()
      .mockResolvedValue({ id: 3, kind: 'PHONE', isActive: true });
    const service = new NotificationsService(
      {
        userDevice: { findUnique, findFirst, update },
      } as unknown as PrismaService,
      {} as ExpoPushService,
    );

    await service.registerToken(
      2,
      'ExponentPushToken[phone-new]',
      'android',
      'PHONE',
    );

    expect(findUnique).toHaveBeenCalledWith({
      where: { expoPushToken: 'ExponentPushToken[phone-new]' },
      select: { id: true },
    });
    expect(findFirst).toHaveBeenCalledWith({
      where: { userId: 2, platform: 'android', kind: 'PHONE' },
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { expoPushToken: 'ExponentPushToken[phone-new]', isActive: true },
    });
  });

  it('reactivates and corrects the row when the exact token is re-registered', async () => {
    const findUnique = jest.fn().mockResolvedValue({ id: 8 });
    const update = jest
      .fn()
      .mockResolvedValue({ id: 8, kind: 'PHONE', isActive: true });
    const findFirst = jest.fn();
    const service = new NotificationsService(
      {
        userDevice: { findUnique, findFirst, update },
      } as unknown as PrismaService,
      {} as ExpoPushService,
    );

    await service.registerToken(2, 'ExponentPushToken[current]', 'android');

    expect(update).toHaveBeenCalledWith({
      where: { id: 8 },
      data: {
        userId: 2,
        expoPushToken: 'ExponentPushToken[current]',
        platform: 'android',
        kind: 'PHONE',
        isActive: true,
      },
    });
    expect(findFirst).not.toHaveBeenCalled();
  });
});

describe('NotificationsService business push recording', () => {
  it('uses the canonical notification type and records Expo ticket acceptance, not default success', async () => {
    const create = jest.fn().mockResolvedValue({ id: 71 });
    const sendPushToTokens = jest
      .fn()
      .mockResolvedValueOnce({
        targeted: 1,
        accepted: 1,
        rejected: 0,
        errors: [],
      })
      .mockResolvedValueOnce({
        targeted: 1,
        accepted: 0,
        rejected: 1,
        errors: ['DeviceNotRegistered'],
      });
    const service = new NotificationsService(
      {
        userDevice: {
          findMany: jest.fn().mockResolvedValue([
            { expoPushToken: 'phone-token', kind: 'PHONE' },
            { expoPushToken: 'tv-token', kind: 'TV' },
          ]),
        },
        notification: { create },
      } as unknown as PrismaService,
      { sendPushToTokens } as unknown as ExpoPushService,
    );
    jest.spyOn(service, 'isNotificationEnabled').mockResolvedValue(true);
    jest.spyOn(service, 'canSendNotification').mockResolvedValue(true);

    await service.notifyUser({
      userId: 2,
      type: NotificationType.HEATING_STARTED,
      title: 'Heating started',
      message: 'Started',
      data: { flowTemp: 55 },
    });

    expect(sendPushToTokens).toHaveBeenCalledTimes(2);
    expect(sendPushToTokens).toHaveBeenNthCalledWith(
      1,
      ['phone-token'],
      'Heating started',
      'Started',
      { flowTemp: 55 },
      expect.any(String),
      NotificationType.HEATING_STARTED,
    );
    expect(sendPushToTokens).toHaveBeenNthCalledWith(
      2,
      ['tv-token'],
      'Heating started',
      'Started',
      { flowTemp: 55 },
      expect.any(String),
      NotificationType.HEATING_STARTED,
    );
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 2,
        type: NotificationType.HEATING_STARTED,
        deliveryOk: true,
      }),
    });
  });

  it('records deliveryOk false when Expo rejects every business ticket', async () => {
    const create = jest.fn().mockResolvedValue({ id: 72 });
    const service = new NotificationsService(
      {
        userDevice: {
          findMany: jest
            .fn()
            .mockResolvedValue([
              { expoPushToken: 'phone-token', kind: 'PHONE' },
            ]),
        },
        notification: { create },
      } as unknown as PrismaService,
      {
        sendPushToTokens: jest.fn().mockResolvedValue({
          targeted: 1,
          accepted: 0,
          rejected: 1,
          errors: ['DeviceNotRegistered'],
        }),
      } as unknown as ExpoPushService,
    );
    jest.spyOn(service, 'isNotificationEnabled').mockResolvedValue(true);
    jest.spyOn(service, 'canSendNotification').mockResolvedValue(true);

    await service.notifyUser({
      userId: 2,
      type: NotificationType.HEATING_ENDED,
      title: 'Heating ended',
      message: 'Ended',
    });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ deliveryOk: false }),
    });
  });
});
