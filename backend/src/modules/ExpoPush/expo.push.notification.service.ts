import { Injectable } from '@nestjs/common';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { NotificationType } from 'src/generated/prisma/enums';

@Injectable()
export class ExpoPushService {
  private expo: Expo;

  constructor() {
    this.expo = new Expo();
  }

  async sendPushToTokens(
    tokens: string[],
    title: string,
    message: string,
    data?: any,
  ) {
    const messages: ExpoPushMessage[] = [];

    for (const pushToken of tokens) {
      if (!Expo.isExpoPushToken(pushToken)) continue;

      messages.push({
        to: pushToken,
        sound: 'default',
        title,
        body: message,
        data,
        priority: 'high',
        channelId: resolveChannel(data.type),
      });
    }

    const chunks = this.expo.chunkPushNotifications(messages);

    for (const chunk of chunks) {
      try {
        await this.expo.sendPushNotificationsAsync(chunk);
      } catch (error) {
        console.error('Expo push error', error);
      }
    }
  }
}

function resolveChannel(type: NotificationType): string {
  switch (type) {
    case NotificationType.DAILY_RECOMMENDATION:
      return 'daily';

    case NotificationType.SYSTEM_ALERT:
      return 'alerts';

    default:
      return 'heating';
  }
}
