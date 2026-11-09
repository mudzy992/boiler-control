import { useState, type JSX } from 'react';
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
import {
  DateRangeFilter,
  TablePager,
  type DateRange,
} from '@/shared/components/table-controls';
import { AnomalyBadge } from '../components/anomaly-badge';

const PAGE_SIZE = 25;

/**
 * Tabela događaja grijanja (`36`).
 *
 * Straničenje i filter su na serveru, ne u browseru: događaja ima preko 400 i
 * raste svaki dan, pa bi „učitaj sve pa filtriraj" značilo prenos cijele tabele
 * pri svakom otvaranju. Zato `limit`/`offset`/`from`/`to` idu u upit, a ukupan
 * broj dolazi iz zaglavlja `X-Total-Count`.
 */
export const HeatingPage = (): JSX.Element => {
  const { t } = useTranslation();
  const [range, setRange] = useState<DateRange>({ from: '', to: '' });
  const [offset, setOffset] = useState(0);

  const eventsQuery = useQuery({
    queryKey: queryKeys.heatingEventsPage(
      range.from,
      range.to,
      offset,
      PAGE_SIZE,
    ),
    queryFn: () =>
      apiClient.getHeatingEvents({
        limit: PAGE_SIZE,
        offset,
        from: range.from || undefined,
        to: range.to || undefined,
      }),
  });

  const events = eventsQuery.data?.rows ?? [];
  const total = eventsQuery.data?.total ?? 0;
  const status = eventsQuery.isLoading
    ? 'loading'
    : eventsQuery.isError
      ? 'error'
      : events.length === 0
        ? 'empty'
        : 'success';

  /*
   * Novi filter vraća na prvu stranu. Bez toga bi „od 2026-01-01" sa strane 7
   * prikazao praznu tabelu i korisnik bi pomislio da filter ne radi.
   */
  const applyRange = (next: DateRange): void => {
    setRange(next);
    setOffset(0);
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t('heating.title')} description={t('heating.subtitle')} />
      <DateRangeFilter
        idPrefix="heating-range"
        value={range}
        onChange={applyRange}
        disabled={eventsQuery.isFetching}
      />
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
                    <TableCell>
                      {record.roomCurrentTemp != null
                        ? `${record.roomCurrentTemp.toFixed(1)}°C`
                        : '—'}
                    </TableCell>
                    <TableCell>
                      {record.roomTargetTemp != null
                        ? `${record.roomTargetTemp.toFixed(1)}°C`
                        : '—'}
                    </TableCell>
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
                      <AnomalyBadge isAnomaly={record.isAnomaly ?? false} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <TablePager
              total={total}
              offset={offset}
              limit={PAGE_SIZE}
              onChange={setOffset}
              isFetching={eventsQuery.isFetching}
            />
          </CardContent>
        </Card>
      </QueryState>
    </div>
  );
};

HeatingPage.displayName = 'HeatingPage';
