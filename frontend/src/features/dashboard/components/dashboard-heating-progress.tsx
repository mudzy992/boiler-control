import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/shared/lib/utils';
import type { HeatingProgressResult } from '../lib/compute-heating-progress';

interface DashboardHeatingProgressProps {
  progress: HeatingProgressResult;
}

export const DashboardHeatingProgress = ({
  progress,
}: DashboardHeatingProgressProps): JSX.Element | null => {
  const { t } = useTranslation();

  if (progress.mode === 'idle') {
    return null;
  }

  if (progress.mode === 'no-estimate') {
    return (
      <p className="text-sm text-muted-foreground">
        {t('dashboard.heatingNoEstimate', {
          elapsed: Math.round(progress.elapsedMin),
        })}
      </p>
    );
  }

  const isOvertime = progress.mode === 'overtime';
  const percent = Math.round(progress.ratio * 100);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-medium text-foreground">
          {t('dashboard.heatingProgress', {
            elapsed: Math.round(progress.elapsedMin),
            expected: Math.round(progress.expectedMin),
          })}
        </span>
        {isOvertime ? (
          <span className="font-semibold text-destructive">
            {t('dashboard.heatingOvertime', {
              minutes: Math.round(progress.overtimeMin),
            })}
          </span>
        ) : (
          <span className="text-muted-foreground">{percent}%</span>
        )}
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={t('dashboard.heatingProgressLabel')}
      >
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-500',
            isOvertime ? 'bg-destructive' : 'bg-brand',
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
};
