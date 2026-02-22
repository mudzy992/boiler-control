import { NotificationType } from 'src/generated/prisma';

export const NOTIFICATION_DEBOUNCE: Record<
  NotificationType,
  number // milliseconds
> = {
  HEATING_STARTED: 30 * 60 * 1000, // 30 min
  HEATING_ENDED: 30 * 60 * 1000,
  FLOW_TEMP_CHANGED: 60 * 60 * 1000, // 1h
  DAILY_RECOMMENDATION: 24 * 60 * 60 * 1000,
  SYSTEM_ALERT: 10 * 60 * 1000,
  GAS_READING_REMINDER: 24 * 60 * 60 * 1000,
};
