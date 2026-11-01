import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import { queryKeys } from '../lib/queryKeys';

export interface AppNotification {
  id: number;
  userId?: number;
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown> | null;
  sentAt: string;
  isRead: boolean;
  sourceRef?: string;
  createdAt?: string;
}

export interface AppNotificationPreference {
  id: number;
  userId?: number;
  type: string;
  enabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/** FE2-3: shared by the dashboard drawer and the notifications page. */
export function useNotificationsQuery() {
  return useQuery<AppNotification[]>({
    queryKey: queryKeys.notifications,
    queryFn: async () => {
      const response = await apiClient.getNotifications();
      return Array.isArray(response) ? (response as AppNotification[]) : [];
    },
    staleTime: 1000 * 60,
  });
}

export function useNotificationPreferencesQuery() {
  return useQuery<AppNotificationPreference[]>({
    queryKey: queryKeys.notificationPreferences,
    queryFn: async () => {
      const response = await apiClient.getNotificationPreferences();
      return Array.isArray(response)
        ? (response as AppNotificationPreference[])
        : [];
    },
    staleTime: 1000 * 60,
  });
}
