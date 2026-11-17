/**
 * Push notifikacije na TV-u.
 *
 * **Glavna svrha TV aplikacije.** Korisnik gleda TV, a ne telefon — obavještenje
 * o kvaru kotla mora se pojaviti **na TV-u**, kao sistemska notifikacija, i kad
 * aplikacija nije u prvom planu.
 *
 * **Zašto `setNotificationHandler` prikazuje i dok je app otvorena.** Podrazumijevano
 * ponašanje na Androidu je da FCM prikaže notifikaciju samo kad app **nije** u
 * prvom planu; ako je otvorena, sistem je ne prikaže. TV koji prikazuje
 * analitiku je upravo u prvom planu — pa bi korisnik propustio baš ono zbog
 * čega aplikacija postoji. Zato handler eksplicitno traži prikaz.
 *
 * **Zašto kanal sa `MAX` značajem.** Android 8+ grupiše notifikacije po
 * kanalima i korisnik može utišati kanal. Kanali se ne mogu mijenjati poslije
 * kreiranja — zato je ime kanala verzionisano (`kvar-v1`), da pojačanje
 * značaja u budućnosti ne bude tiho ignorisano.
 */
import * as Notifications from 'expo-notifications';

export const NOTIFICATION_CHANNEL_ID = 'kvar-v1';

/**
 * Postavi ponašanje prijema. Zove se jednom na startu aplikacije, prije nego
 * se bilo koja notifikacija može primiti.
 */
export function configureNotificationHandling(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      // Nova imena (`shouldShowBanner`/`shouldShowList`) su obavezna od
      // expo-notifications 0.29; stara (`shouldShowAlert`) su uklonjena.
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Kreira kanal i traži dozvolu. Vraća `true` ako TV smije prikazivati
 * notifikacije.
 *
 * **Ne baca** kad korisnik odbije: TV bez dozvola i dalje prikazuje analitiku.
 * Aplikacija koja se ne pokrene jer nema dozvolu za notifikacije je gora od
 * aplikacije bez notifikacija.
 */
export async function prepareNotifications(): Promise<boolean> {
  try {
    await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
      name: 'Kvar i upozorenja',
      importance: Notifications.AndroidImportance.MAX,
      // TV nema vibraciju; zvuk je jedini način da se korisnik trgne.
      sound: 'default',
      enableVibrate: false,
      showBadge: false,
    });

    const existing = await Notifications.getPermissionsAsync();
    if (existing.granted) return true;

    const requested = await Notifications.requestPermissionsAsync();
    return requested.granted;
  } catch {
    return false;
  }
}

/**
 * Expo push token uređaja, ili `null`.
 *
 * `null` je **normalan ishod**, ne greška: TV bez Google Play usluga (ili bez
 * mreže u tom trenutku) nema token. Uparivanje tada radi bez push-a — v.
 * `TvPairingScreen`, koja grešku pretvara u `null` i nastavlja.
 *
 * **Projektni ID je obavezan** za Expo push (`getExpoPushTokenAsync` bez njega
 * baca na SDK 49+). Dolazi iz `expo-constants`, tj. iz `app.config.js`, pa se
 * ne može zaboraviti u kodu.
 */
export async function getTvPushToken(): Promise<string | null> {
  try {
    const projectId = getProjectId();
    if (!projectId) return null;

    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data;
  } catch {
    return null;
  }
}

function getProjectId(): string | null {
  // `expo-constants` je jedini izvor koji radi i u razvoju i u produkciji.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Constants = require('expo-constants').default;
  return (
    Constants?.expoConfig?.extra?.eas?.projectId ??
    Constants?.easConfig?.projectId ??
    null
  );
}
