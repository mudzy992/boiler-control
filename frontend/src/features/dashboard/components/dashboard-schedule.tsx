import { useEffect, useMemo, useState, type JSX } from 'react';
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

const NARROW_MQ = '(max-width: 767px)';

const formatStartMinute = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

const useIsNarrowScreen = (): boolean => {
  const [isNarrow, setIsNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(NARROW_MQ);
    const sync = (): void => setIsNarrow(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  return isNarrow;
};

export const DashboardSchedule = ({
  scheduleByDay,
  activeProgram,
}: DashboardScheduleProps): JSX.Element => {
  const { t } = useTranslation();
  const isNarrow = useIsNarrowScreen();
  const activeDayType = activeProgram?.dayType ?? null;
  const [openDays, setOpenDays] = useState<ReadonlySet<string>>(
    () => new Set(activeDayType ? [activeDayType] : []),
  );

  useEffect(() => {
    setOpenDays(new Set(activeDayType ? [activeDayType] : []));
  }, [activeDayType]);

  const orderedDays = useMemo(() => {
    if (!activeDayType) return scheduleByDay;
    return [...scheduleByDay].sort((a, b) => {
      if (a.dayType === activeDayType) return -1;
      if (b.dayType === activeDayType) return 1;
      return 0;
    });
  }, [scheduleByDay, activeDayType]);

  const handleToggleDay = (dayType: string): void => {
    if (!isNarrow) return;
    setOpenDays((prev) => {
      const next = new Set(prev);
      if (next.has(dayType)) next.delete(dayType);
      else next.add(dayType);
      return next;
    });
  };

  return (
    <Card variant="elevated">
      <CardContent className="space-y-4 pt-4 sm:pt-5">
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
        {orderedDays.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('dashboard.noSchedule')}</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {orderedDays.map((day) => {
              const isOpen = !isNarrow || openDays.has(day.dayType);
              const panelId = `schedule-day-${day.dayType}`;
              return (
                <div
                  key={day.dayType}
                  className="rounded-lg border border-border bg-muted/40 p-3"
                >
                  <button
                    type="button"
                    className={cn(
                      'mb-2 flex w-full items-center justify-between gap-2 rounded-md text-left',
                      !isNarrow && 'cursor-default',
                    )}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => handleToggleDay(day.dayType)}
                  >
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {day.dayType}
                    </p>
                    <span className="text-[10px] text-muted-foreground">
                      {t('dashboard.blocks', { count: day.programs.length })}
                      {isNarrow ? (
                        <span className="ml-2" aria-hidden>
                          {isOpen ? '−' : '+'}
                        </span>
                      ) : null}
                    </span>
                  </button>
                  {isOpen ? (
                    <div id={panelId} className="space-y-1.5">
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
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
