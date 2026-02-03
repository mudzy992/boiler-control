import { apiClient } from './api';

export interface Notification {
  id: number;
  userId: number;
  type: string;
  title: string;
  message: string;
  data?: any;
  sentAt: string;
  deliveryOk: boolean;
  sourceRef?: string;
  createdAt: string;
}

export interface NotificationPreference {
  id: number;
  userId: number;
  type: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export const getNotifications = async (): Promise<Notification[]> => {
  const { data } = await apiClient.get("/notifications");
  return data;
};

export const markNotificationAsRead = async (id: number): Promise<void> => {
  await apiClient.post(`/notifications/${id}/read`);
};

export const getNotificationPreferences = async (): Promise<NotificationPreference[]> => {
  const { data } = await apiClient.get("/notifications/preferences");
  return data;
};

export const updateNotificationPreference = async (
  type: string,
  enabled: boolean
): Promise<NotificationPreference> => {
  const { data } = await apiClient.patch("/notifications/preferences", { type, enabled });
  return data;
};
