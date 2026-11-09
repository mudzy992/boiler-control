import { useMemo, useState, type JSX } from 'react';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { StatusBanner } from '@/shared/components/status-banner';
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
import { GasAnalyticsMetrics } from '../components/gas-analytics-metrics';
import { GasAnalyticsPeriodBar } from '../components/gas-analytics-period-bar';
import { useGasAnalysisQuery, useGasReadingsQuery } from '../hooks/useGasQueries';

export const GasAnalyticsPage = (): JSX.Element => {
  const { t } = useTranslation();
  const [periodDays, setPeriodDays] = useState(30);
  const [useDefaultReferenceRange, setUseDefaultReferenceRange] = useState(true);
  const dateRange = useMemo(() => {
    const endDate = dayjs();
    return {
      from: endDate.subtract(periodDays, 'days').format('YYYY-MM-DD'),
      to: endDate.format('YYYY-MM-DD'),
    };
  }, [periodDays]);

  const analysisQuery = useGasAnalysisQuery({
    useDefaultReferenceRange,
    from: dateRange.from,
    to: dateRange.to,
  });
  const readingsQuery = useGasReadingsQuery();
  const analysisData = (analysisQuery.data ?? {}) as Record<string, unknown>;
  const readings = readingsQuery.data?.rows ?? [];
  /*
   * Analiza se računa na dohvaćenim očitanjima. Ako ih je na serveru više od
   * gornje granice jednog zahtjeva (500), to se mora reći — inače graf tvrdi
   * nešto o periodu koji nije učitan.
   */
  const readingsTotal = readingsQuery.data?.total ?? 0;
  const readingsTruncated = readingsTotal > readings.length;
  const period = analysisData.period as
    | { startDate?: string; endDate?: string; from?: string; to?: string; mode?: string }
    | undefined;
  const referenceReading = analysisData.referenceReading as
    | { readingDate?: string; counterValue?: number }
    | undefined;
  const priceBreakdown = (analysisData.priceBreakdown as Array<Record<string, unknown>>) ?? [];

  const status = analysisQuery.isLoading
    ? 'loading'
    : analysisQuery.isError
      ? 'error'
      : readings.length === 0
        ? 'empty'
        : 'success';

  const periodModeLabel =
    period?.mode === 'reference_to_current'
      ? t('gas.analysisModeReference')
      : period?.mode === 'last_30_days'
        ? t('gas.analysisModeLast30')
        : t('gas.analysisModeExplicit');

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('gas.analyticsPageTitle')}
        description={t('gas.analyticsPageSubtitle')}
      />
      {readingsTruncated ? (
        <StatusBanner
          variant="warning"
          message={t('common.showingOf', {
            shown: readings.length,
            total: readingsTotal,
          })}
        />
      ) : null}
      <GasAnalyticsPeriodBar
        periodDays={periodDays}
        useDefaultReferenceRange={useDefaultReferenceRange}
        onSelectReference={() => setUseDefaultReferenceRange(true)}
        onSelectDays={(days) => {
          setUseDefaultReferenceRange(false);
          setPeriodDays(days);
        }}
      />
      <Card>
        <CardContent className="space-y-1 pt-4 text-sm sm:pt-5">
          <p className="font-medium">{periodModeLabel}</p>
          <p className="text-muted-foreground">
            {(period?.startDate || period?.from
              ? dayjs(period.startDate ?? period.from).format('DD.MM.YYYY')
              : '—')}{' '}
            -{' '}
            {(period?.endDate || period?.to
              ? dayjs(period.endDate ?? period.to).format('DD.MM.YYYY')
              : '—')}
          </p>
          {referenceReading ? (
            <p className="text-muted-foreground">
              {t('gas.analysisReferenceReading')}:{' '}
              {dayjs(referenceReading.readingDate).format('DD.MM.YYYY')} (
              {Number(referenceReading.counterValue ?? 0).toFixed(2)} m³)
            </p>
          ) : null}
        </CardContent>
      </Card>
      <QueryState
        status={status}
        errorMessage={`${t('gas.loadAnalyticsError')} ${t('gas.loadAnalyticsErrorDesc')}`}
        emptyMessage={t('gas.noReadingsYet')}
        onRetry={() => {
          void analysisQuery.refetch();
          void readingsQuery.refetch();
        }}
      >
        <div className="space-y-6">
          <GasAnalyticsMetrics analysisData={analysisData} />
          {priceBreakdown.length > 0 ? (
            <Card>
              <CardContent className="p-0 pt-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('gas.priceExVat')}</TableHead>
                      <TableHead>{t('gas.source')}</TableHead>
                      <TableHead>{t('gas.effective')}</TableHead>
                      <TableHead>{t('gas.consumption')}</TableHead>
                      <TableHead>{t('gas.costExVat')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {priceBreakdown.map((row, idx) => (
                      <TableRow key={`${String(row.priceExVat)}-${idx}`}>
                        <TableCell>{Number(row.priceExVat ?? 0).toFixed(4)}</TableCell>
                        <TableCell>{String(row.source || 'MANUAL').toUpperCase()}</TableCell>
                        <TableCell>
                          {row.effectiveFrom
                            ? dayjs(String(row.effectiveFrom)).format('DD.MM.YYYY')
                            : '—'}{' '}
                          -{' '}
                          {row.effectiveTo
                            ? dayjs(String(row.effectiveTo)).format('DD.MM.YYYY')
                            : t('gas.priceCurrent')}
                        </TableCell>
                        <TableCell>{Number(row.consumptionM3 ?? 0).toFixed(2)} m³</TableCell>
                        <TableCell>{Number(row.costExVat ?? 0).toFixed(2)} KM</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </QueryState>
    </div>
  );
};

GasAnalyticsPage.displayName = 'GasAnalyticsPage';
