import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/components/ui/Button';
import { cn } from '@/shared/lib/utils';
import type { Boiler } from '../types';

interface DashboardStatusBandProps {
  isHeatingActive: boolean;
  boiler: Boiler;
  onSetTemp: () => void;
}

export const DashboardStatusBand = ({
  isHeatingActive,
  boiler,
  onSetTemp,
}: DashboardStatusBandProps): JSX.Element => {
  const { t } = useTranslation();
  const actual =
    typeof boiler.actualFlowTemp === 'number' ? boiler.actualFlowTemp : null;

  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-lg border border-border bg-card p-4 shadow-cockpit sm:p-5',
        isHeatingActive && 'shadow-glow',
      )}
      aria-live="polite"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-cockpit-radial opacity-80"
        aria-hidden
      />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4">
          <span
            className={cn(
              'mt-1.5 h-3 w-3 shrink-0 rounded-full',
              isHeatingActive
                ? 'bg-success animate-status-pulse shadow-[0_0_12px_rgb(var(--success)/0.8)]'
                : 'bg-muted-foreground/50',
            )}
            aria-hidden
          />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {t('dashboard.boilerStatus')}
            </p>
            <h2 className="mt-1 text-display font-semibold tracking-tight text-foreground">
              {isHeatingActive
                ? t('dashboard.heatingActive')
                : t('dashboard.heatingIdle')}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {t('dashboard.suggestedFlow')}:{' '}
              <span className="font-mono text-foreground">
                {boiler.suggestedFlowTemp.toFixed(1)}°C
              </span>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-6">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {t('dashboard.actualFlow')}
            </p>
            <p className="mt-1 font-mono text-kpi font-semibold text-brand">
              {actual != null ? `${actual.toFixed(1)}` : '—'}
              <span className="ml-1 text-lg text-muted-foreground">°C</span>
            </p>
          </div>
          <Button type="button" size="lg" onClick={onSetTemp}>
            {t('dashboard.setCurrentTemp')}
          </Button>
        </div>
      </div>
    </section>
  );
};
