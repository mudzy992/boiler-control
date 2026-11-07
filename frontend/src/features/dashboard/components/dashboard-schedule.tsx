import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/shared/components/ui/Card';
import { cn } from '@/shared/lib/utils';
import type { ThermostatProgram } from '../types';

interface DayGroup {
  dayType: string;
  programs: ThermostatProgram[];
}

interface DashboardScheduleProps {
  scheduleByDay: DayGroup[];
  activeProgram: ThermostatProgram | null;
}

const formatStartMinute = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

export const DashboardSchedule = ({
  scheduleByDay,
  activeProgram,
}: DashboardScheduleProps): JSX.Element => {
  const { t } = useTranslation();

  return (
    <Card variant="elevated">
      <CardContent className="space-y-4 pt-6">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold tracking-tight">
            {t('dashboard.scheduleTitle')}
          </h2>
          {activeProgram ? (
            <span className="rounded bg-success/10 px-2 py-1 text-xs font-semibold text-success">
              {t('dashboard.activeProgram', {
                time: formatStartMinute(activeProgram.startMinute),
                temp: activeProgram.targetTemp.toFixed(1),
              })}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">
              {t('dashboard.noActiveProgram')}
            </span>
          )}
        </div>
        {scheduleByDay.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('dashboard.noSchedule')}</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {scheduleByDay.map((day) => (
              <div
                key={day.dayType}
                className="rounded-lg border border-border bg-muted/40 p-3"
              >
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {day.dayType}
                  </p>
                  <span className="text-[10px] text-muted-foreground">
                    {t('dashboard.blocks', { count: day.programs.length })}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {day.programs.map((p) => {
                    const isActive =
                      activeProgram?.dayType === p.dayType &&
                      activeProgram?.orderIndex === p.orderIndex;
                    return (
                      <div
                        key={`${day.dayType}-${p.orderIndex}`}
                        className={cn(
                          'flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium',
                          isActive
                            ? 'border border-success bg-success/10 text-success'
                            : 'border border-border bg-background',
                        )}
                      >
                        <span className="font-mono">
                          {formatStartMinute(p.startMinute)}
                        </span>
                        <span>{p.targetTemp.toFixed(1)}°C</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
