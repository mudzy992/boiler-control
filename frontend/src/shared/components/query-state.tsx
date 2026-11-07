import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Skeleton, cn } from '@/ui';

export type QueryStateStatus = 'loading' | 'error' | 'empty' | 'success';

export interface QueryStateProps {
  status: QueryStateStatus;
  children?: React.ReactNode;
  errorMessage?: string;
  emptyMessage?: string;
  emptyAction?: React.ReactNode;
  onRetry?: () => void;
  loadingLabel?: string;
  className?: string;
  minHeightClassName?: string;
}

const QueryStateSkeleton = (): React.JSX.Element => (
  <div className="w-full max-w-md space-y-3" aria-hidden="true">
    <Skeleton className="h-8 w-3/4" />
    <Skeleton className="h-4 w-full" />
    <Skeleton className="h-4 w-5/6" />
  </div>
);

export const QueryState = ({
  status,
  children,
  errorMessage,
  emptyMessage,
  emptyAction,
  onRetry,
  loadingLabel,
  className,
  minHeightClassName = 'min-h-64',
}: QueryStateProps): React.JSX.Element => {
  const { t } = useTranslation();

  if (status === 'success') {
    return <>{children}</>;
  }

  if (status === 'loading') {
    return (
      <div
        role="status"
        aria-live="polite"
        className={cn('flex items-center justify-center', minHeightClassName, className)}
      >
        <QueryStateSkeleton />
        <span className="sr-only">{loadingLabel ?? t('common.loading')}</span>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div
        role="alert"
        className={cn(
          'flex flex-col items-start justify-center gap-3',
          minHeightClassName,
          className,
        )}
      >
        <p className="text-sm text-fault">{errorMessage ?? t('common.loadFailed')}</p>
        {onRetry ? (
          <Button type="button" variant="secondary" size="sm" onClick={onRetry}>
            {t('common.retry')}
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex flex-col items-start justify-center gap-3',
        minHeightClassName,
        className,
      )}
    >
      <p className="text-sm text-ink-muted">{emptyMessage ?? t('common.empty')}</p>
      {emptyAction}
    </div>
  );
};
