import { useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/services/api';
import { queryKeys } from '@/lib/queryKeys';
import { Card, CardContent } from '@/shared/components/ui/Card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { StatusBanner } from '@/shared/components/status-banner';
import { TablePager } from '@/shared/components/table-controls';
import {
  coveredGroups,
  historyHeadline,
  isHistoryEmpty,
  originLabelKey,
  valueOrNull,
} from '../lib/daily-history';
import type { DailyHistoryResponse, DailyHistoryRow } from '../types';

interface DailyHistoryPanelProps {
  homeProfileId: number | null | undefined;
  from: string;
  to: string;
  limit?: number;
}

/**
 * Historija dnevnih zapisa (`31`).
 *
 * Postoji jer je 301 rekonstruisan dan bio u bazi i **nigdje vidljiv**: jedini
 * endpoint nad `DailyRecord`-om čitao je `shadow*` kolone, koje su u backfill
 * redu prazne po definiciji.
 *
 * Namjerne odluke:
 *  - porijeklo (`LIVE` / `BACKFILL`) je prva kolona, ne fusnota;
 *  - `null` se prikazuje kao „—", nikad kao `0` — nula ciklusa je mjerenje, a
 *    `null` znači da nije mjereno;
 *  - prazna historija piše da nema zapisa, a ne „0 dana";
 *  - `truncated` se kaže naglas, da se prikaz ne čita kao cijela historija.
 */
export const DailyHistoryPanel = ({
  homeProfileId,
  from,
  to,
  limit = 60,
}: DailyHistoryPanelProps): JSX.Element | null => {
  const { t } = useTranslation();
  const enabled = Boolean(homeProfileId) && Boolean(from) && Boolean(to);
  /*
   * Historija se straniči na serveru (`36`): 302 dana se prije seklo na 180 i o
   * tome je govorio samo banner. Sada se čita jedna strana, a `total` iz
   * odgovora kaže koliko dana stvarno postoji.
   */
  const [offset, setOffset] = useState(0);

  const historyQuery = useQuery({
    queryKey: queryKeys.dailyHistory(homeProfileId ?? 0, from, to, limit, offset),
    queryFn: () =>
      apiClient.getDailyHistory({
        homeProfileId: homeProfileId as number,
        from,
        to,
        limit,
        offset,
      }),
    enabled,
    staleTime: 1000 * 60 * 5,
  });

  if (!enabled) return null;

  const report: DailyHistoryResponse | undefined = historyQuery.data;
  const headline = historyHeadline(report);

  return (
    <Card>
      <CardContent className="space-y-4 pt-4">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">
            {t('reports.historyTitle')}
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            {t('reports.historySubtitle')}
          </p>
        </div>

        {historyQuery.isLoading ? (
          <p className="text-sm text-text-secondary">{t('common.loading')}</p>
        ) : null}

        {historyQuery.isError ? (
          <StatusBanner variant="error" message={t('reports.historyError')} />
        ) : null}

        {report && !isHistoryEmpty(report) ? (
          <>
            <p className="text-sm text-text-secondary">
              {t('reports.historySummary', {
                days: headline.days,
                from: headline.firstDate ?? '—',
                to: headline.lastDate ?? '—',
              })}
            </p>

            {headline.backfill > 0 ? (
              <StatusBanner
                variant="info"
                message={t('reports.historyBackfillNote', {
                  count: headline.backfill,
                })}
              />
            ) : null}

            {headline.truncated ? (
              <StatusBanner
                variant="warning"
                message={t('reports.historyTruncated', { limit })}
              />
            ) : null}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('reports.colDate')}</TableHead>
                  <TableHead>{t('reports.historyColOrigin')}</TableHead>
                  <TableHead>{t('reports.historyColProposal')}</TableHead>
                  <TableHead>{t('reports.historyColCycles')}</TableHead>
                  <TableHead>{t('reports.historyColDuty')}</TableHead>
                  <TableHead>{t('reports.historyColGas')}</TableHead>
                  <TableHead>{t('reports.historyColDegreeDays')}</TableHead>
                  <TableHead>{t('reports.historyColCoverage')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.rows.map((row) => (
                  <HistoryRow key={row.localDate} row={row} />
                ))}
              </TableBody>
            </Table>
            <TablePager
              total={report.total ?? report.rows.length}
              offset={offset}
              limit={limit}
              onChange={setOffset}
              isFetching={historyQuery.isFetching}
            />
          </>
        ) : null}

        {report && isHistoryEmpty(report) && !historyQuery.isLoading ? (
          <p className="text-sm text-text-secondary">{t('reports.historyEmpty')}</p>
        ) : null}
      </CardContent>
    </Card>
  );
};

const HistoryRow = ({ row }: { row: DailyHistoryRow }): JSX.Element => {
  const { t } = useTranslation();
  const proposal = valueOrNull(row.proposedFlowTemp);
  const cycles = valueOrNull(row.cycles);
  const duty = valueOrNull(row.dutyPercent);
  const gas = valueOrNull(row.gasM3);
  const degreeDays = valueOrNull(row.degreeDays);
  const covered = coveredGroups(row);

  return (
    <TableRow>
      <TableCell>{row.localDate}</TableCell>
      <TableCell>
        <span
          className={
            row.origin === 'BACKFILL'
              ? 'rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400'
              : 'rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400'
          }
        >
          {t(originLabelKey(row.origin))}
        </span>
      </TableCell>
      <TableCell>{proposal === null ? '—' : `${proposal.toFixed(1)}°C`}</TableCell>
      <TableCell>{cycles === null ? '—' : cycles}</TableCell>
      <TableCell>{duty === null ? '—' : `${duty.toFixed(1)}%`}</TableCell>
      <TableCell>{gas === null ? '—' : `${gas.toFixed(2)} m³`}</TableCell>
      <TableCell>
        {degreeDays === null ? '—' : degreeDays.toFixed(1)}
      </TableCell>
      <TableCell>
        {covered.length === 0
          ? t('reports.historyNoCoverage')
          : covered.map((key) => t(`reports.historyCoverage_${key}`)).join(' · ')}
      </TableCell>
    </TableRow>
  );
};
