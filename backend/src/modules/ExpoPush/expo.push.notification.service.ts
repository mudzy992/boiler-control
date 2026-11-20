import { createHash } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { NotificationType } from 'src/generated/prisma';

@Injectable()
export class ExpoPushService {
  private readonly logger = new Logger(ExpoPushService.name);
  private expo: Expo;

  constructor() {
    this.expo = new Expo();
  }

  async sendPushToTokens(
    tokens: string[],
    title: string,
    message: string,
    data?: any,
    diagnosticId?: string,
    notificationType?: NotificationType,
  ): Promise<{
    targeted: number;
    accepted: number;
    rejected: number;
    errors: string[];
  }> {
    const messages: ExpoPushMessage[] = [];
    const errors: string[] = [];
    let rejected = 0;

    for (const pushToken of tokens) {
      if (!Expo.isExpoPushToken(pushToken)) {
        rejected += 1;
        errors.push('InvalidExpoPushToken');
        if (diagnosticId) {
          this.logger.warn(
            `[push:${diagnosticId}] invalid Expo token ref=${tokenRef(pushToken)}`,
          );
        }
        continue;
      }

      messages.push({
        to: pushToken,
        sound: 'default',
        title,
        body: message,
        data,
        priority: 'high',
        channelId: resolveChannel(notificationType ?? data?.type),
      });
    }

    const chunks = this.expo.chunkPushNotifications(messages);
    let accepted = 0;

    for (const chunk of chunks) {
      try {
        // A successful HTTP request only means Expo accepted a ticket. It is
        // not evidence that FCM delivered the notification to the device.
        const tickets = await this.expo.sendPushNotificationsAsync(chunk);
        tickets.forEach((ticket, index) => {
          const pushToken = String(chunk[index]?.to ?? 'unknown');
          const ref = tokenRef(pushToken);
          if (ticket.status === 'ok') {
            accepted += 1;
            if (diagnosticId) {
              this.logger.log(
                `[push:${diagnosticId}] Expo ticket accepted tokenRef=${ref} ticketId=${ticket.id}`,
              );
            }
          } else {
            rejected += 1;
            const reason = ticket.details?.error ?? ticket.message;
            errors.push(reason);
            this.logger.error(
              `${diagnosticId ? `[push:${diagnosticId}] ` : ''}Expo push ticket rejected tokenRef=${ref} reason=${reason}`,
            );
          }
        });
      } catch (error) {
        rejected += chunk.length;
        errors.push('ExpoRequestFailed');
        const reason = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `${diagnosticId ? `[push:${diagnosticId}] ` : ''}Expo push request failed for ${chunk.length} token(s): ${reason}`,
        );
      }
    }

    return {
      targeted: tokens.length,
      accepted,
      rejected,
      errors: [...new Set(errors)],
    };
  }
}

/** Stable, non-reversible reference for correlating device tickets without logging tokens. */
function tokenRef(token: string): string {
  return createHash('sha256').update(token).digest('hex').slice(0, 12);
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
