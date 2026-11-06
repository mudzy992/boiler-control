import React, { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../services/api';
import { useNotificationsQuery } from '../hooks/useNotifications';
import { queryKeys } from '../../../lib/queryKeys';
import { BellOutlined, CheckCircleOutlined, AlertOutlined, InfoOutlined } from '@ant-design/icons';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { useTranslation } from 'react-i18next';

export const NotificationsPage: React.FC = () => {
  const { t } = useTranslation();
  const [showAll, setShowAll] = useState(false);
  const queryClient = useQueryClient();

  // FE2-3: shared notifications cache with the dashboard drawer.
  const { data: allNotifications = [], isLoading, error } =
    useNotificationsQuery();

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: (notificationId: number) =>
      apiClient.markNotificationAsRead(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
      queryClient.invalidateQueries({
        queryKey: queryKeys.notificationsUnreadCount,
      });
    },
    onError: () => {
      console.error('Failed to mark notification as read');
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => apiClient.markAllNotificationsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
      queryClient.invalidateQueries({
        queryKey: queryKeys.notificationsUnreadCount,
      });
    },
    onError: () => {
      console.error('Failed to mark all notifications as read');
    },
  });

  // Filter notifications based on showAll flag
  const filteredNotifications = useMemo(() => {
    if (showAll) {
      return [...allNotifications].sort((a, b) =>
        dayjs(b.sentAt).diff(dayjs(a.sentAt)),
      );
    }
    return allNotifications
      .filter((n) => !n.isRead)
      .sort((a, b) => dayjs(b.sentAt).diff(dayjs(a.sentAt)));
  }, [allNotifications, showAll]);

  const unreadCount = useMemo(
    () => allNotifications.filter((n) => !n.isRead).length,
    [allNotifications],
  );

  const handleMarkAsRead = (notificationId: number) => {
    markAsReadMutation.mutate(notificationId);
  };

  const getNotificationIcon = (type: string) => {
    if (type.includes('ANOMALY') || type.includes('ALERT')) {
      return <AlertOutlined className="w-5 h-5 text-warning" />;
    }
    if (type.includes('ERROR')) {
      return <AlertOutlined className="w-5 h-5 text-error" />;
    }
    if (type.includes('STARTED') || type.includes('SUCCESS')) {
      return <CheckCircleOutlined className="w-5 h-5 text-success" />;
    }
    return <InfoOutlined className="w-5 h-5 text-info" />;
  };

  const getNotificationTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      DAILY_RECOMMENDATION: t('notifications.daily'),
      FLOW_TEMP_CHANGED: t('notifications.alerts'),
      HEATING_STARTED: t('notifications.heating'),
      HEATING_ENDED: t('notifications.heating'),
      SYSTEM_ALERT: t('notifications.alerts'),
      GAS_READING_REMINDER: t('notifications.gasReminder'),
    };
    return labels[type] || type;
  };

  if (error) {
    return (
      <Card padding="md" elevated className="border border-error bg-error-50 text-error-700 dark:border-error dark:bg-error-900/20 dark:text-error-100 text-sm">
        Failed to load notifications. Please try again.
      </Card>
    );
  }

  return (
    <div className="space-y-6" id="content">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <BellOutlined className="w-8 h-8 text-brand" />
            <h1 className="text-2xl font-semibold text-text-primary">
              {t('notifications.title')}
            </h1>
            {unreadCount > 0 && (
              <span className="inline-flex items-center justify-center px-3 py-1 text-xs font-semibold text-white bg-error rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          <p className="text-sm text-text-secondary mt-1">
            {showAll
              ? `${allNotifications.length} total notifications`
              : `${unreadCount} unread notifications`}
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => markAllReadMutation.mutate()}
          disabled={unreadCount === 0 || markAllReadMutation.isPending}
        >
          {markAllReadMutation.isPending ? t('common.loading') : 'Mark All Read'}
        </Button>
      </div>

      {/* Toggle buttons */}
      <div className="flex gap-3">
        <Button
          variant={!showAll ? 'primary' : 'ghost'}
          onClick={() => setShowAll(false)}
        >
          Unread {unreadCount > 0 && `(${unreadCount})`}
        </Button>
        <Button
          variant={showAll ? 'primary' : 'ghost'}
          onClick={() => setShowAll(true)}
        >
          All ({allNotifications.length})
        </Button>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-border rounded-full animate-spin border-t-brand"></div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && filteredNotifications.length === 0 && (
        <Card padding="lg" elevated className="text-center">
          <div className="flex flex-col items-center justify-center h-64">
            <BellOutlined className="w-12 h-12 mb-3 text-text-tertiary dark:text-dark-text-tertiary" />
            <p className="text-sm text-text-secondary dark:text-dark-text-secondary">
              {showAll ? 'No notifications yet.' : 'No unread notifications.'}
            </p>
            <p className="text-xs text-text-tertiary dark:text-dark-text-tertiary mt-1">
              {showAll
                ? 'When new events occur, they will appear here.'
                : 'All your notifications are marked as read.'}
            </p>
          </div>
        </Card>
      )}

      {/* Notifications list */}
      {!isLoading && filteredNotifications.length > 0 && (
        <div className="space-y-3">
          {filteredNotifications.map((notif) => (
            <div
              key={notif.id}
              onClick={() => !notif.isRead && handleMarkAsRead(notif.id)}
              className={`group p-4 rounded-xl border transition-all duration-200 cursor-pointer hover:shadow-sm ${
                notif.isRead
                  ? 'border-border bg-surface dark:border-dark-border dark:bg-dark-surface-elevated'
                  : 'border-brand bg-brand-50 dark:border-brand dark:bg-brand-900/10'
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-start flex-1 gap-3">
                  <div className="mt-0.5">{getNotificationIcon(notif.type)}</div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-text-primary dark:text-dark-text-primary">
                      {notif.title}
                    </h3>
                    <p className="text-[10px] uppercase tracking-wider text-text-tertiary dark:text-dark-text-tertiary mt-0.5">
                      {getNotificationTypeLabel(notif.type)}
                    </p>
                  </div>
                </div>
                {!notif.isRead && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[10px] font-semibold text-white bg-brand rounded-full whitespace-nowrap">
                    <span className="inline-block w-1.5 h-1.5 bg-white rounded-full"></span>
                    Unread
                  </span>
                )}
              </div>

              <p className="mb-3 text-sm text-text-secondary dark:text-dark-text-secondary">
                {notif.message}
              </p>

              <div className="flex items-center justify-between gap-3 text-[10px] text-text-tertiary dark:text-dark-text-tertiary">
                <span>{dayjs(notif.sentAt).format('DD.MM.YYYY HH:mm')}</span>
                {!notif.isRead && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMarkAsRead(notif.id);
                    }}
                    disabled={markAsReadMutation.isPending}
                  >
                    Mark as Read
                  </Button>
                )}
              </div>

              {notif.data && Object.keys(notif.data).length > 0 && (
                <div className="mt-3 p-3 rounded-lg border border-border bg-surface-muted dark:border-dark-border dark:bg-dark-surface-muted">
                  <p className="mb-1 text-xs font-semibold text-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">
                    Details:
                  </p>
                  <pre className="overflow-x-auto text-xs text-text-secondary dark:text-dark-text-secondary">
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

NotificationsPage.displayName = 'NotificationsPage';
