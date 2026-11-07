import type { JSX } from 'react';
import { Bell } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { QueryState } from '@/shared/components/query-state';
import { Button } from '@/shared/components/ui/Button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/shared/components/ui/sheet';

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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-sm">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Bell className="h-4 w-4" aria-hidden />
            {t('notifications.title')}
          </SheetTitle>
          <SheetDescription>{t('dashboard.notifSheetHint')}</SheetDescription>
        </SheetHeader>
        <div className="mt-4">
          <QueryState
            status={status}
            emptyMessage={t('notifications.noUnread')}
            onRetry={onRetry}
          >
            <ul className="space-y-3">
              {notifications.map((notif) => (
                <li
                  key={notif.id}
                  className="rounded-lg border border-border p-3"
                >
                  <p className="text-sm font-semibold">{notif.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {notif.message}
                  </p>
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
        </div>
      </SheetContent>
    </Sheet>
  );
};
