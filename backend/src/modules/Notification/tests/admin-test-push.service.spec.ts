import { NotificationsService } from '../notifications.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ExpoPushService } from '../../ExpoPush/expo.push.notification.service';

describe('admin test push delivery', () => {
  it('sends only active tokens of the selected kind for the requesting admin', async () => {
    const findMany = jest.fn().mockResolvedValue([
      { expoPushToken: 'ExponentPushToken[tv-1]' },
      { expoPushToken: 'ExponentPushToken[tv-2]' },
    ]);
    const sendPushToTokens = jest.fn().mockResolvedValue(undefined);
    const service = new NotificationsService(
      { userDevice: { findMany } } as unknown as PrismaService,
      { sendPushToTokens } as unknown as ExpoPushService,
    );

    const result = await service.sendTestPushToOwnDevices({
      userId: 41,
      kind: 'TV',
      title: 'Test',
      message: 'Ping',
    });

    expect(findMany).toHaveBeenCalledWith({
      where: { userId: 41, isActive: true, kind: 'TV' },
      select: { expoPushToken: true },
    });
    expect(sendPushToTokens).toHaveBeenCalledWith(
      ['ExponentPushToken[tv-1]', 'ExponentPushToken[tv-2]'],
      'Test',
      'Ping',
      { test: true, target: 'TV' },
    );
    expect(result).toMatchObject({ success: true, sent: 2 });
  });

  it('does not attempt delivery when no active selected-kind device exists', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const sendPushToTokens = jest.fn();
    const service = new NotificationsService(
      { userDevice: { findMany } } as unknown as PrismaService,
      { sendPushToTokens } as unknown as ExpoPushService,
    );

    const result = await service.sendTestPushToOwnDevices({
      userId: 41,
      kind: 'PHONE',
      title: 'Test',
      message: 'Ping',
    });

    expect(sendPushToTokens).not.toHaveBeenCalled();
    expect(result).toMatchObject({ success: false, sent: 0 });
  });
});
