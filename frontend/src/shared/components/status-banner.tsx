import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export type StatusBannerVariant = 'success' | 'error' | 'info' | 'warning';

/** Transient mutation feedback. Error uses `role="alert"`; others `role="status"`. */
export interface StatusBannerProps {
  variant: StatusBannerVariant;
  message: string;
  onDismiss?: () => void;
  className?: string;
  dismissLabel?: string;
}

const variantClasses: Record<StatusBannerVariant, string> = {
  success: 'border-success/30 bg-success-50 text-success-900 dark:bg-success/10 dark:text-success',
  error: 'border-error/30 bg-error-50 text-error-900 dark:bg-error/10 dark:text-error',
  info: 'border-info/30 bg-muted text-foreground',
  warning: 'border-warning/30 bg-muted text-foreground',
};

export const StatusBanner = ({
  variant,
  message,
  onDismiss,
  className,
  dismissLabel = 'Dismiss',
}: StatusBannerProps): React.JSX.Element => {
  const isAlert = variant === 'error';

  return (
    <div
      role={isAlert ? 'alert' : 'status'}
      aria-live={isAlert ? 'assertive' : 'polite'}
      className={cn(
        'flex items-start justify-between gap-3 rounded-md border px-4 py-3 text-sm',
        variantClasses[variant],
        className,
      )}
    >
      <p className="min-w-0 flex-1">{message}</p>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-md p-1 opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={dismissLabel}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
};
