import { Injectable } from '@nestjs/common';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { NotificationType } from 'src/generated/prisma';

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
  ): Promise<{ targeted: number; accepted: number; rejected: number; errors: string[] }> {
    const messages: ExpoPushMessage[] = [];
    const errors: string[] = [];
    let rejected = 0;

    for (const pushToken of tokens) {
      if (!Expo.isExpoPushToken(pushToken)) {
        rejected += 1;
        errors.push('InvalidExpoPushToken');
        continue;
      }

      messages.push({
        to: pushToken,
        sound: 'default',
        title,
        body: message,
        data,
        priority: 'high',
        channelId: resolveChannel(data?.type),
      });
    }

    const chunks = this.expo.chunkPushNotifications(messages);
    let accepted = 0;

    for (const chunk of chunks) {
      try {
        // A successful HTTP request only means Expo accepted a ticket. It is
        // not evidence that FCM delivered the notification to the device.
        const tickets = await this.expo.sendPushNotificationsAsync(chunk);
        for (const ticket of tickets) {
          if (ticket.status === 'ok') {
            accepted += 1;
          } else {
            rejected += 1;
            const reason = ticket.details?.error ?? ticket.message;
            errors.push(reason);
            console.error('Expo push ticket rejected', {
              message: ticket.message,
              details: ticket.details,
            });
          }
        }
      } catch (error) {
        rejected += chunk.length;
        errors.push('ExpoRequestFailed');
        console.error('Expo push request failed', error);
      }
    }

    return { targeted: tokens.length, accepted, rejected, errors: [...new Set(errors)] };
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
