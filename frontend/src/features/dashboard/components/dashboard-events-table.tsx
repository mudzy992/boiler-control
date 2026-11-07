import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { cn } from '@/shared/lib/utils';
import type { HeatingEventRow } from '../types';

interface DashboardEventsTableProps {
  events: HeatingEventRow[];
  activeBucket: string | null;
}

export const DashboardEventsTable = ({
  events,
  activeBucket,
}: DashboardEventsTableProps): JSX.Element => {
  const { t } = useTranslation();

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('dashboard.colStart')}</TableHead>
            <TableHead>{t('dashboard.colEnd')}</TableHead>
            <TableHead>{t('dashboard.colDuration')}</TableHead>
            <TableHead>{t('dashboard.colCurrent')}</TableHead>
            <TableHead>{t('dashboard.colTarget')}</TableHead>
            <TableHead>{t('dashboard.colAction')}</TableHead>
            <TableHead>{t('dashboard.colAnomaly')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">
                {t('dashboard.noEvents')}
              </TableCell>
            </TableRow>
          ) : (
            events.map((record) => (
              <TableRow
                key={record.id}
                className={cn(
                  record.bucketLabel === activeBucket && 'bg-accent/20',
                )}
              >
                <TableCell>{new Date(record.startedAt).toLocaleString()}</TableCell>
                <TableCell>
                  {record.endedAt
                    ? new Date(record.endedAt).toLocaleString()
                    : '—'}
                </TableCell>
                <TableCell>{record.durationMinutes}</TableCell>
                <TableCell>{record.currentTemp.toFixed(1)}°C</TableCell>
                <TableCell>{record.targetTemp}°C</TableCell>
                <TableCell>
                  {record.hvacAction ? (
                    <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {record.hvacAction}
                    </span>
                  ) : (
                    '—'
                  )}
                </TableCell>
                <TableCell>
                  <span
                    className={cn(
                      'rounded px-2 py-0.5 text-xs font-medium',
                      record.isAnomaly
                        ? 'bg-destructive/10 text-destructive'
                        : 'bg-success/10 text-success',
                    )}
                  >
                    {record.isAnomaly
                      ? t('heating.anomalyYes')
                      : t('heating.anomalyNo')}
                  </span>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};
