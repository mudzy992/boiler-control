import { useEffect, useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/components/ui/Button';
import { cn } from '@/shared/lib/utils';
import { computeHeatingProgress } from '../lib/compute-heating-progress';
import { DashboardHeatingProgress } from './dashboard-heating-progress';

interface DashboardStatusBandProps {
  isHeatingActive: boolean;
  currentTemp: number;
  targetTemp: number;
  expectedHeatTimeMin: number | null;
  heatingStartedAt: string | null;
  onSetTemp: () => void;
}

export const DashboardStatusBand = ({
  isHeatingActive,
  currentTemp,
  targetTemp,
  expectedHeatTimeMin,
  heatingStartedAt,
  onSetTemp,
}: DashboardStatusBandProps): JSX.Element => {
  const { t } = useTranslation();
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!isHeatingActive) {
      return;
    }
    const id = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [isHeatingActive]);

  const progress = computeHeatingProgress({
    now: nowMs,
    startedAt: heatingStartedAt,
    expectedHeatTimeMin,
    isHeatingActive,
  });

  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-lg border border-border bg-card p-4 sm:p-5',
        isHeatingActive && 'shadow-glow',
      )}
      aria-live="polite"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-cockpit-radial opacity-80"
        aria-hidden
      />
      <div className="relative space-y-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
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
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-6">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {t('dashboard.currentTemp')}
              </p>
              <p className="mt-1 font-mono text-kpi font-semibold text-brand">
                {Number.isFinite(currentTemp) ? currentTemp.toFixed(1) : '—'}
                <span className="ml-1 text-lg text-muted-foreground">°C</span>
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('dashboard.targetSubtitle', {
                  temp: Number.isFinite(targetTemp)
                    ? targetTemp.toFixed(1)
                    : '—',
                })}
              </p>
            </div>
            <Button type="button" size="lg" variant="outline" onClick={onSetTemp}>
              {t('dashboard.setCurrentTemp')}
            </Button>
          </div>
        </div>
        <DashboardHeatingProgress progress={progress} />
      </div>
    </section>
  );
};
