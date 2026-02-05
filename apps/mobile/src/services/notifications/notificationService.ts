import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { NavigationContainerRef } from '@react-navigation/native';

export type NotificationPermissionStatus =
  | 'granted'
  | 'denied'
  | 'undetermined'
  | 'provisional'
  | 'limited';

export interface PushRegistrationResult {
  token: string | null;
  status: NotificationPermissionStatus;
}

// Store navigation ref for handling deep links
let navigationRef: NavigationContainerRef<any> | null = null;

const getProjectId = () => {
  const expoConfigProjectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  const easProjectId = (Constants as any)?.easConfig?.projectId as string | undefined;

  return expoConfigProjectId || easProjectId;
};

/**
 * Set the navigation ref for handling deep link navigation from notifications
 */
export const setNavigationRef = (ref: React.RefObject<NavigationContainerRef<any>>) => {
  navigationRef = ref.current;
};

export const configureNotificationHandler = () => {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
};

export const registerForPushNotifications = async (): Promise<PushRegistrationResult> => {
  if (!Device.isDevice) {
    return { token: null, status: 'denied' };
  }

  const existing = await Notifications.getPermissionsAsync();
  let finalStatus = existing.status as NotificationPermissionStatus;

  if (existing.status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    finalStatus = requested.status as NotificationPermissionStatus;
  }

  if (finalStatus !== 'granted') {
    return { token: null, status: finalStatus };
  }

  const projectId = getProjectId();
  const tokenResponse = projectId
    ? await Notifications.getExpoPushTokenAsync({ projectId })
    : await Notifications.getExpoPushTokenAsync();

  if (Platform.OS === 'android') {
    // Default channel
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#4CAF50',
    });

    // Daily recommendations channel
    await Notifications.setNotificationChannelAsync('daily', {
      name: 'Daily Recommendations',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2196F3',
    });

    // System alerts channel (high priority)
    await Notifications.setNotificationChannelAsync('alerts', {
      name: 'System Alerts',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 500, 250, 500],
      lightColor: '#FF5252',
      sound: 'default',
    });

    // Heating events channel
    await Notifications.setNotificationChannelAsync('heating', {
      name: 'Heating Events',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF9800',
    });
  }

  return { token: tokenResponse.data, status: finalStatus };
};

/**
 * Handle deep link navigation from notification
 * Supports: myapp://gas/add-reading
 */
const handleDeepLink = (deepLink: string) => {
  if (!navigationRef) {
    console.warn('❌ Navigation ref not available for deep link handling');
    return;
  }

  // Parse deep link
  if (deepLink.includes('gas/add-reading')) {
    // Navigate to Gas tab, then to GasReadings screen
    navigationRef.navigate('Main', {
      screen: 'Gas',
      params: {
        screen: 'GasReadings',
        params: {
          openAddModal: true, // Custom param to trigger modal opening
        },
      },
    });
  } else if (deepLink.includes('gas')) {
    navigationRef.navigate('Main', {
      screen: 'Gas',
    });
  } else if (deepLink.includes('dashboard')) {
    navigationRef.navigate('Main', {
      screen: 'Dashboard',
    });
  } else if (deepLink.includes('heating')) {
    navigationRef.navigate('Main', {
      screen: 'Heating',
    });
  }
};

export const listenForNotifications = (
  navRef?: React.RefObject<NavigationContainerRef<any>>,
  onReceive?: (notification: Notifications.Notification) => void,
  onResponse?: (response: Notifications.NotificationResponse) => void
) => {
  // Update navigation ref if provided
  if (navRef?.current) {
    navigationRef = navRef.current;
  }

  const notificationListener = Notifications.addNotificationReceivedListener((notification) => {
    onReceive?.(notification);
  });

  const responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
    const notification = response.notification;
    const deepLink = notification.request.content.data?.deepLink as string | undefined;
    // Handle deep link if present
    if (deepLink) {
      handleDeepLink(deepLink);
    }

    // Call custom handler if provided
    onResponse?.(response);
  });

  return () => {
    notificationListener.remove();
    responseListener.remove();
  };
};

/**
 * Schedule daily gas reading reminder notification (deprecated - now handled by backend)
 * Kept for backward compatibility with existing code
 */
export const scheduleDailyGasReadingReminder = async (_hour: number = 11, _minute: number = 30) => {
  try {
    console.log('Note: Gas reminders are now sent from backend at 6:30 AM UTC');
    // This function is deprecated in favor of backend scheduling
    // Kept for backward compatibility
  } catch (error) {
    console.error('Failed to schedule daily gas reminder:', error);
  }
};

/**
 * Cancel all scheduled gas reading reminder notifications (deprecated)
 */
export const cancelDailyGasReadingReminder = async () => {
  try {
    console.log('Note: Gas reminders are now managed by backend');
    // This function is deprecated in favor of backend scheduling
    // Kept for backward compatibility
  } catch (error) {
    console.error('Failed to cancel gas reminders:', error);
  }
};
