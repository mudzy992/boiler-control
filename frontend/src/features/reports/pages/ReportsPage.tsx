import { Fragment, useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { apiClient } from '@/services/api';
import { queryKeys } from '@/lib/queryKeys';
import { PageHeader } from '@/shared/components/page-header';
import { QueryState } from '@/shared/components/query-state';
import { Button } from '@/shared/components/ui/Button';
import { Card, CardContent } from '@/shared/components/ui/Card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { RecommendationBreakdown } from '../../heating/components/RecommendationBreakdown';
import { DailyHistoryPanel } from '../components/DailyHistoryPanel';
import { ShadowReportPanel } from '../components/ShadowReportPanel';
import type { components } from '@/types/api';

type Recommendation = components['schemas']['RecommendationResponseDto'];

export const ReportsPage = (): JSX.Element => {
  const { t } = useTranslation();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const { data: homeProfile } = useQuery({
    queryKey: queryKeys.homeProfile,
    queryFn: () => apiClient.getHomeProfile(),
    staleTime: 1000 * 60 * 5,
  });

  /*
   * Period shadow izvještaja: zadnjih 30 dana, jer se odluka poredi po danu i
   * mjesec dana je najmanji period u kojem se vidi i hladan i topao dan. Ne
   * pomjera se sa izborom u tabeli — tabela prikazuje ono što postoji, a
   * izvještaj ono što je uporedivo.
   */
  const shadowFrom = dayjs().subtract(30, 'day').format('YYYY-MM-DD');
  const shadowTo = dayjs().format('YYYY-MM-DD');

  /*
   * Historija dnevnih zapisa ide od početka rada, a ne 30 dana kao shadow:
   * rekonstruisanih 301 dan je upravo ono što korisnik do sada nije mogao vidjeti.
   * Ograničenje je na 180 najnovijih redova — tabela od 300 redova u pretraživaču
   * je sporija od koristi, a `truncated` to i kaže.
   */
  const historyFrom = '2026-01-01';
  const historyTo = dayjs().format('YYYY-MM-DD');
  const historyLimit = 180;

  /*
   * Preporuke su straničene na serveru (`33`). Prije je backend tiho rezao na
   * 100: korisnik sa 299 preporuka vidio je 100 i nije imao način da sazna da
   * ima još. Sada se traži strana, a `total` iz zaglavlja kaže koliko ih je
   * stvarno — i nudi se „učitaj još" dok se ne dođe do kraja.
   */
  const [pageSize, setPageSize] = useState(50);
  const reportsQuery = useQuery({
    queryKey: queryKeys.reportsPage(pageSize),
    queryFn: async (): Promise<{ rows: Recommendation[]; total: number }> => {
      const data = await apiClient.getReports({ limit: pageSize });
      return { rows: Array.isArray(data.rows) ? data.rows : [], total: data.total };
    },
  });

  const recommendations = reportsQuery.data?.rows ?? [];
  const recommendationsTotal = reportsQuery.data?.total ?? 0;
  const hasMoreRecommendations = recommendations.length < recommendationsTotal;
  const status = reportsQuery.isLoading
    ? 'loading'
    : reportsQuery.isError
      ? 'error'
      : recommendations.length === 0
        ? 'empty'
        : 'success';

  return (
    <div className="space-y-6">
      <PageHeader title={t('reports.title')} description={t('reports.subtitle')} />
      <ShadowReportPanel
        homeProfileId={homeProfile?.id}
        from={shadowFrom}
        to={shadowTo}
      />
      <DailyHistoryPanel
        homeProfileId={homeProfile?.id}
        from={historyFrom}
        to={historyTo}
        limit={historyLimit}
      />
      <QueryState
        status={status}
        onRetry={() => {
          void reportsQuery.refetch();
        }}
        emptyMessage={t('reports.noData')}
      >
        <Card>
          <CardContent className="p-0 pt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('reports.colDate')}</TableHead>
                  <TableHead>{t('reports.colFlow')}</TableHead>
                  <TableHead>{t('reports.colHeatTime')}</TableHead>
                  <TableHead>{t('reports.colConfidence')}</TableHead>
                  <TableHead>{t('reports.colDetails')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recommendations.map((record) => {
                  const expanded = expandedId === record.id;
                  return (
                    <Fragment key={record.id}>
                      <TableRow>
                        <TableCell>
                          {new Date(record.date).toLocaleDateString()}
                        </TableCell>
                        <TableCell>{record.recommendedFlowTemp.toFixed(1)}°C</TableCell>
                        {/*
                          Backend još ne računa očekivano vrijeme dogrijavanja
                          i u zapis upisuje `0` (`daily-record.writer.ts`).
                          „0 min" bi izgledalo kao mjerenje, pa se nula
                          prikazuje kao „—". Kad motor bude davao procjenu, ovdje
                          se vraća broj bez promjene prikaza.
                        */}
                        <TableCell>
                          {record.expectedHeatTimeMin > 0
                            ? `${record.expectedHeatTimeMin.toFixed(0)} min`
                            : '—'}
                        </TableCell>
                        <TableCell>
                          {Math.round(record.confidenceScore * 100)}%
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setExpandedId((current) =>
                                current === record.id ? null : record.id,
                              )
                            }
                            aria-expanded={expanded}
                          >
                            {expanded
                              ? t('reports.hideDetails')
                              : t('reports.showDetails')}
                          </Button>
                        </TableCell>
                      </TableRow>
                      {expanded && record.breakdown ? (
                        <TableRow>
                          <TableCell colSpan={5}>
                            <RecommendationBreakdown
                              breakdown={record.breakdown}
                              title={`${t('reports.title')} — ${new Date(record.date).toLocaleDateString()}`}
                            />
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </QueryState>
      {hasMoreRecommendations ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-text-secondary">
            {t('common.showingOf', {
              shown: recommendations.length,
              total: recommendationsTotal,
            })}
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => setPageSize((size) => Math.min(size + 50, 200))}
            disabled={reportsQuery.isFetching}
          >
            {t('common.loadMore')}
          </Button>
        </div>
      ) : null}
    </div>
  );
};

ReportsPage.displayName = 'ReportsPage';
