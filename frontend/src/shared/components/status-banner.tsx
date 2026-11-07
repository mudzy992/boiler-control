import * as React from 'react';
import { Banner, type BannerTone } from '@/ui';

export type StatusBannerVariant = 'success' | 'error' | 'info' | 'warning';

export interface StatusBannerProps {
  variant: StatusBannerVariant;
  message: string;
  onDismiss?: () => void;
  className?: string;
  dismissLabel?: string;
}

const toneMap: Record<StatusBannerVariant, BannerTone> = {
  success: 'ok',
  error: 'fault',
  info: 'info',
  warning: 'warn',
};

export const StatusBanner = ({
  variant,
  message,
  onDismiss,
  className,
  dismissLabel = 'Dismiss',
}: StatusBannerProps): React.JSX.Element => (
  <Banner
    tone={toneMap[variant]}
    message={message}
    onDismiss={onDismiss}
    dismissLabel={dismissLabel}
    className={className}
  />
);
