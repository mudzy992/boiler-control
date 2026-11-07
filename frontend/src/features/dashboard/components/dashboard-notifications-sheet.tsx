import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { QueryState } from '@/shared/components/query-state';
import { Button, Modal } from '@/ui';

interface NotificationItem {
  id: number;
  title: string;
  message: string;
  isRead: boolean;
}

interface DashboardNotificationsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  isError: boolean;
  onRetry: () => void;
  notifications: NotificationItem[];
  onMarkAsRead: (id: number) => void;
}

export const DashboardNotificationsSheet = ({
  open,
  onOpenChange,
  loading,
  isError,
  onRetry,
  notifications,
  onMarkAsRead,
}: DashboardNotificationsSheetProps): JSX.Element => {
  const { t } = useTranslation();
  const status = loading
    ? 'loading'
    : isError
      ? 'error'
      : notifications.length === 0
        ? 'empty'
        : 'success';

  return (
    <Modal
      open={open}
      onClose={() => onOpenChange(false)}
      title={t('notifications.title')}
      description={t('dashboard.notifSheetHint')}
      className="max-w-sm"
    >
      <QueryState
        status={status}
        emptyMessage={t('notifications.noUnread')}
        onRetry={onRetry}
        minHeightClassName="min-h-40"
      >
        <ul className="space-y-3">
          {notifications.map((notif) => (
            <li key={notif.id} className="rounded-panel border border-line p-3">
              <p className="text-sm font-semibold text-ink">{notif.title}</p>
              <p className="mt-1 text-xs text-ink-muted">{notif.message}</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => onMarkAsRead(notif.id)}
              >
                {t('notifications.markAsRead')}
              </Button>
            </li>
          ))}
        </ul>
      </QueryState>
    </Modal>
  );
};
