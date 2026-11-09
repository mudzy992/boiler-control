import { useEffect, useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, GaugeBar, HeroPanel, Led, Readout } from '@/ui';
import { computeHeatingProgress } from '../lib/compute-heating-progress';

interface DashboardStatusBandProps {
  isHeatingActive: boolean;
  /** `null` = nema mjerenja; prikazuje se „—", nikad 0 °C. */
  currentTemp: number | null;
  targetTemp: number | null;
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
    <HeroPanel aria-live="polite">
      <div className="space-y-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <Led state={isHeatingActive ? 'on' : 'off'} />
            <div>
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-muted">
                {t('dashboard.boilerStatus')}
              </p>
              <h2 className="mt-1 text-display font-semibold tracking-tight text-ink">
                {isHeatingActive
                  ? t('dashboard.heatingActive')
                  : t('dashboard.heatingIdle')}
              </h2>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-6">
            <Readout
              label={t('dashboard.currentTemp')}
              value={
                typeof currentTemp === 'number' && Number.isFinite(currentTemp)
                  ? currentTemp.toFixed(1)
                  : '—'
              }
              unit="°C"
            />
            <div className="pb-1">
              <p className="text-sm text-ink-muted">
                {t('dashboard.targetSubtitle', {
                  temp:
                    typeof targetTemp === 'number' && Number.isFinite(targetTemp)
                      ? targetTemp.toFixed(1)
                      : '—',
                })}
              </p>
              <Button
                type="button"
                size="lg"
                variant="secondary"
                className="mt-2"
                onClick={onSetTemp}
              >
                {t('dashboard.setCurrentTemp')}
              </Button>
            </div>
          </div>
        </div>
        {progress.mode === 'no-estimate' ? (
          <p className="text-sm text-ink-muted">
            {t('dashboard.heatingNoEstimate', {
              elapsed: Math.round(progress.elapsedMin),
            })}
          </p>
        ) : null}
        {progress.mode === 'running' || progress.mode === 'overtime' ? (
          <GaugeBar
            ratio={progress.ratio}
            overtime={progress.mode === 'overtime'}
            label={t('dashboard.heatingProgress', {
              elapsed: Math.round(progress.elapsedMin),
              expected: Math.round(progress.expectedMin),
            })}
            detail={
              progress.mode === 'overtime'
                ? t('dashboard.heatingOvertime', {
                    minutes: Math.round(progress.overtimeMin),
                  })
                : `${Math.round(progress.ratio * 100)}%`
            }
          />
        ) : null}
      </div>
    </HeroPanel>
  );
};
