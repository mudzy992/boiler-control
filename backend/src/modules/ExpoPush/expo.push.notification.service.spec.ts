import { ExpoPushService } from './expo.push.notification.service';

describe('ExpoPushService', () => {
  it('reports Expo ticket acceptance and rejection instead of claiming device delivery', async () => {
    const service = new ExpoPushService();
    const client = (service as any).expo;
    const messages: any[] = [];
    jest.spyOn(client, 'chunkPushNotifications').mockImplementation((items: any[]) => {
      messages.push(...items);
      return items.length ? [items] : [];
    });
    jest.spyOn(client, 'sendPushNotificationsAsync').mockResolvedValue([
      { status: 'ok', id: 'receipt-1' },
      { status: 'error', message: 'Invalid token', details: { error: 'DeviceNotRegistered' } },
    ]);

    const result = await service.sendPushToTokens(
      ['ExponentPushToken[device-1]', 'ExponentPushToken[device-2]'],
      'Test',
      'Ping',
      { test: true },
    );

    expect(messages).toHaveLength(2);
    expect(result).toEqual({
      targeted: 2,
      accepted: 1,
      rejected: 1,
      errors: ['DeviceNotRegistered'],
    });
  });

  it('counts malformed tokens as rejected and does not send them to Expo', async () => {
    const service = new ExpoPushService();
    const client = (service as any).expo;
    const chunk = jest.spyOn(client, 'chunkPushNotifications').mockReturnValue([]);
    const send = jest.spyOn(client, 'sendPushNotificationsAsync');

    const result = await service.sendPushToTokens(['not-an-expo-token'], 'Test', 'Ping');

    expect(chunk).toHaveBeenCalledWith([]);
    expect(send).not.toHaveBeenCalled();
    expect(result).toEqual({
      targeted: 1,
      accepted: 0,
      rejected: 1,
      errors: ['InvalidExpoPushToken'],
    });
  });
});
