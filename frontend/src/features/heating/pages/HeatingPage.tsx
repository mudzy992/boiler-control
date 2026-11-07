import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/services/api';
import { queryKeys } from '@/lib/queryKeys';
import { PageHeader } from '@/shared/components/page-header';
import { QueryState } from '@/shared/components/query-state';
import { Card, CardContent } from '@/shared/components/ui/Card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { AnomalyBadge } from '../components/anomaly-badge';

interface HeatingEvent {
  id: number;
  timestampStart: string;
  timestampEnd: string | null;
  roomCurrentTemp: number;
  roomTargetTemp: number;
  hvacAction: string;
  source: string;
  isAnomaly: boolean;
}

export const HeatingPage = (): JSX.Element => {
  const { t } = useTranslation();
  const eventsQuery = useQuery({
    queryKey: queryKeys.heatingEvents,
    queryFn: async (): Promise<HeatingEvent[]> => {
      const data = await apiClient.getHeatingEvents();
      return Array.isArray(data) ? data : data?.events ?? [];
    },
  });

  const events = eventsQuery.data ?? [];
  const status = eventsQuery.isLoading
    ? 'loading'
    : eventsQuery.isError
      ? 'error'
      : events.length === 0
        ? 'empty'
        : 'success';

  return (
    <div className="space-y-6">
      <PageHeader title={t('heating.title')} description={t('heating.subtitle')} />
      <QueryState
        status={status}
        onRetry={() => {
          void eventsQuery.refetch();
        }}
        emptyMessage={t('heating.empty')}
      >
        <Card>
          <CardContent className="p-0 pt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('heating.colStart')}</TableHead>
                  <TableHead>{t('heating.colEnd')}</TableHead>
                  <TableHead>{t('heating.colRoom')}</TableHead>
                  <TableHead>{t('heating.colTarget')}</TableHead>
                  <TableHead>{t('heating.colAction')}</TableHead>
                  <TableHead>{t('heating.colSource')}</TableHead>
                  <TableHead>{t('heating.colAnomaly')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      {new Date(record.timestampStart).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {record.timestampEnd
                        ? new Date(record.timestampEnd).toLocaleString()
                        : '—'}
                    </TableCell>
                    <TableCell>{record.roomCurrentTemp.toFixed(1)}°C</TableCell>
                    <TableCell>{record.roomTargetTemp.toFixed(1)}°C</TableCell>
                    <TableCell>
                      <span className="rounded bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                        {record.hvacAction
                          ? t(`heating.actions.${record.hvacAction}`, {
                              defaultValue: record.hvacAction,
                            })
                          : '—'}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{record.source}</TableCell>
                    <TableCell>
                      <AnomalyBadge isAnomaly={record.isAnomaly} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </QueryState>
    </div>
  );
};

HeatingPage.displayName = 'HeatingPage';
