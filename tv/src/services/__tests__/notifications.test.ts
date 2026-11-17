jest.mock('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 3, HIGH: 4, MAX: 5 },
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn().mockResolvedValue(undefined),
  getPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  getExpoPushTokenAsync: jest.fn(),
}));

import * as Notifications from 'expo-notifications';
import {
  configureNotificationHandling,
  prepareNotifications,
  SYSTEM_NOTIFICATION_CHANNELS,
} from '../notifications';

const mocked = Notifications as jest.Mocked<typeof Notifications>;

describe('TV system push notifications', () => {
  beforeEach(() => jest.clearAllMocks());

  it('pre-creates every channel ID used by the backend', async () => {
    await prepareNotifications();

    expect(mocked.setNotificationChannelAsync).toHaveBeenCalledTimes(3);
    expect(
      (mocked.setNotificationChannelAsync as jest.Mock).mock.calls.map(
        ([channelId]) => channelId,
      ),
    ).toEqual(['daily', 'alerts', 'heating']);
    expect(SYSTEM_NOTIFICATION_CHANNELS[1].importance).toBe(
      Notifications.AndroidImportance.MAX,
    );
  });

  it('keeps TV usable when notification permission is denied', async () => {
    (mocked.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      granted: false,
    });
    (mocked.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      granted: false,
    });

    await expect(prepareNotifications()).resolves.toBe(false);
  });

  it('asks Android to show the system banner while the TV app is foregrounded', async () => {
    configureNotificationHandling();
    expect(mocked.setNotificationHandler).toHaveBeenCalledTimes(1);
    const [{ handleNotification }] = (mocked.setNotificationHandler as jest.Mock)
      .mock.calls[0];

    await expect(handleNotification()).resolves.toMatchObject({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    });
  });
});
