import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/shared/lib/utils';

interface AnomalyBadgeProps {
  isAnomaly: boolean;
}

export const AnomalyBadge = ({ isAnomaly }: AnomalyBadgeProps): JSX.Element => {
  const { t } = useTranslation();
  return (
    <span
      className={cn(
        'rounded px-2.5 py-0.5 text-xs font-medium',
        isAnomaly
          ? 'bg-error-50 text-error-700 dark:bg-error-900/20 dark:text-error-100'
          : 'bg-success-50 text-success-700 dark:bg-success-900/20 dark:text-success-100',
      )}
    >
      {isAnomaly ? t('heating.anomalyYes') : t('heating.anomalyNo')}
    </span>
  );
};
