/**
 * Push notifikacije na TV-u.
 *
 * Android isporučuje ih kao sistemske FCM notifikacije; Expo Push Service je
 * backend gateway. Kanal-ID-jevi ispod moraju odgovarati backendu
 * `ExpoPushService.resolveChannel()` (`daily`, `alerts`, `heating`), inače
 * Android ne može primijeniti željeni kanal na poruku.
 */
import * as Notifications from 'expo-notifications';

/**
 * Isti channel ID-jevi koje backend šalje. Podešavanja su identična mobilnim,
 * osim što je TV sistemski alert podignut na MAX (TV može biti u drugoj sobi).
 * Android kanali se ne mogu mijenjati nakon prvog kreiranja na uređaju.
 */
export const SYSTEM_NOTIFICATION_CHANNELS = [
  {
    id: 'daily',
    name: 'Preporuke',
    importance: Notifications.AndroidImportance.DEFAULT,
  },
  {
    id: 'alerts',
    name: 'Kvar i sistemska upozorenja',
    importance: Notifications.AndroidImportance.MAX,
  },
  {
    id: 'heating',
    name: 'Događaji grijanja',
    importance: Notifications.AndroidImportance.DEFAULT,
  },
] as const;

/**
 * Postavi ponašanje prijema. Zove se jednom na startu aplikacije, prije nego
 * se bilo koja notifikacija može primiti.
 */
export function configureNotificationHandling(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      // Handler prikazuje sistemski banner i kad je aplikacija u prvom planu.
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Kreira sve kanale koje backend može poslati i traži dozvolu.
 *
 * `null`-token ne blokira uparivanje: TV bez FCM-a ili dozvole ostaje
 * upotrebljiv, samo neće dobijati push obavijesti.
 */
export async function prepareNotifications(): Promise<boolean> {
  try {
    for (const channel of SYSTEM_NOTIFICATION_CHANNELS) {
      await Notifications.setNotificationChannelAsync(channel.id, {
        name: channel.name,
        importance: channel.importance,
        sound: 'default',
        enableVibrate: false,
        showBadge: false,
      });
    }

    const existing = await Notifications.getPermissionsAsync();
    const granted = existing.granted
      ? true
      : (await Notifications.requestPermissionsAsync()).granted;
    console.info(`[tv-push] notification permission ${granted ? 'granted' : 'denied'}`);
    return granted;
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown error';
    console.warn(`[tv-push] notification setup failed: ${reason}`);
    return false;
  }
}

/**
 * Expo push token uređaja, ili `null`.
 *
 * EAS project ID identifikuje Expo projekat, nije Firebase credential. FCM
 * app config i FCM v1 service-account credentials moraju biti podešeni
 * zasebno za TV aplikaciju.
 */
export async function getTvPushToken(): Promise<string | null> {
  try {
    const projectId = getProjectId();
    if (!projectId) {
      console.warn('[tv-push] Expo project ID is missing; cannot obtain a push token');
      return null;
    }

    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    console.info(`[tv-push] Expo push token obtained for project ${projectId}`);
    return data;
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown error';
    console.warn(`[tv-push] Expo token request failed: ${reason}`);
    return null;
  }
}

function getProjectId(): string | null {
  // `expo-constants` je jedini izvor koji radi i u razvoju i u produkciji.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Constants = require('expo-constants').default;
  return (
    Constants?.expoConfig?.extra?.eas?.projectId ??
    Constants?.easConfig?.projectId ??
    null
  );
}
