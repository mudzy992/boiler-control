import { useMemo, useState, type JSX } from 'react';
import dayjs from 'dayjs';
import { Bell, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/api';
import { queryKeys } from '@/lib/queryKeys';
import { PageHeader } from '@/shared/components/page-header';
import { QueryState } from '@/shared/components/query-state';
import { Button } from '@/shared/components/ui/Button';
import { useNotificationsQuery } from '../hooks/useNotifications';

export const NotificationsPage = (): JSX.Element => {
  const { t } = useTranslation();
  const [showAll, setShowAll] = useState(false);
  const queryClient = useQueryClient();
  const notificationsQuery = useNotificationsQuery();
  const allNotifications = notificationsQuery.data ?? [];

  const markAsReadMutation = useMutation({
    mutationFn: (notificationId: number) =>
      apiClient.markNotificationAsRead(notificationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.notificationsUnreadCount,
      });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => apiClient.markAllNotificationsRead(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.notificationsUnreadCount,
      });
    },
  });

  const unreadCount = useMemo(
    () => allNotifications.filter((item) => !item.isRead).length,
    [allNotifications],
  );

  const filteredNotifications = useMemo(() => {
    const list = showAll
      ? [...allNotifications]
      : allNotifications.filter((item) => !item.isRead);
    return list.sort((a, b) => dayjs(b.sentAt).diff(dayjs(a.sentAt)));
  }, [allNotifications, showAll]);

  const status = notificationsQuery.isLoading
    ? 'loading'
    : notificationsQuery.isError
      ? 'error'
      : filteredNotifications.length === 0
        ? 'empty'
        : 'success';

  const resolveIcon = (type: string) => {
    if (type.includes('ANOMALY') || type.includes('ALERT') || type.includes('ERROR')) {
      return <AlertTriangle className="h-5 w-5 text-warning" aria-hidden />;
    }
    if (type.includes('STARTED') || type.includes('SUCCESS')) {
      return <CheckCircle2 className="h-5 w-5 text-success" aria-hidden />;
    }
    return <Info className="h-5 w-5 text-info" aria-hidden />;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('notifications.title')}
        description={
          showAll
            ? t('notifications.totalCount', { count: allNotifications.length })
            : t('notifications.unreadCount', { count: unreadCount })
        }
        action={
          <Button
            type="button"
            onClick={() => markAllReadMutation.mutate()}
            disabled={unreadCount === 0 || markAllReadMutation.isPending}
          >
            {t('notifications.markAllRead')}
          </Button>
        }
      />
      <div className="flex gap-2">
        <Button
          type="button"
          variant={!showAll ? 'default' : 'ghost'}
          onClick={() => setShowAll(false)}
        >
          {t('notifications.unread')}
          {unreadCount > 0 ? ` (${unreadCount})` : ''}
        </Button>
        <Button
          type="button"
          variant={showAll ? 'default' : 'ghost'}
          onClick={() => setShowAll(true)}
        >
          {t('notifications.all')} ({allNotifications.length})
        </Button>
      </div>
      <QueryState
        status={status}
        onRetry={() => {
          void notificationsQuery.refetch();
        }}
        emptyMessage={
          showAll ? t('notifications.noNotifications') : t('notifications.noUnread')
        }
      >
        <div className="space-y-3">
          {filteredNotifications.map((notif) => (
            <button
              key={notif.id}
              type="button"
              onClick={() => {
                if (!notif.isRead) {
                  markAsReadMutation.mutate(notif.id);
                }
              }}
              className={`w-full rounded-lg border p-4 text-left transition-colors ${
                notif.isRead
                  ? 'border-border bg-card'
                  : 'border-primary/40 bg-primary/5'
              }`}
            >
              <div className="mb-2 flex items-start gap-3">
                {resolveIcon(notif.type)}
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">{notif.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{notif.message}</p>
                </div>
                {!notif.isRead ? (
                  <span className="rounded bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                    {t('notifications.unread')}
                  </span>
                ) : null}
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{dayjs(notif.sentAt).format('DD.MM.YYYY HH:mm')}</span>
                {!notif.isRead ? (
                  <span className="inline-flex items-center gap-1">
                    <Bell className="h-3 w-3" aria-hidden />
                    {t('notifications.markAsRead')}
                  </span>
                ) : null}
              </div>
            </button>
          ))}
        </div>
      </QueryState>
    </div>
  );
};

NotificationsPage.displayName = 'NotificationsPage';
