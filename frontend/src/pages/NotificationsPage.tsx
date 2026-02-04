import React, { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import { BellOutlined, CheckCircleOutlined, AlertOutlined, InfoOutlined } from '@ant-design/icons';
import { Button } from 'antd';

export const NotificationsPage: React.FC = () => {
  const [showAll, setShowAll] = useState(false);
  const queryClient = useQueryClient();

  // Fetch all notifications
  const { data: allNotifications = [], isLoading, error } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const response = await apiClient.getNotifications();
      console.log('Notifications API Response:', response);
      return Array.isArray(response) ? response : [];
    },
    staleTime: 1000 * 60 * 1, // 1 minute
  });

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: (notificationId: number) => apiClient.markNotificationAsRead(notificationId),
    onSuccess: () => {
      // Invalidate and refetch notifications
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (error) => {
      console.error('Failed to mark notification as read:', error);
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => apiClient.markAllNotificationsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
    onError: (error) => {
      console.error('Failed to mark all notifications as read:', error);
    },
  });

  // Filter notifications based on showAll flag
  const filteredNotifications = useMemo(() => {
    if (showAll) {
      // Show all notifications, sorted by date (newest first)
      return [...allNotifications].sort((a, b) =>
        dayjs(b.sentAt).diff(dayjs(a.sentAt))
      );
    } else {
      // Show only unread notifications, sorted by date
      return allNotifications
        .filter((n) => !n.isRead)
        .sort((a, b) => dayjs(b.sentAt).diff(dayjs(a.sentAt)));
    }
  }, [allNotifications, showAll]);

  // Count unread notifications
  const unreadCount = useMemo(() => {
    return allNotifications.filter((n) => !n.isRead).length;
  }, [allNotifications]);

  const handleMarkAsRead = (notificationId: number) => {
    markAsReadMutation.mutate(notificationId);
  };

  const getNotificationIcon = (type: string) => {
    if (type.includes('ANOMALY') || type.includes('ALERT')) {
      return <AlertOutlined className="text-amber-500" />;
    }
    if (type.includes('ERROR')) {
      return <AlertOutlined className="text-red-500" />;
    }
    if (type.includes('STARTED') || type.includes('SUCCESS') || type.includes('HEATING')) {
      return <CheckCircleOutlined className="text-green-500" />;
    }
    return <InfoOutlined className="text-blue-500" />;
  };

  const getNotificationTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      'DAILY_RECOMMENDATION': 'Daily Recommendation',
      'FLOW_TEMP_CHANGED': 'Temperature Change',
      'HEATING_STARTED': 'Heating Started',
      'HEATING_ENDED': 'Heating Ended',
      'SYSTEM_ALERT': 'System Alert',
      'GAS_READING_REMINDER': 'Gas Reading Reminder',
    };
    return labels[type] || type;
  };

  if (error) {
    return (
      <div className="p-6 text-red-600 rounded-lg bg-red-50 dark:bg-red-900/20 dark:text-red-400">
        Failed to load notifications. Please try again.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
          <BellOutlined className="text-2xl text-blue-600 dark:text-blue-400" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Notifications</h1>
          {unreadCount > 0 && (
            <span className="inline-flex items-center justify-center px-3 py-1 ml-2 text-sm font-semibold text-white bg-red-500 rounded-full">
              {unreadCount}
            </span>
          )}
          </div>
          <p className="mt-2 text-sm text-gray-600 dark:text-slate-400">
            {showAll
              ? `${allNotifications.length} total notification${allNotifications.length !== 1 ? 's' : ''}`
              : `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`}
          </p>
        </div>
        <Button
          onClick={() => markAllReadMutation.mutate()}
          disabled={unreadCount === 0 || markAllReadMutation.isPending}
          type='primary'
        >
          {markAllReadMutation.isPending ? 'Marking...' : 'Mark All Read'}
        </Button>
      </div>

      {/* Toggle Button */}
      <div className="flex gap-3">
        <Button
          onClick={() => setShowAll(false)}
          type={!showAll ? 'primary' : 'default'}
        >
          Unread {unreadCount > 0 && `(${unreadCount})`}
        </Button>
        <Button
        type={showAll ? 'primary' : 'default'}
          onClick={() => setShowAll(true)}
        >
          All ({allNotifications.length})
        </Button>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-gray-300 rounded-full animate-spin border-t-blue-600 dark:border-slate-700 dark:border-t-blue-500"></div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredNotifications.length === 0 && (
        <div className="px-6 py-16 text-center border-2 border-gray-300 border-dashed rounded-lg bg-gray-50 dark:border-slate-700 dark:bg-slate-800/30">
          <BellOutlined className="mx-auto mb-4 text-4xl text-gray-400 dark:text-slate-500" />
          <p className="text-gray-600 dark:text-slate-400">
            {showAll ? 'No notifications yet.' : 'No unread notifications.'}
          </p>
          <p className="mt-2 text-sm text-gray-500 dark:text-slate-500">
            {showAll
              ? 'When new events occur, they will appear here.'
              : 'All your notifications are marked as read.'}
          </p>
        </div>
      )}

      {/* Notifications List */}
      {!isLoading && filteredNotifications.length > 0 && (
        <div className="space-y-3">
          {filteredNotifications.map((notif) => (
            <div
              key={notif.id}
              onClick={() => !notif.isRead && handleMarkAsRead(notif.id)}
              className={`group rounded-lg border transition-all ${
                notif.isRead
                  ? 'border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-800'
                  : 'border-blue-200 bg-blue-50 dark:border-blue-900/30 dark:bg-blue-900/20'
              } p-4 cursor-pointer hover:shadow-md`}
            >
              {/* Header: Icon, Title, Badge */}
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-start flex-1 gap-3">
                  <div className="mt-0.5 text-lg">{getNotificationIcon(notif.type)}</div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 dark:text-white">{notif.title}</h3>
                    <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-400 mt-0.5">
                      {getNotificationTypeLabel(notif.type)}
                    </p>
                  </div>
                </div>
                {!notif.isRead && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-white bg-blue-600 rounded-full whitespace-nowrap">
                    <span className="inline-block w-2 h-2 bg-white rounded-full"></span>
                    Unread
                  </span>
                )}
              </div>

              {/* Message */}
              <p className="mb-3 text-sm text-gray-700 dark:text-slate-300">{notif.message}</p>

              {/* Metadata */}
              <div className="flex items-center justify-between gap-3 text-xs text-gray-500 dark:text-slate-400">
                <span>{dayjs(notif.sentAt).format('MMM DD, YYYY HH:mm')}</span>
                {!notif.isRead && (
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMarkAsRead(notif.id);
                    }}
                    disabled={markAsReadMutation.isPending}
                    type='default'
                  >
                    {markAsReadMutation.isPending ? 'Marking...' : 'Mark as Read'}
                  </Button>
                )}
              </div>

              {/* Data payload display (if exists) */}
              {notif.data && Object.keys(notif.data).length > 0 && (
                <div className="p-2 mt-3 bg-gray-100 rounded dark:bg-slate-700/30">
                  <p className="mb-1 text-xs font-semibold text-gray-600 dark:text-slate-400">Details:</p>
                  <pre className="overflow-x-auto text-xs text-gray-600 dark:text-slate-400">
                    {JSON.stringify(notif.data, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
